export const STUCK_QUEUE_RECOVERY_MS = 15 * 60_000

export function shouldShowStuckQueueRecovery({ inFlight = 0, oldestInFlightAt = null, now = Date.now(), thresholdMs = STUCK_QUEUE_RECOVERY_MS } = {}) {
  if (!(Number(inFlight) > 0) || !oldestInFlightAt) return false
  const oldest = new Date(oldestInFlightAt).getTime()
  return Number.isFinite(oldest) && Number.isFinite(now) && now - oldest >= thresholdMs
}

