import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { offerQueueRoutes } from '../../../src/api/routes/offerQueue.js'

function buildApp({ plan = 'basic', accessExpiresAt = null, db = {} } = {}) {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: 'user-1' } })
  const dbMock = {
    user: { findUnique: async () => ({ plan, accessExpiresAt }) },
    group: { findMany: async () => [{ waJid: '123@g.us' }] },
    offerQueue: {
      findMany: async () => [{ id: 'q1', userId: 'user-1', name: 'Fila', enabled: true, targetJids: '[]', createdAt: new Date() }],
      findFirst: async () => ({ id: 'q1', userId: 'user-1', name: 'Fila', enabled: true, targetJids: '[]' }),
      create: async ({ data }) => ({ id: 'new-queue', ...data }),
      updateMany: async () => ({ count: 1 }),
      deleteMany: async () => ({ count: 1 }),
    },
    offerQueueItem: {
      count: async () => 0,
      findMany: async () => [],
      findFirst: async () => null,
      create: async ({ data }) => ({ id: 'new-item', ...data }),
      updateMany: async () => ({ count: 1 }),
    },
    ...db,
  }
  app.register(offerQueueRoutes, { prefix: '/api/offer-queues', db: dbMock })
  return app
}

function assertGateError(res) {
  assert.equal(res.statusCode, 403)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'FEATURE_REQUIRES_PRO')
  assert.equal(body.feature, 'offer_queues')
  assert.equal(body.requiredPlan, 'pro')
}

test('POST / bloqueia criação de fila para Basic', async () => {
  const app = buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'POST', url: '/api/offer-queues', payload: { name: 'Fila nova' } })
  assertGateError(res)
  await app.close()
})

test('PUT /:id bloqueia edição de fila para Basic', async () => {
  const app = buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'PUT', url: '/api/offer-queues/q1', payload: { enabled: false } })
  assertGateError(res)
  await app.close()
})

test('POST /:id/items bloqueia novo item para Basic', async () => {
  const app = buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'POST', url: '/api/offer-queues/q1/items', payload: { text: 'Oferta', jids: ['123@g.us'] } })
  assertGateError(res)
  await app.close()
})

test('GET / segue liberado para Basic (UI lista o que existe)', async () => {
  const app = buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'GET', url: '/api/offer-queues' })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body)[0].id, 'q1')
  await app.close()
})

test('DELETE /:id segue liberado para Basic (limpeza sem plano)', async () => {
  const app = buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'DELETE', url: '/api/offer-queues/q1' })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).ok, true)
  await app.close()
})

test('GET /:id/items segue liberado para Basic', async () => {
  const app = buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'GET', url: '/api/offer-queues/q1/items' })
  assert.equal(res.statusCode, 200)
  await app.close()
})

test('POST / aceita criação para Pro', async () => {
  const app = buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'POST', url: '/api/offer-queues', payload: { name: 'Fila nova' } })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).id, 'new-queue')
  await app.close()
})

test('POST / aceita criação para Trial ativo', async () => {
  const app = buildApp({ plan: 'trial', accessExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })
  const res = await app.inject({ method: 'POST', url: '/api/offer-queues', payload: { name: 'Fila nova' } })
  assert.equal(res.statusCode, 200)
  await app.close()
})

test('POST / bloqueia criação para Trial expirado', async () => {
  const app = buildApp({ plan: 'trial', accessExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) })
  const res = await app.inject({ method: 'POST', url: '/api/offer-queues', payload: { name: 'Fila nova' } })
  assertGateError(res)
  await app.close()
})
