// PR-5.B.1: velocity scheduler por canal-destino.
// Plano B / Fase 3: a decisão é SEMPRE por destino (decideDestination). Ordem
// dos cheques: health pause → horário de funcionamento → daily cap → min
// interval → burst cap → allow + reserve. O caminho legado global (decide() +
// botConfig.channel*/janela silenciosa) foi removido no teardown.

import defaultDb from '../db.js'
import { getHealth, isChannelPaused } from './channelHealth.js'
import { HARD_DEFAULT_PRESERVATION } from './preservationConfig.js'

export const DEFER_REASON = Object.freeze({
  HEALTH_PAUSED: 'health_paused',
  QUIET_HOURS: 'quiet_hours',
  // Plano B: defer por estar FORA do horário de funcionamento do destino
  // (semântica nova: envia DENTRO da janela, silêncio FORA).
  OUTSIDE_OPERATING_HOURS: 'outside_operating_hours',
  DAILY_CAP: 'daily_cap',
  MIN_INTERVAL: 'min_interval',
  BURST_CAP: 'burst_cap',
})

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const DEFAULT_QUIET = { startHour: 0, endHour: 6, tz: 'America/Sao_Paulo' }
export const MIN_INTERVAL_JITTER_RATIO = 0.2

function clampPositiveInteger(value, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

export function calculateMinIntervalWithJitterMs(minIntervalSec, random = Math.random) {
  const baseSec = clampPositiveInteger(minIntervalSec, 30)
  const safeRandom = typeof random === 'function' ? random : Math.random
  const jitterRangeSec = Math.floor(baseSec * MIN_INTERVAL_JITTER_RATIO)
  const jitterSec = Math.floor(safeRandom() * (jitterRangeSec + 1))
  return (baseSec + jitterSec) * SEC
}

export function parseQuietHours(raw) {
  if (!raw) return DEFAULT_QUIET
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    return {
      startHour: Number.isFinite(v?.startHour) ? v.startHour : DEFAULT_QUIET.startHour,
      endHour: Number.isFinite(v?.endHour) ? v.endHour : DEFAULT_QUIET.endHour,
      tz: typeof v?.tz === 'string' ? v.tz : DEFAULT_QUIET.tz,
    }
  } catch {
    return DEFAULT_QUIET
  }
}

function tzHourMin(nowMs, tz) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(new Date(nowMs))
  const hour = Number(parts.find(p => p.type === 'hour').value)
  const minute = Number(parts.find(p => p.type === 'minute').value)
  return { hour, minute }
}

export function tzDayBucket(nowMs, tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(nowMs))
}

export function quietHoursState(nowMs, { startHour, endHour, tz }) {
  const { hour, minute } = tzHourMin(nowMs, tz)
  const inQuiet = startHour <= endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour
  if (!inQuiet) return { inQuiet: false, deferMs: 0 }
  const currentMins = hour * 60 + minute
  let endMins = endHour * 60
  if (endMins <= currentMins) endMins += 24 * 60
  return { inQuiet: true, deferMs: (endMins - currentMins) * MIN }
}

// Plano B: horário de FUNCIONAMENTO (envia DENTRO, silêncio FORA). É o
// complemento da janela silenciosa. Devolve deferMs = tempo até a próxima
// abertura quando está fora. Janela start==end = 24h (sempre aberto).
export function operatingHoursState(nowMs, { startHour, endHour, tz }) {
  if (startHour === endHour) return { inOperating: true, deferMs: 0 }
  const { hour, minute } = tzHourMin(nowMs, tz)
  const inOperating = startHour <= endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour
  if (inOperating) return { inOperating: true, deferMs: 0 }
  const currentMins = hour * 60 + minute
  let startMins = startHour * 60
  if (startMins <= currentMins) startMins += 24 * 60
  return { inOperating: false, deferMs: (startMins - currentMins) * MIN }
}

function toMs(v) {
  if (v == null) return null
  return v instanceof Date ? v.getTime() : new Date(v).getTime()
}

/**
 * Plano B — decisão pura por DESTINO (config direcionada). Único caminho de
 * decisão após o teardown. Cheques:
 *  - HORÁRIO DE FUNCIONAMENTO (bloqueia FORA da janela), não janela silenciosa;
 *  - limites anti-ban vindos do destino resolvido (dest.*), não do botConfig.
 * `ignoreOperatingHours` (fonte com horário próprio, ex.: fila) pula só o gate
 * de horário, mantendo o anti-ban.
 * @param {{ now:number, throttle:object|null, isPaused:boolean,
 *   dest:object, ignoreOperatingHours?:boolean }} input
 */
