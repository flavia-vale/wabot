import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../../../src/db.js'
import { preservationRoutes } from '../../../src/api/routes/preservation.js'
import { __resetCacheForTests } from '../../../src/billing/plans.js'

let userCounter = 0

async function buildApp({ plan = 'basic', accessExpiresAt = null } = {}) {
  __resetCacheForTests()
  const n = ++userCounter
  const userId = `pres-mon-${n}-${Date.now()}`
  await db.user.create({
    data: {
      id: userId,
      name: `PresMon ${n}`,
      email: `pres-mon-${n}-${Date.now()}@test.local`,
      passwordHash: 'x',
      plan,
      accessExpiresAt,
    },
  })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(preservationRoutes, { prefix: '/api/preservation' })
  app.addHook('onClose', async () => {
    __resetCacheForTests()
    await db.botConfig.deleteMany({ where: { userId } })
    await db.followLog.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
  })
  return { app, userId }
}

// 1. GET /monitoring/health retorna 402 para basic, 200 com items para pro
test('GET /monitoring/health retorna 402 para basic', async () => {
  const { app } = await buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/health' })
  assert.equal(res.statusCode, 402)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'FEATURE_REQUIRES_PRO')
  await app.close()
})

test('GET /monitoring/health retorna 200 com items para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/health' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok(Array.isArray(body.items), 'deve retornar campo items como array')
  await app.close()
})

// 2. GET /monitoring/risk-score retorna 200 com items e avgScore para pro
test('GET /monitoring/risk-score retorna 200 com items e avgScore para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/risk-score' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok(Array.isArray(body.items), 'deve ter campo items como array')
  assert.ok('avgScore' in body, 'deve ter campo avgScore')
  await app.close()
})

// 3. GET /monitoring/follows retorna 200 com items para pro
test('GET /monitoring/follows retorna 200 com items para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/follows' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok(Array.isArray(body.items), 'deve ter campo items como array')
  await app.close()
})

// 4. GET /monitoring/snapshots retorna 200 para pro
test('GET /monitoring/snapshots retorna 200 para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/snapshots' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok(Array.isArray(body.items), 'deve ter campo items como array')
  await app.close()
})

// 5. GET /monitoring/probe retorna 200 para pro
test('GET /monitoring/probe retorna 200 para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/probe' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok('enabled' in body, 'deve ter campo enabled')
  assert.ok('items' in body, 'deve ter campo items')
  await app.close()
})

// 6. GET /monitoring/clicks retorna 200 com total e days para pro
test('GET /monitoring/clicks retorna 200 com total e days para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/clicks' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok('total' in body, 'deve ter campo total')
  assert.ok('days' in body, 'deve ter campo days')
  await app.close()
})

// 7. Gating: risk-score também retorna 402 para basic (confirma gating em toda área monitoring)
test('GET /monitoring/risk-score retorna 402 para basic', async () => {
  const { app } = await buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/risk-score' })
  assert.equal(res.statusCode, 402)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'FEATURE_REQUIRES_PRO')
  await app.close()
})
