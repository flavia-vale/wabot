import test from 'node:test'
import assert from 'node:assert/strict'
import { drainQueueOnce, evaluateQueueGate, recoverStuckQueueItems, OFFER_QUEUE_MAX_ATTEMPTS } from '../src/offerQueue/dispatcher.js'
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
  assert.equal(calls.sent[0][3].source, 'offerQueue')
  assert.equal(calls.sent[0][3].queueId, 'q1')
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

test('evaluateQueueGate devolve o motivo do bloqueio (read-only) ou null quando liberada', async () => {
  const ready = setup()
  assert.equal(await evaluateQueueGate(ready.queue, ready.deps), null)

  const offline = setup()
  offline.deps.isRunning = async () => false
  assert.equal(await evaluateQueueGate(offline.queue, offline.deps), 'bot_offline')
  // diagnóstico é read-only: nunca toca nos itens
  assert.equal(offline.calls.updates.length, 0)
  assert.equal(offline.calls.sent.length, 0)

  const paused = setup({ enabled: false })
  assert.equal(await evaluateQueueGate(paused.queue, paused.deps), 'queue_disabled')

  const interval = setup({ intervalEnabled: true, intervalMinutes: 30, lastSentAt: new Date('2026-06-10T14:45:00Z') })
  assert.equal(await evaluateQueueGate(interval.queue, interval.deps), 'interval_limit')

  const daily = setup({ dailyCapEnabled: true, dailyCap: 5, count: 5 })
  assert.equal(await evaluateQueueGate(daily.queue, daily.deps), 'daily_limit')
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

test('drainQueueOnce perde claim atomicamente e reagenda falha transitória com backoff', async () => {
  const claimLost = setup()
  claimLost.deps.db.offerQueueItem.updateMany = async () => ({ count: 0 })
  assert.deepEqual(await drainQueueOnce(claimLost.queue, claimLost.deps), { skipped: 'claim_lost' })
  assert.equal(claimLost.calls.sent.length, 0)

  // 1ª falha: volta para 'pending' com nextAttemptAt futuro e lastError
  const retrying = setup()
  retrying.deps.sendBroadcast = async () => { throw new Error('falhou') }
  const retryResult = await drainQueueOnce(retrying.queue, retrying.deps)
  assert.equal(retryResult.retrying, 'i1')
  assert.equal(retryResult.attemptCount, 1)
  const retryUpdate = retrying.calls.updates.at(-1).data
  assert.equal(retryUpdate.status, 'pending')
  assert.ok(retryUpdate.nextAttemptAt > retrying.now, 'nextAttemptAt deve ser futuro')
  assert.match(retryUpdate.lastError, /falhou/)
})

test('drainQueueOnce marca failed terminal quando as tentativas se esgotam', async () => {
  const exhausted = setup()
  exhausted.item.attemptCount = OFFER_QUEUE_MAX_ATTEMPTS - 1
  exhausted.deps.sendBroadcast = async () => { throw new Error('falhou de vez') }
  const result = await drainQueueOnce(exhausted.queue, exhausted.deps)
  assert.equal(result.failed, 'i1')
  const finalUpdate = exhausted.calls.updates.at(-1).data
  assert.equal(finalUpdate.status, 'failed')
  assert.match(finalUpdate.lastError, /falhou de vez/)
})

test('drainQueueOnce registra claim com lease (claimedAt) e incrementa attemptCount', async () => {
  const { queue, calls, deps, now } = setup()
  await drainQueueOnce(queue, deps)
  const claimUpdate = calls.updates.find((u) => u.data.status === 'queued')
  assert.ok(claimUpdate, 'claim deve marcar status queued')
  assert.equal(claimUpdate.data.claimedAt, now)
  assert.deepEqual(claimUpdate.data.attemptCount, { increment: 1 })
})

test('drainQueueOnce ignora item pendente com nextAttemptAt no futuro (filtro na query)', async () => {
  const { queue, calls, deps } = setup()
  let capturedWhere = null
  deps.db.offerQueueItem.findFirst = async ({ where }) => { capturedWhere = where; return null }
  const result = await drainQueueOnce(queue, deps)
  assert.deepEqual(result, { skipped: 'empty' })
  assert.ok(Array.isArray(capturedWhere.OR), 'query deve filtrar por nextAttemptAt')
  assert.equal(calls.sent.length, 0)
})

test('recoverStuckQueueItems devolve queued com lease expirada e mata os esgotados', async () => {
  const now = new Date('2026-06-10T15:00:00.000Z')
  const updates = []
  const db = {
    offerQueueItem: {
      updateMany: async (args) => { updates.push(args); return { count: updates.length === 1 ? 2 : 3 } },
    },
  }
  const result = await recoverStuckQueueItems({ db, now: () => now })
  assert.deepEqual(result, { requeued: 3, exhausted: 2 })

  const [exhaustedCall, requeueCall] = updates
  assert.equal(exhaustedCall.where.status, 'queued')
  assert.deepEqual(exhaustedCall.where.attemptCount, { gte: OFFER_QUEUE_MAX_ATTEMPTS })
  assert.equal(exhaustedCall.data.status, 'failed')
  // cobre linhas legadas presas de antes da migration (claimedAt null)
  assert.deepEqual(exhaustedCall.where.OR[0], { claimedAt: null })
  assert.ok(exhaustedCall.where.OR[1].claimedAt.lt < now, 'cutoff deve respeitar o lease')
  assert.equal(requeueCall.data.status, 'pending')
  assert.equal(requeueCall.data.claimedAt, null)
})

test('startOfSaoPauloDayUtc preserva a fronteira BRT', () => {
  assert.equal(startOfSaoPauloDayUtc(new Date('2026-06-10T02:59:59Z')).toISOString(), '2026-06-09T03:00:00.000Z')
  assert.equal(startOfSaoPauloDayUtc(new Date('2026-06-10T03:00:00Z')).toISOString(), '2026-06-10T03:00:00.000Z')
})

test('horário de funcionamento da fila: fora da janela não envia (override)', async () => {
  // now = 2026-06-10T15:00:00Z = 12:00 BRT, fora de 13:00-22:00
  const { queue, calls, deps } = setup({ operatingHoursEnabled: true, operatingHoursStart: '13:00', operatingHoursEnd: '22:00' })
  assert.deepEqual(await drainQueueOnce(queue, deps), { skipped: 'outside_operating_hours' })
  assert.equal(calls.sent.length, 0)
})

test('horário de funcionamento da fila: dentro da janela ignora a janela silenciosa global', async () => {
  // 12:00 BRT dentro de 07:00-22:00; botConfig com quiet ligado cobrindo o dia
  // inteiro NÃO deve barrar, porque a fila tem horário próprio (override).
  const { queue, calls, deps } = setup({ operatingHoursEnabled: true, operatingHoursStart: '07:00', operatingHoursEnd: '22:00' })
  deps.db.botConfig = { findFirst: async () => ({ quietHoursEnabled: true, channelQuietHoursJson: '{"startHour":0,"endHour":23,"tz":"America/Sao_Paulo"}' }) }
  assert.deepEqual(await drainQueueOnce(queue, deps), { sent: 'i1' })
  assert.equal(calls.sent.length, 1)
})

test('sem horário próprio: segue a janela silenciosa global quando habilitada', async () => {
  // 12:00 BRT dentro de quiet 07-22 com quietHoursEnabled => bloqueia.
  const { queue, calls, deps } = setup()
  deps.db.botConfig = { findFirst: async () => ({ quietHoursEnabled: true, channelQuietHoursJson: '{"startHour":7,"endHour":22,"tz":"America/Sao_Paulo"}' }) }
  assert.deepEqual(await drainQueueOnce(queue, deps), { skipped: 'quiet_hours' })
  assert.equal(calls.sent.length, 0)
})

test('sem horário próprio: janela silenciosa global desligada não bloqueia', async () => {
  const { queue, calls, deps } = setup()
  deps.db.botConfig = { findFirst: async () => ({ quietHoursEnabled: false, channelQuietHoursJson: '{"startHour":7,"endHour":22,"tz":"America/Sao_Paulo"}' }) }
  assert.deepEqual(await drainQueueOnce(queue, deps), { sent: 'i1' })
  assert.equal(calls.sent.length, 1)
})
