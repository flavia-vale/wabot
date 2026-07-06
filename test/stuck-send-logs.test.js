import test from 'node:test'
import assert from 'node:assert/strict'

import { recoverStuckSendLogs, clearUserQueuedSendLogs, STUCK_SEND_LOG_CUTOFF_MS } from '../src/jobs/stuckSendLogs.js'

function makeFakeDb() {
  const calls = []
  return {
    calls,
    messageLog: {
      updateMany: async (args) => { calls.push(args); return { count: 2 } },
    },
  }
}

const NOW = new Date('2026-06-22T12:00:00.000Z')

test('recoverStuckSendLogs alveja status=sending mais velho que o cutoff', async () => {
  const db = makeFakeDb()
  const res = await recoverStuckSendLogs({ db, now: () => NOW, userId: 'u1', cutoffMs: 15 * 60_000 })
  assert.equal(res.recovered, 2)
  assert.equal(db.calls.length, 1)
  const { where, data } = db.calls[0]
  assert.equal(where.status, 'sending')
  assert.equal(where.userId, 'u1')
  // cutoff = now - 15min
  assert.equal(where.sentAt.lt.toISOString(), new Date(NOW.getTime() - 15 * 60_000).toISOString())
})

test('recoverStuckSendLogs reclassifica como timeout de envio preso e estampa sentAt', async () => {
  const db = makeFakeDb()
  await recoverStuckSendLogs({ db, now: () => NOW, cutoffMs: 1000 })
  const { data } = db.calls[0]
  assert.equal(data.status, 'error')
  assert.equal(data.errorMsg, 'timeout:send:stuck')
  assert.equal(data.sentAt, NOW)
})

test('recoverStuckSendLogs sem userId varre todos os usuários (sem filtro de userId)', async () => {
  const db = makeFakeDb()
  await recoverStuckSendLogs({ db, now: () => NOW })
  assert.equal(db.calls[0].where.userId, undefined)
})

test('cutoff default é >= 1min (sane floor)', () => {
  assert.ok(STUCK_SEND_LOG_CUTOFF_MS >= 60_000)
})

test('clearUserQueuedSendLogs alveja queued E sending do usuário, sem cutoff de tempo', async () => {
  const db = makeFakeDb()
  const res = await clearUserQueuedSendLogs({ db, now: () => NOW, userId: 'u1' })
  assert.equal(res.cleared, 2)
  assert.equal(db.calls.length, 1)
  const { where, data } = db.calls[0]
  assert.equal(where.userId, 'u1')
  assert.deepEqual(where.status, { in: ['queued', 'sending'] })
  // Não filtra por sentAt — é imediato, cobre até linhas recém-criadas.
  assert.equal(where.sentAt, undefined)
  assert.equal(data.status, 'skipped')
  assert.equal(data.errorMsg, 'skip:queue_cleared')
  assert.equal(data.sentAt, NOW)
})

test('clearUserQueuedSendLogs exige userId (nunca varre todos os usuários)', async () => {
  const db = makeFakeDb()
  await assert.rejects(() => clearUserQueuedSendLogs({ db, now: () => NOW }), /userId/)
  assert.equal(db.calls.length, 0)
})
