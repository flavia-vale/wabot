import test from 'node:test'
import assert from 'node:assert/strict'

import {
  checkAndReserve,
  recordPost,
  decide,
  quietHoursState,
  tzDayBucket,
  DEFER_REASON,
} from '../../src/core/channelThrottle.js'

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN

const DEFAULT_CONFIG = {
  channelMinIntervalSec: 30,
  channelBurstCap: 6,
  channelBurstWindowSec: 600,
  channelDailyCap: null,
  channelStaggerJitterMs: 0,
  channelQuietHoursJson: '{"startHour":0,"endHour":6,"tz":"America/Sao_Paulo"}',
}

// 2026-01-15 14:00 UTC = 11:00 BRT (UTC-3) → fora do quiet 0–6
const NOON_BRT_MS = Date.UTC(2026, 0, 15, 14, 0, 0)
// 2026-01-15 05:30 UTC = 02:30 BRT → dentro do quiet 0–6
const EARLY_BRT_MS = Date.UTC(2026, 0, 15, 5, 30, 0)

// ---------- helpers puros ----------

test('quietHoursState detecta fora do intervalo', () => {
  const state = quietHoursState(NOON_BRT_MS, { startHour: 0, endHour: 6, tz: 'America/Sao_Paulo' })
  assert.equal(state.inQuiet, false)
  assert.equal(state.deferMs, 0)
})

test('quietHoursState detecta dentro do intervalo e calcula tempo até o fim', () => {
  const state = quietHoursState(EARLY_BRT_MS, { startHour: 0, endHour: 6, tz: 'America/Sao_Paulo' })
  assert.equal(state.inQuiet, true)
  // 02:30 → 06:00 = 3h30 = 12_600_000ms
  assert.equal(state.deferMs, 3.5 * HOUR)
})

test('quietHoursState com janela que cruza meia-noite', () => {
  // quiet 22-06 BRT, agora 23:00 BRT = 02:00 UTC do dia seguinte
  const at23BRT = Date.UTC(2026, 0, 16, 2, 0, 0)
  const state = quietHoursState(at23BRT, { startHour: 22, endHour: 6, tz: 'America/Sao_Paulo' })
  assert.equal(state.inQuiet, true)
  // 23:00 → 06:00 (próximo dia) = 7h
  assert.equal(state.deferMs, 7 * HOUR)
})

test('tzDayBucket retorna data no formato yyyy-mm-dd no tz informado', () => {
  // 2026-01-16 02:00 UTC = 2026-01-15 23:00 BRT
  const lateBRT = Date.UTC(2026, 0, 16, 2, 0, 0)
  assert.equal(tzDayBucket(lateBRT, 'America/Sao_Paulo'), '2026-01-15')
  assert.equal(tzDayBucket(lateBRT, 'UTC'), '2026-01-16')
})

// ---------- decide ----------

test('decide: canal pausado pelo health → recusa', () => {
  const res = decide({
    now: NOON_BRT_MS,
    throttle: null,
    isPaused: true,
    pausedUntil: NOON_BRT_MS + HOUR,
    botConfig: DEFAULT_CONFIG,
  })
  assert.equal(res.allow, false)
  assert.equal(res.reason, DEFER_REASON.HEALTH_PAUSED)
})

test('decide: quiet hours difere até fim do intervalo', () => {
  const res = decide({
    now: EARLY_BRT_MS,
    throttle: null,
    isPaused: false,
    botConfig: DEFAULT_CONFIG,
  })
  assert.equal(res.allow, false)
  assert.equal(res.reason, DEFER_REASON.QUIET_HOURS)
  assert.equal(res.deferUntil, EARLY_BRT_MS + 3.5 * HOUR)
})

