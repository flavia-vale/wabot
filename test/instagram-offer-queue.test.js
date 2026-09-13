import test from 'node:test'
import assert from 'node:assert/strict'
import { drainQueueOnce } from '../src/offerQueue/dispatcher.js'

test('fila Instagram-only drena sem WhatsApp e enfileira Story idempotente', async () => {
  const updates = []
  // Fila Instagram-only é a que a rota grava com whatsappEnabled=false — é
  // esse campo, e não "ter destino Instagram", que dispensa o bot online.
  const queue = { id: 'q1', userId: 'u1', enabled: true, whatsappEnabled: false, intervalEnabled: false, hourlyCapEnabled: false, dailyCapEnabled: false, operatingHoursEnabled: false, instagramDestinations: [{ destination: { id: 'ig1', enabled: true } }] }
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

test('fila híbrida com bot offline volta a informar bot_offline em vez de queimar tentativa', async () => {
  // Regressão: ganhar um destino Instagram fazia a fila híbrida passar do gate,
  // falhar no sendBroadcast e o item virar `failed` terminal depois das
  // tentativas — antes ele só ficava `pending` com o motivo na tela.
  const { evaluateQueueGate } = await import('../src/offerQueue/dispatcher.js')
  const hibrida = { id: 'q2', userId: 'u1', enabled: true, whatsappEnabled: true, intervalEnabled: false, hourlyCapEnabled: false, dailyCapEnabled: false, operatingHoursEnabled: false, instagramDestinations: [{ destination: { id: 'ig1', enabled: true } }] }
  const db = { offerQueueItem: { count: async () => 0 } }
  assert.equal(await evaluateQueueGate(hibrida, { db, isRunning: async () => false }), 'bot_offline')
  assert.equal(await evaluateQueueGate(hibrida, { db, isRunning: async () => true }), null)
  // Instagram-only segue drenando com o bot fora do ar.
  const soInstagram = { ...hibrida, whatsappEnabled: false }
  assert.equal(await evaluateQueueGate(soInstagram, { db, isRunning: async () => false }), null)
})
