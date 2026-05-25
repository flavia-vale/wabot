import test from 'node:test'
import assert from 'node:assert/strict'

import { checkAndReserve, recordPost } from '../../src/core/channelThrottle.js'

test('checkAndReserve skeleton sempre permite', () => {
  const decision = checkAndReserve('group-x', {})
  assert.equal(decision.allow, true)
})

test('recordPost skeleton é no-op', async () => {
  const result = await recordPost('group-x')
  assert.equal(result, null)
})

// ============================================================================
// CENÁRIOS EXTREMOS — boundaries de quietHours e decide
// ============================================================================

test('quietHoursState: hora exata do startHour entra na janela', () => {
  // 23:00:00 UTC-3 (São Paulo) = 02:00:00 UTC
  const t = new Date('2026-05-20T02:00:00Z').getTime()
  const state = quietHoursState(t, { startHour: 23, endHour: 6, tz: 'America/Sao_Paulo' })
  assert.equal(state.inQuiet, true)
})

test('quietHoursState: hora exata do endHour sai da janela', () => {
  // 06:00:00 UTC-3 = 09:00:00 UTC
  const t = new Date('2026-05-20T09:00:00Z').getTime()
  const state = quietHoursState(t, { startHour: 23, endHour: 6, tz: 'America/Sao_Paulo' })
  assert.equal(state.inQuiet, false)
})

test('quietHoursState: janela 0-0 nunca está em quiet (start==end com start<=end)', () => {
  const t = new Date('2026-05-20T15:00:00Z').getTime()
  const state = quietHoursState(t, { startHour: 0, endHour: 0, tz: 'UTC' })
  assert.equal(state.inQuiet, false)
})

test('decide: dailyCap=null = sem limite diário', () => {
  const result = decide({
    now: Date.now(),
    throttle: { postsToday: 9999, dayBucket: tzDayBucket(Date.now(), 'America/Sao_Paulo'), lastPostAt: null, burstWindowStart: null, postsInBurstWindow: 0 },
    isPaused: false,
    botConfig: { channelDailyCap: null, channelMinIntervalSec: 1, channelBurstCap: 1000, channelBurstWindowSec: 60 },
  })
  assert.equal(result.allow, true)
})

test('decide: dailyCap exatamente atingido bloqueia', () => {
  const now = Date.now()
  const tz = 'America/Sao_Paulo'
  const result = decide({
    now,
    throttle: { postsToday: 10, dayBucket: tzDayBucket(now, tz), lastPostAt: null, burstWindowStart: null, postsInBurstWindow: 0 },
    isPaused: false,
    botConfig: { channelDailyCap: 10, channelMinIntervalSec: 1, channelBurstCap: 100, channelBurstWindowSec: 60 },
  })
  assert.equal(result.allow, false)
  assert.equal(result.reason, DEFER_REASON.DAILY_CAP)
})

test('decide: dailyCap menos 1 ainda permite', () => {
  const now = Date.now()
  const tz = 'America/Sao_Paulo'
  const result = decide({
    now,
    throttle: { postsToday: 9, dayBucket: tzDayBucket(now, tz), lastPostAt: null, burstWindowStart: null, postsInBurstWindow: 0 },
    isPaused: false,
    botConfig: { channelDailyCap: 10, channelMinIntervalSec: 1, channelBurstCap: 100, channelBurstWindowSec: 60 },
  })
  assert.equal(result.allow, true)
})

test('decide: minInterval exatamente cumprido permite', () => {
  const now = Date.now()
  const result = decide({
    now,
    throttle: { postsToday: 0, dayBucket: tzDayBucket(now, 'America/Sao_Paulo'), lastPostAt: new Date(now - 30_000), burstWindowStart: null, postsInBurstWindow: 0 },
    isPaused: false,
    botConfig: { channelDailyCap: null, channelMinIntervalSec: 30, channelBurstCap: 100, channelBurstWindowSec: 60 },
  })
  assert.equal(result.allow, true)
})

test('decide: burstCap exatamente atingido bloqueia', () => {
  const now = Date.now()
  const result = decide({
    now,
    throttle: { postsToday: 0, dayBucket: tzDayBucket(now, 'America/Sao_Paulo'), lastPostAt: null, burstWindowStart: new Date(now - 10_000), postsInBurstWindow: 3 },
    isPaused: false,
    botConfig: { channelDailyCap: null, channelMinIntervalSec: 1, channelBurstCap: 3, channelBurstWindowSec: 60 },
  })
  assert.equal(result.allow, false)
  assert.equal(result.reason, DEFER_REASON.BURST_CAP)
})

test('decide: preservationActive=true (default) NÃO curto-circuita — segue regras normais', () => {
  // confirma que sem flag explícita o gate Phase 5 não aplica (decide é puro)
  const now = Date.now()
  const result = decide({
    now,
    throttle: { postsToday: 0, dayBucket: tzDayBucket(now, 'America/Sao_Paulo'), lastPostAt: null, burstWindowStart: null, postsInBurstWindow: 0 },
    isPaused: false,
    botConfig: { channelDailyCap: null, channelMinIntervalSec: 1, channelBurstCap: 10, channelBurstWindowSec: 60 },
  })
  assert.equal(result.allow, true)
})
