import test from 'node:test'
import assert from 'node:assert/strict'
import { drainQueueOnce } from '../src/offerQueue/dispatcher.js'

test('fila Instagram-only drena sem WhatsApp e enfileira Story idempotente', async () => {
  const updates = []
  const queue = { id: 'q1', userId: 'u1', enabled: true, intervalEnabled: false, hourlyCapEnabled: false, dailyCapEnabled: false, operatingHoursEnabled: false, instagramDestinations: [{ destination: { id: 'ig1', enabled: true } }] }
  const item = { id: 'i1', queueId: 'q1', userId: 'u1', status: 'pending', position: 1, targetJids: '[]', offerSnapshot: JSON.stringify({ offerKey: 'p1', title: 'Produto', productUrl: 'https://example.com/p', imageUrl: 'https://example.com/p.jpg' }), attemptCount: 0 }
  const db = {
    offerQueue: { findFirst: async () => queue, updateMany: async () => ({ count: 1 }) },
    offerQueueItem: { findFirst: async () => item, updateMany: async args => { updates.push(args); return { count: 1 } }, count: async () => 0 },
    $transaction: async promises => Promise.all(promises),
  }
  const stories = []
  const result = await drainQueueOnce(queue, { db, isRunning: async () => false, instagramRuntime: { db, storage: {}, publishingQueue: {} }, sendStory: async input => stories.push(input) })
  assert.deepEqual(result, { sent: 'i1' })
  assert.equal(stories[0].destinationId, 'ig1')
  assert.equal(stories[0].idempotencyKey, 'offer-queue:q1:i1:ig1')
  assert.ok(updates.some(call => call.data.status === 'sent'))
})
