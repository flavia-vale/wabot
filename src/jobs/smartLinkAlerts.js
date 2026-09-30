// Varredura dos avisos do Link Inteligente: "todos os grupos passaram de 90%" e
// "lotou". Só lê o banco (as medições já vêm dos jobs de amostra) e envia por
// e-mail e/ou WhatsApp (mensagem do robô para o PRÓPRIO número da cliente),
// conforme os interruptores do link. A regra de quando avisar mora em
// core/smartLinkAlertPolicy.js.

import defaultDb from '../db.js'
import { sendMail as defaultSendMail } from '../email/mailer.js'
import { sendTemplateEmail } from '../email/dispatcher.js'
import { resolveDashboardUrl } from '../email/layout.js'
import { isRunning as defaultIsRunning, sendSelfMessage as defaultSendSelfMessage } from '../manager.js'
import { canUseSmartLinks } from '../billing/plans.js'
import { loadSmartLinkStats } from '../core/smartLinkStats.js'
import { decideAlert, stateAfterRearm, stateAfterSend } from '../core/smartLinkAlertPolicy.js'
import { buildAlertContent } from '../core/smartLinkAlertMessage.js'

const toColumns = (state) => ({
  alertKind: state.kind,
  alertLastSentAt: state.lastSentAt,
  alertReminders: state.reminders,
  alertActiveGroups: state.activeGroups,
})

/**
 * @returns {Promise<{ links: number, sent: number, rearmed: number, failed: number, skipped: number }>}
 */
export async function runSmartLinkAlertSweep({
  db = defaultDb,
  sendMail = defaultSendMail,
  sendSelfMessage = defaultSendSelfMessage,
  isRunning = defaultIsRunning,
  now = new Date(),
  logger,
  panelUrl = `${resolveDashboardUrl()}/painel/link-inteligente`,
} = {}) {
  const stats = { links: 0, sent: 0, rearmed: 0, failed: 0, skipped: 0 }
  const links = await loadSmartLinkStats({ db, where: { enabled: true, deletedAt: null }, now })
  stats.links = links.length
  if (links.length === 0) return stats

  const userIds = [...new Set(links.map(l => l.userId))]
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, status: true, plan: true, accessExpiresAt: true },
  })
  const userById = new Map(users.map(u => [u.id, u]))

  for (const link of links) {
    try {
      const user = userById.get(link.userId)
      // Plano vencido, conta bloqueada ou link sem dono: não incomoda.
      if (!user || user.status !== 'active' || !canUseSmartLinks(user)) { stats.skipped++; continue }

      const decision = decideAlert({ occupancy: link.occupancy, state: link.alert, now })
      if (!decision.send) {
        if (decision.rearm) {
          await db.smartLink.update({ where: { id: link.id }, data: toColumns(stateAfterRearm()) })
          stats.rearmed++
        }
        continue
      }

      // Cliente desligou os dois canais: respeita, e não grava estado (se ligar
      // de novo com o link ainda cheio, o aviso sai).
      if (!link.notifyEmail && !link.notifyWhatsapp) { stats.skipped++; continue }

      const content = buildAlertContent({ kind: decision.kind, reminder: decision.reminder, link, occupancy: link.occupancy, panelUrl })

      // Grava o estado ANTES de enviar. Se a gravação falhar, nada é enviado:
      // enviar e só depois falhar ao gravar reenviaria o mesmo aviso a cada
      // passada (spam). Se nenhum canal entregar, o estado anterior é restaurado.
      await db.smartLink.update({
        where: { id: link.id },
        data: toColumns(stateAfterSend({ decision, state: link.alert, occupancy: link.occupancy, now })),
      })

      let emailSent = false
      let whatsappSent = false

      if (link.notifyEmail) {
        const result = await sendTemplateEmail({
          db, sendMail, slug: content.emailSlug, user, vars: content.emailVars,
          mode: 'auto', ignoreDedup: true, now, logger,
        })
        emailSent = Boolean(result?.sent)
      }

      if (link.notifyWhatsapp) {
        try {
          if (await isRunning(link.userId)) {
            await sendSelfMessage(link.userId, content.whatsappText, null, { kind: content.whatsappKind })
            whatsappSent = true
          }
        } catch (err) {
          logger?.warn?.({ linkId: link.id, err: err?.message }, 'aviso do link por WhatsApp falhou')
        }
      }

      // Nenhum canal entregou: não queima o aviso — volta o estado e tenta de novo na próxima passada.
      if (!emailSent && !whatsappSent) {
        await db.smartLink.update({ where: { id: link.id }, data: toColumns(link.alert) }).catch(() => {})
        stats.failed++
        continue
      }
      stats.sent++
    } catch (err) {
      stats.failed++
      logger?.warn?.({ linkId: link.id, err: err?.message }, 'aviso do link: falha ao processar')
    }
  }
  return stats
}
