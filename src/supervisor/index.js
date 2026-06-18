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
import { checkSupervisorEnvConsistency } from './envGuard.js'
import { createRestartBudget, RESTART_BUDGET_MAX, RESTART_BUDGET_WINDOW_MS, RESTART_QUARANTINE_MS } from './restartBudget.js'
import { parseEnumEnv, logModeSummary } from '../core/envModes.js'
import {
  COMMAND,
  COMMAND_QUEUE,
  COMMAND_TIMEOUTS_MS,
  EVENT,
  EVENTS_CHANNEL,
  SUPERVISOR_HEARTBEAT_KEY,
  SUPERVISOR_HEARTBEAT_RENEW_INTERVAL_MS,
  SUPERVISOR_HEARTBEAT_TTL_SECONDS,
  encodeEvent,
  isCommandStale,
  isKnownCommand,
  lastEventCacheTtlSeconds,
  lastEventKey,
  resolveRedisUrl,
} from './protocol.js'

const REDIS_URL = resolveRedisUrl()
if (!REDIS_URL) {
  logger.fatal('SUPERVISOR_REDIS_URL/REDIS_URL ausente — supervisor não pode iniciar')
  process.exit(1)
}

// Fail-fast contra "supervisor rodando do diretório/ambiente errado" (incidente
// 2026-06): se APP_ENV não bater com o cwd ou com a Redis DB, o supervisor
// consumiria a fila de comandos do ambiente errado e subiria "saudável" sem
// drenar nada. Melhor abortar no boot do que estourar timeout em toda rota.
const envCheck = checkSupervisorEnvConsistency({
  appEnv: process.env.APP_ENV,
  cwd: process.cwd(),
  redisUrl: REDIS_URL,
})
if (!envCheck.ok) {
  logger.fatal(
    { reason: envCheck.reason, appEnv: process.env.APP_ENV ?? null, cwd: process.cwd() },
    'bot-supervisor: ambiente inconsistente — abortando para não consumir a fila errada',
  )
  process.exit(1)
}

const publisher = new Redis(REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: null })
publisher.on('error', err => logger.warn({ err: err.message }, 'Publisher Redis error'))
const SHARD_COUNT = normalizeShardCount(process.env.SHARD_COUNT || 1, 1)
// Fail-fast: SHARD_INDEX precisa ser inteiro finito em [0, SHARD_COUNT). Qualquer
// outra coisa (typo "abc", negativo, fora da faixa) faria a aritmética devolver
// NaN, shouldHandleUserOnShard rejeitaria 100% dos usuários e o supervisor subiria
// "saudável" rejeitando tudo silenciosamente. Melhor crashar no boot.
const SHARD_INDEX_RAW = process.env.SHARD_INDEX
const SHARD_INDEX_PARSED = SHARD_INDEX_RAW === undefined || SHARD_INDEX_RAW === ''
  ? 0
  : Number(SHARD_INDEX_RAW)
if (!Number.isInteger(SHARD_INDEX_PARSED) || SHARD_INDEX_PARSED < 0 || SHARD_INDEX_PARSED >= SHARD_COUNT) {
  logger.fatal(
    { shardIndexRaw: SHARD_INDEX_RAW, shardCount: SHARD_COUNT },
    'SHARD_INDEX inválido — precisa ser inteiro em [0, SHARD_COUNT). Abortando.',
  )
  process.exit(1)
}
const SHARD_INDEX = SHARD_INDEX_PARSED
const SHARD_TAG = `shard-${SHARD_INDEX + 1}-of-${SHARD_COUNT}`
const SESSION_OWNER_MISMATCH_KEY = `supervisor:session_owner_mismatch_total:${SHARD_TAG}`
let sessionOwnerMismatchTotal = 0

// Teto conservador até haver medição real de RSS por worker em soak. Cada
// bot-worker é um fork() independente que o max_memory_restart do PM2 (no
// supervisor) NÃO cobre — 50 filhos podem somar vários GB e disparar o OOM
// killer do host antes de qualquer proteção. Subir só com evidência de soak.
const MAX_SESSIONS_PER_PROCESS = Math.max(1, Number(process.env.MAX_SESSIONS_PER_PROCESS || 20))
const SESSION_CIRCUIT_BREAKER_MODE = parseEnumEnv('SESSION_CIRCUIT_BREAKER_MODE', process.env.SESSION_CIRCUIT_BREAKER_MODE || 'closed', ['closed', 'open'], 'closed')
const SESSION_CIRCUIT_BREAKER_ALERT_KEY = `supervisor:session_circuit_breaker_alert:${SHARD_TAG}`
const SESSION_QUARANTINE_KEY = `supervisor:session_quarantine_total:${SHARD_TAG}`

// Orçamento de restarts automáticos por sessão (health monitor). Start manual
// via comando START_BOT limpa a quarentena.
const restartBudget = createRestartBudget()

