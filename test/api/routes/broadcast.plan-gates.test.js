import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../../../src/db.js'
import { broadcastRoutes } from '../../../src/api/routes/broadcast.js'

let userCounter = 0

async function buildApp({ plan = 'basic', accessExpiresAt = null, isRunning = () => true, sendBroadcast = async (_uid, _text, targetJids) => ({ ok: true, targetJids }) } = {}) {
  const n = ++userCounter
  const userId = `broadcast-user-${n}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({
    data: {
      id: userId,
      name: `Broadcast User ${n}`,
      email: `broadcast-user-${n}-${Date.now()}@tests.local`,
      passwordHash: 'x',
      plan,
      accessExpiresAt,
    },
  })

  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(broadcastRoutes, {
    prefix: '/api/broadcast',
    isRunning,
    sendBroadcast,
  })

  app.addHook('onClose', async () => {
    await db.scheduledMessage.deleteMany({ where: { userId } })
    await db.group.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
  })

  return { app, userId }
}

test('POST /send bloqueia canal para Basic', async () => {
  const { app } = await buildApp({ plan: 'basic' })
  const res = await app.inject({
    method: 'POST',
    url: '/api/broadcast/send',
    payload: { text: 'Teste', jids: ['canal@newsletter'] },
  })

  assert.equal(res.statusCode, 403)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'FEATURE_REQUIRES_PRO')
  assert.equal(body.feature, 'channels')
  await app.close()
})

test('POST /scheduled bloqueia canal para Basic', async () => {
  const { app } = await buildApp({ plan: 'basic' })
  const scheduledAt = new Date(Date.now() + 60_000).toISOString()
  const res = await app.inject({
    method: 'POST',
    url: '/api/broadcast/scheduled',
    payload: { text: 'Teste', scheduledAt, jids: ['canal@newsletter'] },
  })

  assert.equal(res.statusCode, 403)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'FEATURE_REQUIRES_PRO')
  await app.close()
})

test('POST /scheduled aceita canal para Pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const scheduledAt = new Date(Date.now() + 60_000).toISOString()
  const res = await app.inject({
    method: 'POST',
    url: '/api/broadcast/scheduled',
    payload: { text: 'Teste Pro', scheduledAt, jids: ['canal-pro@newsletter'] },
  })

  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(JSON.parse(body.targetJids)[0], 'canal-pro@newsletter')
  await app.close()
})


test('POST /send aguarda status assíncrono do supervisor remoto', async () => {
  let sends = 0
  const { app } = await buildApp({
    plan: 'pro',
    isRunning: async () => false,
    sendBroadcast: async () => { sends += 1 },
  })

  const res = await app.inject({
    method: 'POST',
    url: '/api/broadcast/send',
    payload: { text: 'Teste remoto', jids: ['grupo@g.us'] },
  })

  assert.equal(res.statusCode, 400)
  assert.equal(res.json().error, 'Bot não está conectado')
  assert.equal(sends, 0)
  await app.close()
})
