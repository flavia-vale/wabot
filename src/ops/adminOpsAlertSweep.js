// Coleta + envio dos avisos de `adminOpsAlertPolicy.js`. Roda no setInterval de
// 15 min que já existe (server.js). Três leituras pequenas e limitadas; nunca
// lança — o timer do boot não pode morrer por causa de aviso.

import { sendAdminAlert } from '../email/adminAlerts.js'
import { currentPayingWhere } from '../domain/admin/payingLoader.js'
import { loadTestAccountUserIds, excludeUserIdsWhere } from '../domain/admin/testAccounts.js'
import { RECEPTION_BLIND_WINDOW_MS } from '../domain/session/sessionLiveness.js'
import {
  OPS_ALERT_SLUG,
  STUCK_SENDING_MS,
  buildOpsAlerts,
  findPayingBlind,
  findPayingDown,
  isOpsAlertEnabled,
  resolveOpsAlertCooldownHours,
} from './adminOpsAlertPolicy.js'

const PAYING_LIMIT = 500

export async function runAdminOpsAlertSweep({ db, sendAlert = sendAdminAlert, env = process.env, now = new Date(), logger = console } = {}) {
  if (!isOpsAlertEnabled(env)) return { sent: 0, reason: 'desligado' }
  try {
    const nowMs = now.getTime()
    const testAccounts = await loadTestAccountUserIds(db)
    const paying = await db.user.findMany({
      where: { ...currentPayingWhere(now), ...excludeUserIdsWhere(testAccounts.ids, 'id') },
      select: {
        id: true, name: true, email: true,
        waSession: { select: { status: true, lifecycle: true, lastDisconnectCode: true, lastHeartbeatAt: true, updatedAt: true } },
      },
      take: PAYING_LIMIT,
    })
    const payingById = new Map(paying.map(user => [user.id, { name: user.name, email: user.email }]))

    const [blindRows, stuckSending] = await Promise.all([
      db.analyticsEvent.findMany({
        where: { event: 'ops_wa_reception_blind', createdAt: { gte: new Date(nowMs - RECEPTION_BLIND_WINDOW_MS), lte: now } },
        select: { userId: true, metadata: true },
      }).catch(() => []),
      db.messageLog.count({ where: { status: 'sending', sentAt: { lt: new Date(nowMs - STUCK_SENDING_MS) } } }).catch(() => 0),
    ])

    const alerts = buildOpsAlerts({
      payingDown: findPayingDown(paying.filter(user => user.waSession && user.waSession.status !== 'connected'), nowMs),
      payingBlind: findPayingBlind(blindRows, payingById),
      stuckSending,
    })

    let sent = 0
    for (const alert of alerts) {
      const result = await sendAlert({
        db, slug: OPS_ALERT_SLUG, key: alert.key, vars: alert.vars,
        cooldownHours: resolveOpsAlertCooldownHours(env), now, env, logger,
      })
      if (result?.sent) sent += 1
    }
    return { sent, alerts: alerts.map(a => ({ key: a.key, count: a.count })), reason: alerts.length ? 'avaliado' : 'sem_alerta' }
  } catch (err) {
    logger?.warn?.({ err: err?.message }, 'avisos operacionais da dona: passada falhou')
    return { sent: 0, reason: 'erro' }
  }
}
