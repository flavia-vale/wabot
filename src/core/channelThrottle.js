// PR-5.0 skeleton. Implementação real virá na PR-5.B.1.

/**
 * @typedef {Object} ThrottleDecision
 * @property {boolean} allow
 * @property {number} [deferUntil]
 * @property {string} [reason]
 */

/**
 * @returns {ThrottleDecision}
 */
export function checkAndReserve(_groupId, _botConfig, _opts = {}) {
  return { allow: true }
}

export async function recordPost(_groupId, _opts = {}) {
  return null
}
