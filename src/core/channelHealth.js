// PR-5.0 skeleton. Implementação real virá na PR-5.C.1.

export const HEALTH_STATUS = Object.freeze({
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
  CRITICAL: 'critical',
})

/**
 * @typedef {Object} HealthSnapshot
 * @property {'green'|'yellow'|'red'|'critical'} status
 * @property {string|null} [lastError]
 * @property {number} [consecutiveFailures]
 * @property {Date|null} [pausedUntil]
 */

export async function recordSendResult(_groupId, _result) {
  return null
}

export async function recordStreamError(_userId, _code) {
  return null
}

export async function recomputeHealth(_groupId) {
  return null
}

/**
 * @returns {Promise<HealthSnapshot>}
 */
export async function getHealth(_groupId) {
  return { status: HEALTH_STATUS.GREEN }
}
