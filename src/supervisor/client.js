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
  DEFAULT_NODE_ID,
  PROTOCOL_VERSION,
  SUPERVISOR_BOOTED_AT_KEY,
  SUPERVISOR_HEARTBEAT_KEY,
  bootedAtKey,
  capacityKey,
  commandQueueName,
  commandTimeoutMs,
  decodeEvent,
  heartbeatKey,
  isValidNodeId,
  lastEventKey,
  PLACEMENT_RESERVATION_TTL_SECONDS,
  DUAL_OWNER_STATUS_KEY,
  placementReservationKey,
  resolveRedisUrl,
} from './protocol.js'
import { isNodeRoutingEnabled, resolveKnownNodeIds } from './nodeRouting.js'
import { createRedisClock } from './redisClock.js'
import { findDualOwners, pickNodeForNewSession, resolveSessionNodeId, shouldPlaceSession, shouldReplaceUnpaired, withReservations } from './placement.js'

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
 * @property {(userId:string,text:string,actorUserId?:string|null,options?:{kind?:string})=>Promise<any>} sendSelfMessage
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
 * @property {()=>Promise<number|null>} getSupervisorBootedAtMs
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
  // Roteamento por nó (SUPERVISOR_NODE_ROUTING, default OFF). Desligado, este
  // cliente se comporta exatamente como antes: uma fila só, chaves legadas.
  env = process.env,
  nodeRouting = isNodeRoutingEnabled(env),
  nodeIds = resolveKnownNodeIds(env),
  maxSessionsPerNode = Math.max(1, Number(env.MAX_SESSIONS_PER_PROCESS || 20)),
  nodeCacheTtlMs = 45_000,
  addTimeoutMs = 3_000,
  db = null, // injetável em testes; senão, import tardio de ../db.js
  now = () => Date.now(),
} = {}) {
  if (!redisUrl) {
    logger.warn('SupervisorClient inicializado sem REDIS_URL — operações remotas vão falhar')
  }

  let queue = null
  let queueEvents = null
  let subscriber = null
  let publisherCheck = null
  let initPromise = null
  let deps = null
  const nodeChannels = new Map() // nodeId -> Promise<{queue, queueEvents}>
  const nodeOfUser = new Map() // userId -> { nodeId, expiresAt }
  let dualOwnerTotal = 0
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
      deps = await loadDeps()
      const { Redis, Queue, QueueEvents } = deps
      const connectionOpts = { maxRetriesPerRequest: null, enableReadyCheck: false }
      // Com roteamento por nó, as filas são criadas sob demanda POR nó (e a
      // legada nem é aberta — economiza 2-3 conexões Redis).
      if (!nodeRouting) {
        // BullMQ aceita { url } via connection
        queue = new Queue(COMMAND_QUEUE, { connection: { url: redisUrl, ...connectionOpts } })
        queueEvents = new QueueEvents(COMMAND_QUEUE, { connection: { url: redisUrl, ...connectionOpts } })
        await queueEvents.waitUntilReady()
      }

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

  // Hora do Redis para carimbar `_enqueuedAt` (só com roteamento por nó); o
  // supervisor compara na mesma régua. Ver redisClock.js.
  const redisClock = createRedisClock({ time: async () => (publisherCheck ?? (await init(), publisherCheck)).time() })

  // `queue.add` com maxRetriesPerRequest:null fica pendurado para sempre se o
  // Redis sumir; o teto de tempo transforma isso em erro visível.
  function withTimeout(promise, ms, message) {
    let timer
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms) })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
  }

  async function enqueue(q, qe, name, payload, timeoutMs) {
    const enqueuedAt = nodeRouting ? await redisClock.now() : Date.now()
    const add = q.add(name, { ...payload, _enqueuedAt: enqueuedAt }, {
      removeOnComplete: { age: 60 },
      removeOnFail: { age: 600 },
      attempts: 1,
    })
    const job = nodeRouting ? await withTimeout(add, addTimeoutMs, 'Redis não respondeu ao enfileirar o comando') : await add
    try {
      const result = await job.waitUntilFinished(qe, timeoutMs)
      return result
    } catch (err) {
      // BullMQ lança Error("Job ... has failed with reason: ...") quando o
      // supervisor reporta erro. Propaga com mensagem útil.
      throw new Error(`Comando ${name} falhou: ${err.message}`)
    }
  }

  // ---- Roteamento por nó (só com SUPERVISOR_NODE_ROUTING) ----

  async function getDb() {
    if (db) return db
    db = (await import('../db.js')).default
    return db
  }

  // Fila + QueueEvents do nó, lazy. Falha de criação não fica em cache.
  function getNodeChannel(nodeId) {
    if (!nodeChannels.has(nodeId)) {
      const promise = (async () => {
        await init()
        const { Queue, QueueEvents } = deps
        const connection = { url: redisUrl, maxRetriesPerRequest: null, enableReadyCheck: false }
        const name = commandQueueName(nodeId)
        const q = new Queue(name, { connection })
        const qe = new QueueEvents(name, { connection })
        await qe.waitUntilReady()
        return { queue: q, queueEvents: qe }
      })().catch(err => { nodeChannels.delete(nodeId); throw err })
      nodeChannels.set(nodeId, promise)
    }
    return nodeChannels.get(nodeId)
  }

  // Nó dono da sessão: cache curto + banco (nodeId null = 'n1'). Falha de
  // leitura propaga — rotear às cegas mandaria o comando ao nó errado.
  async function resolveNodeId(userId) {
    const hit = nodeOfUser.get(userId)
    if (hit && hit.expiresAt > now()) return hit.nodeId
    const row = await (await getDb()).waSession.findUnique({ where: { userId }, select: { nodeId: true } })
    const nodeId = resolveSessionNodeId(row)
    nodeOfUser.set(userId, { nodeId, expiresAt: now() + nodeCacheTtlMs })
    return nodeId
  }

  // Revisão C5: API com a flag ligada + supervisor n1 no modo ANTIGO (desfazer
  // na ordem errada, ou supervisor ainda sem a versão nova). O n1 antigo só
  // escreve o heartbeat legado e só lê a fila legada: em vez de "servidor fora"
  // para o painel inteiro, os comandos do n1 vão pela fila legada.
  let lastLegacyFallbackWarnAt = 0
  async function nodeLiveness(nodeId) {
    if (!publisherCheck) {
      try { await init() } catch { return { alive: false, legacy: false } }
    }
    try {
      if (await publisherCheck.get(heartbeatKey(nodeId))) return { alive: true, legacy: false }
      if (nodeId === DEFAULT_NODE_ID && await publisherCheck.get(SUPERVISOR_HEARTBEAT_KEY)) {
        if (now() - lastLegacyFallbackWarnAt > 60_000) {
          lastLegacyFallbackWarnAt = now()
          logger.warn({ event: 'node_routing_legacy_fallback' }, 'node_routing_legacy_fallback: o supervisor n1 está no modo antigo — comandos do n1 indo pela fila legada (desligue SUPERVISOR_NODE_ROUTING na API ou religue o supervisor com a flag)')
        }
        return { alive: true, legacy: true }
      }
      return { alive: false, legacy: false }
    } catch {
      return { alive: false, legacy: false }
    }
  }

  let legacyChannel = null
  function getLegacyChannel() {
    if (!legacyChannel) {
      legacyChannel = (async () => {
        await init()
        const { Queue, QueueEvents } = deps
        const connection = { url: redisUrl, maxRetriesPerRequest: null, enableReadyCheck: false }
        const q = new Queue(COMMAND_QUEUE, { connection })
        const qe = new QueueEvents(COMMAND_QUEUE, { connection })
        await qe.waitUntilReady()
        return { queue: q, queueEvents: qe }
      })().catch(err => { legacyChannel = null; throw err })
    }
    return legacyChannel
  }

  async function sendToNode(nodeId, name, payload, timeoutMs) {
    // Falha rápida: nó sem heartbeat = ninguém vai ler a fila. Sem isso cada
    // clique esperava o timeout cheio (5-45 s) e o job ficava parado na fila.
    const liveness = await nodeLiveness(nodeId)
    if (liveness.legacy) {
      const { queue: q, queueEvents: qe } = await getLegacyChannel()
      return enqueue(q, qe, name, payload, timeoutMs)
    }
    if (!liveness.alive) {
      const err = new Error('O servidor dos seus robôs não está respondendo agora. Nossa equipe já foi avisada — tente de novo em alguns minutos.')
      err.code = 'WA_NODE_UNAVAILABLE'
      // C10: indisponibilidade conhecida (503), não falha da API — o tratador de
      // erros responde 503 com frase genérica e o classificador não a conta como incidente.
      err.statusCode = 503
      err.nodeId = nodeId
      throw err
    }
    const { queue: q, queueEvents: qe } = await getNodeChannel(nodeId)
    return enqueue(q, qe, name, payload, timeoutMs)
  }

  async function send(name, payload = {}, { timeoutMs = commandTimeoutMs(name), nodeId = null } = {}) {
    if (!nodeRouting) {
      await init()
      return enqueue(queue, queueEvents, name, payload, timeoutMs)
    }
    // Comando sem userId (ex.: métricas do shard POC) vai para o 'n1'.
    if (nodeId || !payload?.userId) return sendToNode(nodeId ?? DEFAULT_NODE_ID, name, payload, timeoutMs)
    // Revisão C8: logo depois de uma conta mudar de servidor, o cache (até 45 s)
    // ainda aponta o antigo — que recusa ("Session owner mismatch") ou diz que
    // não há robô para parar. Relê o banco e, se o dono mudou, tenta UMA vez no
    // certo. Sem risco de duplicar: a recusa acontece ANTES de executar.
    const first = await resolveNodeId(payload.userId)
    const retryOnNewOwner = async (fallback) => {
      nodeOfUser.delete(payload.userId)
      const second = await resolveNodeId(payload.userId)
      if (second === first) return fallback()
      return sendToNode(second, name, payload, timeoutMs)
    }
    let result
    try {
      result = await sendToNode(first, name, payload, timeoutMs)
    } catch (err) {
      if (!/Session owner mismatch/.test(String(err?.message))) throw err
      return retryOnNewOwner(() => { throw err })
    }
    if ((name === COMMAND.STOP_BOT || name === COMMAND.IS_RUNNING) && result === false) {
      return retryOnNewOwner(() => result)
    }
    return result
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

  async function isSupervisorAlive(nodeId = null) {
    if (!publisherCheck) {
      try { await init() } catch { return false }
    }
    try {
      if (nodeRouting) {
        if (nodeId) return (await nodeLiveness(nodeId)).alive
        // Sem nodeId: vivo só se TODOS os nós conhecidos estão vivos — um nó
        // morto não pode ficar escondido atrás dos outros.
        const flags = await Promise.all(nodeIds.map(id => nodeLiveness(id)))
        return flags.every(f => f.alive)
      }
      const value = await publisherCheck.get(SUPERVISOR_HEARTBEAT_KEY)
      return Boolean(value)
    } catch {
      return false
    }
  }

  // Momento (epoch ms) em que o supervisor subiu, ou null se a chave não
  // existe (supervisor fora do ar, ou versão anterior a esta que ainda não
  // publica o campo). Consumido pelo guard de "código novo não carregado"
  // (ops/staleWorkerCodeGuard.js), que trata null como "não avisar".
  // Teto de sessões publicado por cada nó (supervisor:capacity:<id>). `null` =
  // nó sem chave (parado, ou supervisor antigo): teto desconhecido, não presumido.
  async function getNodeCapacities() {
    const out = {}
    if (!publisherCheck) {
      try { await init() } catch { return Object.fromEntries(nodeIds.map(id => [id, null])) }
    }
    await Promise.all(nodeIds.map(async id => {
      try {
        const n = Number(await publisherCheck.get(capacityKey(id)))
        out[id] = Number.isFinite(n) && n >= 1 ? Math.floor(n) : null
      } catch {
        out[id] = null
      }
    }))
    return out
  }

  async function getSupervisorBootedAtMs(nodeId = null) {
    if (!publisherCheck) {
      try { await init() } catch { return null }
    }
    const parse = value => {
      const parsed = Number(value)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null
    }
    try {
      if (nodeRouting) {
        if (nodeId) return parse(await publisherCheck.get(bootedAtKey(nodeId)))
        // Sem nodeId: o boot MAIS ANTIGO (o nó com código mais velho é o que importa).
        const boots = (await Promise.all(nodeIds.map(id => publisherCheck.get(bootedAtKey(id))))).map(parse).filter(Boolean)
        return boots.length ? Math.min(...boots) : null
      }
      const value = await publisherCheck.get(SUPERVISOR_BOOTED_AT_KEY)
      return parse(value)
    } catch {
      return null
    }
  }

  // ---- Superfície compatível com src/core/sessionCore.js ----

  // Comandos fire-and-forget assíncronos: aguardam ack do supervisor.
  // Sessão nova (sem nodeId): escolhe o nó vivo com mais vagas e GRAVA o
  // nodeId ANTES de enviar o START_BOT — assim um segundo comando concorrente
  // já enxerga o dono. Devolve null quando nenhum nó pode receber.
  async function measureNodes() {
    const counts = await listRunningBotsByNode()
    const capacities = await getNodeCapacities()
    const reserved = {}
    await Promise.all(nodeIds.map(async id => {
      try { reserved[id] = Number(await publisherCheck?.get(placementReservationKey(id))) || 0 } catch { reserved[id] = 0 }
    }))
    const nodes = await Promise.all(nodeIds.map(async id => ({
      nodeId: id,
      alive: await isSupervisorAlive(id),
      running: counts[id] ?? null,
      // Teto publicado pelo próprio nó; sem chave NÃO se presume (nó nunca é escolhido).
      max: capacities[id] ?? null,
    })))
    return withReservations(nodes, reserved)
  }

  // Reserva a vaga escolhida por 2 min (C9): cadastros simultâneos não caem
  // todos no mesmo nó só porque a contagem ainda não mudou. Best-effort.
  async function reservePlacement(nodeId) {
    try {
      const key = placementReservationKey(nodeId)
      await publisherCheck.incr(key)
      await publisherCheck.expire(key, PLACEMENT_RESERVATION_TTL_SECONDS)
    } catch {}
  }

  async function ensureNodePlacement(userId) {
    const database = await getDb()
    const row = await database.waSession.findUnique({ where: { userId }, select: { nodeId: true, phone: true, status: true, lifecycle: true } })
    // Regra única: nulo = 'n1'. Conta antiga (já pareada) NUNCA é recolocada.
    if (!shouldPlaceSession(row)) {
      const existing = resolveSessionNodeId(row)
      // C9: conta nunca pareada presa a um nó fora do ar/lotado pode ir para outro.
      if (nodeIds.length > 1 && row && !row.phone && row.status === 'disconnected') {
        const nodes = await measureNodes()
        const current = nodes.find(n => n.nodeId === existing)
        if (shouldReplaceUnpaired({ row, node: current ?? { alive: false } })) {
          const chosen = pickNodeForNewSession({ nodes: nodes.filter(n => n.nodeId !== existing) })
          if (chosen) {
            const r = await database.waSession.updateMany({ where: { userId, nodeId: row.nodeId }, data: { nodeId: chosen } })
            if (r?.count) {
              await reservePlacement(chosen)
              logger.warn({ userId, from: existing, to: chosen, event: 'session_replaced_unpaired' }, 'conta nunca pareada trocou de servidor (o dela estava fora do ar ou lotado)')
            }
            const final = resolveSessionNodeId(await database.waSession.findUnique({ where: { userId }, select: { nodeId: true } }))
            nodeOfUser.set(userId, { nodeId: final, expiresAt: now() + nodeCacheTtlMs })
            return final
          }
        }
      }
      nodeOfUser.set(userId, { nodeId: existing, expiresAt: now() + nodeCacheTtlMs })
      return existing
    }
    let chosen = null
    if (nodeIds.length === 1) {
      chosen = nodeIds[0] // um nó só: nada a decidir nem a medir
    } else {
      chosen = pickNodeForNewSession({ nodes: await measureNodes() })
    }
    if (!chosen) {
      logger.warn({ userId, nodeIds }, 'Nenhum nó do supervisor disponível para a sessão nova — start recusado')
      return null
    }
    if (row) {
      // updateMany com nodeId:null: se outro request gravou antes, não sobrescreve.
      await database.waSession.updateMany({ where: { userId, nodeId: null }, data: { nodeId: chosen } })
    } else {
      try {
        await database.waSession.create({ data: { userId, nodeId: chosen } })
      } catch {
        // Corrida de criação (userId é único): quem perdeu lê o dono gravado.
        const again = await database.waSession.findUnique({ where: { userId }, select: { nodeId: true } })
        chosen = resolveSessionNodeId(again)
      }
    }
    const final = resolveSessionNodeId(await database.waSession.findUnique({ where: { userId }, select: { nodeId: true } }))
    if (nodeIds.length > 1 && final === chosen) await reservePlacement(final)
    nodeOfUser.set(userId, { nodeId: final, expiresAt: now() + nodeCacheTtlMs })
    return final
  }

  const startBot = async userId => {
    if (!nodeRouting) return send(COMMAND.START_BOT, { userId })
    const nodeId = await ensureNodePlacement(userId)
    if (!nodeId) return false // sem nó disponível = recusa, classificada pela API
    return send(COMMAND.START_BOT, { userId }, { nodeId })
  }
  // `opts.nodeId` (só com roteamento): fala com um nó ESPECÍFICO em vez do dono
  // no banco — usado pelo desfazer da mudança de servidor (revisão C6).
  const stopBot = (userId, opts = {}) => send(COMMAND.STOP_BOT, { userId }, { nodeId: opts?.nodeId ?? null })
  const isRunning = (userId, opts = {}) => send(COMMAND.IS_RUNNING, { userId }, { nodeId: opts?.nodeId ?? null })
  // Split-brain: o mesmo robô ligado em dois nós. É o único ponto que enxerga
  // os dois nós juntos, então a deduplicação por Set NÃO pode apagar o sinal.
  // Parar o robô do nó errado é opt-in (SUPERVISOR_DUAL_OWNER_AUTOSTOP=1).
  async function reportDualOwners(lists) {
    const dual = findDualOwners(lists)
    if (!dual.length) return
    dualOwnerTotal += dual.length
    for (const { userId, nodes } of dual) {
      logger.error({ userId, nodes, event: 'session_dual_owner' }, 'session_dual_owner: o mesmo robô está ligado em mais de um servidor')
      if (!['1', 'true', 'on'].includes(String(env.SUPERVISOR_DUAL_OWNER_AUTOSTOP ?? '').toLowerCase())) continue
      try {
        const owner = await resolveNodeId(userId)
        for (const nodeId of nodes.filter(id => id !== owner)) {
          await send(COMMAND.STOP_BOT, { userId }, { nodeId })
        }
      } catch (err) {
        logger.error({ userId, err: err?.message }, 'session_dual_owner: falha ao parar o robô do servidor errado')
      }
    }
  }

  // Revisão C11: varredura explícita (a API roda a cada 5 min, só com a flag).
  // Grava o resultado no Redis para o vigia ler; nó sem resposta não conta.
  async function checkDualOwners() {
    const lists = await listRunningByNode()
    const dual = findDualOwners(lists)
    await reportDualOwners(lists)
    try {
      if (!publisherCheck) await init()
      await publisherCheck.set(DUAL_OWNER_STATUS_KEY, JSON.stringify({ at: now(), count: dual.length, users: dual.slice(0, 10) }), 'EX', 900)
    } catch {}
    return dual
  }

  // Fan-out aos nós VIVOS. Cada valor é a lista de userIds do nó, ou null se
  // aquele nó não respondeu. Nó morto (sem heartbeat) não entra: não roda robô.
  async function listRunningByNode() {
    const result = {}
    await Promise.all(nodeIds.map(async id => {
      if (!(await isSupervisorAlive(id))) return
      try {
        const list = await send(COMMAND.LIST_RUNNING_BOTS, {}, { nodeId: id })
        result[id] = Array.isArray(list) ? list : null
      } catch {
        result[id] = null
      }
    }))
    return result
  }
  // Contagem por nó: { n1: 12, n2: null } (null = não medido; NUNCA 0).
  // Revisão C13: com roteamento, /metrics, o aviso de vagas e a escolha de nó
  // perguntam a TODOS os nós; um cache de 15 s evita uma rajada de comandos
  // por raspagem. Só o resultado completo (sem nó "não medido") é guardado.
  let byNodeCache = { at: 0, value: null }
  async function listRunningBotsByNode() {
    if (nodeRouting && byNodeCache.value && now() - byNodeCache.at < 15_000) return { ...byNodeCache.value }
    const value = await listRunningBotsByNodeFresh()
    if (nodeRouting && Object.values(value).every(v => v !== null)) byNodeCache = { at: now(), value }
    return value
  }
  async function listRunningBotsByNodeFresh() {
    if (!nodeRouting) {
      try {
        const list = await send(COMMAND.LIST_RUNNING_BOTS, {})
        return { [DEFAULT_NODE_ID]: Array.isArray(list) ? list.length : null }
      } catch {
        return { [DEFAULT_NODE_ID]: null }
      }
    }
    const lists = await listRunningByNode()
    return Object.fromEntries(Object.entries(lists).map(([id, list]) => [id, list ? list.length : null]))
  }
  // Com roteamento: soma de todos os nós vivos. Se QUALQUER nó falhar, rejeita
  // — a contagem total vira "sem medição" (os chamadores já tratam rejeição
  // como null; somar parcial afirmaria vaga/teto sem medir, ver RCA de capacidade).
  const listRunningBots = async () => {
    if (!nodeRouting) return send(COMMAND.LIST_RUNNING_BOTS, {})
    const lists = await listRunningByNode()
    const failed = Object.entries(lists).filter(([, list]) => list === null).map(([id]) => id)
    if (failed.length) throw new Error(`Contagem de robôs indisponível: nó(s) sem resposta: ${failed.join(', ')}`)
    await reportDualOwners(lists)
    return [...new Set(Object.values(lists).flat())]
  }
  const listGroups = userId => send(COMMAND.LIST_GROUPS, { userId })
  const sendBroadcast = (userId, text, jids, options = {}) => send(COMMAND.SEND_BROADCAST, { userId, text, jids, options })
  const sendSelfMessage = (userId, text, actorUserId = null, options = {}) => send(COMMAND.SEND_SELF_MESSAGE, { userId, text, actorUserId, kind: options?.kind })
  const requestPairingCode = (userId, phone) => send(COMMAND.REQUEST_PAIRING_CODE, { userId, phone })
  const getBotMetrics = userId => send(COMMAND.GET_BOT_METRICS, { userId })
  const reloadConfig = userId => send(COMMAND.RELOAD_CONFIG, { userId })
  const refreshWaGroups = userId => send(COMMAND.REFRESH_WA_GROUPS, { userId })
  const channelMetadata = (userId, { jid, inviteCode }) => send(COMMAND.CHANNEL_METADATA, { userId, jid, inviteCode })
  const groupInviteCode = (userId, jid) => send(COMMAND.GROUP_INVITE_CODE, { userId, jid })
  const followChannelImmediate = (userId, jid) => send(COMMAND.CHANNEL_FOLLOW, { userId, jid })
  const listFollowedChannels = userId => send(COMMAND.CHANNEL_LIST_FOLLOWED, { userId })
  const getLastQR = userId => send(COMMAND.GET_LAST_QR, { userId })
  const moveSessionToShard = (userId, shardId = 'poc-1') => send(COMMAND.SHARD_MOVE_SESSION, { userId, shardId })
  const rollbackSessionFromShard = (userId, shardId = 'poc-1') => send(COMMAND.SHARD_ROLLBACK_SESSION, { userId, shardId })
  const getShardMetrics = (shardId = 'poc-1') => send(COMMAND.SHARD_METRICS, { shardId })

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
    if (legacyChannel) {
      try { const { queue: q, queueEvents: qe } = await legacyChannel; await qe?.close(); await q?.close() } catch {}
    }
    for (const channel of nodeChannels.values()) {
      try {
        const { queue: q, queueEvents: qe } = await channel
        await qe?.close()
        await q?.close()
      } catch {}
    }
  }

  return /** @type {SupervisorClient} */ ({
    // superfície igual a sessionCore.js
    startBot, stopBot, isRunning, listRunningBots, listRunningBotsByNode,
    listGroups, sendBroadcast, sendSelfMessage, requestPairingCode, getBotMetrics, reloadConfig, refreshWaGroups,
    channelMetadata, groupInviteCode, followChannelImmediate, listFollowedChannels,
    onQR, onStatus, getLastQR,
    resumePersistedBots, startSessionHealthMonitor, stopAllBots,
    // extras
    isSupervisorAlive, getSupervisorBootedAtMs, getLastEvent, close, _events: events,
    moveSessionToShard, rollbackSessionFromShard, getShardMetrics,
    resolveNodeId, nodeIds, nodeRouting, getNodeCapacities,
    forgetNode: userId => { nodeOfUser.delete(userId) },
    checkDualOwners,
    // Antes não era exportado: o contador do /metrics ficava sempre 0.
    getDualOwnerTotal: () => dualOwnerTotal,
  })
}
