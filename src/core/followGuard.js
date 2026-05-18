// PR-5.0 skeleton. Implementação real virá na PR-5.A.
// Por enquanto canFollowNow sempre permite, logFollow é no-op tipado.

/**
 * @typedef {Object} FollowGuardDecision
 * @property {boolean} ok
 * @property {string} [reason]
 * @property {number} [retryAfterMs]
 * @property {number} [dailyUsed]
 * @property {number} [dailyCap]
 */

/**
 * @returns {FollowGuardDecision}
 */
export function canFollowNow(_userId, _opts = {}) {
  return { ok: true }
}

export async function logFollow(_userId, _channelJid, _status, _error) {
  return null
}
