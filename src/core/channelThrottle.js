// PR-5.0 skeleton. Implementação real virá na PR-5.B.1.

/**
 * @typedef {Object} ThrottleDecision
 * @property {boolean} allow
 * @property {number} [deferUntil]
 * @property {string} [reason]
 */
export function decide({ now, throttle, isPaused, botConfig }) {
  if (isPaused) {
    return { allow: false, reason: DEFER_REASON.HEALTH_PAUSED, deferUntil: now + HOUR }
  }

  const quiet = parseQuietHours(botConfig.channelQuietHoursJson)
  const q = quietHoursState(now, quiet)
  if (q.inQuiet) {
    return { allow: false, reason: DEFER_REASON.QUIET_HOURS, deferUntil: now + q.deferMs }
  }

  const today = tzDayBucket(now, quiet.tz)
  const sameDay = throttle?.dayBucket === today
  const postsToday = sameDay ? (throttle?.postsToday ?? 0) : 0

  if (botConfig.channelDailyCap != null && postsToday >= botConfig.channelDailyCap) {
    return { allow: false, reason: DEFER_REASON.DAILY_CAP, deferUntil: now + DAY }
  }

  const minIntervalMs = (botConfig.channelMinIntervalSec ?? 30) * SEC
  const lastPostMs = toMs(throttle?.lastPostAt)
  if (lastPostMs && now - lastPostMs < minIntervalMs) {
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
  if (windowActive && postsInWindow >= burstCap) {
    return {
      allow: false,
      reason: DEFER_REASON.BURST_CAP,
      deferUntil: winStartMs + burstWindowMs,
    }
  }

/**
 * @returns {ThrottleDecision}
 */
export function checkAndReserve(_groupId, _botConfig, _opts = {}) {
  return { allow: true }
}

/**
 * Decide e (se allow) reserva o slot atomicamente via upsert.
 * @param {string} groupId
 * @param {object} botConfig
 * @param {{ db?: any, now?: number, getHealth?: function }} [opts]
 */
export async function checkAndReserve(groupId, botConfig, opts = {}) {
  if (opts.preservationActive === false) {
    return { allow: true, reason: 'gating_off' }
  }
  const db = opts.db ?? defaultDb
  const now = opts.now ?? Date.now()
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
  })
  if (!decision.allow) return decision

  await reserve(db, groupId, throttle, now, botConfig)
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
