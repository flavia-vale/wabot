import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { offerAutomationRoutes } from '../../../src/api/routes/offerAutomation.js'

function buildApp({ plan = 'basic', accessExpiresAt = null, db = {} } = {}) {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: 'user-1' } })
  const dbMock = {
    user: { findUnique: async () => ({ plan, accessExpiresAt }) },
    group: { findMany: async () => [{ waJid: '123@g.us' }] },
    offerAutomation: {
      findMany: async () => [{ id: 'a1', userId: 'user-1', keyword: 'fone' }],
      findFirst: async () => ({ id: 'a1', userId: 'user-1', intervalMinutes: 60 }),
      create: async ({ data }) => ({ id: 'new-automation', ...data }),
      update: async ({ data }) => ({ id: 'a1', ...data }),
      delete: async () => ({}),
    },
    ...db,
  }
  app.register(offerAutomationRoutes, { prefix: '/api/offer-automations', db: dbMock })
  return app
}

function assertGateError(res) {
  assert.equal(res.statusCode, 403)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'FEATURE_REQUIRES_PRO')
  assert.equal(body.feature, 'offer_automations')
  assert.equal(body.requiredPlan, 'pro')
}

const VALID_CREATE_PAYLOAD = {
  keyword: 'fone',
  destGroupJid: '123@g.us',
  intervalMinutes: 60,
  offersPerSend: 1,
}

test('POST / bloqueia criação de automação para Basic', async () => {
  const app = buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'POST', url: '/api/offer-automations', payload: VALID_CREATE_PAYLOAD })
  assertGateError(res)
  await app.close()
})

test('PUT /:id bloqueia edição de automação para Basic', async () => {
  const app = buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'PUT', url: '/api/offer-automations/a1', payload: { enabled: false } })
  assertGateError(res)
  await app.close()
})

test('POST /:id/trigger bloqueia execução manual para Basic', async () => {
  const app = buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'POST', url: '/api/offer-automations/a1/trigger' })
  assertGateError(res)
  await app.close()
})

test('POST /search-preview bloqueia prévia de busca para Basic', async () => {
  const app = buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'POST', url: '/api/offer-automations/search-preview', payload: { keyword: 'fone' } })
  assertGateError(res)
  await app.close()
})

test('GET / segue liberado para Basic (UI lista o que existe)', async () => {
  const app = buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'GET', url: '/api/offer-automations' })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body)[0].id, 'a1')
  await app.close()
})

test('DELETE /:id segue liberado para Basic (limpeza sem plano)', async () => {
  const app = buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'DELETE', url: '/api/offer-automations/a1' })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).ok, true)
  await app.close()
})

test('POST / aceita criação para Pro', async () => {
  const app = buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'POST', url: '/api/offer-automations', payload: VALID_CREATE_PAYLOAD })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).id, 'new-automation')
  await app.close()
})

test('POST / aceita criação para Trial ativo', async () => {
  const app = buildApp({ plan: 'trial', accessExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })
  const res = await app.inject({ method: 'POST', url: '/api/offer-automations', payload: VALID_CREATE_PAYLOAD })
  assert.equal(res.statusCode, 200)
  await app.close()
})

test('POST / bloqueia criação para Trial expirado', async () => {
  const app = buildApp({ plan: 'trial', accessExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) })
  const res = await app.inject({ method: 'POST', url: '/api/offer-automations', payload: VALID_CREATE_PAYLOAD })
  assertGateError(res)
  await app.close()
})
