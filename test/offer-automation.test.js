import test from 'node:test'
import assert from 'node:assert/strict'
import { filterOffers, buildOffersQuery, buildOfferCandidateLimit } from '../src/offerAutomation/shopeeOffers.js'

test('filterOffers: remove offers below minDiscountPct', () => {
  const offers = [
    { itemId: '1', priceDiscountRate: 5, originPrice: 1000, priceMin: 950 },
    { itemId: '2', priceDiscountRate: 25, originPrice: 1000, priceMin: 750 },
    { itemId: '3', priceDiscountRate: 0, originPrice: 1000, priceMin: 1000 },
  ]
  const result = filterOffers(offers, { minDiscountPct: 10, excludeItemIds: [] })
  assert.deepEqual(result.map(o => o.itemId), ['2'])
})

test('filterOffers: excludes already-sent itemIds', () => {
  const offers = [
    { itemId: '1', priceDiscountRate: 30, originPrice: 1000, priceMin: 700 },
    { itemId: '2', priceDiscountRate: 30, originPrice: 1000, priceMin: 700 },
  ]
  const result = filterOffers(offers, { minDiscountPct: 0, excludeItemIds: ['1'] })
  assert.deepEqual(result.map(o => o.itemId), ['2'])
})

test('filterOffers: requires originPrice > priceMin for real discount when rate is 0', () => {
  const offers = [
    { itemId: '1', priceDiscountRate: 0, originPrice: 0, priceMin: 500 },
    { itemId: '2', priceDiscountRate: 0, originPrice: 1000, priceMin: 800 },
  ]
  const result = filterOffers(offers, { minDiscountPct: 0, excludeItemIds: [] })
  assert.deepEqual(result.map(o => o.itemId), ['2'])
})

test('buildOffersQuery: generates valid GraphQL string', () => {
  const q = buildOffersQuery({ keyword: 'festa', page: 1, limit: 10 })
  assert.ok(q.includes('productOfferV2'))
  assert.ok(q.includes('keyword: "festa"'))
  assert.ok(q.includes('page: 1'))
  assert.ok(q.includes('limit: 10'))
  assert.ok(q.includes('offerLink'))
  assert.ok(q.includes('priceDiscountRate'))
})

test('buildOffersQuery: includes isAMSOffer when true', () => {
  const q = buildOffersQuery({ keyword: 'festa', page: 1, limit: 10, isAMSOffer: true })
  assert.ok(q.includes('isAMSOffer: true'))
})

test('buildOffersQuery: includes isKeySeller when true', () => {
  const q = buildOffersQuery({ keyword: 'festa', page: 1, limit: 10, isKeySeller: true })
  assert.ok(q.includes('isKeySeller: true'))
})

test('buildOffersQuery: uses custom sortType', () => {
  const q = buildOffersQuery({ keyword: 'festa', page: 1, limit: 10, sortType: 5 })
  assert.ok(q.includes('sortType: 5'))
})

test('buildOffersQuery: usa lista ampla por padrão para evitar no_offers_found falso', () => {
  const q = buildOffersQuery({ keyword: 'festa', page: 1, limit: 10 })
  assert.ok(q.includes('listType: 1'))
  assert.ok(!q.includes('listType: 2'))
})

test('buildOfferCandidateLimit: busca candidatos suficientes para filtrar descontos e deduplicados', () => {
  assert.equal(buildOfferCandidateLimit(1), 20)
  assert.equal(buildOfferCandidateLimit(3), 30)
  assert.equal(buildOfferCandidateLimit(50), 100)
})

import { formatOfferMessage, runAutomation } from '../src/offerAutomation/dispatcher.js'

test('formatOfferMessage: includes product name and price', () => {
  const offer = {
    productName: 'Balão Metalizado Estrela',
    priceMin: 1990000,
    originPrice: 3500000,
    priceDiscountRate: 43,
    offerLink: 'https://shope.ee/abc123',
    sales: 1250,
    ratingStar: 4.8,
  }
  const msg = formatOfferMessage(offer, 'decoração de festas')
  assert.ok(msg.includes('Balão Metalizado Estrela'))
  assert.ok(msg.includes('43%'))
  assert.ok(msg.includes('https://shope.ee/abc123'))
  assert.ok(msg.includes('R$'))
})

test('formatOfferMessage: handles missing originPrice gracefully', () => {
  const offer = {
    productName: 'Kit Festa Junina',
    priceMin: 2500000,
    originPrice: 0,
    priceDiscountRate: 0,
    offerLink: 'https://shope.ee/xyz456',
    sales: 80,
    ratingStar: 4.2,
  }
  const msg = formatOfferMessage(offer, 'festa')
  assert.ok(msg.includes('Kit Festa Junina'))
  assert.ok(msg.includes('https://shope.ee/xyz456'))
})

function baseAutomation(overrides = {}) {
  return {
    id: 'auto-x', userId: 'user-x', keyword: 'festa', minDiscountPct: 20,
    offersPerSend: 1, destGroupJid: 'grupo@g.us', sentItemIds: '[]',
    sortType: 2, isAMSOffer: false, isKeySeller: false, ...overrides,
  }
}

const credOk = {
  credential: { findUnique: async () => ({ data: JSON.stringify({ appId: 'a', secretKey: 's' }) }) },
  botConfig: { findUnique: async () => ({ copyVariationPoolJson: '{}' }) },
  offerAutomation: { update: async () => ({}) },
}

