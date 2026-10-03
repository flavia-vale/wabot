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

import { accountIdFromSessionKey } from '../domain/session/sessionKey.js'
import { listResumableStandbySessions } from '../core/standbySessions.js'
import 'dotenv/config'
import os from 'os'
import fs from 'fs'
import { Worker } from 'bullmq'
import Redis from 'ioredis'

import db from '../db.js'
import logger from '../logger.js'
import * as sessionCore from '../core/sessionCore.js'
import { buildRedisOptions } from '../core/redisFactory.js'
import { buildShardTag, normalizeShardCount, shouldHandleUserOnShard } from './sharding.js'
import { checkSupervisorEnvConsistency, supervisorManagesSessions, supervisorShouldAutoResume } from './envGuard.js'
import { createRestartBudget, RESTART_BUDGET_MAX, RESTART_BUDGET_WINDOW_MS, RESTART_QUARANTINE_MS } from './restartBudget.js'
import { shouldResurrectSession, buildResurrectionWhere, resolveIncludeReconnecting } from '../core/sessionResurrectionPolicy.js'
import { createReloadConfigHandler } from './commandHandlers.js'
import { parseEnumEnv, logModeSummary } from '../core/envModes.js'
import { recordOperationalSignal } from '../observability/operationalSignals.js'
import { createOwnerLease } from './ownerLease.js'
import { buildNodeIdentity, decideNodeBoot } from './bootGuard.js'
import { createRedisClock } from './redisClock.js'
import { createShardProcessController } from './shardProcessController.js'
import { createShardOwnershipCoordinator } from '../core/shardOwnershipCoordinator.js'
import {
  buildResumeWhere,
  commandNeedsFreshOwnership,
  createNodeOwnershipCache,
  isNodeRoutingEnabled,
  isOwnerLeaseEnabled,
  nodeIdWhere,
  ownsLegacyQueue,
  resolveSupervisorNodeId,
  shouldActLocally,
} from './nodeRouting.js'
import {
  COMMAND,
  COMMAND_QUEUE,
  COMMAND_TIMEOUTS_MS,
  EVENT,
  EVENTS_CHANNEL,
  SUPERVISOR_BOOTED_AT_KEY,
  SUPERVISOR_HEARTBEAT_KEY,
  SUPERVISOR_HEARTBEAT_RENEW_INTERVAL_MS,
  OWNER_LEASE_RENEW_INTERVAL_MS,
  SUPERVISOR_HEARTBEAT_TTL_SECONDS,
  bootedAtKey,
  capacityKey,
  commandQueueName,
  encodeEvent,
  heartbeatKey,
  identityKey,
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

// Config de sharding é validada no topo (antes do gate de modo) porque é pura
// checagem de configuração, sem side-effect de Redis — um SHARD_INDEX inválido
// é um erro de deploy que deve falhar rápido independente do modo.
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

// Roteamento por nó (SUPERVISOR_NODE_ROUTING, default OFF). Desligado, nada
// abaixo muda: posse por hash, fila e chaves legadas. Ligado, a posse vem de
// WaSession.nodeId (null = 'n1') e este processo é o nó SUPERVISOR_NODE_ID.
const NODE_ROUTING = isNodeRoutingEnabled(process.env)
let NODE_ID = 'n1'
if (NODE_ROUTING) {
  try {
    NODE_ID = resolveSupervisorNodeId(process.env)
  } catch (err) {
    logger.fatal({ err: err.message }, 'SUPERVISOR_NODE_ID inválido — abortando')
    process.exit(1)
  }
  if (SHARD_COUNT > 1) {
    logger.warn({ shardCount: SHARD_COUNT, nodeId: NODE_ID }, 'SUPERVISOR_NODE_ROUTING ligado: SHARD_COUNT/SHARD_INDEX são IGNORADOS para posse de sessão (vale WaSession.nodeId)')
  }
}
// Identidade desta máquina como nó (revisão C3). Só usada com roteamento.
const NODE_IDENTITY = buildNodeIdentity({
  hostname: os.hostname(),
  machineId: (() => { try { return fs.readFileSync('/etc/machine-id', 'utf8') } catch { return '' } })(),
})
const SHARD_TAG = `shard-${SHARD_INDEX + 1}-of-${SHARD_COUNT}`
// Chaves dos contadores por nó (o leitor soma por prefixo, então segue valendo).
const COUNTER_TAG = NODE_ROUTING ? `${SHARD_TAG}:${NODE_ID}` : SHARD_TAG
const SESSION_OWNER_MISMATCH_KEY = `supervisor:session_owner_mismatch_total:${COUNTER_TAG}`

// Acopla o supervisor à MESMA flag que a API (src/manager.js) já respeita. Só
// em `remote` o supervisor é dono das sessões; em `inline` (ou qualquer outro
// valor) ele entra em standby logo abaixo — sem isso, api + supervisor davam
// fork() do MESMO worker sobre o MESMO AUTH_INFO_DIR e o WhatsApp caía em loop
// de conflito (incidente "wpp caindo toda hora" em staging). Ver envGuard.js.
const SUPERVISOR_MODE = parseEnumEnv('BOT_SUPERVISOR_MODE', process.env.BOT_SUPERVISOR_MODE || 'inline', ['inline', 'remote'], 'inline')
if (!supervisorManagesSessions(SUPERVISOR_MODE)) {
  logger.warn(
    { supervisorMode: SUPERVISOR_MODE, appEnv: process.env.APP_ENV ?? null, cwd: process.cwd() },
    'bot-supervisor em STANDBY: BOT_SUPERVISOR_MODE != "remote" — a API gerencia as sessões inline. ' +
      'O supervisor NÃO fará fork/resume/health/consumo de comandos para evitar dupla posse da sessão ' +
      '(dois sockets Baileys na mesma credencial = WhatsApp caindo em loop de conflito). ' +
      'Para ativá-lo, defina BOT_SUPERVISOR_MODE=remote no .env e reinicie API e supervisor juntos.',
  )
  logModeSummary('bot-supervisor', { supervisorMode: SUPERVISOR_MODE, standby: true })
  // Mantém o processo vivo (PM2 não fica em churn de restart) sem tocar em
  // nenhuma sessão. Sai limpo em SIGTERM/SIGINT.
  const keepAlive = setInterval(() => {}, 60_000)
  const standbyShutdown = signal => {
    logger.info({ signal }, 'bot-supervisor (standby) encerrando')
    clearInterval(keepAlive)
    process.exit(0)
  }
  process.once('SIGTERM', () => standbyShutdown('SIGTERM'))
  process.once('SIGINT', () => standbyShutdown('SIGINT'))
} else if (NODE_ROUTING) {
  // Revisão C3/C4: com roteamento, confere ANTES de criar os consumidores de
  // fila se este processo pode mesmo ser o nó. Flag off: caminho de sempre.
  void guardThenStartRemoteSupervisor()
} else {
  startRemoteSupervisor()
}

async function guardThenStartRemoteSupervisor() {
  let existing = null
  const probe = new Redis(REDIS_URL, buildRedisOptions('supervisor-boot-guard', { lazyConnect: false, maxRetriesPerRequest: 3 }))
  probe.on('error', () => {})
  try {
    existing = await probe.get(identityKey(NODE_ID))
    if (existing && existing !== NODE_IDENTITY) {
      // Pode ser a identidade de uma máquina que acabou de morrer: espera a
      // chave vencer (mesmo TTL do heartbeat) antes de concluir colisão.
      logger.warn({ nodeId: NODE_ID, existing, own: NODE_IDENTITY }, 'boot: outro servidor aparece como este nó — aguardando a chave vencer antes de decidir')
      await new Promise(resolve => setTimeout(resolve, (SUPERVISOR_HEARTBEAT_TTL_SECONDS + 5) * 1000))
      existing = await probe.get(identityKey(NODE_ID))
    }
  } catch (err) {
    // Falha aberta: sem Redis o supervisor não funciona de qualquer forma, e o
    // erro de conexão aparece logo adiante, no fluxo normal.
    logger.warn({ err: err?.message }, 'boot: não consegui ler a identidade do nó — seguindo')
    existing = null
  } finally {
    try { await probe.quit() } catch {}
  }
  const verdict = decideNodeBoot({ nodeId: NODE_ID, databaseUrl: process.env.DATABASE_URL, ownIdentity: NODE_IDENTITY, existingIdentity: existing })
  if (verdict.ok) return startRemoteSupervisor()
  // ESPERA (não sai: sair viraria loop de restart do pm2). Não liga robô, não
  // consome fila, não escreve heartbeat — a API e o vigia veem o nó "fora".
  const say = () => logger.fatal({ nodeId: NODE_ID, reason: verdict.reason, event: 'supervisor_boot_blocked' }, `bot-supervisor BLOQUEADO: ${verdict.message}`)
  say()
  const timer = setInterval(say, 60_000)
  const stop = signal => { clearInterval(timer); logger.info({ signal }, 'bot-supervisor (bloqueado) encerrando'); process.exit(0) }
  process.once('SIGTERM', () => stop('SIGTERM'))
  process.once('SIGINT', () => stop('SIGINT'))
}

function startRemoteSupervisor() {
const publisher = new Redis(REDIS_URL, buildRedisOptions('supervisor-publisher', { lazyConnect: false, maxRetriesPerRequest: null }))
publisher.on('error', err => logger.warn({ err: err.message }, 'Publisher Redis error'))
let sessionOwnerMismatchTotal = 0

// Teto conservador até haver medição real de RSS por worker em soak. Cada
// bot-worker é um fork() independente que o max_memory_restart do PM2 (no
// supervisor) NÃO cobre — 50 filhos podem somar vários GB e disparar o OOM
// killer do host antes de qualquer proteção. Subir só com evidência de soak.
const MAX_SESSIONS_PER_PROCESS = Math.max(1, Number(process.env.MAX_SESSIONS_PER_PROCESS || 20))
const SESSION_CIRCUIT_BREAKER_MODE = parseEnumEnv('SESSION_CIRCUIT_BREAKER_MODE', process.env.SESSION_CIRCUIT_BREAKER_MODE || 'closed', ['closed', 'open'], 'closed')
const SESSION_CIRCUIT_BREAKER_ALERT_KEY = `supervisor:session_circuit_breaker_alert:${COUNTER_TAG}`
const SESSION_QUARANTINE_KEY = `supervisor:session_quarantine_total:${COUNTER_TAG}`
const SHARD_POC_MODE = parseEnumEnv('WA_SESSION_SHARD_POC', process.env.WA_SESSION_SHARD_POC || 'observe', ['off', 'observe', 'enabled'], 'observe')
const shardOwnedUsers = new Set()
const pocShard = createShardProcessController({
  shardId: 'poc-1',
  onEvent: ({ userId, event }) => {
    if (event?.type === 'qr') publishEvent(userId, EVENT.QR, event.data)
    if (event?.type === 'status') publishEvent(userId, EVENT.STATUS, { status: event.data, phone: event.phone ?? null })
    if (event?.type === 'lifecycle') publishEvent(userId, EVENT.LIFECYCLE, event.data)
  },
})
const shardOwnership = createShardOwnershipCoordinator({
  db,
  logger,
  dedicated: {
    block: userId => sessionCore.blockSessionCommands(userId),
    unblock: userId => sessionCore.unblockSessionCommands(userId),
    drain: async () => true,
    stop: async userId => sessionCore.stopBot(userId),
    waitForExit: (userId, timeoutMs) => sessionCore.waitForBotExit(userId, timeoutMs),
    isRunning: async userId => sessionCore.isRunning(userId),
    start: async userId => startBotWithBridge(userId),
    waitForHeartbeat: async (userId, timeoutMs) => {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        const processInfo = sessionCore.getSessionProcessInfo(userId)
        const row = await db.waSession.findUnique({ where: { userId }, select: { status: true, lifecycle: true } })
        if (processInfo?.lastHeartbeatAt && row?.status === 'connected' && row?.lifecycle === 'ready') return true
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      return false
    },
  },
  shard: pocShard,
})

// Orçamento de restarts automáticos por sessão (health monitor). Start manual
// via comando START_BOT limpa a quarentena.
const restartBudget = createRestartBudget()
// RCA 2026-08-27: sessão presa há mais de 2min grava status='disconnected'
// com lifecycle='reconnecting' e, antes deste fix, sumia da ressurreição —
// morrendo de vez quando o worker caía. `WA_RESURRECT_RECONNECTING=0` volta ao
// comportamento antigo sem redeploy.
const RESURRECT_RECONNECTING = resolveIncludeReconnecting()

// Espelha o sessionCore: AUTO_START_WHATSAPP_SESSIONS=false desliga o
// auto-resume/ressurreição. Comandos manuais (START_BOT) e kill de zumbis
// seguem ativos. Antes o supervisor ignorava a flag e divergia do inline.
const AUTO_RESUME = supervisorShouldAutoResume(process.env)

logModeSummary('bot-supervisor', {
  shardCount: SHARD_COUNT,
  shardIndex: SHARD_INDEX,
  shardTag: SHARD_TAG,
  nodeRouting: NODE_ROUTING,
  nodeId: NODE_ROUTING ? NODE_ID : null,
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
  // Sinal durável: sem isso o teto cheio só aparecia no log do supervisor, e a
  // recusa chegava à cliente como "Bot não está conectado" (RCA 2026-09-01).
  recordOperationalSignal('session_capacity_limit', { userId, running, max: MAX_SESSIONS_PER_PROCESS, shard: SHARD_TAG })
  if (SESSION_CIRCUIT_BREAKER_MODE === 'open') return true
  return false
}

// Posse por nó: cache curto de WaSession.nodeId. O processador de comandos
// aquece o cache (async) antes de rodar o handler; daí `belongsToThisShard`
// continua síncrono. Desconhecido (nunca consultado) conta como "meu": quem
// chega aqui sem aquecer vem do resume/health monitor, que já filtram por nó
// no banco, ou é um bot que ESTE processo iniciou — nunca paramos robô por
// falha de leitura.
const nodeOwnership = createNodeOwnershipCache({
  loadNodeId: async userId => {
    const row = await db.waSession.findUnique({ where: { userId }, select: { nodeId: true } })
    return row?.nodeId || 'n1'
  },
})

// Cadeado de posse (SUPERVISOR_OWNER_LEASE, default off): 2ª barreira contra o
// mesmo WhatsApp ligado em dois nós. Falha aberta; o banco é a verdade.
const OWNER_LEASE = isOwnerLeaseEnabled(process.env)
const ownerLease = OWNER_LEASE ? createOwnerLease({ redis: publisher, nodeId: NODE_ID, logger }) : null

// Número reserva (docs/rca/multi-numero.md): com roteamento por nó, só retoma a
// prontidão de conta cujo número ativo mora neste nó.
async function listStandbyForThisNode() {
  return listResumableStandbySessions(db, {
    includeReconnecting: RESURRECT_RECONNECTING,
    accountSessionWhere: NODE_ROUTING ? nodeIdWhere(NODE_ID) : null,
  }).catch(err => {
    logger.warn({ err: err?.message, shard: SHARD_TAG }, 'Falha ao listar números de prontidão para retomar')
    return []
  })
}

function belongsToThisShard(sessionKey) {
  // Número reserva (<conta>~n2) mora no shard/nó da CONTA.
  const userId = accountIdFromSessionKey(sessionKey) ?? sessionKey
  if (!NODE_ROUTING) return shouldHandleUserOnShard(userId, SHARD_COUNT, SHARD_INDEX)
  const cached = nodeOwnership.peek(userId)
  return cached === null ? true : cached === NODE_ID
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
  if (ownerLease && !sessionCore.isRunning(userId)) {
    const lease = await ownerLease.acquire(userId)
    if (!lease.ok) {
      logger.error({ userId, holder: lease.holder, nodeId: NODE_ID, event: 'session_lease_conflict' }, 'session_lease_conflict: outro servidor já está com este WhatsApp ligado — start recusado')
      void noteSessionOwnerMismatch(userId, 'startBot:lease')
      return false
    }
  }
  const ok = sessionCore.startBot(userId)
  if (!ok && ownerLease) void ownerLease.release(userId)
  if (ok) attachBridge(userId)
  return ok
}

function stopBotWithBridge(userId) {
  // C1: com roteamento, robô que roda AQUI é parado mesmo se o banco disser
  // que o dono é outro nó (é assim que se desfaz um "robô em dois servidores").
  if (!shouldActLocally({ routing: NODE_ROUTING, owns: belongsToThisShard(userId), runningHere: sessionCore.isRunning(userId) })) {
    void noteSessionOwnerMismatch(userId, 'stopBot')
    return false
  }
  const ok = sessionCore.stopBot(userId)
  detachBridge(userId)
  if (ownerLease) void ownerLease.release(userId)
  return ok
}

// ---- Consumidor BullMQ ----

const COMMAND_HANDLERS = {
  // Start explícito (usuário/admin) limpa a quarentena do restart budget —
  // intervenção manual é o caminho documentado para religar antes do prazo.
  [COMMAND.START_BOT]: ({ userId }) => {
    restartBudget.clear(userId)
    if (shardOwnedUsers.has(userId)) return pocShard.start(userId)
    return startBotWithBridge(userId)
  },
  [COMMAND.STOP_BOT]: ({ userId }) => shardOwnedUsers.has(userId) ? pocShard.stop(userId) : stopBotWithBridge(userId),
  // C1: com roteamento, responde a verdade LOCAL (robô ligado aqui = true,
  // mesmo fora da posse) — senão "parou?" respondia "sim" com o robô vivo.
  [COMMAND.IS_RUNNING]: ({ userId }) => shouldActLocally({ routing: NODE_ROUTING, owns: belongsToThisShard(userId), runningHere: sessionCore.isRunning(userId) }) ? (shardOwnedUsers.has(userId) ? pocShard.isRunning(userId) : sessionCore.isRunning(userId)) : false,
  [COMMAND.LIST_RUNNING_BOTS]: async () => {
    const dedicatedUsers = sessionCore.listRunningBots()
    const shardUsers = []
    for (const userId of shardOwnedUsers) if (await pocShard.isRunning(userId)) shardUsers.push(userId)
    return [...new Set([...dedicatedUsers, ...shardUsers])]
  },
  [COMMAND.LIST_GROUPS]: ({ userId }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'listGroups')
      throw new Error('Session owner mismatch')
    }
    return shardOwnedUsers.has(userId) ? pocShard.command(userId, 'listGroups') : sessionCore.listGroups(userId)
  },
  [COMMAND.SEND_BROADCAST]: ({ userId, text, jids, options }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'sendBroadcast')
      throw new Error('Session owner mismatch')
    }
    return shardOwnedUsers.has(userId) ? pocShard.command(userId, 'broadcast', { text, jids, options }) : sessionCore.sendBroadcast(userId, text, jids, options)
  },
  [COMMAND.SEND_SELF_MESSAGE]: ({ userId, text, actorUserId, kind }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'sendSelfMessage')
      throw new Error('Session owner mismatch')
    }
    return shardOwnedUsers.has(userId)
      ? pocShard.command(userId, 'sendSelfMessage', { text, actorUserId, kind })
      : sessionCore.sendSelfMessage(userId, text, actorUserId, { kind })
  },
  [COMMAND.REQUEST_PAIRING_CODE]: ({ userId, phone }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'requestPairingCode')
      throw new Error('Session owner mismatch')
    }
    return shardOwnedUsers.has(userId) ? pocShard.command(userId, 'requestPairingCode', { phone }) : sessionCore.requestPairingCode(userId, phone)
  },
  [COMMAND.GET_BOT_METRICS]: ({ userId }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'getBotMetrics')
      return { session_owner_mismatch_total: sessionOwnerMismatchTotal }
    }
    return shardOwnedUsers.has(userId) ? pocShard.sessionMetrics(userId) : sessionCore.getBotMetrics(userId)
  },
  [COMMAND.RELOAD_CONFIG]: ({ userId }) => shardOwnedUsers.has(userId)
    ? pocShard.command(userId, 'reloadConfig')
    : createReloadConfigHandler({ belongsToThisShard, sessionCore, logger })({ userId }),
  [COMMAND.REFRESH_WA_GROUPS]: ({ userId }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'refreshWaGroups')
      throw new Error('Session owner mismatch')
    }
    return shardOwnedUsers.has(userId) ? pocShard.command(userId, 'refreshWaGroups') : sessionCore.refreshWaGroups(userId)
  },
  [COMMAND.CHANNEL_METADATA]: ({ userId, jid, inviteCode }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'channelMetadata')
      throw new Error('Session owner mismatch')
    }
    return shardOwnedUsers.has(userId) ? pocShard.command(userId, 'channel:metadata', { jid, inviteCode }) : sessionCore.channelMetadata(userId, { jid, inviteCode })
  },
  [COMMAND.GROUP_INVITE_CODE]: ({ userId, jid }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'groupInviteCode')
      throw new Error('Session owner mismatch')
    }
    return shardOwnedUsers.has(userId) ? pocShard.command(userId, 'group:inviteCode', { jid }) : sessionCore.groupInviteCode(userId, jid)
  },
  [COMMAND.CHANNEL_FOLLOW]: ({ userId, jid }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'channelFollow')
      throw new Error('Session owner mismatch')
    }
    return shardOwnedUsers.has(userId) ? pocShard.command(userId, 'channel:follow', { jid }) : sessionCore.followChannelImmediate(userId, jid)
  },
  [COMMAND.CHANNEL_LIST_FOLLOWED]: ({ userId }) => {
    if (!belongsToThisShard(userId)) {
      void noteSessionOwnerMismatch(userId, 'channelListFollowed')
      throw new Error('Session owner mismatch')
    }
    return shardOwnedUsers.has(userId) ? pocShard.command(userId, 'channel:listFollowed') : sessionCore.listFollowedChannels(userId)
  },
  [COMMAND.GET_LAST_QR]: ({ userId }) => belongsToThisShard(userId) ? (shardOwnedUsers.has(userId) ? pocShard.getLastQR(userId) : sessionCore.getLastQR(userId)) : null,
  [COMMAND.SHARD_MOVE_SESSION]: async ({ userId, shardId = 'poc-1' }) => {
    if (SHARD_POC_MODE !== 'enabled') throw new Error(`Shard POC não habilitado (modo ${SHARD_POC_MODE})`)
    if (shardId !== 'poc-1') throw new Error('Shard POC desconhecido')
    if (!belongsToThisShard(userId)) throw new Error('Session owner mismatch')
    const result = await shardOwnership.moveToShard({ userId, shardId })
    shardOwnedUsers.add(userId)
    return result
  },
  [COMMAND.SHARD_ROLLBACK_SESSION]: async ({ userId, shardId = 'poc-1' }) => {
    if (shardId !== 'poc-1') throw new Error('Shard POC desconhecido')
    const result = await shardOwnership.rollback({ userId, shardId, dedicatedOwner: SHARD_TAG })
    shardOwnedUsers.delete(userId)
    return result
  },
  [COMMAND.SHARD_METRICS]: ({ shardId = 'poc-1' }) => shardId === 'poc-1' ? pocShard.metrics() : null,
}

