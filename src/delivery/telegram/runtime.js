// Feature 017, Fatia 3 (T050) — liga o Telegram dentro do processo `api`:
// registra o adaptador, inicia o leitor único de atualizações (ligação de
// grupos) e a drenagem da caixa de saída. NÃO liga nada (sem erro, sem
// passada rodando) se o aplicativo não estiver habilitado em
// DELIVERY_NETWORKS_ENABLED ou se o segredo do robô estiver ausente —
// mesmo padrão do motor de e-mails sem SMTP.

import defaultDb from '../../db.js'
import logger from '../../logger.js'
import { DELIVERY_NETWORK, isDeliveryNetworkEnabled, registerDeliveryNetwork } from '../../core/delivery/networks.js'
import { createHealthRecorder } from '../../core/delivery/networkHealth.js'
import { getPlanAccess } from '../../billing/plans.js'
import { trackAnalyticsEventSafe } from '../../analytics.js'
import { startDeliveryOutboxJanitor, startDeliveryOutboxSweep } from '../../deliveryOutbox/sweep.js'
import { createTelegramApi, readTelegramSecret } from './api.js'
import { createTelegramAdapter } from './adapter.js'
import { handleLinkUpdate } from './link.js'
import { startTelegramUpdatesLoop } from './updatesLoop.js'
import { startHealthWatch } from './healthWatch.js'

let runtime = null

export function getTelegramRuntime() {
  return runtime
}

export async function canUseMultiNetworkFor(db, userId) {
  const { entitlements } = await getPlanAccess(userId, { db })
  return Boolean(entitlements?.canUseMultiNetwork)
}

export function startTelegramDelivery({ db = defaultDb, env = process.env, fetchImpl, extraUpdateHandlers = [] } = {}) {
  if (runtime) return runtime
  const secret = readTelegramSecret(env)
  if (!isDeliveryNetworkEnabled(DELIVERY_NETWORK.TELEGRAM, env) || !secret) {
    if (isDeliveryNetworkEnabled(DELIVERY_NETWORK.TELEGRAM, env)) logger.info('telegram: habilitado mas sem o segredo do robô; não iniciado')
    // Desligado: só a faxina roda (descarta com motivo o que sobrar na caixa
    // de saída). Sem nenhuma chamada ao Telegram.
    startDeliveryOutboxJanitor({ deliveryNetwork: DELIVERY_NETWORK.TELEGRAM, db })
    return null
  }

  const api = createTelegramApi({ secret, ...(fetchImpl ? { fetchImpl } : {}) })
  const adapter = createTelegramAdapter({ api, db })
  registerDeliveryNetwork(adapter)
  const health = createHealthRecorder()
  const canUseMultiNetwork = (userId) => canUseMultiNetworkFor(db, userId)

  const linkHandler = (update) => handleLinkUpdate(update, { db, adapter, canUseMultiNetwork, botUsername: adapter.botUsername })
  const updates = startTelegramUpdatesLoop({ api, handlers: [linkHandler, ...extraUpdateHandlers] })
  const sweep = startDeliveryOutboxSweep({
    deliveryNetwork: DELIVERY_NETWORK.TELEGRAM,
    db,
    env,
    canUseMultiNetwork,
    health,
    track: trackAnalyticsEventSafe,
  })

  const healthWatch = startHealthWatch({ health, db })

  runtime = {
    adapter,
    health,
    healthWatch,
    stop() {
      updates.stop()
      sweep?.stop()
      healthWatch.stop()
      runtime = null
    },
  }
  logger.info('telegram: robô ligado (leitor único + caixa de saída)')
  return runtime
}
