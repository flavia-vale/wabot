import test from 'node:test'
import assert from 'node:assert/strict'
import { captureInstagramMirror, processInstagramMirrorIngress } from '../src/instagram/mirroring/index.js'

test('captura de espelhamento cria outbox por destino somente no Premium', async () => {
  let data
  const db = {
    instagramMirrorDestination: { findMany: async () => [{ destinationId: 'ig1' }, { destinationId: 'ig2' }] },
    instagramStoryIngress: { create: async args => { (data ||= []).push(args.data); return args.data } },
  }
  const result = await captureInstagramMirror({ user: { id: 'u1', plan: 'premium' }, sourceGroupId: 'g1', sourceMessageKey: 'g1:m1', text: '*Cafeteira elétrica*', primary: { platform: 'shopee', url: 'https://example.com/raw', converted: 'https://example.com/affiliate' }, credentials: {} }, { db, fetchImageUrl: async () => 'https://example.com/image.jpg' })
  assert.equal(result.captured, 2)
  assert.equal(data[0].sourceMessageKey, 'g1:m1')
  assert.equal(JSON.parse(data[0].offerSnapshotJson).productUrl, 'https://example.com/affiliate')
})

test('consumidor do outbox marca processado após aceitar publicação', async () => {
  const changes = []
  const row = { id: 'in1', userId: 'u1', destinationId: 'ig1', sourceMessageKey: 'g:m', offerSnapshotJson: JSON.stringify({ offerKey: 'g:m', title: 'Oferta', productUrl: 'https://example.com/p', imageUrl: 'https://example.com/i.jpg' }), status: 'pending', attemptCount: 0 }
  const db = {
    instagramStoryIngress: { findMany: async () => [row], updateMany: async () => ({ count: 1 }), update: async args => changes.push(args) },
  }
  const runtime = { db: {}, storage: {}, publishingQueue: {} }
  const accepted = []
  const result = await processInstagramMirrorIngress({ db, runtime, storyCreator: async input => accepted.push(input), now: () => new Date('2026-09-10T12:00:00Z') })
  assert.equal(result.processed, 1)
  assert.equal(changes[0].data.status, 'processed')
  assert.equal(accepted[0].idempotencyKey, 'mirror:ig1:g:m')
})