// lockDuration > maior timeout de comando (+ folga) para que handlers
// legitimamente longos (REQUEST_PAIRING_CODE 45s, SEND_BROADCAST 30s) NÃO
// sejam marcados como stalled e reprocessados no meio da execução — um
// reprocesso de SEND_BROADCAST seria envio duplicado. O guard isCommandStale
// é a segunda linha: mesmo que um stall escape, o job reentregue já estará
// velho demais e é descartado em vez de reexecutado.
const COMMAND_LOCK_DURATION_MS = Math.max(60_000, Math.max(...Object.values(COMMAND_TIMEOUTS_MS)) + 15_000)

// Hora do Redis (só com roteamento por nó): API e supervisor carimbam e
// comparam na MESMA régua, imune a desvio de relógio entre servidores.
const redisClock = createRedisClock({ time: () => publisher.time() })

async function processCommand(job) {
  const name = job.name
  if (!isKnownCommand(name)) throw new Error(`Comando desconhecido: ${name}`)
  const data = job.data ?? {}
  // Drenagem de jobs velhos / TTL de comando: se a API já desistiu de
  // esperar, descartar em vez de executar (evita SEND_BROADCAST duplicado).
  // Retornamos resultado (job 'completed') em vez de throw: a decisão de
  // descartar foi bem-sucedida; ninguém está aguardando o valor.
  const nowMs = NODE_ROUTING ? await redisClock.now() : Date.now()
  if (isCommandStale(name, data._enqueuedAt, nowMs)) {
    const ageMs = nowMs - Number(data._enqueuedAt)
    logger.warn({ jobId: job.id, name, userId: data.userId ?? null, ageMs }, 'Comando obsoleto descartado (API já desistiu) — não executado')
    // Com roteamento, START_BOT obsoleto devolve `false` (recusa): o objeto
    // `{_stale}` é truthy e a rota o lia como "robô iniciado" (QR nunca vinha).
    if (NODE_ROUTING && name === COMMAND.START_BOT) return false
    return { _stale: true, discarded: true, ageMs }
  }
  const handler = COMMAND_HANDLERS[name]
  if (!handler) throw new Error(`Handler ausente para ${name}`)
  // Aquece a posse por nó (async) para os handlers síncronos. Falha de banco
  // propaga: o comando falha visível em vez de rodar sem saber de quem é.
  if (NODE_ROUTING && data.userId) {
    if (commandNeedsFreshOwnership(name)) nodeOwnership.invalidate(data.userId) // START/STOP: banco, sem cache
    await nodeOwnership.get(data.userId)
  }
  return await handler(data)
}

