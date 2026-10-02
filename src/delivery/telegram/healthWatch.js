// Feature 017, Fatia 6 (T081/T083) — vigia o estado do robô único do
// Telegram dentro da API. Na mudança para um estado ruim: sinal operacional
// durável e e-mail interno (com cooldown por estado). Nenhuma conta do
// WhatsApp é tocada.

import defaultDb from '../../db.js'
import logger from '../../logger.js'
import { DELIVERY_NETWORK, deliveryNetworkDisplayName } from '../../core/delivery/networks.js'
import { NETWORK_HEALTH_LABEL, computeNetworkHealth, decideHealthAlert } from '../../core/delivery/networkHealth.js'
import { recordOperationalSignal } from '../../observability/operationalSignals.js'
import { sendAdminAlert as defaultSendAdminAlert } from '../../email/adminAlerts.js'

const formatWhen = (date) => (date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(date) : 'agora')

export function createHealthWatch({ health, db = defaultDb, deliveryNetwork = DELIVERY_NETWORK.TELEGRAM, sendAdminAlert = defaultSendAdminAlert, now = () => Date.now() } = {}) {
  let previous = null
  async function check() {
    const current = computeNetworkHealth(health.signals(deliveryNetwork), { now: now() })
    const alert = decideHealthAlert(previous, current)
    previous = current
    if (!alert) return { current, alert: null }
    recordOperationalSignal(alert.sinal, { deliveryNetwork, estado: alert.estado })
    await sendAdminAlert({
      db,
      slug: 'admin_robo_aplicativo_parado',
      key: `${deliveryNetwork}:${alert.estado}`,
      vars: {
        aplicativo: deliveryNetworkDisplayName(deliveryNetwork),
        estado: NETWORK_HEALTH_LABEL[alert.estado],
        motivo: current.motivo,
        desde: formatWhen(current.desde),
      },
      logger,
    })
    return { current, alert }
  }
  return { check, current: () => previous }
}

export function startHealthWatch(options = {}, intervalMs = 60_000) {
  const watch = createHealthWatch(options)
  const timer = setInterval(() => { watch.check().catch((err) => logger.warn({ err: err?.message }, 'telegram: vigia de estado falhou')) }, intervalMs)
  timer.unref?.()
  return { ...watch, stop: () => clearInterval(timer) }
}
