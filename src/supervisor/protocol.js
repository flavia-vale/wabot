/**
 * Protocolo de comunicação API <-> bot-supervisor.
 *
 * Esse módulo concentra os nomes de filas, canais pub/sub, tipos de comando
 * e timeouts default — qualquer mudança em formato precisa passar por aqui
 * para que client (API) e servidor (supervisor) fiquem em sync.
 *
 * [PROTECTED_CORE]: tratar como contrato. Mudanças breaking exigem versão.
 */

export const PROTOCOL_VERSION = 1

// Fila BullMQ que carrega comandos request-response API -> Supervisor.
// IMPORTANTE: BullMQ proíbe ':' em nomes de fila (usa ':' como separador
// interno de chaves Redis 'bull:<queue>:<id>'). O construtor de Worker/Queue
// lança 'Error: Queue name cannot contain :' e mata o supervisor no boot.
// Mantemos hífen como separador. Pub/sub channels e chaves Redis simples
// (heartbeat) podem ter ':' — só Queue/Worker que não pode.
export const COMMAND_QUEUE = 'supervisor-commands'

// Canal Redis pub/sub que carrega eventos broadcast Supervisor -> API.
// payload: { v, userId, type, data, ts }
export const EVENTS_CHANNEL = 'bots:events'

// Chave Redis com TTL renovado pelo supervisor para liveness.
export const SUPERVISOR_HEARTBEAT_KEY = 'supervisor:heartbeat'
export const SUPERVISOR_HEARTBEAT_TTL_SECONDS = 30
export const SUPERVISOR_HEARTBEAT_RENEW_INTERVAL_MS = 10_000

// Tipos de comando aceitos pelo supervisor. Cada um mapeia 1:1 para um método
// equivalente em src/core/sessionCore.js, mantendo a mesma superfície que o
// manager.js sempre expôs para as rotas.
export const COMMAND = Object.freeze({
  START_BOT: 'startBot',
  STOP_BOT: 'stopBot',
  IS_RUNNING: 'isRunning',
  LIST_RUNNING_BOTS: 'listRunningBots',
  LIST_GROUPS: 'listGroups',
  SEND_BROADCAST: 'sendBroadcast',
  REQUEST_PAIRING_CODE: 'requestPairingCode',
  GET_BOT_METRICS: 'getBotMetrics',
  RELOAD_CONFIG: 'reloadConfig',
  REFRESH_WA_GROUPS: 'refreshWaGroups',
  CHANNEL_METADATA: 'channel:metadata',
  CHANNEL_FOLLOW: 'channel:follow',
  CHANNEL_LIST_FOLLOWED: 'channel:listFollowed',
  GET_LAST_QR: 'getLastQR',
})

// Tipos de evento publicados pelo supervisor.
export const EVENT = Object.freeze({
  QR: 'qr',
  STATUS: 'status',
  LIFECYCLE: 'lifecycle',
  HEARTBEAT: 'heartbeat',
})

// Timeouts default por comando (ms). Mantém os mesmos valores já usados em
// src/core/sessionCore.js para não mudar semântica visível à rota.
export const COMMAND_TIMEOUTS_MS = Object.freeze({
  [COMMAND.START_BOT]: 5_000,
  [COMMAND.STOP_BOT]: 15_000,
  [COMMAND.IS_RUNNING]: 5_000,
  [COMMAND.LIST_RUNNING_BOTS]: 5_000,
  [COMMAND.LIST_GROUPS]: 10_000,
  [COMMAND.SEND_BROADCAST]: 30_000,
  [COMMAND.REQUEST_PAIRING_CODE]: 45_000,
  [COMMAND.GET_BOT_METRICS]: 5_000,
  [COMMAND.RELOAD_CONFIG]: 5_000,
  [COMMAND.REFRESH_WA_GROUPS]: 15_000,
  [COMMAND.CHANNEL_METADATA]: 15_000,
  [COMMAND.CHANNEL_FOLLOW]: 15_000,
  [COMMAND.CHANNEL_LIST_FOLLOWED]: 20_000,
  [COMMAND.GET_LAST_QR]: 5_000,
})

/**
 * @typedef {Object} SupervisorEvent
 * @property {number} v
 * @property {string} userId
 * @property {string} type
 * @property {any} data
 * @property {number} ts
 */

/**
 * @typedef {Object} SupervisorCommandPayload
 * @property {string} name
 * @property {string} userId
 * @property {Object<string, any>} [payload]
 */

export function isKnownCommand(name) {
  return Object.values(COMMAND).includes(name)
}

export function commandTimeoutMs(name) {
  return COMMAND_TIMEOUTS_MS[name] ?? 10_000
}

/**
 * Empacota um evento no formato canônico antes de publicar em EVENTS_CHANNEL.
 * Mantém versionamento explícito (v) para permitir evoluir o formato sem
 * quebrar consumidores antigos.
 */
export function encodeEvent({ userId, type, data = null, ts = Date.now() }) {
  if (!userId) throw new Error('encodeEvent: userId obrigatório')
  if (!type) throw new Error('encodeEvent: type obrigatório')
  return JSON.stringify({ v: PROTOCOL_VERSION, userId, type, data, ts })
}

/**
 * Desserializa o payload de EVENTS_CHANNEL. Retorna null se for malformado
 * ou de versão incompatível — consumidores devem ignorar silenciosamente
 * (a alternativa é derrubar o assinante por uma mensagem mal-formada).
 */
export function decodeEvent(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null
  let parsed
  try { parsed = JSON.parse(raw) } catch { return null }
  if (!parsed || typeof parsed !== 'object') return null
  if (parsed.v !== PROTOCOL_VERSION) return null
  if (!parsed.userId || !parsed.type) return null
  return /** @type {SupervisorEvent} */ (parsed)
}

/**
 * Resolve a URL Redis aceitando overrides de ambiente. Centralizado aqui
 * para que client e supervisor concordem em qual URL ler.
 */
export function resolveRedisUrl(env = process.env) {
  return env.SUPERVISOR_REDIS_URL || env.REDIS_URL || ''
}