function createCommandWorker(queueName) {
  const w = new Worker(queueName, processCommand, {
    connection: { url: REDIS_URL, maxRetriesPerRequest: null },
    concurrency: 8,
    lockDuration: COMMAND_LOCK_DURATION_MS,
  })
  w.on('failed', (job, err) => {
    logger.warn({ jobId: job?.id, name: job?.name, queue: queueName, err: err?.message }, 'Comando supervisor falhou')
  })
  w.on('stalled', jobId => {
    // Reprocesso por stall é tolerado: isCommandStale descarta o reentregue se já
    // passou do timeout. Logamos para visibilidade do sinal (morte abrupta).
    logger.warn({ jobId, queue: queueName }, 'Comando supervisor stalled (lock expirou) — guard de staleness evita efeito duplicado no reprocesso')
  })
  return w
}

// Flag off: UMA fila, a legada (idêntico ao histórico). Flag on: a fila do nó
// E, só no 'n1', a legada (transição — a API ainda pode estar nela). Outros
// nós NUNCA leem a legada: pegariam jobs de sessões do 'n1'.
const workers = NODE_ROUTING
  ? [createCommandWorker(commandQueueName(NODE_ID)), ...(ownsLegacyQueue(NODE_ID) ? [createCommandWorker(COMMAND_QUEUE)] : [])]
  : [createCommandWorker(COMMAND_QUEUE)]

