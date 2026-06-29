import test from 'node:test'
import assert from 'node:assert/strict'

import { recoverStuckSendLogs, STUCK_SEND_LOG_CUTOFF_MS } from '../src/jobs/stuckSendLogs.js'

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
