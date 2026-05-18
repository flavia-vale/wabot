import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../../../src/db.js'
import { configRoutes } from '../../../src/api/routes/config.js'

let userCounter = 0

async function buildApp({ plan = 'basic', accessExpiresAt = null } = {}) {
  const n = ++userCounter
  const userId = `config-user-${n}-${Date.now()}`
  await db.user.create({ data: { id: userId, name: `Cfg ${n}`, email: `cfg-${n}-${Date.now()}@test.local`, passwordHash: 'x', plan, accessExpiresAt } })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(configRoutes, { prefix: '/api/config' })
  app.addHook('onClose', async () => {
    await db.botConfig.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
  })
  return { app, userId }
}

test('PUT / bloqueia feedGlobal=true para Basic', async () => {
  const { app } = await buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'PUT', url: '/api/config', payload: { feedGlobal: true } })
  assert.equal(res.statusCode, 403)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'FEATURE_REQUIRES_PRO')
  assert.equal(body.feature, 'advanced_preservation')
  await app.close()
})

test('PUT / permite feedGlobal=true para Pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'PUT', url: '/api/config', payload: { feedGlobal: true } })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).feedGlobal, true)
  await app.close()
})

test('PUT / permite postToStatus=true para trial ativo', async () => {
  const { app } = await buildApp({ plan: 'trial', accessExpiresAt: new Date(Date.now() + 86400000) })
  const res = await app.inject({ method: 'PUT', url: '/api/config', payload: { postToStatus: true } })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).postToStatus, true)
  await app.close()
})
