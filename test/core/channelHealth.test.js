import test from 'node:test'
import assert from 'node:assert/strict'

import {
  HEALTH_STATUS,
  nextStateOnFailure,
  nextStateOnSuccess,
  isChannelPaused,
  getHealth,
  recordSendResult,
  recordStreamError,
  PAUSE_DURATION_MS,
  CONSECUTIVE_FAIL_THRESHOLD,
} from '../../src/core/channelHealth.js'

test('HEALTH_STATUS imutável e completo', () => {
  assert.deepEqual(
    Object.keys(HEALTH_STATUS).sort(),
    ['CRITICAL', 'GREEN', 'RED', 'YELLOW'],
  )
  assert.throws(() => { HEALTH_STATUS.GREEN = 'x' }, TypeError)
})

// ---------- transições puras ----------

test('nextStateOnSuccess reseta consecutiveFailures e mantém status verde', () => {
  const next = nextStateOnSuccess({ currentStatus: 'yellow', consecutiveFailures: 2 })
  assert.equal(next.status, 'green')
  assert.equal(next.consecutiveFailures, 0)
  assert.equal(next.pausedUntil, null)
})

test('nextStateOnSuccess preserva pausedUntil ainda no futuro', () => {
  const future = Date.now() + 60_000
  const next = nextStateOnSuccess({ currentStatus: 'red', consecutiveFailures: 5, pausedUntil: future })
  assert.equal(next.pausedUntil, future)
})

test('nextStateOnFailure incrementa consecutiveFailures', () => {
  const next = nextStateOnFailure({ currentStatus: 'green', consecutiveFailures: 1, errorCode: '500', now: 1000 })
  assert.equal(next.consecutiveFailures, 2)
  assert.equal(next.status, 'green') // erro genérico não muda status ainda
})

test('nextStateOnFailure: 3 erros 403 consecutivos → red + pausedUntil', () => {
  const now = 1_000_000
  const next = nextStateOnFailure({ currentStatus: 'green', consecutiveFailures: 2, errorCode: '403', now })
  assert.equal(next.consecutiveFailures, 3)
  assert.equal(next.status, 'red')
  assert.equal(next.pausedUntil, now + PAUSE_DURATION_MS)
})

test('nextStateOnFailure: 401 com threshold atingido também vira red', () => {
  const now = 1_000_000
  const next = nextStateOnFailure({ currentStatus: 'yellow', consecutiveFailures: CONSECUTIVE_FAIL_THRESHOLD - 1, errorCode: '401', now })
  assert.equal(next.status, 'red')
  assert.equal(next.pausedUntil, now + PAUSE_DURATION_MS)
})

test('isChannelPaused: true quando pausedUntil > now', () => {
  const now = 1000
  assert.equal(isChannelPaused({ pausedUntil: new Date(now + 5000) }, now), true)
  assert.equal(isChannelPaused({ pausedUntil: new Date(now - 5000) }, now), false)
  assert.equal(isChannelPaused({ pausedUntil: null }, now), false)
  assert.equal(isChannelPaused(null, now), false)
})

// ---------- I/O com fake db ----------

function makeFakeDb(state = {}) {
  const records = state.channelHealth ?? new Map()
  return {
    _state: { records },
    channelHealth: {
      findUnique: async ({ where }) => records.get(where.groupId) ?? null,
      upsert: async ({ where, create, update }) => {
        const existing = records.get(where.groupId)
        const next = existing
          ? { ...existing, ...update }
          : { id: 'h-' + where.groupId, groupId: where.groupId, ...create }
        records.set(where.groupId, next)
        return next
      },
      updateMany: async ({ where, data }) => {
        let count = 0
        for (const [k, v] of records) {
          if (where.group?.userId && v.userId !== where.group.userId) continue
          records.set(k, { ...v, ...data })
          count++
        }
        return { count }
      },
    },
    group: state.group ?? { findMany: async () => [] },
  }
}

