const DEFAULT_TIMEOUT_MS = Math.max(Number(process.env.WORKER_STALE_RESTART_WAIT_MS || 12_000), 1_000)
const DEFAULT_POLL_MS = Math.max(Number(process.env.WORKER_STALE_RESTART_POLL_MS || 250), 50)

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

export async function restartStaleWorkerIfNeeded({
  userId,
  platform,
  workerHealth,
  stopBot,
  startBot,
  isRunning,
  sleep = delay,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pollMs = DEFAULT_POLL_MS,
} = {}) {
  if (!workerHealth?.restartRecommended) return { attempted: false, reason: 'worker_current' }
  if (platform !== 'amazon') return { attempted: false, reason: 'platform_not_remediated' }

  const stopped = Boolean(await stopBot(userId))
  if (!stopped) {
    const started = Boolean(await startBot(userId))
    return { attempted: true, reason: 'stale_worker_start_attempted', stopped, started, timedOutWaitingStop: false }
  }

  const deadline = Date.now() + timeoutMs
  let timedOutWaitingStop = false
  while (Boolean(await isRunning(userId))) {
    if (Date.now() >= deadline) {
      timedOutWaitingStop = true
      break
    }
    await sleep(pollMs)
  }

  const started = timedOutWaitingStop ? false : Boolean(await startBot(userId))
  return {
    attempted: true,
    reason: timedOutWaitingStop ? 'stale_worker_stop_timeout' : 'stale_worker_restarted',
    stopped,
    started,
    timedOutWaitingStop,
  }
}