test('runAutomation: distingue all_offers_filtered de no_offers_found', async () => {
  const filtered = await runAutomation(baseAutomation(), {
    dbClient: credOk,
    isRunningFn: () => true,
    fetchOffersFn: async () => ({ rawCount: 12, offers: [] }),
  })
  assert.deepEqual(filtered, { skipped: 'all_offers_filtered' })

  const empty = await runAutomation(baseAutomation(), {
    dbClient: credOk,
    isRunningFn: () => true,
    fetchOffersFn: async () => ({ rawCount: 0, offers: [] }),
  })
  assert.deepEqual(empty, { skipped: 'no_offers_found' })
})

test('runAutomation: surfa erro real da API Shopee em vez de mascarar', async () => {
  const result = await runAutomation(baseAutomation(), {
    dbClient: credOk,
    isRunningFn: () => true,
    fetchOffersFn: async () => { throw new Error('shopee_api_error: 90309999 invalid signature') },
  })
  assert.deepEqual(result, { error: 'shopee_api_error: 90309999 invalid signature' })
})

import Fastify from 'fastify'
import { offerAutomationRoutes } from '../src/api/routes/offerAutomation.js'

function buildApp(dbMock) {
  const app = Fastify()
  app.decorate('authenticate', async (req) => { req.user = { sub: 'user-1' } })
  app.register(offerAutomationRoutes, { prefix: '/api/offer-automations', db: dbMock })
  return app
}

test('GET /api/offer-automations: returns user automations', async () => {
  const fakeList = [
    { id: 'a1', userId: 'user-1', keyword: 'festa', intervalMinutes: 120,
      offersPerSend: 2, minDiscountPct: 20, enabled: true, destGroupJid: '123@g.us',
      destGroupName: 'Grupo Festas', lastSentAt: null, sentItemIds: '[]',
      createdAt: new Date(), updatedAt: new Date() },
  ]
  const dbMock = {
    offerAutomation: {
      findMany: async ({ where }) => where.userId === 'user-1' ? fakeList : [],
    },
  }
  const app = buildApp(dbMock)
  const res = await app.inject({ method: 'GET', url: '/api/offer-automations' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.length, 1)
  assert.equal(body[0].keyword, 'festa')
})

test('POST /api/offer-automations: creates automation', async () => {
  let created = null
  const dbMock = {
    offerAutomation: {
      create: async ({ data }) => { created = data; return { id: 'new-1', ...data } },
    },
  }
  const app = buildApp(dbMock)
  const res = await app.inject({
    method: 'POST',
    url: '/api/offer-automations',
    payload: {
      destGroupJid: '123@g.us',
      destGroupName: 'Grupo Festas',
      keyword: 'decoração festa',
      intervalMinutes: 240,
      offersPerSend: 1,
      minDiscountPct: 20,
    },
  })
  assert.equal(res.statusCode, 200)
  assert.equal(created.keyword, 'decoração festa')
  assert.equal(created.userId, 'user-1')
})

test('POST /api/offer-automations: rejects missing keyword', async () => {
  const dbMock = { offerAutomation: {} }
  const app = buildApp(dbMock)
  const res = await app.inject({
    method: 'POST',
    url: '/api/offer-automations',
    payload: { destGroupJid: '123@g.us', destGroupName: 'G', intervalMinutes: 60, offersPerSend: 1, minDiscountPct: 0 },
  })
  assert.equal(res.statusCode, 400)
})

test('DELETE /api/offer-automations/:id: deletes owned automation', async () => {
  const dbMock = {
    offerAutomation: {
      findFirst: async () => ({ id: 'a1', userId: 'user-1' }),
      delete: async () => ({ id: 'a1' }),
    },
  }
  const app = buildApp(dbMock)
  const res = await app.inject({ method: 'DELETE', url: '/api/offer-automations/a1' })
  assert.equal(res.statusCode, 200)
})

test('runAutomation: envia imagem do anúncio junto com a oferta automática', async () => {
  const sent = []
  const updates = []
  const automation = {
    id: 'auto-img',
    userId: 'user-img',
    keyword: 'fone bluetooth',
    minDiscountPct: 10,
    offersPerSend: 1,
    destGroupJid: 'grupo@g.us',
    sentItemIds: '[]',
    sortType: 2,
    isAMSOffer: false,
    isKeySeller: false,
  }

  const dbClient = {
    credential: {
      findUnique: async () => ({ data: JSON.stringify({ appId: 'app', secretKey: 'secret' }) }),
    },
    botConfig: {
      findUnique: async () => ({ copyVariationPoolJson: '{}' }),
    },
    offerAutomation: {
      update: async ({ data }) => { updates.push(data); return { ...automation, ...data } },
    },
  }

  const result = await runAutomation(automation, {
    dbClient,
    isRunningFn: () => true,
    fetchOffersFn: async () => ({ rawCount: 1, offers: [{
      itemId: '42',
      productName: 'Fone Bluetooth',
      priceMin: 990000,
      originPrice: 1990000,
      priceDiscountRate: 50,
      offerLink: 'https://shope.ee/oferta42',
      imageUrl: 'https://down-br.img.susercontent.com/file/anuncio42',
    }] }),
    sendBroadcastFn: async (...args) => { sent.push(args); return { queued: 1 } },
  })

  assert.deepEqual(result, { sent: 1 })
  assert.equal(sent.length, 1)
  assert.equal(sent[0][0], 'user-img')
  assert.deepEqual(sent[0][2], ['grupo@g.us'])
  assert.deepEqual(sent[0][3], {
    imageUrl: 'https://down-br.img.susercontent.com/file/anuncio42',
    imageRefererUrl: 'https://shope.ee/oferta42',
    source: 'offerAutomation',
  })
  assert.deepEqual(updates[0].sentItemIds, JSON.stringify(['42']))
})
