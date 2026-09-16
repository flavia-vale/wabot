import { monitorEventLoopDelay } from 'node:perf_hooks'

function memorySnapshot() {
  const memory = process.memoryUsage()
  return {
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    heapTotalBytes: memory.heapTotal,
    externalBytes: memory.external,
    arrayBuffersBytes: memory.arrayBuffers,
  }
}

/**
 * Unidade de isolamento de uma sessão dentro de um shard.
 *
 * O runtime injetado é a única peça autorizada a abrir o socket Baileys. Todo
 * recurso mutável pertencente ao tenant fica neste objeto; serviços realmente
 * compartilháveis entram por `services` e nunca carregam identidade de usuário.
 */
export class BaileysSessionContext {
  constructor({ userId, services = {}, runtimeFactory, now = () => Date.now() }) {
    if (!userId) throw new Error('BaileysSessionContext: userId obrigatório')
    if (typeof runtimeFactory !== 'function') throw new Error('BaileysSessionContext: runtimeFactory obrigatório')
    this.userId = userId
    this.services = services
    this.runtimeFactory = runtimeFactory
    this.now = now
    this.state = 'idle'
    this.acceptingCommands = false
    this.startedAt = null
    this.lastHeartbeatAt = null
    this.runtime = null

    this.activeSock = null
    this.pendingSock = null
    this.authState = null
    this.pairingState = null
    this.incomingQueue = null
    this.sendQueue = null
    this.signalCaches = new Map()
    this.retryCaches = new Map()
    this.allowedChatJids = new Set()
    this.selfChatJids = new Set()
    this.knownChannelJids = new Set()
    this.dedup = new Map()
    this.timers = new Set()
    this.listeners = new Set()
    this.backoff = new Map()
    this.metrics = new Map()
    this.callbacks = new Map()
    this.mediaRefs = new Set()
  }

  registerTimer(timer) { this.timers.add(timer); return timer }
  registerDisposer(disposer) { if (typeof disposer === 'function') this.listeners.add(disposer); return disposer }
  heartbeat(at = this.now()) { this.lastHeartbeatAt = at }

  async start() {
    if (this.state === 'running') return false
    if (this.state !== 'idle' && this.state !== 'stopped') throw new Error(`Sessão ${this.userId} não pode iniciar em ${this.state}`)
    this.state = 'starting'
    try {
      const runtime = await this.runtimeFactory({ context: this, userId: this.userId, services: this.services })
      if (!runtime || typeof runtime.start !== 'function' || typeof runtime.stop !== 'function') throw new Error('runtime de sessão inválido')
      this.runtime = runtime
      await runtime.start()
      this.startedAt = this.now()
      this.heartbeat(this.startedAt)
      this.acceptingCommands = true
      this.state = 'running'
      return true
    } catch (error) {
      this.acceptingCommands = false
      this.state = 'failed'
      try { await this.runtime?.stop?.({ timeoutMs: 5_000 }) } catch {}
      this.runtime = null
      await this.disposeResources()
      throw error
    }
  }

  async command(type, payload = {}) {
    if (!this.acceptingCommands || this.state !== 'running') throw new Error(`Sessão ${this.userId} indisponível (${this.state})`)
    if (typeof this.runtime?.command !== 'function') throw new Error('runtime não aceita comandos')
    return this.runtime.command(type, payload)
  }

  async drain({ timeoutMs = 15_000 } = {}) {
    if (['idle', 'stopped'].includes(this.state)) return true
    this.acceptingCommands = false
    this.state = 'draining'
    if (typeof this.runtime?.drain === 'function') await this.runtime.drain({ timeoutMs })
    return true
  }

  async stop({ timeoutMs = 15_000 } = {}) {
    if (this.state === 'stopped') return false
    this.acceptingCommands = false
    if (!['idle', 'failed'].includes(this.state)) await this.drain({ timeoutMs })
    try { await this.runtime?.stop?.({ timeoutMs }) } finally {
      await this.disposeResources()
      this.runtime = null
      this.activeSock = null
      this.pendingSock = null
      this.authState = null
      this.pairingState = null
      this.incomingQueue = null
      this.sendQueue = null
      this.state = 'stopped'
    }
    return true
  }

  async disposeResources() {
    for (const timer of this.timers) { clearTimeout(timer); clearInterval(timer) }
    this.timers.clear()
    for (const dispose of this.listeners) { try { await dispose() } catch {} }
    this.listeners.clear()
    for (const collection of [this.signalCaches, this.retryCaches, this.dedup, this.backoff, this.metrics, this.callbacks]) collection.clear()
    for (const collection of [this.allowedChatJids, this.selfChatJids, this.knownChannelJids, this.mediaRefs]) collection.clear()
  }

  async snapshot() {
    const runtime = typeof this.runtime?.metrics === 'function' ? await this.runtime.metrics() : null
    return {
      userId: this.userId,
      state: this.state,
      acceptingCommands: this.acceptingCommands,
      startedAt: this.startedAt,
      lastHeartbeatAt: this.lastHeartbeatAt,
      queue: runtime?.queue ?? null,
      runtime,
    }
  }
}

export function createShardProcessMetrics({ contexts, eventLoopDelay, startedAt }) {
  const delay = eventLoopDelay
  const ns = value => Number.isFinite(value) ? Math.round((value / 1e6) * 100) / 100 : null
  return {
    pid: process.pid,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    sessions: contexts.size,
    ...memorySnapshot(),
    eventLoopDelayMs: delay ? { p50: ns(delay.percentile(50)), p95: ns(delay.percentile(95)), p99: ns(delay.percentile(99)), max: ns(delay.max) } : null,
  }
}

export function createEventLoopMonitor() {
  const monitor = monitorEventLoopDelay({ resolution: 20 })
  monitor.enable()
  return monitor
}
