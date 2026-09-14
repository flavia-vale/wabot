import test from 'node:test'
import assert from 'node:assert/strict'
import { discoverReviewItems } from '../src/offerAutomation/reviewDiscoveryService.js'
import { explainReviewDiscovery } from '../dashboard/lib/offerAutomationReview.js'

function offer(itemId, productName, price = 10) {
  return {
    itemId,
    productName,
    price,
    priceMin: price,
    priceMax: price,
    priceDiscountRate: 30,
    offerLink: `https://shopee.test/${itemId}`,
    imageUrl: null,
  }
}

test('nova busca procura além do item repetido que já está na fila', async () => {
  let requestedLimit = 0
  let created = []
  const automation = { id: 'a1', userId: 'u1', keyword: 'festa', reviewTargetSize: 2, offersPerSend: 1, sentItemIds: '[]', destGroupJid: 'grupo@g.us', instagramDestinations: [] }
  const db = {
    offerAutomationReviewItem: {
      count: async () => 1,
      findMany: async () => [{ productKey: 'produto repetido', priceCents: 1000 }],
      findFirst: async () => ({ position: 1 }),
      createMany: async ({ data }) => { created = data },
    },
    credential: { findUnique: async () => ({ data: JSON.stringify({ appId: '123', secretKey: 'segredo-valido' }) }) },
    botConfig: { findUnique: async () => null },
    offerAutomation: { update: async () => {} },
    $transaction: async (callback) => callback(db),
  }

  const result = await discoverReviewItems(automation, {
    db,
    fetchOffersFn: async ({ limit }) => {
      requestedLimit = limit
      return { offers: [offer('1', 'Produto repetido'), offer('2', 'Produto novo')], rawCount: 2 }
    },
  })

  assert.equal(requestedLimit, 2)
  assert.equal(result.discovered, 1)
  assert.equal(created[0].itemId, '2')
})

test('resultado da busca sempre explica por que a fila continuou vazia', () => {
  assert.match(explainReviewDiscovery({ discovered: 0, rawCount: 0 }).text, /Nenhuma oferta/)
  assert.match(explainReviewDiscovery({ discovered: 0, rawCount: 4 }).text, /já estavam na fila/)
  assert.match(explainReviewDiscovery({ skipped: 'review_queue_full' }).text, /fila já está completa/)
  assert.equal(explainReviewDiscovery({ discovered: 3 }).tone, 'success')
})
