import test from 'node:test'
import assert from 'node:assert/strict'
import { deliverApprovedReviewItems } from '../src/offerAutomation/reviewDeliveryService.js'

function fakeDb(item) {
  const db = {
    item,
    logs: [],
    offerAutomationReviewItem: {
      findFirst: async ({ where }) => db.item.status === where.status ? { ...db.item } : null,
      updateMany: async ({ where, data }) => {
        if (where.id && where.id !== db.item.id) return { count: 0 }
        if (where.status && where.status !== db.item.status) return { count: 0 }
        if (data.attemptCount?.increment) db.item.attemptCount += data.attemptCount.increment
        Object.assign(db.item, Object.fromEntries(Object.entries(data).filter(([, value]) => typeof value !== 'object' || value instanceof Date)))
        return { count: 1 }
      },
    },
    offerAutomation: { update: async ({ data }) => { db.automationUpdate = data } },
    offerAutomationSentLog: { create: async ({ data }) => { db.logs.push(data) } },
    $transaction: async callback => callback(db),
  }
  return db
}

test('delivery seleciona somente approved e envia o snapshot aprovado', async () => {
  const item = { id: 'i1', automationId: 'a1', userId: 'u1', status: 'approved', position: 1, itemId: '42', productKey: 'produto', priceCents: 999, productUrl: 'https://shopee.com.br/p', imageUrl: 'https://img/p.jpg', imageRefererUrl: 'https://shopee.com.br/p', productSnapshot: JSON.stringify({ title: 'Produto' }), targetSnapshot: JSON.stringify({ whatsapp: { jid: 'g@g.us' }, instagram: [] }), deliverySnapshot: '{}', renderedText: 'texto congelado', attemptCount: 0, expiresAt: new Date(Date.now() + 60_000), nextAttemptAt: null }
  const db = fakeDb(item)
  const calls = []
  const result = await deliverApprovedReviewItems({ id: 'a1', userId: 'u1', offersPerSend: 1, sentItemIds: '[]' }, { db, isRunning: async () => true, sendBroadcast: async (...args) => calls.push(args), instagramRuntime: null })
  assert.equal(result.sent, 1)
  assert.equal(db.item.status, 'sent')
  assert.equal(calls.length, 1)
  assert.equal(calls[0][1], 'texto congelado')
  assert.deepEqual(calls[0][2], ['g@g.us'])
  assert.equal(db.logs.length, 1)
})

test('delivery não seleciona item awaiting_review', async () => {
  const db = fakeDb({ id: 'i1', status: 'awaiting_review' })
  let sends = 0
  const result = await deliverApprovedReviewItems({ id: 'a1', userId: 'u1', offersPerSend: 1, sentItemIds: '[]' }, { db, sendBroadcast: async () => { sends++ }, instagramRuntime: null })
  assert.deepEqual(result, { sent: 0, failed: 0 })
  assert.equal(sends, 0)
})

test('delivery bloqueia snapshot antigo sem preço antes de publicar', async () => {
  const item = { id: 'i1', automationId: 'a1', userId: 'u1', status: 'approved', position: 1, itemId: '42', productKey: 'produto', priceCents: 0, productSnapshot: '{}', targetSnapshot: JSON.stringify({ whatsapp: { jid: 'g@g.us' }, instagram: [] }), deliverySnapshot: '{}', renderedText: 'oferta sem preço', attemptCount: 1 }
  const db = fakeDb(item)
  let sends = 0

  const result = await deliverApprovedReviewItems(
    { id: 'a1', userId: 'u1', offersPerSend: 1, sentItemIds: '[]' },
    { db, isRunning: async () => true, sendBroadcast: async () => { sends++ }, instagramRuntime: null },
  )

  assert.deepEqual(result, { sent: 0, failed: 1 })
  assert.equal(sends, 0)
  assert.equal(db.item.status, 'failed')
  assert.match(db.item.lastError, /sem preço válido/)
})
