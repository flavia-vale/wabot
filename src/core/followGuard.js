// PR-5.A: limita newsletterFollow por janela diária + warmup + intervalo +
// cooldown pós rate-limit. Defesa estatística contra fingerprint de farm.
//
// Decisão é pura via `decide(...)`. `canFollowNow`/`logFollow` consultam o
// banco; aceitam `{ db }` para testes.

import defaultDb from '../db.js'
import { writeFollowLog } from '../events/store.js'

const DAY_MS = 24 * 60 * 60 * 1000

export const MIN_INTERVAL_MS = 30_000
export const RATE_LIMIT_COOLDOWN_MS = 60 * 60 * 1000 // 1h
export const DEFAULT_MAX_DAILY_FOLLOWS = 3 // espelha o default do schema

/**
 * @param {number} sessionAgeMs
 * @param {number} maxDailyFollows
 */
export function warmupCap(sessionAgeMs, maxDailyFollows) {
  if (sessionAgeMs < 3 * DAY_MS) return 1
  if (sessionAgeMs < 7 * DAY_MS) return 2
  return maxDailyFollows
}

/**
 * Decisão pura, sem I/O.
 * @param {{
 *   now: number,
 *   sessionAgeMs: number,
 *   dailyOkCount: number,
 *   maxDailyFollows: number,
 *   lastFollowOkAt: number|Date|null,
 *   lastRateLimitedAt: number|Date|null,
 * }} input
 */
export function decide(input) {
  const {
    now,
    sessionAgeMs,
    dailyOkCount,
    maxDailyFollows,
    lastFollowOkAt,
    lastRateLimitedAt,
  } = input

  const cap = warmupCap(sessionAgeMs, maxDailyFollows)

  const rlAt = toMs(lastRateLimitedAt)
  if (rlAt && now - rlAt < RATE_LIMIT_COOLDOWN_MS) {
    return {
      ok: false,
      reason: 'rate_limited',
      retryAfterMs: RATE_LIMIT_COOLDOWN_MS - (now - rlAt),
      dailyUsed: dailyOkCount,
      dailyCap: cap,
    }
  }

  if (dailyOkCount >= cap) {
    return {
      ok: false,
      reason: 'daily_cap',
      retryAfterMs: DAY_MS, // bucket é móvel; usuário tenta de novo daqui 24h
      dailyUsed: dailyOkCount,
      dailyCap: cap,
    }
  }

  const lastAt = toMs(lastFollowOkAt)
  if (lastAt && now - lastAt < MIN_INTERVAL_MS) {
    return {
      ok: false,
      reason: 'min_interval',
      retryAfterMs: MIN_INTERVAL_MS - (now - lastAt),
      dailyUsed: dailyOkCount,
      dailyCap: cap,
    }
  }

  return { ok: true, dailyUsed: dailyOkCount, dailyCap: cap }
}

function toMs(v) {
  if (v == null) return null
  if (typeof v === 'number') return v
  if (v instanceof Date) return v.getTime()
  return null
}

/**
 * @param {string} userId
 * @param {{ db?: any, now?: number }} [opts]
 */
export async function canFollowNow(userId, opts = {}) {
  if (opts.preservationActive === false) {
    return { allow: false, reason: 'gating_off' }
  }
  const db = opts.db ?? defaultDb
  const now = opts.now ?? Date.now()

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, createdAt: true } })
  if (!user) {
    return { ok: false, reason: 'no_user' }
  }

  // O guard em si nunca desliga. followGuardEnabled controla só se o limite
  // diário personalizado do usuário vale; desligado, fica o default seguro.
  const botConfig = await db.botConfig.findUnique({
    where: { userId },
    select: { maxDailyFollows: true, followGuardEnabled: true },
  })
  const maxDailyFollows = botConfig?.followGuardEnabled === true
    ? (botConfig.maxDailyFollows ?? DEFAULT_MAX_DAILY_FOLLOWS)
    : DEFAULT_MAX_DAILY_FOLLOWS

  const since24h = new Date(now - DAY_MS)
  const dailyOkCount = await db.followLog.count({
    where: { userId, status: 'ok', followedAt: { gte: since24h } },
  })

  const lastOk = await db.followLog.findFirst({
    where: { userId, status: 'ok' },
    orderBy: { followedAt: 'desc' },
    select: { followedAt: true },
  })

  const lastRateLimited = await db.followLog.findFirst({
    where: { userId, status: 'rate_limited' },
    orderBy: { followedAt: 'desc' },
    select: { followedAt: true },
  })

  return decide({
    now,
    sessionAgeMs: now - new Date(user.createdAt).getTime(),
    dailyOkCount,
    maxDailyFollows,
    lastFollowOkAt: lastOk?.followedAt ?? null,
    lastRateLimitedAt: lastRateLimited?.followedAt ?? null,
  })
}

/**
 * @param {string} userId
 * @param {string} channelJid
 * @param {'ok'|'error'|'rate_limited'} status
 * @param {string|null} [error]
 * @param {{ db?: any }} [opts]
 */
export async function logFollow(userId, channelJid, status, error = null, opts = {}) {
  const db = opts.db ?? defaultDb
  return writeFollowLog({ userId, channelJid, status, error: error ?? null }, { db })
}