test('decide: dailyCap atingido → defer 24h', () => {
  const res = decide({
    now: NOON_BRT_MS,
    throttle: {
      postsToday: 10,
      dayBucket: tzDayBucket(NOON_BRT_MS, 'America/Sao_Paulo'),
      lastPostAt: null,
      burstWindowStart: null,
      postsInBurstWindow: 0,
    },
    isPaused: false,
    botConfig: { ...DEFAULT_CONFIG, channelDailyCap: 10 },
  })
  assert.equal(res.allow, false)
  assert.equal(res.reason, DEFER_REASON.DAILY_CAP)
})

test('decide: dailyCap de outro dia não bloqueia', () => {
  const res = decide({
    now: NOON_BRT_MS,
    throttle: {
      postsToday: 10,
      dayBucket: '2025-12-31',
      lastPostAt: null,
      burstWindowStart: null,
      postsInBurstWindow: 0,
    },
    isPaused: false,
    botConfig: { ...DEFAULT_CONFIG, channelDailyCap: 10 },
  })
  assert.equal(res.allow, true)
})

test('decide: intervalo mínimo não fechou → defer até o gap', () => {
  const lastPostMs = NOON_BRT_MS - 10 * SEC
  const res = decide({
    now: NOON_BRT_MS,
    throttle: {
      postsToday: 1,
      dayBucket: tzDayBucket(NOON_BRT_MS, 'America/Sao_Paulo'),
      lastPostAt: new Date(lastPostMs),
      burstWindowStart: new Date(lastPostMs),
      postsInBurstWindow: 1,
    },
    isPaused: false,
    botConfig: DEFAULT_CONFIG,
  })
  assert.equal(res.allow, false)
  assert.equal(res.reason, DEFER_REASON.MIN_INTERVAL)
  assert.equal(res.deferUntil, lastPostMs + 30 * SEC)
})

test('decide: burst cap atingido na janela móvel → defer', () => {
  const windowStart = NOON_BRT_MS - 5 * MIN
  const res = decide({
    now: NOON_BRT_MS,
    throttle: {
      postsToday: 6,
      dayBucket: tzDayBucket(NOON_BRT_MS, 'America/Sao_Paulo'),
      lastPostAt: new Date(NOON_BRT_MS - 60 * SEC),
      burstWindowStart: new Date(windowStart),
      postsInBurstWindow: 6,
    },
    isPaused: false,
    botConfig: DEFAULT_CONFIG,
  })
  assert.equal(res.allow, false)
  assert.equal(res.reason, DEFER_REASON.BURST_CAP)
  // janela começou em -5min, fecha em +5min (600s)
  assert.equal(res.deferUntil, windowStart + 10 * MIN)
})

test('decide: burst window expirou → permite', () => {
  const windowStart = NOON_BRT_MS - 20 * MIN
  const res = decide({
    now: NOON_BRT_MS,
    throttle: {
      postsToday: 6,
      dayBucket: tzDayBucket(NOON_BRT_MS, 'America/Sao_Paulo'),
      lastPostAt: new Date(NOON_BRT_MS - 60 * SEC),
      burstWindowStart: new Date(windowStart),
      postsInBurstWindow: 6,
    },
    isPaused: false,
    botConfig: DEFAULT_CONFIG,
  })
  assert.equal(res.allow, true)
})

test('decide: sem throttle anterior → permite', () => {
  const res = decide({
    now: NOON_BRT_MS,
    throttle: null,
    isPaused: false,
    botConfig: DEFAULT_CONFIG,
  })
  assert.equal(res.allow, true)
})

// ---------- I/O com fake db ----------

function makeFakeDb(initial = new Map()) {
  return {
    _records: initial,
    channelThrottle: {
      findUnique: async ({ where }) => initial.get(where.groupId) ?? null,
      upsert: async ({ where, create, update }) => {
        const existing = initial.get(where.groupId)
        const next = existing ? { ...existing, ...update } : { id: 't', groupId: where.groupId, ...create }
        initial.set(where.groupId, next)
        return next
      },
    },
  }
}

