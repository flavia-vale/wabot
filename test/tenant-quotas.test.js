import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { QUOTAS, checkBroadcastRate, _resetBroadcastHistory } from '../src/api/quotas.js'
import { broadcastRoutes } from '../src/api/routes/broadcast.js'
import { offerAutomationRoutes } from '../src/api/routes/offerAutomation.js'

function buildBroadcastApp(db) {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: 'u1' } })
  app.register(broadcastRoutes, {
    prefix: '/api/broadcast',
    db,
    isRunning: async () => true,
    sendBroadcast: async () => ({ ok: true }),
  })
  return app
}

function baseDb(overrides = {}) {
  return {
    group: { findMany: async () => [{ waJid: 'meu@g.us' }] },
    user: { findUnique: async () => ({ plan: 'pro', accessExpiresAt: null }) },
    scheduledMessage: { count: async () => 0, create: async ({ data }) => ({ id: 's1', ...data }) },
    ...overrides,
  }
}

test('checkBroadcastRate: bloqueia acima do limite por minuto com retryAfter', () => {
  _resetBroadcastHistory()
  const t0 = 1_000_000
  for (let i = 0; i < QUOTAS.broadcastsPerMinute; i++) {
    assert.equal(checkBroadcastRate('u1', t0 + i * 100).allowed, true)
  }
  const blocked = checkBroadcastRate('u1', t0 + 5_000)
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.scope, 'minute')
  assert.ok(blocked.retryAfterSec >= 1)
  // outro tenant não é afetado
  assert.equal(checkBroadcastRate('u2', t0 + 5_000).allowed, true)
  _resetBroadcastHistory()
})

test('checkBroadcastRate: janela desliza — libera após 1 minuto', () => {
  _resetBroadcastHistory()
  const t0 = 2_000_000
  for (let i = 0; i < QUOTAS.broadcastsPerMinute; i++) checkBroadcastRate('u1', t0)
  assert.equal(checkBroadcastRate('u1', t0 + 61_000).allowed, true)
  _resetBroadcastHistory()
})

test('POST /api/broadcast/send responde 429 + Retry-After ao estourar a taxa', async () => {
  _resetBroadcastHistory()
  const app = buildBroadcastApp(baseDb())
  let lastRes = null
  for (let i = 0; i <= QUOTAS.broadcastsPerMinute; i++) {
    lastRes = await app.inject({ method: 'POST', url: '/api/broadcast/send', payload: { text: 'oferta', jids: ['meu@g.us'] } })
  }
  assert.equal(lastRes.statusCode, 429)
  assert.ok(Number(lastRes.headers['retry-after']) >= 1, 'Retry-After presente')
  _resetBroadcastHistory()
})

test('POST /api/broadcast/scheduled respeita teto de agendamentos pendentes', async () => {
  _resetBroadcastHistory()
  const db = baseDb({
    scheduledMessage: {
      count: async () => QUOTAS.pendingScheduledPerUser,
      create: async () => { throw new Error('não deve criar acima da quota') },
    },
  })
  const app = buildBroadcastApp(db)
  const res = await app.inject({
    method: 'POST',
    url: '/api/broadcast/scheduled',
    payload: { text: 'oferta', scheduledAt: new Date(Date.now() + 3_600_000).toISOString(), jids: ['meu@g.us'] },
  })
  assert.equal(res.statusCode, 400)
  assert.match(JSON.parse(res.body).error, /Limite atingido/)
  _resetBroadcastHistory()
})

test('POST /api/offer-automations respeita teto de automações por tenant', async () => {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: 'u1' } })
  const db = {
    group: { findMany: async () => [{ waJid: 'meu@g.us' }] },
    // feature-gate de ofertas automáticas (plano Pro/Trial ativo)
    user: { findUnique: async () => ({ plan: 'pro', accessExpiresAt: null }) },
    offerAutomation: {
      count: async () => QUOTAS.automationsPerUser,
      create: async () => { throw new Error('não deve criar acima da quota') },
    },
  }
  app.register(offerAutomationRoutes, { prefix: '/api/offer-automations', db })
  const res = await app.inject({
    method: 'POST',
    url: '/api/offer-automations',
    payload: { destGroupJid: 'meu@g.us', keyword: 'promo', intervalMinutes: 60, offersPerSend: 1 },
  })
  assert.equal(res.statusCode, 400)
  assert.match(JSON.parse(res.body).error, /Limite atingido/)
})
