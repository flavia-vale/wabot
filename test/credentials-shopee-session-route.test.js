// GET /credentials/shopee/session e a sondagem no save.
//
// RCA ago/2026: o painel só conferia o FORMATO dos campos da Shopee, então uma
// conta com a chave recusada (`error [10020]: Invalid Signature`) aparecia em
// VERDE enquanto 100% das ofertas da loja eram descartadas e as automações
// ficavam paradas. Estes testes guardam a sondagem que fechou esse buraco.
//
// Sem rede e sem banco: a sondagem e o db são injetados.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { credentialsRoutes } from '../src/api/routes/credentials.js'

let userCounter = 0

function nextUserId() {
  return `shopee-session-route-user-${++userCounter}-${Date.now()}`
}

function fakeDb(initialCred) {
  let cred = initialCred
  return {
    credential: {
      findUnique: async () => cred,
      update: async ({ data }) => { cred = { ...cred, ...data }; return cred },
      upsert: async ({ create, update }) => { cred = cred ? { ...cred, ...update } : { ...create }; return cred },
    },
  }
}

async function buildApp({ userId, db, checkShopeeSession }) {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(credentialsRoutes, {
    db,
    checkShopeeSession,
    reloadConfig: async () => true,
    getBotMetrics: async () => null,
    restartStaleWorker: async () => ({ attempted: false, reason: 'test' }),
  })
  return app
}

const credRow = (data = { appId: '18360000001', secretKey: 'k'.repeat(32) }) => ({
  userId: 'x',
  platform: 'shopee',
  data: JSON.stringify(data),
})

test('GET /shopee/session devolve chave recusada quando a Shopee não aceita', async () => {
  const app = await buildApp({
    userId: nextUserId(),
    db: fakeDb(credRow()),
    checkShopeeSession: async () => ({ configured: true, alive: false, reason: 'rejected' }),
  })
  const res = await app.inject({ method: 'GET', url: '/shopee/session' })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.alive, false)
  assert.equal(body.reason, 'rejected')
  assert.ok(body.checkedAt, 'a resposta diz quando foi checado')
  await app.close()
})

test('GET /shopee/session: sem credencial cadastrada não sonda nem alarma', async () => {
  let probes = 0
  const app = await buildApp({
    userId: nextUserId(),
    db: fakeDb(null),
    checkShopeeSession: async () => { probes += 1; return { configured: true, alive: false } },
  })
  const body = (await app.inject({ method: 'GET', url: '/shopee/session' })).json()
  assert.deepEqual(body, { configured: false, alive: null, reason: 'not_configured' })
  assert.equal(probes, 0)
  await app.close()
})

test('GET /shopee/session: falha da loja fica indeterminada (nunca vira "chave morta")', async () => {
  const app = await buildApp({
    userId: nextUserId(),
    db: fakeDb(credRow()),
    checkShopeeSession: async () => ({ configured: true, alive: null, reason: 'network_error' }),
  })
  const body = (await app.inject({ method: 'GET', url: '/shopee/session' })).json()
  assert.equal(body.alive, null)
  await app.close()
})

test('GET /shopee/session sonda toda vez (não há cache — a chamada não gasta sessão)', async () => {
  let probes = 0
  const app = await buildApp({
    userId: nextUserId(),
    db: fakeDb(credRow()),
    checkShopeeSession: async () => { probes += 1; return { configured: true, alive: true, reason: 'ok' } },
  })
  await app.inject({ method: 'GET', url: '/shopee/session' })
  await app.inject({ method: 'GET', url: '/shopee/session' })
  assert.equal(probes, 2)
  await app.close()
})

test('PUT /shopee testa a chave na hora de salvar e responde em vermelho quando recusada', async () => {
  const app = await buildApp({
    userId: nextUserId(),
    db: fakeDb(null),
    checkShopeeSession: async () => ({ configured: true, alive: false, reason: 'rejected' }),
  })
  const res = await app.inject({
    method: 'PUT',
    url: '/shopee',
    payload: { appId: '18360000001', secretKey: 'k'.repeat(32) },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.sessionCheck.alive, false)
  assert.equal(body.messageTone, 'error')
  assert.match(body.message, /param de sair/i)
  // O texto do ML/Amazon ("continua saindo, só o link fica mais comprido") seria
  // mentira aqui — na Shopee nada é publicado sem chave aceita.
  assert.doesNotMatch(body.message, /continuam saindo|mais comprido/i)
  await app.close()
})

test('PUT /shopee com chave aceita responde em verde', async () => {
  const app = await buildApp({
    userId: nextUserId(),
    db: fakeDb(null),
    checkShopeeSession: async () => ({ configured: true, alive: true, reason: 'ok' }),
  })
  const body = (await app.inject({
    method: 'PUT',
    url: '/shopee',
    payload: { appId: '18360000001', secretKey: 'k'.repeat(32) },
  })).json()
  assert.equal(body.messageTone, 'success')
  assert.match(body.message, /Testamos agora/i)
  await app.close()
})

test('PUT /shopee com campo faltando nem chega a sondar', async () => {
  let probes = 0
  const app = await buildApp({
    userId: nextUserId(),
    db: fakeDb(null),
    checkShopeeSession: async () => { probes += 1; return { configured: true, alive: false } },
  })
  const res = await app.inject({ method: 'PUT', url: '/shopee', payload: { appId: '18360000001', secretKey: '' } })
  assert.equal(res.statusCode, 400)
  assert.equal(probes, 0)
  await app.close()
})