test('checkAndReserve aloca o primeiro slot e atualiza throttle', async () => {
  const db = makeFakeDb()
  const res = await checkAndReserve('g-1', DEFAULT_CONFIG, {
    db,
    now: NOON_BRT_MS,
    getHealth: async () => ({ status: 'green', pausedUntil: null }),
  })
  assert.equal(res.allow, true)
  const stored = db._records.get('g-1')
  assert.equal(stored.postsToday, 1)
  assert.equal(stored.postsInBurstWindow, 1)
  assert.ok(stored.lastPostAt)
})

test('checkAndReserve respeita pausa do health', async () => {
  const db = makeFakeDb()
  const res = await checkAndReserve('g-1', DEFAULT_CONFIG, {
    db,
    now: NOON_BRT_MS,
    getHealth: async () => ({ status: 'red', pausedUntil: new Date(NOON_BRT_MS + HOUR) }),
  })
  assert.equal(res.allow, false)
  assert.equal(res.reason, DEFER_REASON.HEALTH_PAUSED)
  // não reservou
  assert.equal(db._records.size, 0)
})

test('recordPost incrementa contadores e atualiza burst window', async () => {
  const db = makeFakeDb()
  await recordPost('g-1', { db, now: NOON_BRT_MS, botConfig: DEFAULT_CONFIG })
  await recordPost('g-1', { db, now: NOON_BRT_MS + 60 * SEC, botConfig: DEFAULT_CONFIG })
  const stored = db._records.get('g-1')
  assert.equal(stored.postsToday, 2)
  assert.equal(stored.postsInBurstWindow, 2)
})

test('checkAndReserve curto-circuita quando preservationActive=false', async () => {
  const db = {
    channelThrottle: {
      findUnique: async () => { throw new Error('NÃO deveria consultar throttle quando gating off') },
      upsert: async () => { throw new Error('NÃO deveria reservar quando gating off') },
    },
  }
  const result = await checkAndReserve('g-1', { channelMinIntervalSec: 30 }, {
    db,
    preservationActive: false,
    getHealth: async () => ({}),
  })
  assert.equal(result.allow, true)
  assert.equal(result.reason, 'gating_off')
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

test('decide: throttle desligado ignora limites, mas mantém janela silenciosa independente', () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0)
  const result = decide({
    now,
    throttle: {
      postsToday: 999,
      dayBucket: tzDayBucket(now, 'UTC'),
      lastPostAt: new Date(now - 1_000),
      burstWindowStart: new Date(now - 60_000),
      postsInBurstWindow: 999,
    },
    isPaused: false,
    botConfig: {
      channelThrottleEnabled: false,
      quietHoursEnabled: false,
      channelQuietHoursJson: JSON.stringify({ startHour: 0, endHour: 23, tz: 'UTC' }),
      channelDailyCap: 1,
      channelMinIntervalSec: 3600,
      channelBurstWindowSec: 3600,
      channelBurstCap: 1,
    },
  })
  assert.equal(result.allow, true)
})

test('decide: janela silenciosa pode bloquear com throttle desligado', () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0)
  const result = decide({
    now,
    throttle: null,
    isPaused: false,
    botConfig: {
      channelThrottleEnabled: false,
      quietHoursEnabled: true,
      channelQuietHoursJson: JSON.stringify({ startHour: 10, endHour: 14, tz: 'UTC' }),
    },
  })
  assert.equal(result.allow, false)
  assert.equal(result.reason, DEFER_REASON.QUIET_HOURS)
})

test('decide: pausa de saúde bloqueia mesmo com throttle desligado', () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0)
  const result = decide({
    now,
    throttle: null,
    isPaused: true,
    botConfig: {
      channelThrottleEnabled: false,
      quietHoursEnabled: true,
      channelQuietHoursJson: JSON.stringify({ startHour: 0, endHour: 6, tz: 'UTC' }),
    },
  })
  assert.equal(result.allow, false)
  assert.equal(result.reason, DEFER_REASON.HEALTH_PAUSED)
})

