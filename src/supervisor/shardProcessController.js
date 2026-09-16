import { fork } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { SHARD_COMMAND } from '../core/sessionShardRuntime.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const workerPath = join(__dirname, '..', 'session-shard-worker.js')

export function createShardProcessController({ shardId = 'poc-1', env = process.env, forkImpl = fork, timeoutMs = 60_000, onEvent = () => {} } = {}) {
  let child = null
  let ready = false
  const pending = new Map()
  const sessionSignals = new Map()
  const lastQr = new Map()
  let sequence = 0

  function onMessage(message) {
    if (message?.type === 'SHARD_READY') ready = true
    if (message?.type === 'SESSION_EVENT') {
      const signal = sessionSignals.get(message.userId) || { connectedAt: 0, heartbeatAt: 0 }
      if (message.event?.type === 'heartbeat') signal.heartbeatAt = Date.now()
      if (message.event?.type === 'status' && message.event?.data === 'connected') signal.connectedAt = Date.now()
      if (message.event?.type === 'status' && message.event?.data === 'disconnected') signal.connectedAt = 0
      if (message.event?.type === 'qr') lastQr.set(message.userId, message.event.data)
      if (message.event?.type === 'status' && ['connected', 'disconnected'].includes(message.event?.data)) lastQr.delete(message.userId)
      sessionSignals.set(message.userId, signal)
      onEvent(message)
    }
    if (message?.type === 'SESSION_STOPPED') { sessionSignals.delete(message.userId); lastQr.delete(message.userId) }
    if (message?.type !== 'SHARD_RESULT' || !message.requestId) return
    const request = pending.get(message.requestId)
    if (!request) return
    pending.delete(message.requestId)
    clearTimeout(request.timer)
    if (message.error) request.reject(new Error(message.error)); else request.resolve(message.data)
  }

  async function ensureStarted() {
    if (child && ready) return
    if (child && !child.killed) return waitUntil(() => ready, 10_000, 'Shard não confirmou READY')
    ready = false
    child = forkImpl(workerPath, [], { env: { ...env, SHARD_ID: shardId } })
    child.on('message', onMessage)
    child.once('exit', () => {
      ready = false; child = null
      for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Processo shard encerrou')) }
      pending.clear(); sessionSignals.clear(); lastQr.clear()
    })
    await waitUntil(() => ready, 10_000, 'Shard não confirmou READY')
  }

  function request(type, userId, payload = {}, requestTimeoutMs = timeoutMs) {
    return new Promise((resolve, reject) => {
      if (!child || !ready) return reject(new Error('Shard indisponível'))
      const requestId = `${process.pid}-${Date.now()}-${++sequence}`
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`Timeout ${type}`)) }, requestTimeoutMs)
      timer.unref?.()
      pending.set(requestId, { resolve, reject, timer })
      child.send({ protocolVersion: 1, requestId, shardId, userId, type, payload })
    })
  }

  async function waitUntil(predicate, limitMs, message) {
    const deadline = Date.now() + limitMs
    while (Date.now() < deadline) { if (await predicate()) return true; await new Promise(resolve => setTimeout(resolve, 25)) }
    throw new Error(message)
  }

  return {
    ensureStarted,
    start: async userId => { await ensureStarted(); return request(SHARD_COMMAND.START_SESSION, userId) },
    command: (userId, type, payload = {}) => request(SHARD_COMMAND.SESSION_COMMAND, userId, { type, payload }),
    sessionMetrics: userId => child && ready ? request(SHARD_COMMAND.GET_SESSION_METRICS, userId) : Promise.resolve(null),
    getLastQR: userId => lastQr.get(userId) ?? null,
    stop: userId => child && ready ? request(SHARD_COMMAND.STOP_SESSION, userId) : Promise.resolve({ stopped: false, idempotent: true }),
    drain: userId => child && ready ? request(SHARD_COMMAND.DRAIN_SESSION, userId) : Promise.resolve({ drained: false, idempotent: true }),
    isRunning: async userId => child && ready ? Boolean((await request(SHARD_COMMAND.GET_SESSION_METRICS, userId))?.state === 'running') : false,
    waitForHeartbeat: (userId, ms) => waitUntil(() => {
      const signal = sessionSignals.get(userId)
      return Boolean(signal?.connectedAt && signal?.heartbeatAt >= signal.connectedAt)
    }, ms, 'Shard não confirmou conexão seguida de heartbeat'),
    metrics: () => child && ready ? request(SHARD_COMMAND.GET_SHARD_METRICS) : Promise.resolve(null),
    shutdown: async () => {
      if (!child) return { stopped: false, idempotent: true }
      try { await request(SHARD_COMMAND.SHUTDOWN_SHARD) } catch {}
      await waitUntil(() => child == null, 15_000, 'Shard não encerrou')
      return { stopped: true }
    },
    get pid() { return child?.pid ?? null },
  }
}
