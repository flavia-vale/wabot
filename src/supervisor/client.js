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
import { buildRedisOptions } from '../core/redisFactory.js'
import {
  COMMAND,
  COMMAND_QUEUE,
  EVENT,
  EVENTS_CHANNEL,
  PROTOCOL_VERSION,
  SUPERVISOR_HEARTBEAT_KEY,
  commandTimeoutMs,
  decodeEvent,
  lastEventKey,
  resolveRedisUrl,
} from './protocol.js'

// P2-2: pub/sub é versionado (decodeEvent rejeita versão incompatível). Antes
// isso era um descarte SILENCIOSO — num rolling deploy com PROTOCOL_VERSION
// diferente entre supervisor e API, eventos de QR/status sumiam sem rastro.
// Logamos o mismatch de forma THROTTLED (1/min) pra dar visibilidade sem
// inundar o log se a divergência persistir.
let lastProtocolMismatchWarnAt = 0
function warnOnProtocolMismatch(raw) {
  let parsed
  try { parsed = JSON.parse(raw) } catch { return }
  if (!parsed || typeof parsed !== 'object') return
  if (parsed.v === PROTOCOL_VERSION) return
  const now = Date.now()
  if (now - lastProtocolMismatchWarnAt < 60_000) return
  lastProtocolMismatchWarnAt = now
  logger.warn(
    { gotVersion: parsed.v, expectedVersion: PROTOCOL_VERSION },
    'Evento do supervisor descartado por PROTOCOL_VERSION incompatível — supervisor e API em versões divergentes? (verifique a ordem de deploy)',
  )
}

/**
 * @typedef {Object} SupervisorClient
 * @property {(userId:string)=>Promise<any>} startBot
 * @property {(userId:string)=>Promise<any>} stopBot
 * @property {(userId:string)=>Promise<any>} isRunning
 * @property {()=>Promise<any>} listRunningBots
 * @property {(userId:string)=>Promise<any>} listGroups
 * @property {(userId:string,text:string,jids:string[],options?:Object)=>Promise<any>} sendBroadcast
 * @property {(userId:string,phone:string)=>Promise<any>} requestPairingCode
 * @property {(userId:string)=>Promise<any>} getBotMetrics
 * @property {(userId:string)=>Promise<any>} reloadConfig
 * @property {(userId:string)=>Promise<any>} refreshWaGroups
 * @property {(userId:string,args:{jid?:string,inviteCode?:string})=>Promise<any>} channelMetadata
 * @property {(userId:string,jid:string)=>Promise<any>} followChannelImmediate
 * @property {(userId:string)=>Promise<any>} listFollowedChannels
 * @property {(userId:string,fn:Function)=>Function} onQR
 * @property {(userId:string,fn:Function)=>Function} onStatus
 * @property {(userId:string)=>Promise<any>} getLastQR
 * @property {()=>Promise<{attempted:number,started:number,skipped:number,mode:string}>} resumePersistedBots
 * @property {()=>Function} startSessionHealthMonitor
 * @property {()=>number} stopAllBots
 * @property {()=>Promise<boolean>} isSupervisorAlive
 * @property {()=>Promise<void>} close
 */

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

      subscriber = new Redis(redisUrl, buildRedisOptions('supervisor-client-sub', { lazyConnect: false }))
      publisherCheck = new Redis(redisUrl, buildRedisOptions('supervisor-client-check', { lazyConnect: false }))

      subscriber.on('message', (channel, message) => {
        if (channel !== EVENTS_CHANNEL) return
        const evt = decodeEvent(message)
        if (!evt) { warnOnProtocolMismatch(message); return }
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

  // Lê o último valor cacheado de um evento (QR/STATUS) gravado pelo supervisor
  // em cacheLastEvent. Usado para re-hidratar um assinante que chegou depois da
  // última publicação (fecha a janela fire-and-forget do pub/sub). Best-effort:
  // null quando não há cache, Redis indisponível ou payload corrompido.
  async function getLastEvent(type, userId) {
    if (!publisherCheck) {
      try { await init() } catch { return null }
    }
    try {
      const raw = await publisherCheck.get(lastEventKey(userId, type))
      if (raw == null) return null
      try { return JSON.parse(raw) } catch { return null }
    } catch {
      return null
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
  const sendBroadcast = (userId, text, jids, options = {}) => send(COMMAND.SEND_BROADCAST, { userId, text, jids, options })
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
    const handler = (data, evt) => fn(data, evt)
    events.on(`${type}:${userId}`, handler)
    // Re-hidrata SÓ este assinante com o último valor cacheado (QR/STATUS), em
    // vez de depender de uma nova publicação. Fecha a janela em que um evento
    // publicado antes da subscription estar pronta (ou durante restart da API)
    // se perdia, deixando o painel "carregando" pra sempre. Best-effort e
    // assíncrono: garante init e entrega o cache só para `handler` (não
    // re-emite globalmente, pra não duplicar em assinantes já existentes).
    getLastEvent(type, userId)
      .then(cached => {
        if (cached !== null && cached !== undefined) {
          handler(cached, { v: 1, userId, type, data: cached, cached: true })
        }
      })
      .catch(() => {})
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

  return /** @type {SupervisorClient} */ ({
    // superfície igual a sessionCore.js
    startBot, stopBot, isRunning, listRunningBots,
    listGroups, sendBroadcast, requestPairingCode, getBotMetrics, reloadConfig, refreshWaGroups,
    channelMetadata, followChannelImmediate, listFollowedChannels,
    onQR, onStatus, getLastQR,
    resumePersistedBots, startSessionHealthMonitor, stopAllBots,
    // extras
    isSupervisorAlive, getLastEvent, close, _events: events,
  })
}
