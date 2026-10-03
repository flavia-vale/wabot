// Aviso por e-mail quando a conta Rakuten passa a ser recusada (revisão
// 2026-10-03, R9). Antes, a conta virava "recusada" em silêncio: a cliente só
// descobria abrindo "Minhas credenciais".
//
// Mesmo trilho do aviso de credencial vencida (src/credentialExpiry): texto no
// catálogo de e-mails (slug `rakuten_dados_recusados`, editável pela admin),
// envio pelo motor de e-mails, janela de silêncio de 7 dias gravada em
// AnalyticsEvent (`credential_expiry_alert_sent`, platform `rakuten`). Sem SMTP
// ou com trava do motor, nada é gravado — a janela não queima sem aviso.
//
// Nunca lança: aviso que falha não pode derrubar a sync.

import { randomUUID } from 'node:crypto'
import { sendTemplateEmail } from '../../email/dispatcher.js'
import { resolveDashboardUrl } from '../../email/layout.js'
import { ALERT_EVENT, isAlertableUser, resolveAlertCooldownMs } from '../../credentialExpiry/policy.js'
import { lastAlertByPlatform } from '../../credentialExpiry/sweep.js'

export const RAKUTEN_REFUSED_TEMPLATE_SLUG = 'rakuten_dados_recusados'

export async function notifyRakutenRefused({ db, userId, sendMail, now = new Date(), logger = console, cooldownMs = resolveAlertCooldownMs(), sendTemplate = sendTemplateEmail }) {
  try {
    if (typeof sendMail !== 'function') return { sent: false, reason: 'no_mailer' }
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!isAlertableUser(user)) return { sent: false, reason: 'not_alertable' }
    const since = new Date(now.getTime() - cooldownMs)
    const last = await lastAlertByPlatform({ db, userId, since })
    if (last?.rakuten) return { sent: false, reason: 'cooldown' }
    const res = await sendTemplate({
      db,
      sendMail,
      slug: RAKUTEN_REFUSED_TEMPLATE_SLUG,
      user,
      vars: { link_credenciais: `${resolveDashboardUrl()}/painel/ids-afiliada` },
      mode: 'auto',
      now,
      logger,
    })
    // Motivo do motor (ex.: account_idle — conta sem uso não recebe aviso).
    if (!res?.sent) return { sent: false, reason: res?.reason ?? 'not_sent' }
    await db.analyticsEvent.create({
      data: { id: randomUUID(), userId, event: ALERT_EVENT, metadata: JSON.stringify({ platform: 'rakuten', together: 1 }), createdAt: new Date(now) },
    })
    return { sent: true }
  } catch (error) {
    logger?.warn?.({ err: error?.message, userId }, 'rakuten: aviso de conta recusada falhou')
    return { sent: false, reason: 'error' }
  }
}
