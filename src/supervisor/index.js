/**
 * Entrypoint do app PM2 "bot-supervisor".
 *
 * Responsabilidades:
 *  - Fazer fork() dos bot-workers (delegando ao mesmo src/core/sessionCore.js
 *    que historicamente roda dentro da API)
 *  - Consumir comandos da fila BullMQ `supervisor:commands` vindos da API
 *  - Publicar eventos (QR/status/lifecycle) no canal pub/sub `bots:events`
 *  - Manter heartbeat Redis para que a API possa checar liveness
 *  - Rodar `resumePersistedBots` e `startSessionHealthMonitor` no boot
 *
 * Acoplamento com API é apenas via Redis. Reiniciar API não toca os workers.
 */

import 'dotenv/config'
import { Worker } from 'bullmq'
import Redis from 'ioredis'

import db from '../db.js'
import logger from '../logger.js'
import * as sessionCore from '../core/sessionCore.js'
import { buildShardTag, normalizeShardCount, shouldHandleUserOnShard } from './sharding.js'
import { parseEnumEnv, logModeSummary } from '../core/envModes.js'
import {
  COMMAND,
  COMMAND_QUEUE,
  EVENT,
  EVENTS_CHANNEL,
  SUPERVISOR_HEARTBEAT_KEY,
  SUPERVISOR_HEARTBEAT_RENEW_INTERVAL_MS,
  SUPERVISOR_HEARTBEAT_TTL_SECONDS,
  encodeEvent,
  isKnownCommand,
  resolveRedisUrl,
} from './protocol.js'

const REDIS_URL = resolveRedisUrl()
if (!REDIS_URL) {
  logger.fatal('SUPERVISOR_REDIS_URL/REDIS_URL ausente — supervisor não pode iniciar')
  process.exit(1)
}

const publisher = new Redis(REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: null })
publisher.on('error', err => logger.warn({ err: err.message }, 'Publisher Redis error'))
const SHARD_COUNT = normalizeShardCount(process.env.SHARD_COUNT || 1, 1)
const SHARD_INDEX = Math.max(0, Math.min(SHARD_COUNT - 1, Number(process.env.SHARD_INDEX || 0)))
const SHARD_TAG = `shard-${SHARD_INDEX + 1}-of-${SHARD_COUNT}`
const SESSION_OWNER_MISMATCH_KEY = `supervisor:session_owner_mismatch_total:${SHARD_TAG}`
let sessionOwnerMismatchTotal = 0

const MAX_SESSIONS_PER_PROCESS = Math.max(1, Number(process.env.MAX_SESSIONS_PER_PROCESS || 200))
const SESSION_CIRCUIT_BREAKER_MODE = parseEnumEnv('SESSION_CIRCUIT_BREAKER_MODE', process.env.SESSION_CIRCUIT_BREAKER_MODE || 'closed', ['closed', 'open'], 'closed')
const SESSION_CIRCUIT_BREAKER_ALERT_KEY = `supervisor:session_circuit_breaker_alert:${SHARD_TAG}`

logModeSummary('bot-supervisor', {
  shardCount: SHARD_COUNT,
  shardIndex: SHARD_INDEX,
  shardTag: SHARD_TAG,
  maxSessionsPerProcess: MAX_SESSIONS_PER_PROCESS,
  sessionCircuitBreakerMode: SESSION_CIRCUIT_BREAKER_MODE,
})

async function checkSessionCircuitBreaker(userId) {
  const running = sessionCore.listRunningBots().length
  if (running < MAX_SESSIONS_PER_PROCESS) return true
  const msg = `Circuit breaker: limite de sessões por processo atingido (${running}/${MAX_SESSIONS_PER_PROCESS})`
  logger.error({ userId, shard: SHARD_TAG, running, max: MAX_SESSIONS_PER_PROCESS }, msg)
  try {
    await publisher.incr(SESSION_CIRCUIT_BREAKER_ALERT_KEY)
  } catch (err) {
    logger.warn({ err: err?.message }, 'Falha ao gravar alerta de circuit breaker')
  }
  if (SESSION_CIRCUIT_BREAKER_MODE === 'open') return true
  return false
}

function belongsToThisShard(userId) {
  return shouldHandleUserOnShard(userId, SHARD_COUNT, SHARD_INDEX)
}

async function noteSessionOwnerMismatch(userId, command = 'unknown') {
  sessionOwnerMismatchTotal++
  logger.warn({ userId, command, shard: SHARD_TAG }, 'sessão fora do shard local — comando ignorado')
  try {
    await publisher.incr(SESSION_OWNER_MISMATCH_KEY)
  } catch (err) {
    logger.warn({ err: err.message }, 'Falha ao incrementar session_owner_mismatch_total')
  }
}


