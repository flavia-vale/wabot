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
export async function isSupervisorAlive() {
  if (MODE !== 'remote' || !remoteClient?.isSupervisorAlive) return null
  try {
    return await remoteClient.isSupervisorAlive()
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
export async function getSupervisorBootedAtMs() {
  if (MODE !== 'remote' || !remoteClient?.getSupervisorBootedAtMs) return null
  try {
    return await remoteClient.getSupervisorBootedAtMs()
  } catch {
    return null
  }
}
