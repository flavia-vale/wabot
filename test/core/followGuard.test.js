import test from 'node:test'
import assert from 'node:assert/strict'

import {
  warmupCap,
  decide,
  canFollowNow,
  logFollow,
  MIN_INTERVAL_MS,
  RATE_LIMIT_COOLDOWN_MS,
} from '../../src/core/followGuard.js'

const DAY_MS = 24 * 60 * 60 * 1000

test('warmupCap < 1d → 1', () => {
  assert.equal(warmupCap(0, 10), 1)
  assert.equal(warmupCap(0.5 * DAY_MS, 10), 1)
})

test('warmupCap 1d–3d → 1', () => {
  assert.equal(warmupCap(2 * DAY_MS, 10), 1)
})

test('warmupCap 3d–7d → 2', () => {
  assert.equal(warmupCap(3 * DAY_MS, 10), 2)
  assert.equal(warmupCap(6.9 * DAY_MS, 10), 2)
})

test('warmupCap >= 7d → maxDailyFollows', () => {
  assert.equal(warmupCap(7 * DAY_MS, 5), 5)
  assert.equal(warmupCap(30 * DAY_MS, 3), 3)
})

test('decide: permite quando abaixo do cap, sem rate-limit recente, intervalo ok', () => {
  const now = 1_000_000_000_000
  const result = decide({
    now,
    sessionAgeMs: 10 * DAY_MS,
    dailyOkCount: 1,
    maxDailyFollows: 3,
    lastFollowOkAt: now - 60_000,
    lastRateLimitedAt: null,
  })
  assert.deepEqual(result, { ok: true, dailyUsed: 1, dailyCap: 3 })
})

test('decide: nega quando dailyOkCount >= cap', () => {
  const now = 1_000_000_000_000
  const result = decide({
    now,
    sessionAgeMs: 10 * DAY_MS,
    dailyOkCount: 3,
    maxDailyFollows: 3,
    lastFollowOkAt: now - 3600_000,
    lastRateLimitedAt: null,
  })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'daily_cap')
  assert.equal(result.dailyUsed, 3)
  assert.equal(result.dailyCap, 3)
  assert.ok(result.retryAfterMs > 0)
})

test('decide: warmup limita cap em sessão nova mesmo com maxDailyFollows alto', () => {
  const now = 1_000_000_000_000
  const result = decide({
    now,
    sessionAgeMs: 12 * 60 * 60 * 1000, // 12h → cap 1
    dailyOkCount: 1,
    maxDailyFollows: 10,
    lastFollowOkAt: now - 3600_000,
    lastRateLimitedAt: null,
  })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'daily_cap')
  assert.equal(result.dailyCap, 1)
})

test('decide: nega quando intervalo mínimo não fechou', () => {
  const now = 1_000_000_000_000
  const result = decide({
    now,
    sessionAgeMs: 10 * DAY_MS,
    dailyOkCount: 1,
    maxDailyFollows: 3,
    lastFollowOkAt: now - 5_000, // 5s atrás, mínimo é 30s
    lastRateLimitedAt: null,
  })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'min_interval')
  assert.ok(result.retryAfterMs > 0)
  assert.ok(result.retryAfterMs <= MIN_INTERVAL_MS)
})

test('decide: nega durante cooldown pós rate-limit', () => {
  const now = 1_000_000_000_000
  const result = decide({
    now,
    sessionAgeMs: 10 * DAY_MS,
    dailyOkCount: 0,
    maxDailyFollows: 3,
    lastFollowOkAt: null,
    lastRateLimitedAt: now - 10 * 60 * 1000, // 10min atrás
  })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'rate_limited')
  assert.ok(result.retryAfterMs > 0)
  assert.ok(result.retryAfterMs <= RATE_LIMIT_COOLDOWN_MS)
})

test('decide: cooldown rate-limit já expirou → permite', () => {
  const now = 1_000_000_000_000
  const result = decide({
    now,
    sessionAgeMs: 10 * DAY_MS,
    dailyOkCount: 0,
    maxDailyFollows: 3,
    lastFollowOkAt: null,
    lastRateLimitedAt: now - (RATE_LIMIT_COOLDOWN_MS + 1000),
  })
  assert.equal(result.ok, true)
})

function makeFakeDb({ user, ok = [], rateLimited = null } = {}) {
  return {
    user: { findUnique: async () => user ?? null },
    botConfig: { findUnique: async () => ({ maxDailyFollows: 3 }) },
    followLog: {
      findFirst: async ({ where, orderBy }) => {
        if (where.status === 'ok') return ok[ok.length - 1] ?? null
        if (where.status === 'rate_limited') return rateLimited
        return null
      },
      count: async ({ where }) => {
        if (where?.status === 'ok') return ok.length
        return 0
      },
      create: async ({ data }) => ({ id: 'log-' + Math.random(), ...data }),
    },
  }
}

test('canFollowNow: usuário inexistente retorna ok=false', async () => {
  const db = makeFakeDb({ user: null })
  const decision = await canFollowNow('user-x', { db, now: Date.now() })
  assert.equal(decision.ok, false)
  assert.equal(decision.reason, 'no_user')
})

test('canFollowNow: usuário antigo, sem follows, permite', async () => {
  const now = Date.now()
  const user = { id: 'u', createdAt: new Date(now - 30 * DAY_MS) }
  const db = makeFakeDb({ user })
  const decision = await canFollowNow('u', { db, now })
  assert.equal(decision.ok, true)
  assert.equal(decision.dailyCap, 3)
})

test('canFollowNow: warmup em conta nova bloqueia após 1 follow', async () => {
  const now = Date.now()
  const user = { id: 'u', createdAt: new Date(now - 6 * 60 * 60 * 1000) } // 6h
  const db = makeFakeDb({
    user,
    ok: [{ followedAt: new Date(now - 60 * 60 * 1000) }],
  })
  const decision = await canFollowNow('u', { db, now })
  assert.equal(decision.ok, false)
  assert.equal(decision.reason, 'daily_cap')
  assert.equal(decision.dailyCap, 1)
})

test('logFollow grava com status e error', async () => {
  let created = null
  const db = {
    followLog: { create: async ({ data }) => { created = data; return { id: 'x', ...data } } },
  }
  await logFollow('u', '123@newsletter', 'ok', null, { db })
  assert.equal(created.userId, 'u')
  assert.equal(created.channelJid, '123@newsletter')
  assert.equal(created.status, 'ok')

  await logFollow('u', '123@newsletter', 'rate_limited', 'overlimit', { db })
  assert.equal(created.status, 'rate_limited')
  assert.equal(created.error, 'overlimit')
})
