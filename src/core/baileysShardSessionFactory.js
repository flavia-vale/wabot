import { createBotSessionRuntime } from '../bot-worker.js'

export async function createShardSessionRuntime({ context, services }) {
  const pending = new Map()
  let requestSequence = 0
  const sendIpc = message => {
    if (message?.type === 'heartbeat') context.heartbeat(message.ts)
    if (['qr', 'status', 'lifecycle', 'heartbeat'].includes(message?.type)) services.emitSessionEvent?.(context.userId, message)
    if (!message?.requestId) return
    const waiter = pending.get(message.requestId)
    if (!waiter) return
    pending.delete(message.requestId)
    if (message.error) waiter.reject(new Error(message.error)); else waiter.resolve(message.data ?? message.code ?? message)
  }
  const engine = await createBotSessionRuntime({
    userId: context.userId,
    sendIpc,
    exitRuntime: code => { throw Object.assign(new Error(`Sessão solicitou saída (${code})`), { code: 'SESSION_EXIT', exitCode: code }) },
    registerProcessHandlers: false,
    autoStart: false,
    sharedLimits: services,
    ownerInstance: `shard:${services.shardId}`,
  })
  const command = (type, payload = {}, timeoutMs = 45_000) => new Promise((resolve, reject) => {
    const requestId = `${context.userId}-${Date.now()}-${++requestSequence}`
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`Timeout ${type}`)) }, timeoutMs)
    timer.unref?.()
    pending.set(requestId, {
      resolve: value => { clearTimeout(timer); resolve(value) },
      reject: error => { clearTimeout(timer); reject(error) },
    })
    Promise.resolve(engine.command({ type, requestId, ...payload })).catch(error => {
      const waiter = pending.get(requestId)
      if (waiter) { pending.delete(requestId); waiter.reject(error) }
    })
  })
  return {
    start: engine.start,
    command,
    drain: engine.drain,
    async stop() {
      for (const waiter of pending.values()) waiter.reject(new Error('Sessão encerrada'))
      pending.clear()
      return engine.stop()
    },
    metrics: engine.metrics,
  }
}