// ============================================================================
// Janela silenciosa POR GRUPO (override da global)
// ============================================================================

test('decide: janela do grupo sobrepõe a global (bloqueia quando global liberaria)', () => {
  const now = Date.UTC(2026, 0, 15, 14, 0, 0) // 11:00 BRT
  const result = decide({
    now,
    throttle: null,
    isPaused: false,
    botConfig: {
      quietHoursEnabled: true,
      // global silenciaria 0-6: às 11h NÃO bloquearia
      channelQuietHoursJson: JSON.stringify({ startHour: 0, endHour: 6, tz: 'America/Sao_Paulo' }),
    },
    group: {
      quietHoursEnabled: true,
      // grupo silencia 10-14: às 11h BLOQUEIA
      quietHoursJson: JSON.stringify({ startHour: 10, endHour: 14, tz: 'America/Sao_Paulo' }),
    },
  })
  assert.equal(result.allow, false)
  assert.equal(result.reason, DEFER_REASON.QUIET_HOURS)
})

test('decide: janela do grupo sobrepõe a global (libera quando global bloquearia)', () => {
  const now = EARLY_BRT_MS // 02:30 BRT
  const result = decide({
    now,
    throttle: null,
    isPaused: false,
    botConfig: {
      quietHoursEnabled: true,
      // global silencia 0-6: às 02:30 bloquearia
      channelQuietHoursJson: JSON.stringify({ startHour: 0, endHour: 6, tz: 'America/Sao_Paulo' }),
    },
    group: {
      quietHoursEnabled: true,
      // grupo silencia 10-14: às 02:30 NÃO bloqueia → override libera
      quietHoursJson: JSON.stringify({ startHour: 10, endHour: 14, tz: 'America/Sao_Paulo' }),
    },
  })
  assert.equal(result.allow, true)
})

test('decide: grupo sem override cai na global', () => {
  const result = decide({
    now: EARLY_BRT_MS,
    throttle: null,
    isPaused: false,
    botConfig: DEFAULT_CONFIG,
    group: { quietHoursEnabled: false, quietHoursJson: null },
  })
  assert.equal(result.allow, false)
  assert.equal(result.reason, DEFER_REASON.QUIET_HOURS)
})

// ============================================================================
// ignoreGlobalQuietHours: fila com horário próprio sobrepõe a janela GLOBAL
// (Item 2 do plano "fila serial: horário da fila ignora a global no worker")
// ============================================================================

test('decide: ignoreGlobalQuietHours libera dentro da janela silenciosa GLOBAL', () => {
  const result = decide({
    now: EARLY_BRT_MS, // 02:30 BRT, dentro do quiet global 0-6
    throttle: null,
    isPaused: false,
    botConfig: {
      quietHoursEnabled: true,
      channelQuietHoursJson: JSON.stringify({ startHour: 0, endHour: 6, tz: 'America/Sao_Paulo' }),
    },
    ignoreGlobalQuietHours: true,
  })
  assert.equal(result.allow, true)
})

test('decide: ignoreGlobalQuietHours NÃO afeta a janela explícita POR GRUPO', () => {
  const now = Date.UTC(2026, 0, 15, 14, 0, 0) // 11:00 BRT
  const result = decide({
    now,
    throttle: null,
    isPaused: false,
    botConfig: {
      quietHoursEnabled: true,
      channelQuietHoursJson: JSON.stringify({ startHour: 0, endHour: 6, tz: 'America/Sao_Paulo' }),
    },
    // grupo silencia 10-14 → escolha por destino, deve continuar bloqueando
    group: { quietHoursEnabled: true, quietHoursJson: JSON.stringify({ startHour: 10, endHour: 14, tz: 'America/Sao_Paulo' }) },
    ignoreGlobalQuietHours: true,
  })
  assert.equal(result.allow, false)
  assert.equal(result.reason, DEFER_REASON.QUIET_HOURS)
})