// ---- Heartbeat ----

let heartbeatTimer = null
// Momento em que ESTE processo subiu. Renovado junto do heartbeat (mesmo TTL)
// para a chave sumir quando o supervisor morre — assim a API nunca compara
// contra o boot de um supervisor que não existe mais. Ver
// `ops/staleWorkerCodeGuard.js`.
const SUPERVISOR_BOOTED_AT_MS = Date.now()
async function renewHeartbeat() {
  try {
    if (NODE_ROUTING) {
      await publisher.set(heartbeatKey(NODE_ID), String(Date.now()), 'EX', SUPERVISOR_HEARTBEAT_TTL_SECONDS)
      await publisher.set(bootedAtKey(NODE_ID), String(SUPERVISOR_BOOTED_AT_MS), 'EX', SUPERVISOR_HEARTBEAT_TTL_SECONDS)
      // Teto DESTE nó: a API lê daqui em vez de presumir o mesmo teto para todos.
      await publisher.set(capacityKey(NODE_ID), String(MAX_SESSIONS_PER_PROCESS), 'EX', SUPERVISOR_HEARTBEAT_TTL_SECONDS)
      // Qual MÁQUINA é este nó (revisão C3): outro servidor com o mesmo nome
      // vê isto no boot e fica em espera em vez de religar as mesmas contas.
      await publisher.set(identityKey(NODE_ID), NODE_IDENTITY, 'EX', SUPERVISOR_HEARTBEAT_TTL_SECONDS)
    }
    // Chaves legadas: sempre com a flag off; com ela on, só o 'n1' (a API ainda
    // em modo legado lê estas — dois nós não podem sobrescrever a mesma chave).
    if (!NODE_ROUTING || ownsLegacyQueue(NODE_ID)) {
      await publisher.set(SUPERVISOR_HEARTBEAT_KEY, String(Date.now()), 'EX', SUPERVISOR_HEARTBEAT_TTL_SECONDS)
      await publisher.set(SUPERVISOR_BOOTED_AT_KEY, String(SUPERVISOR_BOOTED_AT_MS), 'EX', SUPERVISOR_HEARTBEAT_TTL_SECONDS)
    }
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

  // Falha de uma sessão dentro do shard reduz blast radius: restaura somente
  // aquele tenant ao worker dedicado, sem reiniciar as outras três.
  for (const userId of [...shardOwnedUsers]) {
    try {
      if (await pocShard.isRunning(userId)) continue
      logger.error({ userId }, 'Sessão saiu do shard — rollback automático individual')
      await shardOwnership.rollback({ userId, shardId: 'poc-1', dedicatedOwner: SHARD_TAG })
      shardOwnedUsers.delete(userId)
    } catch (err) {
      logger.error({ userId, err: err?.message }, 'Rollback automático da sessão do shard falhou')
    }
  }

  // (2) Ressuscita sessões persistidas que pertencem ao shard mas não estão
  // rodando localmente — cobre tanto o exit de worker (OOM/exceção) quanto
  // o restart pós-stopBot acima no próximo tick. Pulado quando o auto-resume
  // está desligado (AUTO_START_WHATSAPP_SESSIONS=false).
  if (!AUTO_RESUME) return
  try {
    const persisted = (await db.waSession.findMany({
      where: buildResumeWhere({ base: buildResurrectionWhere({ includeReconnecting: RESURRECT_RECONNECTING }), nodeId: NODE_ID, routing: NODE_ROUTING }),
      select: { userId: true, status: true, lifecycle: true, ownerInstance: true },
    })).filter(row => shouldResurrectSession({ ...row, includeReconnecting: RESURRECT_RECONNECTING }))
      .concat(await listStandbyForThisNode())
    for (const s of persisted) {
      // Prontidão (<conta>~n2) segue o nó/shard da CONTA, nunca o hash da chave.
      const shardKey = s.accountId ?? s.userId
      if (NODE_ROUTING && !s.accountId) nodeOwnership.set(s.userId, NODE_ID) // o filtro do banco já provou a posse
      if (!belongsToThisShard(shardKey)) continue
      if (String(s.lifecycle).startsWith('moving') || String(s.lifecycle).startsWith('restoring') || String(s.ownerInstance).startsWith('shard:')) continue
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
      // Sinal próprio para o caso do RCA 2026-08-27: sessão que estava
      // marcada como desconectada mas com o robô declarando "ainda tentando".
      // Antes deste fix ela morria de vez e só voltava com a cliente clicando —
      // medir quantas vezes salvamos é o que prova o valor do conserto.
      const eraOrfaReconectando = s.status === 'disconnected' && s.lifecycle === 'reconnecting'
      try {
        await startBotWithBridge(s.userId)
        if (eraOrfaReconectando) {
          logger.warn({ userId: s.userId, shard: SHARD_TAG }, 'Sessão presa em reconexão sem worker foi ressuscitada (antes só voltava com ação da cliente)')
          try {
            const { recordOperationalSignal } = await import('../observability/operationalSignals.js')
            recordOperationalSignal('wa_session_resurrected', { userId: s.userId })
          } catch {}
        }
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

  // O shard é filho do supervisor. Se o supervisor reiniciou, qualquer owner
  // `shard:*` persistido é órfão por definição. Reverte a posse antes do
  // auto-resume; nunca abre um segundo shard às cegas sobre auth existente.
  try {
    const orphaned = await db.waSession.findMany({ where: { ownerInstance: { startsWith: 'shard:' } }, select: { userId: true } })
    for (const { userId } of orphaned) {
      await db.waSession.update({ where: { userId }, data: { ownerInstance: SHARD_TAG, lifecycle: 'reconnecting', status: 'connected' } })
      logger.warn({ userId }, 'Ownership de shard órfão restaurado para worker dedicado após restart do supervisor')
    }
  } catch (err) {
    logger.error({ err: err?.message }, 'Falha ao reconciliar ownership de shard no boot')
  }

  // Resume de sessões persistidas — guardado por try/catch por sessão. Antes
  // o loop era unguarded: uma única sessão com auth_info corrompido derrubava
  // o boot inteiro, PM2 reiniciava, mesma falha → loop de DoS auto-infligido.
  // Pulado quando AUTO_START_WHATSAPP_SESSIONS=false (paridade com inline).
  let started = 0
  let attempted = 0
  try {
    const persisted = AUTO_RESUME
      ? (await db.waSession.findMany({
          where: buildResumeWhere({ base: buildResurrectionWhere({ includeReconnecting: RESURRECT_RECONNECTING }), nodeId: NODE_ID, routing: NODE_ROUTING }),
          select: { userId: true, status: true, lifecycle: true, ownerInstance: true },
        })).filter(row => shouldResurrectSession({ ...row, includeReconnecting: RESURRECT_RECONNECTING }))
          .concat(await listStandbyForThisNode())
      : []
    if (!AUTO_RESUME) logger.info({ shard: SHARD_TAG }, 'AUTO_START_WHATSAPP_SESSIONS=false — supervisor não faz auto-resume (só comandos manuais)')
    attempted = persisted.length
    for (const s of persisted) {
      // Prontidão (<conta>~n2) segue o nó/shard da CONTA, nunca o hash da chave.
      const shardKey = s.accountId ?? s.userId
      if (NODE_ROUTING && !s.accountId) nodeOwnership.set(s.userId, NODE_ID) // o filtro do banco já provou a posse
      if (!belongsToThisShard(shardKey)) continue
      if (String(s.lifecycle).startsWith('moving') || String(s.lifecycle).startsWith('restoring') || String(s.ownerInstance).startsWith('shard:')) continue
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
      // Com roteamento por nó NÃO paramos robô por "posse": o cache vem de
      // comandos (um comando mal roteado faria este nó matar o próprio robô).
      if (!NODE_ROUTING && !belongsToThisShard(userId)) {
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

  // Renova o cadeado dos robôs que ESTE nó roda. Se outro nó o segurou, só
  // sinaliza (nunca derruba robô por causa do cadeado — o banco manda).
  if (ownerLease) {
    setInterval(async () => {
      for (const userId of sessionCore.listRunningBots()) {
        const r = await ownerLease.renew(userId)
        if (!r.ok) logger.error({ userId, holder: r.holder, nodeId: NODE_ID, event: 'session_lease_conflict' }, 'session_lease_conflict: outro servidor segura o cadeado de um robô que roda aqui')
      }
    }, OWNER_LEASE_RENEW_INTERVAL_MS).unref?.()
  }

  logger.info('bot-supervisor pronto — consumindo comandos')
}

async function shutdown(signal) {
  logger.info({ signal }, 'bot-supervisor encerrando')
  try { if (heartbeatTimer) clearInterval(heartbeatTimer) } catch {}
  try { if (healthMonitorTimer) clearInterval(healthMonitorTimer) } catch {}
  if (NODE_ROUTING) {
    try { await publisher.del(heartbeatKey(NODE_ID)) } catch {}
    try { await publisher.del(bootedAtKey(NODE_ID)) } catch {}
    try { await publisher.del(capacityKey(NODE_ID)) } catch {}
    try { if ((await publisher.get(identityKey(NODE_ID))) === NODE_IDENTITY) await publisher.del(identityKey(NODE_ID)) } catch {}
    if (ownerLease) for (const userId of sessionCore.listRunningBots()) { try { await ownerLease.release(userId) } catch {} }
  }
  if (!NODE_ROUTING || ownsLegacyQueue(NODE_ID)) {
    try { await publisher.del(SUPERVISOR_HEARTBEAT_KEY) } catch {}
    try { await publisher.del(SUPERVISOR_BOOTED_AT_KEY) } catch {}
  }
  for (const w of workers) { try { await w.close() } catch {} }
  try { await pocShard.shutdown() } catch {}
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
}
