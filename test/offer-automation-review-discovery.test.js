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

test('descoberta limita a quantidade lógica mesmo com muitos itens já na fila', async () => {
  let requestedLimit = 0
  const automation = { id: 'a2', userId: 'u2', keyword: 'festa', reviewTargetSize: 30, offersPerSend: 1, sentItemIds: '[]', destGroupJid: 'grupo@g.us', instagramDestinations: [] }
  const living = Array.from({ length: 29 }, (_, index) => ({ productKey: `produto ${index}`, priceCents: 1000 }))
  const db = {
    offerAutomationReviewItem: {
      count: async () => 29,
      findMany: async () => living,
      findFirst: async () => ({ position: 29 }),
      createMany: async () => {},
    },
    credential: { findUnique: async () => ({ data: JSON.stringify({ appId: '123', secretKey: 'segredo-valido' }) }) },
    botConfig: { findUnique: async () => null },
    offerAutomation: { update: async () => {} },
    $transaction: async (callback) => callback(db),
  }

  await discoverReviewItems(automation, {
    db,
    fetchOffersFn: async ({ limit }) => {
      requestedLimit = limit
      return { offers: [], rawCount: 0 }
    },
  })

  assert.ok(requestedLimit <= 50)
})

test('próximas opções usa a página seguinte e troca somente as não aprovadas', async () => {
  let searchArgs
  let removedWhere
  let automationUpdate
  const automation = { id: 'a3', userId: 'u3', keyword: 'festa', page: 1, reviewTargetSize: 5, offersPerSend: 1, sentItemIds: '[]', destGroupJid: 'grupo@g.us', instagramDestinations: [] }
  const db = {
    offerAutomationReviewItem: {
      count: async ({ where }) => {
        assert.deepEqual(where.status.in, ['approved', 'sending'])
        return 1
      },
      findMany: async () => [
        { productKey: 'já aprovada', priceCents: 1000 },
        { productKey: 'ainda aguardando', priceCents: 1000 },
      ],
      findFirst: async () => ({ position: 2 }),
      updateMany: async ({ where }) => { removedWhere = where; return { count: 1 } },
      createMany: async () => {},
    },
    credential: { findUnique: async () => ({ data: JSON.stringify({ appId: '123', secretKey: 'segredo-valido' }) }) },
    botConfig: { findUnique: async () => null },
    offerAutomation: { update: async (args) => { automationUpdate = args } },
    $transaction: async (callback) => callback(db),
  }

  const result = await discoverReviewItems(automation, {
    db,
    nextPage: true,
    fetchOffersFn: async (args) => {
      searchArgs = args
      return { offers: [offer('3', 'Opção nova')], rawCount: 1 }
    },
  })

  assert.equal(searchArgs.page, 2)
  assert.equal(searchArgs.sortType, 2)
  assert.equal(removedWhere.status, 'awaiting_review')
  assert.equal(automationUpdate.data.page, 2)
  assert.equal(result.replaced, true)
})
