import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { deliveryNetworksRoutes } from '../src/api/routes/deliveryNetworks.js'
import { __resetCacheForTests } from '../src/billing/plans.js'

// Feature 017, T035 (FR-034/US9): a lista de aplicativos nunca oferece o
// Instagram para escolha (ele tem tela própria, decisão T001), não esconde
// nada por plano e não usa nenhum termo travado em
// contracts/telegram-surface.md.

const FUTURE = new Date(Date.now() + 30 * 86400_000)

async function make(user, env = {}) {
  __resetCacheForTests()
  const app = Fastify()
  app.decorate('authenticate', async (req) => { req.user = { sub: 'u1' } })
  const db = { user: { findUnique: async () => user } }
  await app.register(deliveryNetworksRoutes, { db, env })
  const res = await app.inject({ url: '/' })
  await app.close()
  return res
}

const byId = (body) => Object.fromEntries(body.aplicativos.map((a) => [a.id, a]))

test('Instagram nunca é selecionável, em nenhum plano ou interruptor', async () => {
  for (const plan of ['basic', 'pro', 'premium']) {
    const res = await make({ plan, accessExpiresAt: FUTURE }, { DELIVERY_NETWORKS_ENABLED: 'whatsapp,telegram,instagram' })
    assert.equal(res.statusCode, 200)
    const ig = byId(res.json()).instagram
    assert.equal(ig.selecionavel, false)
    assert.equal(ig.status, 'tela_propria')
  }
})

test('o plano não esconde aplicativo: todos aparecem para o Basic', async () => {
  const res = await make({ plan: 'basic', accessExpiresAt: FUTURE })
  const apps = byId(res.json())
  assert.deepEqual(Object.keys(apps).sort(), ['instagram', 'telegram', 'whatsapp'])
  assert.equal(apps.whatsapp.selecionavel, true)
  assert.equal(apps.telegram.selecionavel, false)
  assert.equal(apps.telegram.liberadoNoPlano, false)
})

test('Telegram fica "em breve" enquanto não entrega por este caminho', async () => {
  const res = await make({ plan: 'premium', accessExpiresAt: FUTURE }, { DELIVERY_NETWORKS_ENABLED: 'whatsapp,telegram' })
  const tg = byId(res.json()).telegram
  assert.equal(tg.liberadoNoPlano, true)
  if (tg.capacidades === null) {
    assert.equal(tg.status, 'em_breve')
    assert.equal(tg.selecionavel, false)
  }
})

test('com o interruptor no padrão, só o WhatsApp é selecionável', async () => {
  const res = await make({ plan: 'premium', accessExpiresAt: FUTURE }, {})
  const apps = res.json().aplicativos.filter((a) => a.selecionavel).map((a) => a.id)
  assert.deepEqual(apps, ['whatsapp'])
})

test('nenhuma resposta usa termo travado', async () => {
  const res = await make({ plan: 'premium', accessExpiresAt: FUTURE }, { DELIVERY_NETWORKS_ENABLED: 'whatsapp,telegram' })
  assert.doesNotMatch(res.body, /\b(canal|plataforma|rede de entrega|adaptador|driver|transporte|Bot API|Graph API|webhook|token|chat_id)\b/i)
})