test('decide: ignoreGlobalQuietHours mantém anti-ban (burst cap continua bloqueando)', () => {
  const now = NOON_BRT_MS
  const windowStart = now - 5 * MIN
  const result = decide({
    now,
    throttle: {
      postsToday: 6,
      dayBucket: tzDayBucket(now, 'America/Sao_Paulo'),
      lastPostAt: new Date(now - 60 * SEC),
      burstWindowStart: new Date(windowStart),
      postsInBurstWindow: 6,
    },
    isPaused: false,
    botConfig: { ...DEFAULT_CONFIG, quietHoursEnabled: true, channelBurstWindowSec: 600 },
    ignoreGlobalQuietHours: true,
  })
  assert.equal(result.allow, false)
  assert.equal(result.reason, DEFER_REASON.BURST_CAP)
})

test('checkAndReserve propaga ignoreGlobalQuietHours para decide', async () => {
  const db = makeFakeDb()
  // 02:30 BRT dentro do quiet global 0-6, mas a fila tem horário próprio
  const res = await checkAndReserve('g-1', {
    quietHoursEnabled: true,
    channelQuietHoursJson: JSON.stringify({ startHour: 0, endHour: 6, tz: 'America/Sao_Paulo' }),
    channelMinIntervalSec: 30,
    channelBurstCap: 6,
    channelBurstWindowSec: 600,
  }, {
    db,
    now: EARLY_BRT_MS,
    ignoreGlobalQuietHours: true,
    getHealth: async () => ({ status: 'green', pausedUntil: null }),
  })
  assert.equal(res.allow, true)
  assert.equal(db._records.get('g-1').postsToday, 1)
})

test('checkAndReserve: janela do grupo vale mesmo com preservationActive=false', async () => {
  const db = {
    channelThrottle: {
      findUnique: async () => { throw new Error('não deveria consultar throttle') },
      upsert: async () => { throw new Error('não deveria reservar') },
    },
  }
  // 11:00 BRT, grupo silencia 10-14 → bloqueia apesar do master off
  const result = await checkAndReserve('g-1', {}, {
    db,
    preservationActive: false,
    now: Date.UTC(2026, 0, 15, 14, 0, 0),
    group: { quietHoursEnabled: true, quietHoursJson: JSON.stringify({ startHour: 10, endHour: 14, tz: 'America/Sao_Paulo' }) },
  })
  assert.equal(result.allow, false)
  assert.equal(result.reason, DEFER_REASON.QUIET_HOURS)
})

test('checkAndReserve: preservationActive=false e grupo fora da janela libera (gating_off)', async () => {
  const db = {
    channelThrottle: {
      findUnique: async () => { throw new Error('não deveria consultar throttle') },
      upsert: async () => { throw new Error('não deveria reservar') },
    },
  }
  const result = await checkAndReserve('g-1', {}, {
    db,
    preservationActive: false,
    now: Date.UTC(2026, 0, 15, 14, 0, 0), // 11:00 BRT, fora de 0-6
    group: { quietHoursEnabled: true, quietHoursJson: JSON.stringify({ startHour: 0, endHour: 6, tz: 'America/Sao_Paulo' }) },
  })
  assert.equal(result.allow, true)
  assert.equal(result.reason, 'gating_off')
})

test('checkAndReserve não grava contadores quando throttle está desligado', async () => {
  let writes = 0
  const db = {
    channelThrottle: {
      findUnique: async () => null,
      upsert: async () => { writes++ },
    },
  }
  const result = await checkAndReserve('g-quiet-only', {
    channelThrottleEnabled: false,
    quietHoursEnabled: true,
    channelQuietHoursJson: JSON.stringify({ startHour: 0, endHour: 0, tz: 'UTC' }),
  }, {
    db,
    now: Date.UTC(2026, 0, 15, 12, 0, 0),
    getHealth: async () => ({ pausedUntil: null }),
  })
  assert.equal(result.allow, true)
  assert.equal(writes, 0)
})
