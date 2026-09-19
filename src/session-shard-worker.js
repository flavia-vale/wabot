import 'dotenv/config'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import logger from './logger.js'
import { SessionShardRuntime } from './core/sessionShardRuntime.js'
import { createSemaphore } from './core/semaphore.js'

const shardId = String(process.env.SHARD_ID || '').trim()
if (!shardId) throw new Error('SHARD_ID obrigatório para session-shard-worker')
const maxSessions = Math.min(4, Math.max(1, Number(process.env.WA_SESSION_SHARD_POC_MAX_SESSIONS || 4)))
const factoryModule = String(process.env.WA_SHARD_SESSION_FACTORY_MODULE || '').trim()

const resolvedFactory = !factoryModule
  ? new URL('./core/baileysShardSessionFactory.js', import.meta.url).href
  : factoryModule.startsWith('.') || factoryModule.startsWith('/')
  ? pathToFileURL(resolve(process.cwd(), factoryModule)).href
  : factoryModule
const imported = await import(resolvedFactory)
if (typeof imported.createShardSessionRuntime !== 'function') throw new Error('Módulo do shard precisa exportar createShardSessionRuntime')

const sharpSemaphore = createSemaphore(Number(process.env.WA_SHARD_SHARP_CONCURRENCY || 1))
const scrapingSemaphore = createSemaphore(Number(process.env.WA_SHARD_SCRAPING_CONCURRENCY || 2))
const runtime = new SessionShardRuntime({
  shardId,
  maxSessions,
  services: { shardId, sharpSemaphore, scrapingSemaphore, emitSessionEvent: (userId, message) => process.send?.({ type: 'SESSION_EVENT', shardId, userId, event: message, protocolVersion: 1 }) },
  runtimeFactory: imported.createShardSessionRuntime,
  emit: event => process.send?.({ ...event, protocolVersion: 1 }),
})

let shuttingDown = false
async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info({ shardId, signal }, 'session shard encerrando')
  const result = await runtime.shutdown()
  process.send?.({ type: 'SHARD_STOPPED', shardId, result, protocolVersion: 1 })
  process.exit(result.failed ? 1 : 0)
}

process.on('message', async message => {
  const requestId = message?.requestId
  try {
    if (message?.shardId && message.shardId !== shardId) throw new Error('shardId divergente')
    const data = await runtime.dispatch(message)
    process.send?.({ type: 'SHARD_RESULT', requestId, shardId, userId: message?.userId ?? null, data, protocolVersion: 1 })
  } catch (error) {
    process.send?.({ type: 'SHARD_RESULT', requestId, shardId, userId: message?.userId ?? null, error: error?.message || String(error), protocolVersion: 1 })
  }
})
process.once('SIGTERM', () => { void shutdown('SIGTERM') })
process.once('SIGINT', () => { void shutdown('SIGINT') })
process.send?.({ type: 'SHARD_READY', shardId, maxSessions, pid: process.pid, protocolVersion: 1 })
