import test from 'node:test'
import assert from 'node:assert/strict'
import { drainQueueOnce } from '../src/offerQueue/dispatcher.js'
import { startOfSaoPauloDayUtc } from '../src/offerQueue/time.js'

function setup(overrides = {}) {
  const now = new Date('2026-06-10T15:00:00.000Z')
  const queue = { id: 'q1', userId: 'u1', enabled: true, intervalEnabled: false, intervalMinutes: 30, hourlyCapEnabled: false, hourlyCap: 10, dailyCapEnabled: false, dailyCap: 50, lastSentAt: null, ...overrides }
  const item = { id: 'i1', queueId: 'q1', userId: 'u1', status: 'pending', position: 1, text: 'Oferta', targetJids: '["grupo@g.us"]', imageUrl: 'https://img.test/item.jpg', imageRefererUrl: 'https://loja.test/item' }
  const calls = { counts: [], sent: [], updates: [], transaction: null }
  const db = {
    offerQueueItem: {
      count: async (args) => { calls.counts.push(args); return overrides.count ?? 0 },
      findFirst: async () => item,
      updateMany: async (args) => { calls.updates.push(args); return { count: 1 } },
    },
    offerQueue: {
      findFirst: async ({ where, select }) => {
        if (where.enabled === true && queue.enabled !== true) return null
        const found = { ...queue }
        return select ? Object.fromEntries(Object.keys(select).map((key) => [key, found[key]])) : found
      },
      updateMany: (args) => ({ model: 'queue', args }),
    },
    $transaction: async (ops) => { calls.transaction = ops },
  }
  const deps = { db, now: () => now, isRunning: () => true, sendBroadcast: async (...args) => { calls.sent.push(args) } }
  return { queue, item, calls, deps, now }
}

test('drainQueueOnce envia um item FIFO com receita de imagem e marca sucesso', async () => {
  const { queue, calls, deps } = setup()
  const result = await drainQueueOnce(queue, deps)
  assert.deepEqual(result, { sent: 'i1' })
  assert.equal(calls.sent.length, 1)
  assert.deepEqual(calls.sent[0][2], ['grupo@g.us'])
  assert.equal(calls.sent[0][3].imageUrl, 'https://img.test/item.jpg')
  assert.equal(calls.transaction.length, 2)
})

test('drainQueueOnce não envia filas pausadas e devolve o item se a pausa ocorrer após o claim', async () => {
  const paused = setup({ enabled: false })
  assert.deepEqual(await drainQueueOnce(paused.queue, paused.deps), { skipped: 'queue_disabled' })
  assert.equal(paused.calls.sent.length, 0)
  assert.equal(paused.calls.updates.length, 0)

  const pausedAfterClaim = setup()
  let checks = 0
  pausedAfterClaim.deps.db.offerQueue.findFirst = async () => (++checks === 1 ? pausedAfterClaim.queue : null)
  assert.deepEqual(await drainQueueOnce(pausedAfterClaim.queue, pausedAfterClaim.deps), { skipped: 'queue_disabled' })
  assert.equal(pausedAfterClaim.calls.sent.length, 0)
  assert.equal(pausedAfterClaim.calls.updates.at(-1).data.status, 'pending')
})

test('drainQueueOnce serializa execuções concorrentes da mesma fila', async () => {
  const first = setup()
  let releaseSend
  const sendStarted = new Promise((resolve) => {
    first.deps.sendBroadcast = async () => {
      resolve()
      await new Promise((release) => { releaseSend = release })
    }
  })

  const running = drainQueueOnce(first.queue, first.deps)
  await sendStarted
  assert.deepEqual(await drainQueueOnce(first.queue, first.deps), { skipped: 'queue_busy' })
  releaseSend()
  assert.deepEqual(await running, { sent: 'i1' })
  assert.equal(first.calls.updates.filter((call) => call.data.status === 'queued').length, 1)
})

test('drainQueueOnce respeita bot offline e intervalo sem fazer claim', async () => {
  const offline = setup()
  offline.deps.isRunning = async () => false
  assert.deepEqual(await drainQueueOnce(offline.queue, offline.deps), { skipped: 'bot_offline' })
  assert.equal(offline.calls.updates.length, 0)

  const interval = setup({ intervalEnabled: true, intervalMinutes: 30, lastSentAt: new Date('2026-06-10T14:45:00Z') })
  assert.deepEqual(await drainQueueOnce(interval.queue, interval.deps), { skipped: 'interval_limit' })
  assert.equal(interval.calls.updates.length, 0)
})

test('drainQueueOnce aplica caps horário e diário somente quando habilitados', async () => {
  const hourly = setup({ hourlyCapEnabled: true, hourlyCap: 3, count: 3 })
  assert.deepEqual(await drainQueueOnce(hourly.queue, hourly.deps), { skipped: 'hourly_limit' })
  assert.equal(hourly.calls.counts[0].where.sentAt.gte.toISOString(), '2026-06-10T14:00:00.000Z')

  const daily = setup({ dailyCapEnabled: true, dailyCap: 5, count: 5 })
  assert.deepEqual(await drainQueueOnce(daily.queue, daily.deps), { skipped: 'daily_limit' })
  assert.equal(daily.calls.counts[0].where.sentAt.gte.toISOString(), '2026-06-10T03:00:00.000Z')

  const disabled = setup({ count: 999 })
  assert.deepEqual(await drainQueueOnce(disabled.queue, disabled.deps), { sent: 'i1' })
  assert.equal(disabled.calls.counts.length, 0)
})

test('drainQueueOnce perde claim atomicamente e marca falha sem travar fila', async () => {
  const claimLost = setup()
  claimLost.deps.db.offerQueueItem.updateMany = async () => ({ count: 0 })
  assert.deepEqual(await drainQueueOnce(claimLost.queue, claimLost.deps), { skipped: 'claim_lost' })
  assert.equal(claimLost.calls.sent.length, 0)

  const failed = setup()
  failed.deps.sendBroadcast = async () => { throw new Error('falhou') }
  const result = await drainQueueOnce(failed.queue, failed.deps)
  assert.equal(result.failed, 'i1')
  assert.equal(failed.calls.updates.at(-1).data.status, 'failed')
})

test('startOfSaoPauloDayUtc preserva a fronteira BRT', () => {
  assert.equal(startOfSaoPauloDayUtc(new Date('2026-06-10T02:59:59Z')).toISOString(), '2026-06-09T03:00:00.000Z')
  assert.equal(startOfSaoPauloDayUtc(new Date('2026-06-10T03:00:00Z')).toISOString(), '2026-06-10T03:00:00.000Z')
})
