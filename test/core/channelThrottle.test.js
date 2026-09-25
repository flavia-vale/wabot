import test from 'node:test'
import assert from 'node:assert/strict'

import {
  checkAndReserve,
  recordPost,
  decideDestination,
  calculateMinIntervalWithJitterMs,
  operatingHoursState,
  quietHoursState,
  tzDayBucket,
  DEFER_REASON,
} from '../../src/core/channelThrottle.js'

// Plano B / Fase 3: a função pura legada `decide()` (cadência global + janela
// silenciosa) e o ramo legado de `checkAndReserve` foram removidos no teardown.
// A decisão é SEMPRE por destino via `decideDestination`; sem destPreservation
// explícito, checkAndReserve cai no HARD_DEFAULT.

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN

// botConfig é ignorado por checkAndReserve hoje; mantido só para recordPost
// (reserve legado) e como 2º arg posicional das chamadas.
const DEFAULT_CONFIG = {
  channelBurstWindowSec: 600,
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


test('calculateMinIntervalWithJitterMs applies 0 to 20 percent jitter above the configured interval', () => {
  assert.equal(calculateMinIntervalWithJitterMs(600, () => 0), 600_000)
  assert.equal(calculateMinIntervalWithJitterMs(600, () => 0.999), 720_000)
  assert.equal(calculateMinIntervalWithJitterMs(600, () => 0.5), 660_000)
})

test('calculateMinIntervalWithJitterMs clamps invalid interval to the hard default before jitter', () => {
  assert.equal(calculateMinIntervalWithJitterMs(null, () => 0), 30_000)
  assert.equal(calculateMinIntervalWithJitterMs(undefined, () => 0.999), 36_000)
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

test('checkAndReserve aloca o primeiro slot e atualiza throttle (sem dest → HARD_DEFAULT)', async () => {
  const db = makeFakeDb()
  const res = await checkAndReserve('g-1', DEFAULT_CONFIG, {
    db,
    now: NOON_BRT_MS,
    getHealth: async () => ({ status: 'green', pausedUntil: null }),
  })
  assert.equal(res.allow, true)
  const stored = db._records.get('g-1')
  assert.equal(stored.postsToday, 1)
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

test('recordPost incrementa contadores', async () => {
  const db = makeFakeDb()
  await recordPost('g-1', { db, now: NOON_BRT_MS, botConfig: DEFAULT_CONFIG })
  await recordPost('g-1', { db, now: NOON_BRT_MS + 60 * SEC, botConfig: DEFAULT_CONFIG })
  const stored = db._records.get('g-1')
  assert.equal(stored.postsToday, 2)
})

// ============================================================================
// Plano B — horário de funcionamento + decisão por DESTINO
// ============================================================================

const DEST_DEFAULT = {
  operatingHoursEnabled: false,
  operatingHoursJson: '{"startHour":8,"endHour":22,"tz":"America/Sao_Paulo"}',
  throttleEnabled: true,
  minIntervalSec: 30,
  dailyCap: null,
}

test('operatingHoursState: dentro da janela funciona (deferMs 0)', () => {
  // 11:00 BRT, funcionamento 8-22
  const s = operatingHoursState(NOON_BRT_MS, { startHour: 8, endHour: 22, tz: 'America/Sao_Paulo' })
  assert.equal(s.inOperating, true)
  assert.equal(s.deferMs, 0)
})

test('operatingHoursState: fora da janela difere até a abertura', () => {
  // 02:30 BRT, funcionamento 8-22 → abre 08:00 = +5h30
  const s = operatingHoursState(EARLY_BRT_MS, { startHour: 8, endHour: 22, tz: 'America/Sao_Paulo' })
  assert.equal(s.inOperating, false)
  assert.equal(s.deferMs, 5.5 * HOUR)
})

test('operatingHoursState: janela que cruza meia-noite (envia 22-8)', () => {
  // 02:30 BRT, funcionamento 22-8 → está dentro
  const s = operatingHoursState(EARLY_BRT_MS, { startHour: 22, endHour: 8, tz: 'America/Sao_Paulo' })
  assert.equal(s.inOperating, true)
})

test('operatingHoursState: start==end = 24h sempre aberto', () => {
  const s = operatingHoursState(EARLY_BRT_MS, { startHour: 0, endHour: 0, tz: 'UTC' })
  assert.equal(s.inOperating, true)
  assert.equal(s.deferMs, 0)
})

test('decideDestination: fora do horário de funcionamento difere', () => {
  const res = decideDestination({
    now: EARLY_BRT_MS, // 02:30 BRT
    throttle: null,
    isPaused: false,
    dest: { ...DEST_DEFAULT, operatingHoursEnabled: true },
  })
  assert.equal(res.allow, false)
  assert.equal(res.reason, DEFER_REASON.OUTSIDE_OPERATING_HOURS)
  assert.equal(res.deferUntil, EARLY_BRT_MS + 5.5 * HOUR)
})

test('decideDestination: dentro do horário permite', () => {
  const res = decideDestination({
    now: NOON_BRT_MS,
    throttle: null,
    isPaused: false,
    dest: { ...DEST_DEFAULT, operatingHoursEnabled: true },
  })
  assert.equal(res.allow, true)
})

test('decideDestination: horário desabilitado nunca bloqueia por horário', () => {
  const res = decideDestination({
    now: EARLY_BRT_MS,
    throttle: null,
    isPaused: false,
    dest: { ...DEST_DEFAULT, operatingHoursEnabled: false },
  })
  assert.equal(res.allow, true)
})

test('decideDestination: ignoreOperatingHours pula o horário mas mantém o intervalo mínimo', () => {
  const now = NOON_BRT_MS
  const lastPostMs = now - 10 * SEC
  const res = decideDestination({
    now,
    throttle: { postsToday: 6, dayBucket: tzDayBucket(now, 'America/Sao_Paulo'), lastPostAt: new Date(lastPostMs) },
    isPaused: false,
    dest: { ...DEST_DEFAULT, operatingHoursEnabled: true, minIntervalSec: 60 },
    ignoreOperatingHours: true,
    random: () => 0,
  })
  assert.equal(res.allow, false)
  assert.equal(res.reason, DEFER_REASON.MIN_INTERVAL)
})

test('decideDestination: limites anti-ban vêm do destino com jitter de 0% no mínimo', () => {
  const now = NOON_BRT_MS
  const lastPostMs = now - 40 * SEC
  const res = decideDestination({
    now,
    throttle: { postsToday: 1, dayBucket: tzDayBucket(now, 'America/Sao_Paulo'), lastPostAt: new Date(lastPostMs) },
    isPaused: false,
    dest: { ...DEST_DEFAULT, minIntervalSec: 60 }, // 40s < 60s → bloqueia
    random: () => 0,
  })
  assert.equal(res.allow, false)
  assert.equal(res.reason, DEFER_REASON.MIN_INTERVAL)
  assert.equal(res.deferUntil, lastPostMs + 60 * SEC)
})

test('decideDestination waits until lastPostAt plus randomized min interval', () => {
  const now = Date.UTC(2026, 0, 1, 12, 10, 0)
  const lastPostAt = new Date(Date.UTC(2026, 0, 1, 12, 0, 0))
  const res = decideDestination({
    now,
    throttle: { lastPostAt, dayBucket: '2026-01-01', postsToday: 1 },
    isPaused: false,
    dest: {
      ...DEST_DEFAULT,
      minIntervalSec: 600,
      dailyCap: null,
    },
    random: () => 0.999,
  })

  assert.equal(res.allow, false)
  assert.equal(res.reason, DEFER_REASON.MIN_INTERVAL)
  assert.equal(res.deferUntil, Date.UTC(2026, 0, 1, 12, 12, 0))
})

test('decideDestination: dailyCap do destino bloqueia', () => {
  const now = NOON_BRT_MS
  const res = decideDestination({
    now,
    throttle: { postsToday: 10, dayBucket: tzDayBucket(now, 'America/Sao_Paulo'), lastPostAt: null, burstWindowStart: null, postsInBurstWindow: 0 },
    isPaused: false,
    dest: { ...DEST_DEFAULT, dailyCap: 10 },
  })
  assert.equal(res.allow, false)
  assert.equal(res.reason, DEFER_REASON.DAILY_CAP)
  assert.ok(res.deferUntil > now)
  assert.ok(res.deferUntil - now <= 13 * 60 * 60 * 1000, 'daily cap deve liberar na próxima virada local, não em 24h rolantes')
})

test('decideDestination: throttleEnabled=false ignora caps mas horário ainda vale', () => {
  const now = EARLY_BRT_MS
  const res = decideDestination({
    now,
    throttle: { postsToday: 999, dayBucket: tzDayBucket(now, 'America/Sao_Paulo'), lastPostAt: new Date(now - 1), burstWindowStart: new Date(now - 1), postsInBurstWindow: 999 },
    isPaused: false,
    dest: { ...DEST_DEFAULT, throttleEnabled: false, operatingHoursEnabled: true, dailyCap: 1, minIntervalSec: 3600 },
  })
  // fora do horário (02:30, funcionamento 8-22) → bloqueia por horário
  assert.equal(res.allow, false)
  assert.equal(res.reason, DEFER_REASON.OUTSIDE_OPERATING_HOURS)
})

test('decideDestination: pausa de saúde bloqueia primeiro', () => {
  const pausedUntil = NOON_BRT_MS + 12 * 60 * 1000
  const res = decideDestination({
    now: NOON_BRT_MS,
    throttle: null,
    isPaused: { pausedUntil: new Date(pausedUntil) },
    dest: { ...DEST_DEFAULT, operatingHoursEnabled: true },
  })
  assert.equal(res.allow, false)
  assert.equal(res.reason, DEFER_REASON.HEALTH_PAUSED)
  assert.equal(res.deferUntil, pausedUntil)
})

test('checkAndReserve: destPreservation usa horário de funcionamento e reserva slot', async () => {
  const db = makeFakeDb()
  const res = await checkAndReserve('g-dest', {}, {
    db,
    now: NOON_BRT_MS,
    destPreservation: { ...DEST_DEFAULT, operatingHoursEnabled: true },
    getHealth: async () => ({ status: 'green', pausedUntil: null }),
  })
  assert.equal(res.allow, true)
  assert.equal(db._records.get('g-dest').postsToday, 1)
})

test('checkAndReserve: destPreservation fora do horário não reserva', async () => {
  const db = makeFakeDb()
  const res = await checkAndReserve('g-dest', {}, {
    db,
    now: EARLY_BRT_MS,
    destPreservation: { ...DEST_DEFAULT, operatingHoursEnabled: true },
    getHealth: async () => ({ status: 'green', pausedUntil: null }),
  })
  assert.equal(res.allow, false)
  assert.equal(res.reason, DEFER_REASON.OUTSIDE_OPERATING_HOURS)
  assert.equal(db._records.size, 0)
})

test('checkAndReserve: destPreservation com throttleEnabled=false permite sem reservar', async () => {
  const db = makeFakeDb()
  const res = await checkAndReserve('g-dest', {}, {
    db,
    now: NOON_BRT_MS,
    destPreservation: { ...DEST_DEFAULT, throttleEnabled: false },
    getHealth: async () => ({ status: 'green', pausedUntil: null }),
  })
  assert.equal(res.allow, true)
  assert.equal(db._records.size, 0)
})

test('checkAndReserve: ignoreGlobalQuietHours pula o horário do destino mas reserva', async () => {
  const db = makeFakeDb()
  // 02:30 BRT, fora do horário 8-22; mas a fila tem horário próprio → envia.
  const res = await checkAndReserve('g-dest', {}, {
    db,
    now: EARLY_BRT_MS,
    ignoreGlobalQuietHours: true,
    destPreservation: { ...DEST_DEFAULT, operatingHoursEnabled: true },
    getHealth: async () => ({ status: 'green', pausedUntil: null }),
  })
  assert.equal(res.allow, true)
  assert.equal(db._records.get('g-dest').postsToday, 1)
})
