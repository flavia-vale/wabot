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
  const userId = `pres-cfg-${n}-${Date.now()}`
  await db.user.create({
    data: {
      id: userId,
      name: `PresCfg ${n}`,
      email: `pres-cfg-${n}-${Date.now()}@test.local`,
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
    await db.user.deleteMany({ where: { id: userId } })
  })
  return { app, userId }
}

// 1. GET /config retorna 402 para usuário basic
test('GET /config retorna 402 com FEATURE_REQUIRES_PRO para basic', async () => {
  const { app } = await buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/config' })
  assert.equal(res.statusCode, 402)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'FEATURE_REQUIRES_PRO')
  assert.equal(body.feature, 'advanced_preservation')
  await app.close()
})

// 2. GET /config retorna 200 com config + flags para usuário pro
test('GET /config retorna 200 com config e flags para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/config' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok('config' in body, 'deve ter campo config')
  assert.ok('flags' in body, 'deve ter campo flags')
  assert.ok('clickTrackerSaltConfigured' in body.flags)
  await app.close()
})

// 3. PUT /config retorna 402 para basic
test('PUT /config retorna 402 para basic', async () => {
  const { app } = await buildApp({ plan: 'basic' })
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { channelMinIntervalSec: 10 },
  })
  assert.equal(res.statusCode, 402)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'FEATURE_REQUIRES_PRO')
  await app.close()
})

// 4. PUT /config atualiza campos para pro
test('PUT /config atualiza channelMinIntervalSec para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { channelMinIntervalSec: 30 },
  })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok('config' in body)
  assert.equal(body.config.channelMinIntervalSec, 30)
  await app.close()
})

// 5a. PUT /config retorna 400 para channelMinIntervalSec negativo
test('PUT /config retorna 400 para channelMinIntervalSec inválido (negativo)', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { channelMinIntervalSec: -1 },
  })
  assert.equal(res.statusCode, 400)
  const body = JSON.parse(res.body)
  assert.ok(body.errors && body.errors.length > 0, 'deve retornar array de erros')
  await app.close()
})

// 5b. PUT /config retorna 400 para imageMutationEnabled como string
test('PUT /config retorna 400 para imageMutationEnabled como string', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { imageMutationEnabled: 'true' },
  })
  assert.equal(res.statusCode, 400)
  const body = JSON.parse(res.body)
  assert.ok(body.errors && body.errors.length > 0)
  await app.close()
})

// 6. PUT /config aceita channelDailyCap: null
test('PUT /config aceita channelDailyCap null para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  // First set a value, then null it out
  await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { channelDailyCap: 100 },
  })
  __resetCacheForTests()
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { channelDailyCap: null },
  })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.config.channelDailyCap, null)
  await app.close()
})