logModeSummary('bot-supervisor', {
  shardCount: SHARD_COUNT,
  shardIndex: SHARD_INDEX,
  shardTag: SHARD_TAG,
  maxSessionsPerProcess: MAX_SESSIONS_PER_PROCESS,
  sessionCircuitBreakerMode: SESSION_CIRCUIT_BREAKER_MODE,
  restartBudgetMax: RESTART_BUDGET_MAX,
  restartBudgetWindowMs: RESTART_BUDGET_WINDOW_MS,
  restartQuarantineMs: RESTART_QUARANTINE_MS,
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
  cacheLastEvent(userId, type, data)
}

// Grava o último valor de QR/STATUS numa chave Redis com TTL para que um
// assinante tardio (API reiniciada, subscriber reconectado) possa re-hidratar
// em vez de ficar cego até a próxima publicação. Best-effort: falha aqui não
// pode derrubar a publicação do evento ao vivo.
function cacheLastEvent(userId, type, data) {
  const ttl = lastEventCacheTtlSeconds(type)
  if (!ttl) return
  try {
    void publisher.set(lastEventKey(userId, type), JSON.stringify(data ?? null), 'EX', ttl)
  } catch (err) {
    logger.warn({ err: err.message, userId, type }, 'Falha ao cachear last-event')
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
  // Start explícito (usuário/admin) limpa a quarentena do restart budget —
  // intervenção manual é o caminho documentado para religar antes do prazo.
  [COMMAND.START_BOT]: ({ userId }) => {
    restartBudget.clear(userId)
    return startBotWithBridge(userId)
  },
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
  [COMMAND.SEND_BROADCAST]: ({ userId, text, jids, options }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'sendBroadcast')
      throw new Error('Session owner mismatch')
    }
    return sessionCore.sendBroadcast(userId, text, jids, options)
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

// lockDuration > maior timeout de comando (+ folga) para que handlers
// legitimamente longos (REQUEST_PAIRING_CODE 45s, SEND_BROADCAST 30s) NÃO
// sejam marcados como stalled e reprocessados no meio da execução — um
// reprocesso de SEND_BROADCAST seria envio duplicado. O guard isCommandStale
// é a segunda linha: mesmo que um stall escape, o job reentregue já estará
// velho demais e é descartado em vez de reexecutado.
const COMMAND_LOCK_DURATION_MS = Math.max(60_000, Math.max(...Object.values(COMMAND_TIMEOUTS_MS)) + 15_000)

const worker = new Worker(
  COMMAND_QUEUE,
  async job => {
    const name = job.name
    if (!isKnownCommand(name)) throw new Error(`Comando desconhecido: ${name}`)
    const data = job.data ?? {}
    // Drenagem de jobs velhos / TTL de comando: se a API já desistiu de
    // esperar, descartar em vez de executar (evita SEND_BROADCAST duplicado).
    // Retornamos resultado (job 'completed') em vez de throw: a decisão de
    // descartar foi bem-sucedida; ninguém está aguardando o valor.
    if (isCommandStale(name, data._enqueuedAt)) {
      const ageMs = Date.now() - Number(data._enqueuedAt)
      logger.warn({ jobId: job.id, name, userId: data.userId ?? null, ageMs }, 'Comando obsoleto descartado (API já desistiu) — não executado')
      return { _stale: true, discarded: true, ageMs }
    }
    const handler = COMMAND_HANDLERS[name]
    if (!handler) throw new Error(`Handler ausente para ${name}`)
    return await handler(data)
  },
  {
    connection: { url: REDIS_URL, maxRetriesPerRequest: null },
    concurrency: 8,
    lockDuration: COMMAND_LOCK_DURATION_MS,
  },
)

worker.on('failed', (job, err) => {
  logger.warn({ jobId: job?.id, name: job?.name, err: err?.message }, 'Comando supervisor falhou')
})

worker.on('stalled', jobId => {
  // Reprocesso por stall é tolerado: isCommandStale descarta o reentregue se já
  // passou do timeout. Logamos para visibilidade do sinal (morte abrupta).
  logger.warn({ jobId }, 'Comando supervisor stalled (lock expirou) — guard de staleness evita efeito duplicado no reprocesso')
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

// ---- Monitor de saúde shard-aware ----

const HEALTH_TICK_MS = Math.max(Number(process.env.WA_ZOMBIE_CHECK_INTERVAL_MS || 15000), 5000)
const HEALTH_STALE_MS = Math.max(Number(process.env.WA_HEARTBEAT_STALE_MS || 90000), 30000)
let healthMonitorTimer = null

async function healthMonitorTick() {
  // (1) Mata zumbis: workers vivos mas sem heartbeat há >STALE_MS. stopBot
  // remove do Map; o próximo tick ressuscita via DB-poll abaixo.
  const now = Date.now()
  for (const { userId, lastHeartbeatAt, killed } of sessionCore.listSessionHealth()) {
    if (killed) continue
    if (!belongsToThisShard(userId)) continue
    const hbAge = now - (lastHeartbeatAt || 0)
    if (hbAge <= HEALTH_STALE_MS) continue
    logger.warn({ userId, hbAge, shard: SHARD_TAG }, 'Worker com heartbeat estagnado — reiniciando')
    try { stopBotWithBridge(userId) } catch (err) {
      logger.warn({ err: err?.message, userId }, 'Falha ao parar worker estagnado')
    }
  }

  // (2) Ressuscita sessões persistidas que pertencem ao shard mas não estão
  // rodando localmente — cobre tanto o exit de worker (OOM/exceção) quanto
  // o restart pós-stopBot acima no próximo tick.
  try {
    const persisted = await db.waSession.findMany({
      where: { status: { in: ['connected', 'connecting'] } },
      select: { userId: true },
    })
    for (const s of persisted) {
      if (!belongsToThisShard(s.userId)) continue
      if (sessionCore.isRunning(s.userId)) continue
      // Restart budget: sessão que morre repetidamente (auth_info corrompido,
      // falha permanente) entra em quarentena em vez de churn infinito de
      // kill/ressuscita — cada ciclo gera reconexão no WhatsApp (risco de ban)
      // e consome o host inteiro.
      if (restartBudget.isQuarantined(s.userId)) continue
      const verdict = restartBudget.registerRestart(s.userId)
      if (!verdict.allowed) {
        if (verdict.justQuarantined) {
          logger.error(
            { userId: s.userId, shard: SHARD_TAG, restarts: verdict.count, windowMs: RESTART_BUDGET_WINDOW_MS, quarantineMs: RESTART_QUARANTINE_MS },
            'Sessão em quarentena: orçamento de restarts esgotado — investigar auth_info/credenciais; start manual religa antes do prazo',
          )
          try { await publisher.incr(SESSION_QUARANTINE_KEY) } catch (err) {
            logger.warn({ err: err?.message }, 'Falha ao incrementar session_quarantine_total')
          }
        }
        continue
      }
      try {
        await startBotWithBridge(s.userId)
      } catch (err) {
        logger.error({ err: err?.message, userId: s.userId, shard: SHARD_TAG }, 'Falha ao ressuscitar sessão no health monitor')
      }
    }
  } catch (err) {
    logger.error({ err: err?.message, shard: SHARD_TAG }, 'Health monitor: falha ao listar sessões persistidas')
  }
}

function startShardHealthMonitor() {
  if (healthMonitorTimer) return
  healthMonitorTimer = setInterval(
    () => { void healthMonitorTick() },
    HEALTH_TICK_MS,
  )
  healthMonitorTimer.unref?.()
}

// ---- Boot ----

async function boot() {
  logger.info({ redisUrl: REDIS_URL.replace(/:[^:@/]+@/, ':***@'), shard: SHARD_TAG, shardCount: SHARD_COUNT, shardIndex: SHARD_INDEX }, 'bot-supervisor iniciando')
  startHeartbeat()

  // Resume de sessões persistidas — guardado por try/catch por sessão. Antes
  // o loop era unguarded: uma única sessão com auth_info corrompido derrubava
  // o boot inteiro, PM2 reiniciava, mesma falha → loop de DoS auto-infligido.
  let started = 0
  let attempted = 0
  try {
    const persisted = await db.waSession.findMany({ where: { status: { in: ['connected', 'connecting'] } }, select: { userId: true } })
    attempted = persisted.length
    for (const s of persisted) {
      if (!belongsToThisShard(s.userId)) continue
      try {
        if (await startBotWithBridge(s.userId)) started++
      } catch (err) {
        logger.error({ err: err?.message, userId: s.userId, shard: SHARD_TAG }, 'Falha ao retomar sessão persistida — continuando')
      }
    }
  } catch (err) {
    logger.error({ err: err?.message, shard: SHARD_TAG }, 'Falha ao listar sessões persistidas — supervisor sobe sem resume')
  }
  logger.info({ attempted, started, shard: SHARD_TAG }, 'Sessões persistidas retomadas no shard')

  // Monitor de saúde shard-aware. Substitui sessionCore.startSessionHealthMonitor
  // (que não conhece shard) com duas responsabilidades:
  //   1. Reiniciar workers com heartbeat estagnado (zumbis baileys).
  //   2. Ressuscitar sessões persistidas com status connected/connecting que
  //      pertencem a este shard mas não estão no Map do sessionCore (worker
  //      morreu por OOM/exceção, exit handler removeu do Map).
  // Sem isso, em modo remote workers crashados nunca eram restartados.
  startShardHealthMonitor()

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
  try { if (healthMonitorTimer) clearInterval(healthMonitorTimer) } catch {}
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