// ---- Bridge sessionCore -> pub/sub ----
//
// sessionCore guarda listeners por userId dentro do entry no Map. A forma
// mais limpa de capturar QR/status para republicar é assinar diretamente
// via onQR/onStatus *quando* o bot é criado. Como o bot pode ser iniciado
// via `startBot` (este processo) ou via `resumePersistedBots`, ambos
// passam pelo `startBot`, então um hook em torno do startBot cobre.

const subscriptions = new Map() // userId -> { offQR, offStatus }

function attachBridge(userId) {
  if (subscriptions.has(userId)) return
  const offQR = sessionCore.onQR(userId, qr => publishEvent(userId, EVENT.QR, qr))
  const offStatus = sessionCore.onStatus(userId, (status, phone) => {
    publishEvent(userId, EVENT.STATUS, { status, phone: phone ?? null })
  })
  subscriptions.set(userId, { offQR, offStatus })
}

function detachBridge(userId) {
  const subs = subscriptions.get(userId)
  if (!subs) return
  try { subs.offQR?.() } catch {}
  try { subs.offStatus?.() } catch {}
  subscriptions.delete(userId)
}

function publishEvent(userId, type, data) {
  try {
    publisher.publish(EVENTS_CHANNEL, encodeEvent({ userId, type, data }))
  } catch (err) {
    logger.warn({ err: err.message, userId, type }, 'Falha ao publicar evento')
  }
}

// Wrapper de startBot que também monta a bridge — sessionCore.startBot
// é síncrono e adiciona o bot ao Map antes de retornar, então a bridge
// consegue assinar imediatamente após.
async function startBotWithBridge(userId) {
  if (!belongsToThisShard(userId)) {
    void noteSessionOwnerMismatch(userId, 'startBot')
    return false
  }
  if (!(await checkSessionCircuitBreaker(userId))) return false
  const ok = sessionCore.startBot(userId)
  if (ok) attachBridge(userId)
  return ok
}

function stopBotWithBridge(userId) {
  if (!belongsToThisShard(userId)) {
    void noteSessionOwnerMismatch(userId, 'stopBot')
    return false
  }
  const ok = sessionCore.stopBot(userId)
  detachBridge(userId)
  return ok
}

// ---- Consumidor BullMQ ----

const COMMAND_HANDLERS = {
  [COMMAND.START_BOT]: ({ userId }) => startBotWithBridge(userId),
  [COMMAND.STOP_BOT]: ({ userId }) => stopBotWithBridge(userId),
  [COMMAND.IS_RUNNING]: ({ userId }) => belongsToThisShard(userId) ? sessionCore.isRunning(userId) : false,
  [COMMAND.LIST_RUNNING_BOTS]: () => sessionCore.listRunningBots(),
  [COMMAND.LIST_GROUPS]: ({ userId }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'listGroups')
      throw new Error('Session owner mismatch')
    }
    return sessionCore.listGroups(userId)
  },
  [COMMAND.SEND_BROADCAST]: ({ userId, text, jids }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'sendBroadcast')
      throw new Error('Session owner mismatch')
    }
    return sessionCore.sendBroadcast(userId, text, jids)
  },
  [COMMAND.REQUEST_PAIRING_CODE]: ({ userId, phone }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'requestPairingCode')
      throw new Error('Session owner mismatch')
    }
    return sessionCore.requestPairingCode(userId, phone)
  },
  [COMMAND.GET_BOT_METRICS]: ({ userId }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'getBotMetrics')
      return { session_owner_mismatch_total: sessionOwnerMismatchTotal }
    }
    return sessionCore.getBotMetrics(userId)
  },
  [COMMAND.RELOAD_CONFIG]: ({ userId }) => belongsToThisShard(userId) ? sessionCore.reloadConfig(userId) : false,
  [COMMAND.REFRESH_WA_GROUPS]: ({ userId }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'refreshWaGroups')
      throw new Error('Session owner mismatch')
    }
    return sessionCore.refreshWaGroups(userId)
  },
  [COMMAND.CHANNEL_METADATA]: ({ userId, jid, inviteCode }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'channelMetadata')
      throw new Error('Session owner mismatch')
    }
    return sessionCore.channelMetadata(userId, { jid, inviteCode })
  },
  [COMMAND.CHANNEL_FOLLOW]: ({ userId, jid }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'channelFollow')
      throw new Error('Session owner mismatch')
    }
    return sessionCore.followChannelImmediate(userId, jid)
  },
  [COMMAND.CHANNEL_LIST_FOLLOWED]: ({ userId }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'channelListFollowed')
      throw new Error('Session owner mismatch')
    }
    return sessionCore.listFollowedChannels(userId)
  },
  [COMMAND.GET_LAST_QR]: ({ userId }) => belongsToThisShard(userId) ? sessionCore.getLastQR(userId) : null,
}

