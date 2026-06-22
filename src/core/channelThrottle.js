// PR-5.B.1: velocity scheduler por canal-destino.
// Ordem dos cheques (em decide): health pause → quiet hours → daily cap →
// min interval → burst cap → allow + reserve.

import defaultDb from '../db.js'
import { getHealth, isChannelPaused } from './channelHealth.js'

export const DEFER_REASON = Object.freeze({
  HEALTH_PAUSED: 'health_paused',
  QUIET_HOURS: 'quiet_hours',
  DAILY_CAP: 'daily_cap',
  MIN_INTERVAL: 'min_interval',
  BURST_CAP: 'burst_cap',
})

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const DEFAULT_QUIET = { startHour: 0, endHour: 6, tz: 'America/Sao_Paulo' }

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

function toMs(v) {
  if (v == null) return null
  return v instanceof Date ? v.getTime() : new Date(v).getTime()
}

/**
 * Decisão pura.
 * @param {{
 *   now: number,
 *   throttle: { postsToday: number, dayBucket: string, lastPostAt: Date|null,
 *               burstWindowStart: Date|null, postsInBurstWindow: number } | null,
 *   isPaused: boolean,
 *   botConfig: object,
 *   group?: { quietHoursEnabled?: boolean, quietHoursJson?: string|null } | null,
 *   ignoreGlobalQuietHours?: boolean,
 * }} input
 */
export function decide({ now, throttle, isPaused, botConfig, group, ignoreGlobalQuietHours }) {
  // Pausa por saúde (403/throttle do WhatsApp) é defesa do canal, não
  // preferência de cadência: vale independente do toggle de throttle.
  if (isPaused) {
    return { allow: false, reason: DEFER_REASON.HEALTH_PAUSED, deferUntil: now + HOUR }
  }

  // Janela silenciosa por grupo espelhado (destino) SOBREPÕE a global, igual ao
  // horário de funcionamento por fila. Se o grupo ativa a própria janela, a
  // global é ignorada para ESTE destino; senão, cai na global do BotConfig.
  const groupQuietActive = group?.quietHoursEnabled === true
  const quiet = parseQuietHours(groupQuietActive ? group.quietHoursJson : botConfig.channelQuietHoursJson)
  const q = quietHoursState(now, quiet)
  const quietGateOn = groupQuietActive || botConfig.quietHoursEnabled !== false
  // Fonte com horário de funcionamento PRÓPRIO (ex.: fila de ofertas) ignora a
  // janela silenciosa GLOBAL para este envio — a fila já decidiu que está dentro
  // do seu horário. A janela explícita POR GRUPO (escolha por destino) continua
  // valendo; e todas as proteções anti-ban (health/daily/min_interval/burst)
  // permanecem. Sem o flag = comportamento histórico.
  const skipGlobalQuiet = ignoreGlobalQuietHours === true && !groupQuietActive
  if (quietGateOn && q.inQuiet && !skipGlobalQuiet) {
    return { allow: false, reason: DEFER_REASON.QUIET_HOURS, deferUntil: now + q.deferMs }
  }

  const today = tzDayBucket(now, quiet.tz)
  const sameDay = throttle?.dayBucket === today
  const postsToday = sameDay ? (throttle?.postsToday ?? 0) : 0

  if (botConfig.channelThrottleEnabled !== false && botConfig.channelDailyCap != null && postsToday >= botConfig.channelDailyCap) {
    return { allow: false, reason: DEFER_REASON.DAILY_CAP, deferUntil: now + DAY }
  }

  const minIntervalMs = (botConfig.channelMinIntervalSec ?? 30) * SEC
  const lastPostMs = toMs(throttle?.lastPostAt)
  if (botConfig.channelThrottleEnabled !== false && lastPostMs && now - lastPostMs < minIntervalMs) {
    return {
      allow: false,
      reason: DEFER_REASON.MIN_INTERVAL,
      deferUntil: lastPostMs + minIntervalMs,
    }
  }

  const burstWindowMs = (botConfig.channelBurstWindowSec ?? 3600) * SEC
  const burstCap = botConfig.channelBurstCap ?? 6
  const winStartMs = toMs(throttle?.burstWindowStart)
  const windowActive = winStartMs && now - winStartMs < burstWindowMs
  const postsInWindow = windowActive ? (throttle?.postsInBurstWindow ?? 0) : 0
  if (botConfig.channelThrottleEnabled !== false && windowActive && postsInWindow >= burstCap) {
    return {
      allow: false,
      reason: DEFER_REASON.BURST_CAP,
      deferUntil: winStartMs + burstWindowMs,
    }
  }

  return { allow: true }
}

/**
 * Decide e (se allow) reserva o slot atomicamente via upsert.
 * @param {string} groupId
 * @param {object} botConfig
 * @param {{ db?: any, now?: number, getHealth?: function }} [opts]
 */
export async function checkAndReserve(groupId, botConfig, opts = {}) {
  const now = opts.now ?? Date.now()
  if (opts.preservationActive === false) {
    // Master de preservação off: throttle/health não se aplicam. Mas a janela
    // silenciosa POR GRUPO é uma escolha explícita por destino e continua
    // valendo (não depende do master global nem da global do BotConfig).
    if (opts.group?.quietHoursEnabled === true) {
      const q = quietHoursState(now, parseQuietHours(opts.group.quietHoursJson))
      if (q.inQuiet) return { allow: false, reason: DEFER_REASON.QUIET_HOURS, deferUntil: now + q.deferMs }
    }
    return { allow: true, reason: 'gating_off' }
  }
  const db = opts.db ?? defaultDb
  const fetchHealth = opts.getHealth ?? ((id) => getHealth(id, { db }))

  const [health, throttle] = await Promise.all([
    fetchHealth(groupId),
    db.channelThrottle.findUnique({ where: { groupId } }),
  ])
  const decision = decide({
    now,
    throttle,
    isPaused: isChannelPaused(health, now),
    botConfig,
    group: opts.group ?? null,
    ignoreGlobalQuietHours: opts.ignoreGlobalQuietHours === true,
  })
  if (!decision.allow) return decision

  if (botConfig.channelThrottleEnabled !== false) {
    await reserve(db, groupId, throttle, now, botConfig)
  }
  return decision
}

async function reserve(db, groupId, throttle, now, botConfig) {
  const quiet = parseQuietHours(botConfig.channelQuietHoursJson)
  const today = tzDayBucket(now, quiet.tz)
  const burstWindowMs = (botConfig.channelBurstWindowSec ?? 3600) * SEC
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
