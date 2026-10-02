import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Fastify from 'fastify'
import { deliveryNetworksRoutes } from '../src/api/routes/deliveryNetworks.js'
import { __resetCacheForTests } from '../src/billing/plans.js'

// Feature 017, Fatia 3 (T045/T047/T058): rotas e tela Aplicativos.

const FUTURE = new Date(Date.now() + 30 * 86400_000)

function fakeDb(plan) {
  const links = []
  return {
    links,
    user: { findUnique: async () => ({ plan, accessExpiresAt: FUTURE }) },
    deliveryNetworkLink: {
      findUnique: async ({ where }) => links.find((l) => l.userId === where.userId_deliveryNetwork?.userId) ?? null,
      create: async ({ data }) => { const l = { id: 'l1', disabledAt: null, ...data }; links.push(l); return l },
      update: async ({ where, data }) => { const l = links.find((x) => x.id === where.id); Object.assign(l, data); return l },
    },
  }
}

async function make(plan, runtime) {
  __resetCacheForTests()
  const app = Fastify()
  app.decorate('authenticate', async (req) => { req.user = { sub: 'u1' } })
  const db = fakeDb(plan)
  await app.register(deliveryNetworksRoutes, { db, env: { DELIVERY_NETWORKS_ENABLED: 'whatsapp,telegram' }, getTelegramRuntime: () => runtime })
  return { app, db }
}

const runtime = (destinos = []) => ({
  adapter: {
    botUsername: async () => 'EspelhaGruposBot',
    readiness: async () => (destinos.some((d) => d.pronto) ? { pronto: true, motivo: null } : { pronto: false, motivo: 'robo_nao_adicionado' }),
    listDestinations: async () => destinos,
  },
})

test('sem Premium: 403 com explicação e caminho para o plano (nunca "seu plano não permite")', async () => {
  for (const plan of ['basic', 'pro', 'trial']) {
    const { app } = await make(plan, runtime())
    for (const url of ['/telegram/status', '/telegram/destinations']) {
      const res = await app.inject({ url })
      assert.equal(res.statusCode, 403, `${plan} ${url}`)
      assert.equal(res.json().upgradePath, '/painel/plano')
      assert.doesNotMatch(res.json().error, /não permite/i)
    }
    assert.equal((await app.inject({ method: 'POST', url: '/telegram/disable' })).statusCode, 403)
    await app.close()
  }
})

test('robô não ligado no servidor: "indisponível", não erro', async () => {
  const { app } = await make('premium', null)
  const res = await app.inject({ url: '/telegram/status' })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().disponivel, false)
  await app.close()
})

test('Premium: link de um toque com o código da conta, e lista vazia explicada', async () => {
  const { app, db } = await make('premium', runtime())
  const status = (await app.inject({ url: '/telegram/status' })).json()
  assert.equal(status.disponivel, true)
  assert.equal(status.pronto, false)
  assert.equal(status.linkAdicionar, `https://t.me/EspelhaGruposBot?startgroup=${db.links[0].linkCode}&admin=post_messages`)
  assert.ok(status.texto)
  const dest = (await app.inject({ url: '/telegram/destinations' })).json()
  assert.deepEqual(dest.destinos, [])
  assert.ok(dest.texto)
  await app.close()
})

test('destinos com estado e texto leigo; desligar e ligar não apaga nada', async () => {
  const { app, db } = await make('premium', runtime([
    { groupId: 'g1', nome: 'Ofertas', pronto: true, motivo: null },
    { groupId: 'g2', nome: 'Outro', pronto: false, motivo: 'sem_permissao' },
  ]))
  const dest = (await app.inject({ url: '/telegram/destinations' })).json()
  assert.equal(dest.destinos[1].pronto, false)
  assert.match(dest.destinos[1].texto, /administrador/)
  await app.inject({ method: 'POST', url: '/telegram/disable' })
  assert.ok(db.links[0].disabledAt)
  const off = (await app.inject({ url: '/telegram/status' })).json()
  assert.equal(off.desligado, true)
  assert.equal(off.pronto, false)
  await app.inject({ method: 'POST', url: '/telegram/enable' })
  assert.equal(db.links[0].disabledAt, null)
  await app.close()
})

test('nenhuma resposta carrega termo travado', async () => {
  const { app } = await make('premium', runtime([{ groupId: 'g2', nome: 'Outro', pronto: false, motivo: 'sem_permissao' }]))
  for (const url of ['/', '/telegram/status', '/telegram/destinations']) {
    const body = (await app.inject({ url })).body
    assert.doesNotMatch(body, /\b(canal|plataforma|adaptador|webhook|token|chat_id|Bot API)\b/i, url)
  }
  await app.close()
})

test('tela Aplicativos: no menu, passo a passo leigo, sem campo para digitar', () => {
  const nav = readFileSync(new URL('../dashboard/app/painel/nav.js', import.meta.url), 'utf8')
  assert.match(nav, /href: '\/painel\/aplicativos'/)
  const page = readFileSync(new URL('../dashboard/app/painel/aplicativos/AppsPanel.js', import.meta.url), 'utf8')
  assert.match(page, /Adicionar o robô a um grupo/)
  assert.match(page, /robô do Espelha Grupos/)
  assert.match(page, /\/painel\/plano/)
  assert.match(page, /nada foi apagado/)
  assert.doesNotMatch(page, /<input|<textarea|BOTinho/)
})