export function decideDestination({ now, throttle, isPaused, dest, ignoreOperatingHours, random = Math.random }) {
  if (isPaused) {
    return { allow: false, reason: DEFER_REASON.HEALTH_PAUSED, deferUntil: now + HOUR }
  }
  const hours = parseQuietHours(dest.operatingHoursJson)
  if (dest.operatingHoursEnabled === true && ignoreOperatingHours !== true) {
    const s = operatingHoursState(now, hours)
    if (!s.inOperating) {
      return { allow: false, reason: DEFER_REASON.OUTSIDE_OPERATING_HOURS, deferUntil: now + s.deferMs }
    }
  }

  const throttleOn = dest.throttleEnabled !== false
  const today = tzDayBucket(now, hours.tz)
  const sameDay = throttle?.dayBucket === today
  const postsToday = sameDay ? (throttle?.postsToday ?? 0) : 0

  if (throttleOn && dest.dailyCap != null && postsToday >= dest.dailyCap) {
    return { allow: false, reason: DEFER_REASON.DAILY_CAP, deferUntil: now + DAY }
  }

  const minIntervalMs = calculateMinIntervalWithJitterMs(dest.minIntervalSec, random)
  const lastPostMs = toMs(throttle?.lastPostAt)
  if (throttleOn && lastPostMs && now - lastPostMs < minIntervalMs) {
    return { allow: false, reason: DEFER_REASON.MIN_INTERVAL, deferUntil: lastPostMs + minIntervalMs }
  }

  const burstWindowMs = (dest.burstWindowSec ?? 3600) * SEC
  const burstCap = dest.burstCap ?? 6
  const winStartMs = toMs(throttle?.burstWindowStart)
  const windowActive = winStartMs && now - winStartMs < burstWindowMs
  const postsInWindow = windowActive ? (throttle?.postsInBurstWindow ?? 0) : 0
  if (throttleOn && windowActive && postsInWindow >= burstCap) {
    return { allow: false, reason: DEFER_REASON.BURST_CAP, deferUntil: winStartMs + burstWindowMs }
  }

  return { allow: true }
}

/**
 * Decide e (se allow) reserva o slot atomicamente via upsert.
 *
 * Plano B / Fase 3: a decisão é SEMPRE por destino. `opts.destPreservation` traz
 * a config resolvida (preset/override → preset default → HARD_DEFAULT). Sem ele,
 * cai no HARD_DEFAULT — nunca sem proteção anti-ban. O 2º parâmetro `botConfig`
 * é mantido só por compatibilidade de assinatura (não é mais lido).
 * @param {string} groupId
 * @param {object} _botConfig (legado, ignorado)
 * @param {{ db?: any, now?: number, getHealth?: function,
 *   destPreservation?: object, ignoreGlobalQuietHours?: boolean }} [opts]
 */
export async function checkAndReserve(groupId, _botConfig, opts = {}) {
  const now = opts.now ?? Date.now()
  const dest = opts.destPreservation ?? HARD_DEFAULT_PRESERVATION
  const db = opts.db ?? defaultDb
  const fetchHealth = opts.getHealth ?? ((id) => getHealth(id, { db }))

  const [health, throttle] = await Promise.all([
    fetchHealth(groupId),
    db.channelThrottle.findUnique({ where: { groupId } }),
  ])
  const decision = decideDestination({
    now,
    throttle,
    isPaused: isChannelPaused(health, now),
    dest,
    ignoreOperatingHours: opts.ignoreGlobalQuietHours === true,
    random: opts.random,
  })
  if (!decision.allow) return decision

  if (dest.throttleEnabled !== false) {
    await reserve(db, groupId, throttle, now, {
      burstWindowSec: dest.burstWindowSec,
      tz: parseQuietHours(dest.operatingHoursJson).tz,
    })
  }
  return decision
}

// `effective` = { burstWindowSec, tz }. Aceita também o formato legado do
// botConfig (channelBurstWindowSec/channelQuietHoursJson) para retrocompat dos
// chamadores antigos (ex.: recordPost).
async function reserve(db, groupId, throttle, now, effective = {}) {
  const tz = effective.tz ?? parseQuietHours(effective.channelQuietHoursJson).tz
  const burstWindowSec = effective.burstWindowSec ?? effective.channelBurstWindowSec
  const today = tzDayBucket(now, tz)
  const burstWindowMs = (burstWindowSec ?? 3600) * SEC
  const winStartMs = toMs(throttle?.burstWindowStart)
  const windowActive = winStartMs && now - winStartMs < burstWindowMs

  const sameDay = throttle?.dayBucket === today
  const postsToday = sameDay ? (throttle?.postsToday ?? 0) : 0

  const burstWindowStart = windowActive ? throttle.burstWindowStart : new Date(now)
  const postsInBurstWindow = windowActive ? (throttle?.postsInBurstWindow ?? 0) + 1 : 1

  await db.channelThrottle.upsert({
    where: { groupId },
    create: {
      groupId,
      lastPostAt: new Date(now),
      burstWindowStart,
      postsInBurstWindow,
      postsToday: postsToday + 1,
      dayBucket: today,
    },
    update: {
      lastPostAt: new Date(now),
      burstWindowStart,
      postsInBurstWindow,
      postsToday: postsToday + 1,
      dayBucket: today,
    },
  })
}

/**
 * Atualiza contadores após envio bem-sucedido. Idempotente em relação ao
 * reserve do checkAndReserve — geralmente só chamar se o reserve não rolou
 * (ex.: caminho legado). Hoje serve como hook para futuro stagger.
 */
export async function recordPost(groupId, opts = {}) {
  const db = opts.db ?? defaultDb
  const now = opts.now ?? Date.now()
  const botConfig = opts.botConfig ?? {}
  const throttle = await db.channelThrottle.findUnique({ where: { groupId } })
  await reserve(db, groupId, throttle, now, botConfig)
}
