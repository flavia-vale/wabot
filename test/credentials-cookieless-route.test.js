import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { credentialsRoutes } from '../src/api/routes/credentials.js'
import { parseCredentialData } from '../src/credentialHealth.js'

let userCounter = 0
function nextUserId() {
  return `cookieless-route-user-${++userCounter}-${Date.now()}`
}

function fakeDb(initialCred) {
  let cred = initialCred
  const calls = { delete: 0, upsert: 0 }
  return {
    calls,
    current: () => cred,
    credential: {
      findUnique: async () => cred,
      update: async ({ data }) => { cred = { ...cred, ...data }; return cred },
      upsert: async ({ create, update }) => {
        calls.upsert++
        cred = cred ? { ...cred, ...update } : { ...create }
        return cred
      },
      delete: async () => {
        calls.delete++
        if (!cred) {
          const err = new Error('Record to delete does not exist.')
          err.code = 'P2025'
          throw err
        }
        cred = null
        return { id: 1 }
      },
    },
  }
}

function fakeProbeCache() {
  const store = new Map()
  return {
    getCachedProbe: (userId) => store.get(userId) ?? null,
    setCachedProbe: (userId, result) => { store.set(userId, result) },
    invalidateCachedProbe: (userId) => { store.delete(userId) },
    has: (userId) => store.has(userId),
  }
}

async function buildApp({ userId, db, checkMercadoLivreSession, checkAmazonSession, mlCache = fakeProbeCache(), amazonCache = fakeProbeCache(), reloadConfig }) {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(credentialsRoutes, {
    db,
    checkMercadoLivreSession: checkMercadoLivreSession ?? (async () => { throw new Error('não deveria sondar o ML') }),
    checkAmazonSession: checkAmazonSession ?? (async () => { throw new Error('não deveria sondar a Amazon') }),
    getMlProbeCache: mlCache.getCachedProbe,
    setMlProbeCache: mlCache.setCachedProbe,
    invalidateMlProbeCache: mlCache.invalidateCachedProbe,
    getCachedProbe: amazonCache.getCachedProbe,
    setCachedProbe: amazonCache.setCachedProbe,
    invalidateCachedProbe: amazonCache.invalidateCachedProbe,
    reloadConfig: reloadConfig ?? (async () => true),
    getBotMetrics: async () => null,
    restartStaleWorker: async () => ({ attempted: false, reason: 'test' }),
  })
  return app
}

test('ML no modo sem cookie: não sonda o ML e não alarma "sessão expirada"', async () => {
  const userId = nextUserId()
  const db = fakeDb({ userId, platform: 'mercadolivre', data: JSON.stringify({ tag: '475630078', cookielessMode: true }) })
  let probed = false
  const app = await buildApp({
    userId,
    db,
    checkMercadoLivreSession: async () => { probed = true; return { configured: true, alive: false } },
  })

  const res = await app.inject({ method: 'GET', url: '/mercadolivre/session' })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), { configured: false, alive: null, reason: 'cookieless_mode' })
  assert.equal(probed, false, 'modo sem cookie não pode disparar request autenticado ao ML')
  await app.close()
})

test('Amazon no modo sem cookie: não sonda o SiteStripe', async () => {
  const userId = nextUserId()
  const db = fakeDb({ userId, platform: 'amazon', data: JSON.stringify({ tag: 'fafaciane-20', cookielessMode: true }) })
  let probed = false
  const app = await buildApp({
    userId,
    db,
    checkAmazonSession: async () => { probed = true; return { configured: true, alive: false } },
  })

  const res = await app.inject({ method: 'GET', url: '/amazon/session' })
  assert.deepEqual(res.json(), { configured: false, alive: null, reason: 'cookieless_mode' })
  assert.equal(probed, false)
  await app.close()
})

test('PUT com modo sem cookie não persiste o SSID nem quando ele vem no corpo', async () => {
  const userId = nextUserId()
  const db = fakeDb(null)
  const app = await buildApp({ userId, db })

  const res = await app.inject({
    method: 'PUT',
    url: '/mercadolivre',
    payload: { tag: '475630078', ssid: 'ghy-nao-guarde-isso_-1', cookielessMode: true },
  })

  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.validation.configured, true)
  assert.equal(body.validation.cookielessMode, true)
  assert.equal('ssid' in body.data, false)

  const stored = parseCredentialData(db.current().data)
  assert.equal('ssid' in stored, false, 'o SSID não pode chegar ao banco no modo sem cookie')
  assert.deepEqual(stored, { tag: '475630078', cookielessMode: true })
  await app.close()
})

test('DELETE apaga a credencial, invalida cache de sondagem e recarrega a config do worker', async () => {
  const userId = nextUserId()
  const db = fakeDb({ userId, platform: 'mercadolivre', data: JSON.stringify({ tag: 't', ssid: 'ghy-abc' }) })
  const mlCache = fakeProbeCache()
  mlCache.setCachedProbe(userId, { configured: true, alive: true })
  let reloaded = false
  const app = await buildApp({ userId, db, mlCache, reloadConfig: async () => { reloaded = true; return true } })

  const res = await app.inject({ method: 'DELETE', url: '/mercadolivre' })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().deleted, true)
  assert.equal(db.current(), null)
  assert.equal(mlCache.has(userId), false, 'sondagem antiga não pode sobreviver ao apagamento')
  assert.equal(reloaded, true)
  await app.close()
})

test('DELETE é idempotente: apagar o que não existe responde 200 com deleted:false', async () => {
  const userId = nextUserId()
  const db = fakeDb(null)
  const app = await buildApp({ userId, db })

  const res = await app.inject({ method: 'DELETE', url: '/amazon' })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().deleted, false)
  await app.close()
})

test('DELETE recusa plataforma inválida', async () => {
  const userId = nextUserId()
  const app = await buildApp({ userId, db: fakeDb(null) })
  const res = await app.inject({ method: 'DELETE', url: '/plataforma-inexistente' })
  assert.equal(res.statusCode, 400)
  await app.close()
})
