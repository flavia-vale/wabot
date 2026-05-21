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
function startBotWithBridge(userId) {
  const ok = sessionCore.startBot(userId)
  if (ok) attachBridge(userId)
  return ok
}

function stopBotWithBridge(userId) {
  const ok = sessionCore.stopBot(userId)
  detachBridge(userId)
  return ok
}

// ---- Consumidor BullMQ ----

const COMMAND_HANDLERS = {
  [COMMAND.START_BOT]: ({ userId }) => startBotWithBridge(userId),
  [COMMAND.STOP_BOT]: ({ userId }) => stopBotWithBridge(userId),
  [COMMAND.IS_RUNNING]: ({ userId }) => sessionCore.isRunning(userId),
  [COMMAND.LIST_RUNNING_BOTS]: () => sessionCore.listRunningBots(),
  [COMMAND.LIST_GROUPS]: ({ userId }) => sessionCore.listGroups(userId),
  [COMMAND.SEND_BROADCAST]: ({ userId, text, jids }) => sessionCore.sendBroadcast(userId, text, jids),
  [COMMAND.REQUEST_PAIRING_CODE]: ({ userId, phone }) => sessionCore.requestPairingCode(userId, phone),
  [COMMAND.GET_BOT_METRICS]: ({ userId }) => sessionCore.getBotMetrics(userId),
  [COMMAND.RELOAD_CONFIG]: ({ userId }) => sessionCore.reloadConfig(userId),
  [COMMAND.CHANNEL_METADATA]: ({ userId, jid, inviteCode }) => sessionCore.channelMetadata(userId, { jid, inviteCode }),
  [COMMAND.CHANNEL_FOLLOW]: ({ userId, jid }) => sessionCore.followChannelImmediate(userId, jid),
  [COMMAND.CHANNEL_LIST_FOLLOWED]: ({ userId }) => sessionCore.listFollowedChannels(userId),
  [COMMAND.GET_LAST_QR]: ({ userId }) => sessionCore.getLastQR(userId),
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
  logger.info({ redisUrl: REDIS_URL.replace(/:[^:@/]+@/, ':***@') }, 'bot-supervisor iniciando')
  startHeartbeat()

  // O monitor de saúde mantido em sessionCore precisa que cada bot
  // startado pelo monitor também ative a bridge. Por isso o monitor é
  // iniciado com um wrapper que adiciona attachBridge após cada start.
  // Como sessionCore.startSessionHealthMonitor chama internamente
  // sessionCore.startBot (não o wrapper), precisamos compensar assinando
  // os bots já rodando a cada tick. Mais barato: polling de subscriptions.
  sessionCore.startSessionHealthMonitor(db, logger)

  await sessionCore.resumePersistedBots(db, logger)
    .catch(err => logger.error({ err: err.message }, 'Falha ao retomar sessões persistidas'))

  // Garante bridge para todos os bots já rodando (após resume e a qualquer
  // momento que health monitor reerga um). Custo: O(n) a cada 5s, n <= 100.
  setInterval(() => {
    for (const userId of sessionCore.listRunningBots()) attachBridge(userId)
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
