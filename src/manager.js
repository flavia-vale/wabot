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

const MODE = (process.env.BOT_SUPERVISOR_MODE || 'inline').toLowerCase()

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
} else if (MODE !== 'inline') {
  logger.warn({ MODE }, 'BOT_SUPERVISOR_MODE desconhecido, usando inline')
}

export const startBot = (...args) => impl.startBot(...args)
export const stopBot = (...args) => impl.stopBot(...args)
export const isRunning = (...args) => impl.isRunning(...args)
export const listRunningBots = (...args) => impl.listRunningBots(...args)
export const onQR = (...args) => impl.onQR(...args)
export const onStatus = (...args) => impl.onStatus(...args)
export const getLastQR = (...args) => impl.getLastQR(...args)
export const listGroups = (...args) => impl.listGroups(...args)
export const sendBroadcast = (...args) => impl.sendBroadcast(...args)
export const requestPairingCode = (...args) => impl.requestPairingCode(...args)
export const getBotMetrics = (...args) => impl.getBotMetrics(...args)
export const reloadConfig = (...args) => impl.reloadConfig(...args)
export const refreshWaGroups = (...args) => impl.refreshWaGroups(...args)
export const channelMetadata = (...args) => impl.channelMetadata(...args)
export const followChannelImmediate = (...args) => impl.followChannelImmediate(...args)
export const listFollowedChannels = (...args) => impl.listFollowedChannels(...args)
export const stopAllBots = (...args) => impl.stopAllBots(...args)
export const startSessionHealthMonitor = (...args) => impl.startSessionHealthMonitor(...args)
export const resumePersistedBots = (...args) => impl.resumePersistedBots(...args)

export const SUPERVISOR_MODE = MODE
