/**
 * Manager — fachada que esconde se o ciclo de vida dos bots roda inline
 * (mesmo processo que importa este módulo) ou remoto (delegado ao app PM2
 * `bot-supervisor` via Redis).
 *
 * Modo selecionado por BOT_SUPERVISOR_MODE:
 *   - 'inline' (default): comportamento histórico, fork() dos workers feito
 *     no processo importador (hoje, a API).
 *   - 'remote': comandos enfileirados em BullMQ; supervisor consome.
 *
 * IMPORTANTE: a superfície (nomes e assinaturas exportados) DEVE bater com
 * src/core/sessionCore.js para que rotas e o resto da API não mudem.
 */

import logger from './logger.js'
import * as inlineImpl from './core/sessionCore.js'
import { parseEnumEnv, logModeSummary } from './core/envModes.js'

const MODE = parseEnumEnv('BOT_SUPERVISOR_MODE', process.env.BOT_SUPERVISOR_MODE || 'inline', ['inline', 'remote'], 'inline')

let impl = inlineImpl
let remoteClient = null

if (MODE === 'remote') {
  // Importação síncrona via top-level await: ESM permite e mantém a
  // expectativa de que `import { startBot } from '../manager.js'` já
  // venha resolvido.
  const { createSupervisorClient } = await import('./supervisor/client.js')
  remoteClient = createSupervisorClient()
  impl = remoteClient
  logger.info('Manager em modo REMOTE — comandos serão enviados ao bot-supervisor via Redis')
}

logModeSummary('manager', { supervisorMode: MODE })

export const startBot = (...args) => impl.startBot(...args)
export const stopBot = (...args) => impl.stopBot(...args)
export const isRunning = (...args) => impl.isRunning(...args)
export const listRunningBots = (...args) => impl.listRunningBots(...args)
export const onQR = (...args) => impl.onQR(...args)
export const onStatus = (...args) => impl.onStatus(...args)
export const getLastQR = (...args) => impl.getLastQR(...args)
export const listGroups = (...args) => impl.listGroups(...args)
export const sendBroadcast = (...args) => impl.sendBroadcast(...args)
export const sendSelfMessage = (...args) => impl.sendSelfMessage(...args)
export const requestPairingCode = (...args) => impl.requestPairingCode(...args)
export const getBotMetrics = (...args) => impl.getBotMetrics(...args)
export const reloadConfig = (...args) => impl.reloadConfig(...args)
export const refreshWaGroups = (...args) => impl.refreshWaGroups(...args)
export const channelMetadata = (...args) => impl.channelMetadata(...args)
export const groupInviteCode = (...args) => impl.groupInviteCode(...args)
export const followChannelImmediate = (...args) => impl.followChannelImmediate(...args)
export const listFollowedChannels = (...args) => impl.listFollowedChannels(...args)
export const stopAllBots = (...args) => impl.stopAllBots(...args)
export const moveSessionToShard = (...args) => impl.moveSessionToShard ? impl.moveSessionToShard(...args) : Promise.reject(new Error('Shard disponível somente no modo remote'))
export const rollbackSessionFromShard = (...args) => impl.rollbackSessionFromShard ? impl.rollbackSessionFromShard(...args) : Promise.reject(new Error('Shard disponível somente no modo remote'))
export const getShardMetrics = (...args) => impl.getShardMetrics ? impl.getShardMetrics(...args) : Promise.resolve(null)
export const startSessionHealthMonitor = (...args) => impl.startSessionHealthMonitor(...args)
export const resumePersistedBots = (...args) => impl.resumePersistedBots(...args)

export const SUPERVISOR_MODE = MODE

/**
 * Liveness do bot-supervisor (só faz sentido em modo `remote`). Lê o heartbeat
 * que o supervisor renova no Redis. Em `inline` não há supervisor: retorna
 * `null` (N/A) para o chamador distinguir "morto" de "não se aplica".
 * Best-effort: nunca lança.
 */
export async function isSupervisorAlive(nodeId = null) {
  if (MODE !== 'remote' || !remoteClient?.isSupervisorAlive) return null
  try {
    return await remoteClient.isSupervisorAlive(nodeId)
  } catch {
    return false
  }
}

/**
 * Momento (epoch ms) em que o processo do bot-supervisor subiu, ou `null`
 * quando não se aplica (modo `inline`) ou o dado não está disponível.
 * Best-effort: nunca lança. Consumido pelo guard de "código novo não
 * carregado" (`ops/staleWorkerCodeGuard.js`).
 */
export async function getSupervisorBootedAtMs(nodeId = null) {
  if (MODE !== 'remote' || !remoteClient?.getSupervisorBootedAtMs) return null
  try {
    return await remoteClient.getSupervisorBootedAtMs(nodeId)
  } catch {
    return null
  }
}

/**
 * Momento (epoch ms) da última batida do supervisor, ou `null` (N/A em
 * `inline`, ou sem batida). Best-effort: nunca lança. Usado por `/health`.
 */
export async function getSupervisorHeartbeatAtMs(nodeId = null) {
  if (MODE !== 'remote' || !remoteClient?.getSupervisorHeartbeatAtMs) return null
  try {
    return await remoteClient.getSupervisorHeartbeatAtMs(nodeId)
  } catch {
    return null
  }
}

/**
 * Robôs ligados por nó do supervisor: `{ n1: 12, n2: null }` (null = não
 * medido, NUNCA 0). Em `inline` ou com SUPERVISOR_NODE_ROUTING desligado há um
 * nó só ('n1'). Nunca lança.
 */
/** Estado de cada nó para o /metrics: [{nodeId, alive, running, capacity}] ou null (flag off / inline). */
export async function getSupervisorNodesSnapshot() {
  if (MODE !== 'remote' || !remoteClient?.nodeRouting) return null
  try {
    const [counts, caps] = await Promise.all([remoteClient.listRunningBotsByNode(), remoteClient.getNodeCapacities()])
    return await Promise.all(remoteClient.nodeIds.map(async nodeId => ({
      nodeId,
      alive: Boolean(await remoteClient.isSupervisorAlive(nodeId)),
      running: counts?.[nodeId] ?? null,
      capacity: caps?.[nodeId] ?? null,
    })))
  } catch {
    return null
  }
}

export function getDualOwnerTotal() {
  return remoteClient?.getDualOwnerTotal?.() ?? 0
}

export async function getNodeCapacities() {
  try {
    if (remoteClient?.getNodeCapacities) return await remoteClient.getNodeCapacities()
  } catch {}
  return {}
}

export async function listRunningBotsByNode() {
  try {
    if (remoteClient?.listRunningBotsByNode) return await remoteClient.listRunningBotsByNode()
    return { n1: Array.from(await impl.listRunningBots()).length }
  } catch {
    return { n1: null }
  }
}

/**
 * Nó da conta, se ele está vivo e quantos robôs tem — só quando o roteamento
 * por nó está ligado (modo `remote`); senão `null` e quem chama usa o caminho
 * legado. Nunca lança; campos não medidos vêm `null`.
 */
export async function getNodeRoutingInfo(userId) {
  if (MODE !== 'remote' || !remoteClient?.nodeRouting) return null
  try {
    const nodeId = await remoteClient.resolveNodeId(userId)
    const [alive, counts, caps] = await Promise.all([remoteClient.isSupervisorAlive(nodeId), remoteClient.listRunningBotsByNode(), remoteClient.getNodeCapacities()])
    return { nodeId, alive: Boolean(alive), running: counts?.[nodeId] ?? null, max: caps?.[nodeId] ?? null }
  } catch {
    return { nodeId: null, alive: null, running: null, max: null }
  }
}