test('getHealth retorna defaults verdes quando não há registro', async () => {
  const db = makeFakeDb()
  const snap = await getHealth('g-1', { db })
  assert.equal(snap.status, 'green')
  assert.equal(snap.consecutiveFailures, 0)
})

test('recordSendResult sucesso cria registro verde com latência', async () => {
  const db = makeFakeDb()
  await recordSendResult('g-1', { ok: true, latencyMs: 250 }, { db })
  const snap = await getHealth('g-1', { db })
  assert.equal(snap.status, 'green')
  assert.equal(snap.consecutiveFailures, 0)
  assert.ok(snap.lastPostedAt)
})

test('recordSendResult com 3 falhas 403 consecutivas → status red e pausedUntil', async () => {
  const db = makeFakeDb()
  const now = Date.now()
  await recordSendResult('g-1', { ok: false, errorCode: '403' }, { db, now })
  await recordSendResult('g-1', { ok: false, errorCode: '403' }, { db, now })
  await recordSendResult('g-1', { ok: false, errorCode: '403' }, { db, now })
  const snap = await getHealth('g-1', { db })
  assert.equal(snap.status, 'red')
  assert.equal(snap.consecutiveFailures, 3)
  assert.ok(snap.pausedUntil)
  const pausedMs = new Date(snap.pausedUntil).getTime()
  assert.ok(pausedMs >= now + PAUSE_DURATION_MS - 1000)
})

test('recordSendResult sucesso após red reseta failures mas mantém pausedUntil', async () => {
  const db = makeFakeDb()
  const now = Date.now()
  await recordSendResult('g-1', { ok: false, errorCode: '403' }, { db, now })
  await recordSendResult('g-1', { ok: false, errorCode: '403' }, { db, now })
  await recordSendResult('g-1', { ok: false, errorCode: '403' }, { db, now })
  await recordSendResult('g-1', { ok: true, latencyMs: 100 }, { db, now })
  const snap = await getHealth('g-1', { db })
  assert.equal(snap.consecutiveFailures, 0)
  // pausedUntil ainda no futuro: scheduler é quem decide deixar ou não tentar
  assert.ok(snap.pausedUntil)
})

test('recordStreamError forbidden → status=critical em canais da sessão', async () => {
  // 2 canais do mesmo user
  const records = new Map([
    ['g-1', { id: 'h1', groupId: 'g-1', userId: 'u-1', status: 'green', consecutiveFailures: 0 }],
    ['g-2', { id: 'h2', groupId: 'g-2', userId: 'u-1', status: 'green', consecutiveFailures: 0 }],
  ])
  const db = makeFakeDb({
    channelHealth: records,
    group: {
      findMany: async ({ where }) =>
        where?.userId === 'u-1' ? [{ id: 'g-1' }, { id: 'g-2' }] : [],
    },
  })
  await recordStreamError('u-1', 'forbidden', { db })
  assert.equal(records.get('g-1').status, 'critical')
  assert.equal(records.get('g-2').status, 'critical')
})

test('recordStreamError rate-overlimit → status=yellow', async () => {
  const records = new Map([
    ['g-1', { id: 'h1', groupId: 'g-1', userId: 'u-1', status: 'green', consecutiveFailures: 0 }],
  ])
  const db = makeFakeDb({
    channelHealth: records,
    group: { findMany: async () => [{ id: 'g-1' }] },
  })
  await recordStreamError('u-1', 'rate-overlimit', { db })
  assert.equal(records.get('g-1').status, 'yellow')
})

test('recordStreamError com código irrelevante é no-op', async () => {
  const records = new Map([
    ['g-1', { id: 'h1', groupId: 'g-1', userId: 'u-1', status: 'green', consecutiveFailures: 0 }],
  ])
  const db = makeFakeDb({ channelHealth: records, group: { findMany: async () => [{ id: 'g-1' }] } })
  await recordStreamError('u-1', 'something-else', { db })
  assert.equal(records.get('g-1').status, 'green')
})