const worker = new Worker(
  COMMAND_QUEUE,
  async job => {
    const name = job.name
    if (!isKnownCommand(name)) throw new Error(`Comando desconhecido: ${name}`)
    const handler = COMMAND_HANDLERS[name]
    if (!handler) throw new Error(`Handler ausente para ${name}`)
    return await handler(job.data ?? {})
  },
  {
    connection: { url: REDIS_URL, maxRetriesPerRequest: null },
    concurrency: 8,
  },
)

worker.on('failed', (job, err) => {
  logger.warn({ jobId: job?.id, name: job?.name, err: err?.message }, 'Comando supervisor falhou')
})

// ---- Heartbeat ----

let heartbeatTimer = null
async function renewHeartbeat() {
  try {
    await publisher.set(SUPERVISOR_HEARTBEAT_KEY, String(Date.now()), 'EX', SUPERVISOR_HEARTBEAT_TTL_SECONDS)
  } catch (err) {
    logger.warn({ err: err.message }, 'Falha ao renovar heartbeat')
  }
}
function startHeartbeat() {
  renewHeartbeat()
  heartbeatTimer = setInterval(renewHeartbeat, SUPERVISOR_HEARTBEAT_RENEW_INTERVAL_MS)
  heartbeatTimer.unref?.()
}

// ---- Boot ----

async function boot() {
  logger.info({ redisUrl: REDIS_URL.replace(/:[^:@/]+@/, ':***@'), shard: SHARD_TAG, shardCount: SHARD_COUNT, shardIndex: SHARD_INDEX }, 'bot-supervisor iniciando')
  startHeartbeat()

  // O monitor de saúde mantido em sessionCore precisa que cada bot
  // startado pelo monitor também ative a bridge. Por isso o monitor é
  // iniciado com um wrapper que adiciona attachBridge após cada start.
  // Como sessionCore.startSessionHealthMonitor chama internamente
  // sessionCore.startBot (não o wrapper), precisamos compensar assinando
  // os bots já rodando a cada tick. Mais barato: polling de subscriptions.
  // Em modo sharded, o monitor de saúde do core não deve iniciar sessões fora do shard.

  const persisted = await db.waSession.findMany({ where: { status: { in: ['connected', 'connecting'] } }, select: { userId: true } })
  let started = 0
  for (const s of persisted) {
    if (!belongsToThisShard(s.userId)) continue
    if (await startBotWithBridge(s.userId)) started++
  }
  logger.info({ attempted: persisted.length, started, shard: SHARD_TAG }, 'Sessões persistidas retomadas no shard')

  // Garante bridge para todos os bots já rodando (após resume e a qualquer
  // momento que health monitor reerga um). Custo: O(n) a cada 5s, n <= 100.
  setInterval(() => {
    for (const userId of sessionCore.listRunningBots()) {
      if (!belongsToThisShard(userId)) {
        void noteSessionOwnerMismatch(userId, 'runningBotSweep')
        stopBotWithBridge(userId)
        continue
      }
      attachBridge(userId)
    }
    for (const userId of subscriptions.keys()) {
      if (!sessionCore.isRunning(userId)) detachBridge(userId)
    }
  }, 5_000).unref?.()

  logger.info('bot-supervisor pronto — consumindo comandos')
}

async function shutdown(signal) {
  logger.info({ signal }, 'bot-supervisor encerrando')
  try { if (heartbeatTimer) clearInterval(heartbeatTimer) } catch {}
  try { await publisher.del(SUPERVISOR_HEARTBEAT_KEY) } catch {}
  try { await worker.close() } catch {}
  try { await publisher.quit() } catch {}
  try { sessionCore.stopAllBots() } catch {}
  try { await db.$disconnect() } catch {}
  process.exit(0)
}

process.once('SIGTERM', () => { void shutdown('SIGTERM') })
process.once('SIGINT', () => { void shutdown('SIGINT') })

boot().catch(err => {
  logger.fatal({ err: err.message }, 'Falha ao iniciar bot-supervisor')
  process.exit(1)
})
