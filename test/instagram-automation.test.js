import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { runAutomation } from '../src/offerAutomation/dispatcher.js'
import { offerAutomationRoutes } from '../src/api/routes/offerAutomation.js'

function automationDb() {
  const updates = []
  return {
    updates,
    credential: { findUnique: async () => ({ data: JSON.stringify({ appId: 'app', secretKey: 'secret' }) }) },
    offerAutomationSentLog: { findMany: async () => [], createMany: async () => ({}), deleteMany: async () => ({}) },
    botConfig: { findUnique: async () => null },
    offerAutomation: { update: async args => { updates.push(args); return args.data } },
  }
}

test('automação somente Instagram executa sem sessão WhatsApp e usa idempotência por destino', async () => {
  const db = automationDb()
  const calls = []
  const result = await runAutomation({
    id: 'auto-1', userId: 'user-1', keyword: 'cafeteira', offersPerSend: 1,
    minDiscountPct: 10, sentItemIds: '[]', page: 1,
    destGroupJid: null,
    instagramDestinations: [{ destination: { id: 'ig-1', enabled: true } }],
  }, {
    dbOverride: db,
    isRunningFn: async () => false,
    fetchOffersFn: async () => ({ rawCount: 1, offers: [{ itemId: 'item-1', productName: 'Cafeteira', priceMin: 90, priceDiscountRate: 10, offerLink: 'https://example.com/p', imageUrl: 'https://example.com/p.jpg' }] }),
    instagramRuntimeFn: () => ({ db, storage: {}, publishingQueue: {} }),
    sendStoryFn: async (...args) => calls.push(args),
  })
  assert.deepEqual(result, { sent: 1, storiesQueued: 1 })
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0].destinationId, 'ig-1')
  assert.match(calls[0][0].idempotencyKey, /^offer-automation:auto-1:ig-1:/)
  assert.equal(calls[0][0].offer.priceCents, 9000)
})

test('POST de automação rejeita destino Instagram para plano Pro', async () => {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async req => { req.user = { sub: 'user-1' } })
  const db = {
    user: { findUnique: async () => ({ plan: 'pro', accessExpiresAt: null }) },
    group: { findMany: async () => [] },
    offerAutomation: { count: async () => 0 },
  }
  app.register(offerAutomationRoutes, { prefix: '/api/offer-automations', db })
  const response = await app.inject({ method: 'POST', url: '/api/offer-automations', payload: { keyword: 'café', intervalMinutes: 60, offersPerSend: 1, instagramDestinationIds: ['ig-1'] } })
  assert.equal(response.statusCode, 403)
  assert.equal(response.json().feature, 'instagram_stories')
  await app.close()
})

test('POST cria automação Instagram-only com vínculo tipado no plano Premium', async () => {
  let createData
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async req => { req.user = { sub: 'user-1' } })
  const db = {
    user: { findUnique: async () => ({ plan: 'premium', accessExpiresAt: null }) },
    group: { findMany: async () => [] },
    destination: { findMany: async () => [{ id: 'ig-1' }] },
    offerAutomation: { count: async () => 0, create: async ({ data }) => { createData = data; return { id: 'auto-1', ...data } } },
  }
  app.register(offerAutomationRoutes, { prefix: '/api/offer-automations', db })
  const response = await app.inject({ method: 'POST', url: '/api/offer-automations', payload: { keyword: 'café', intervalMinutes: 60, offersPerSend: 1, instagramDestinationIds: ['ig-1'] } })
  assert.equal(response.statusCode, 200)
  assert.equal(createData.destGroupJid, null)
  assert.deepEqual(createData.instagramDestinations.create, [{ destinationId: 'ig-1' }])
  await app.close()
})
