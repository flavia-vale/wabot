/**
 * Cliente do bot-supervisor usado pela API. Expõe a MESMA superfície que
 * src/core/sessionCore.js — assim as rotas continuam importando de
 * src/manager.js sem nenhuma mudança.
 *
 * Conexão Redis é lazy: a API pode subir sem Redis disponível e cair em
 * erro apenas quando uma rota tentar de fato falar com o supervisor.
 */

import { EventEmitter } from 'events'
import logger from '../logger.js'
import {
  COMMAND,
  COMMAND_QUEUE,
  EVENT,
  EVENTS_CHANNEL,
  SUPERVISOR_HEARTBEAT_KEY,
  commandTimeoutMs,
  decodeEvent,
  resolveRedisUrl,
} from './protocol.js'

/**
 * Cria um cliente do supervisor. As dependências (`Queue`, `QueueEvents`,
 * `Redis`) são injetadas para permitir testes com ioredis-mock e bullmq-mock
 * sem precisar de Redis real.
 */
export function createSupervisorClient({
  redisUrl = resolveRedisUrl(),
  // permite injeção em testes
  ioredisModule = null,
  bullmqModule = null,
} = {}) {
  if (!redisUrl) {
    logger.warn('SupervisorClient inicializado sem REDIS_URL — operações remotas vão falhar')
  }

  let queue = null
  let queueEvents = null
  let subscriber = null
  let publisherCheck = null
  let initPromise = null
  const events = new EventEmitter()
  // Evita warning quando muitos sockets WebSocket assinam o mesmo emitter.
  events.setMaxListeners(0)

  async function loadDeps() {
    const ioredis = ioredisModule ?? (await import('ioredis'))
    const bullmq = bullmqModule ?? (await import('bullmq'))
    return { Redis: ioredis.default ?? ioredis.Redis ?? ioredis, Queue: bullmq.Queue, QueueEvents: bullmq.QueueEvents }
  }

  async function init() {
    if (initPromise) return initPromise
    initPromise = (async () => {
      const { Redis, Queue, QueueEvents } = await loadDeps()
      const connectionOpts = { maxRetriesPerRequest: null, enableReadyCheck: false }
      // BullMQ aceita { url } via connection
      queue = new Queue(COMMAND_QUEUE, { connection: { url: redisUrl, ...connectionOpts } })
      queueEvents = new QueueEvents(COMMAND_QUEUE, { connection: { url: redisUrl, ...connectionOpts } })
      await queueEvents.waitUntilReady()

      subscriber = new Redis(redisUrl, { lazyConnect: false })
      publisherCheck = new Redis(redisUrl, { lazyConnect: false })

      subscriber.on('message', (channel, message) => {
        if (channel !== EVENTS_CHANNEL) return
        const evt = decodeEvent(message)
        if (!evt) return
        events.emit(`${evt.type}:${evt.userId}`, evt.data, evt)
        events.emit(evt.type, evt)
      })
      subscriber.on('error', err => logger.warn({ err: err.message }, 'SupervisorClient subscriber Redis error'))
      publisherCheck.on('error', err => logger.warn({ err: err.message }, 'SupervisorClient publisher Redis error'))
      await subscriber.subscribe(EVENTS_CHANNEL)
    })().catch(err => {
      logger.error({ err: err.message }, 'Falha ao inicializar SupervisorClient — tentativas posteriores podem reabrir conexão')
      initPromise = null
      throw err
    })
    return initPromise
  }

  async function send(name, payload = {}, { timeoutMs = commandTimeoutMs(name) } = {}) {
    await init()
    const job = await queue.add(name, { ...payload, _enqueuedAt: Date.now() }, {
      removeOnComplete: { age: 60 },
      removeOnFail: { age: 600 },
      attempts: 1,
    })
    try {
      const result = await job.waitUntilFinished(queueEvents, timeoutMs)
      return result
    } catch (err) {
      // BullMQ lança Error("Job ... has failed with reason: ...") quando o
      // supervisor reporta erro. Propaga com mensagem útil.
      throw new Error(`Comando ${name} falhou: ${err.message}`)
    }
  }

  async function isSupervisorAlive() {
    if (!publisherCheck) {
      try { await init() } catch { return false }
    }
    try {
      const value = await publisherCheck.get(SUPERVISOR_HEARTBEAT_KEY)
      return Boolean(value)
    } catch {
      return false
    }
  }

  // ---- Superfície compatível com src/core/sessionCore.js ----

  // Comandos fire-and-forget assíncronos: aguardam ack do supervisor.
  const startBot = userId => send(COMMAND.START_BOT, { userId })
  const stopBot = userId => send(COMMAND.STOP_BOT, { userId })
  const isRunning = userId => send(COMMAND.IS_RUNNING, { userId })
  const listRunningBots = () => send(COMMAND.LIST_RUNNING_BOTS, {})
  const listGroups = userId => send(COMMAND.LIST_GROUPS, { userId })
  const sendBroadcast = (userId, text, jids) => send(COMMAND.SEND_BROADCAST, { userId, text, jids })
  const requestPairingCode = (userId, phone) => send(COMMAND.REQUEST_PAIRING_CODE, { userId, phone })
  const getBotMetrics = userId => send(COMMAND.GET_BOT_METRICS, { userId })
  const reloadConfig = userId => send(COMMAND.RELOAD_CONFIG, { userId })
  const refreshWaGroups = userId => send(COMMAND.REFRESH_WA_GROUPS, { userId })
  const channelMetadata = (userId, { jid, inviteCode }) => send(COMMAND.CHANNEL_METADATA, { userId, jid, inviteCode })
  const followChannelImmediate = (userId, jid) => send(COMMAND.CHANNEL_FOLLOW, { userId, jid })
  const listFollowedChannels = userId => send(COMMAND.CHANNEL_LIST_FOLLOWED, { userId })
  const getLastQR = userId => send(COMMAND.GET_LAST_QR, { userId })

  // Subscriptions — antes vinham via process IPC do worker filho. Agora
  // chegam via pub/sub. Mantém a mesma assinatura (callback + unsubscribe).
  function subscribeUserEvent(type, userId, fn) {
    // Garante init em background; primeiros eventos podem ser perdidos se
    // chamado antes da subscription Redis estar pronta. Aceitável: dashboard
    // pede QR ativamente após assinar.
    init().catch(() => {})
    const handler = (data, evt) => fn(data, evt)
    events.on(`${type}:${userId}`, handler)
    return () => events.off(`${type}:${userId}`, handler)
  }
  // onQR: callback recebe a string do QR code (mesma semântica de sessionCore.js).
  const onQR = (userId, fn) => subscribeUserEvent(EVENT.QR, userId, fn)
  // onStatus: callback recebe (status, phone). No supervisor o payload é
  // publicado como { status, phone } para preservar essa assinatura.
  const onStatus = (userId, fn) => subscribeUserEvent(EVENT.STATUS, userId, data => {
    if (data && typeof data === 'object') fn(data.status, data.phone)
    else fn(data, undefined)
  })

  // Compatibilidade — no modo inline o `manager.js` historicamente tinha
  // essas funções como ops do servidor; no modo remote elas viram NO-OP
  // porque o supervisor cuida de tudo. Mantemos exportadas para não quebrar
  // a interface importada por src/api/server.js.
  function stopAllBots() {
    // Em modo remote a API não derruba bots no seu shutdown — esse é o
    // ponto inteiro do desacoplamento. Supervisor segue rodando.
    return 0
  }
  async function resumePersistedBots() {
    return { attempted: 0, started: 0, skipped: 0, mode: 'remote' }
  }
  function startSessionHealthMonitor() {
    // Health monitor agora roda no supervisor; cliente não precisa fazer nada.
    return () => {}
  }

  async function close() {
    try { await subscriber?.unsubscribe(EVENTS_CHANNEL) } catch {}
    try { await subscriber?.quit() } catch {}
    try { await publisherCheck?.quit() } catch {}
    try { await queueEvents?.close() } catch {}
    try { await queue?.close() } catch {}
  }

  return {
    // superfície igual a sessionCore.js
    startBot, stopBot, isRunning, listRunningBots,
    listGroups, sendBroadcast, requestPairingCode, getBotMetrics, reloadConfig, refreshWaGroups,
    channelMetadata, followChannelImmediate, listFollowedChannels,
    onQR, onStatus, getLastQR,
    resumePersistedBots, startSessionHealthMonitor, stopAllBots,
    // extras
    isSupervisorAlive, close, _events: events,
  }
}
