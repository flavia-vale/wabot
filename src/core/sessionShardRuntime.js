import { BaileysSessionContext, createEventLoopMonitor, createShardProcessMetrics } from './BaileysSessionContext.js'

export const SHARD_COMMAND = Object.freeze({
  START_SESSION: 'START_SESSION', STOP_SESSION: 'STOP_SESSION', SESSION_COMMAND: 'SESSION_COMMAND',
  DRAIN_SESSION: 'DRAIN_SESSION',
  GET_SESSION_METRICS: 'GET_SESSION_METRICS', GET_SHARD_METRICS: 'GET_SHARD_METRICS',
  DRAIN_SHARD: 'DRAIN_SHARD', SHUTDOWN_SHARD: 'SHUTDOWN_SHARD',
})

export class SessionShardRuntime {
  constructor({ shardId, runtimeFactory, services = {}, maxSessions = 4, emit = () => {} }) {
    if (!shardId) throw new Error('SHARD_ID obrigatório')
    if (typeof runtimeFactory !== 'function') throw new Error('runtimeFactory obrigatório')
    this.shardId = shardId
    this.runtimeFactory = runtimeFactory
    this.services = services
    this.maxSessions = Math.min(4, Math.max(1, Number(maxSessions) || 4))
    this.emit = emit
    this.contexts = new Map()
    this.startedAt = Date.now()
    this.eventLoopDelay = createEventLoopMonitor()
    this.draining = false
  }

  async startSession(userId) {
    if (this.draining) throw new Error('Shard em drenagem')
    const existing = this.contexts.get(userId)
    if (existing?.state === 'running') return { started: false, idempotent: true }
    if (!existing && this.contexts.size >= this.maxSessions) throw new Error(`Limite do shard atingido (${this.maxSessions})`)
    const context = existing || new BaileysSessionContext({ userId, services: this.services, runtimeFactory: this.runtimeFactory })
    this.contexts.set(userId, context)
    try {
      await context.start()
      this.emit({ type: 'SESSION_STARTED', shardId: this.shardId, userId })
      return { started: true }
    } catch (error) {
      this.contexts.delete(userId)
      throw error
    }
  }

  async stopSession(userId) {
    const context = this.contexts.get(userId)
    if (!context) return { stopped: false, idempotent: true }
    await context.stop()
    this.contexts.delete(userId)
    this.emit({ type: 'SESSION_STOPPED', shardId: this.shardId, userId })
    return { stopped: true }
  }

  async drain() {
    this.draining = true
    await Promise.all([...this.contexts.values()].map(context => context.drain()))
    return { drained: true, sessions: this.contexts.size }
  }

  async shutdown() {
    await this.drain()
    const results = await Promise.allSettled([...this.contexts.keys()].map(userId => this.stopSession(userId)))
    this.eventLoopDelay.disable()
    return { stopped: results.filter(result => result.status === 'fulfilled').length, failed: results.filter(result => result.status === 'rejected').length }
  }

  async metrics() {
    const sessions = await Promise.all([...this.contexts.values()].map(context => context.snapshot()))
    return { shardId: this.shardId, process: createShardProcessMetrics({ contexts: this.contexts, eventLoopDelay: this.eventLoopDelay, startedAt: this.startedAt }), sessions }
  }

  async dispatch(message) {
    const { type, userId, payload = {} } = message || {}
    if (!Object.values(SHARD_COMMAND).includes(type)) throw new Error(`Comando de shard desconhecido: ${type}`)
    if ([SHARD_COMMAND.START_SESSION, SHARD_COMMAND.STOP_SESSION, SHARD_COMMAND.SESSION_COMMAND, SHARD_COMMAND.DRAIN_SESSION, SHARD_COMMAND.GET_SESSION_METRICS].includes(type) && !userId) throw new Error(`${type}: userId obrigatório`)
    if (type === SHARD_COMMAND.START_SESSION) return this.startSession(userId)
    if (type === SHARD_COMMAND.STOP_SESSION) return this.stopSession(userId)
    if (type === SHARD_COMMAND.SESSION_COMMAND) return this.contexts.get(userId)?.command(payload.type, payload.payload) ?? Promise.reject(new Error('Sessão não está no shard'))
    if (type === SHARD_COMMAND.DRAIN_SESSION) return this.contexts.get(userId)?.drain(payload) ?? { drained: false, idempotent: true }
    if (type === SHARD_COMMAND.GET_SESSION_METRICS) return this.contexts.get(userId)?.snapshot() ?? null
    if (type === SHARD_COMMAND.GET_SHARD_METRICS) return this.metrics()
    if (type === SHARD_COMMAND.DRAIN_SHARD) return this.drain()
    return this.shutdown()
  }
}
