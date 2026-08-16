// Resumo semanal: "o que seu robô fez esta semana".
//
// Roda junto com as outras passadas in-process (setInterval + unref), mas só
// AGE no dia da semana escolhido (`WEEKLY_SUMMARY_WEEKDAY`, default segunda).
// Assim não precisa de cron dedicado nem de processo PM2 novo.
//
// É e-mail de divulgação (`marketing`): respeita descadastro e leva o link de
// descadastro no rodapé. Quem não teve nenhum envio na semana NÃO recebe —
// resumo de "0 ofertas" não é carinho, é lembrete de que não está funcionando.

import { sendTemplateEmail, isDeliverableUser } from '../email/dispatcher.js'
import { resolveDashboardUrl } from '../email/layout.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000
export const WEEKLY_SUMMARY_SLUG = 'resumo_semanal'

/** 0 = domingo … 6 = sábado. Default 1 (segunda). */
export function resolveWeekday(env = process.env) {
  const raw = Number(env.WEEKLY_SUMMARY_WEEKDAY)
  return Number.isInteger(raw) && raw >= 0 && raw <= 6 ? raw : 1
}

/**
 * Hoje é dia de mandar? Puro — recebe o `now`.
 */
export function isSummaryDay(now = new Date(), env = process.env) {
  return new Date(now).getDay() === resolveWeekday(env)
}

/**
 * Monta os números da semana de um cliente. Puro sobre as linhas já lidas.
 * @returns {{ ofertas: number, grupos: number, cliques: number }}
 */
export function summarizeWeek({ logs = [], cliques = 0 } = {}) {
  const grupos = new Set()
  let ofertas = 0
  for (const log of logs) {
    if (log?.status !== 'success') continue
    ofertas += 1
    if (log.destGroup) grupos.add(log.destGroup)
  }
  return { ofertas, grupos: grupos.size, cliques: Number(cliques) || 0 }
}

/**
 * Passada do resumo semanal. Nunca lança para o chamador.
 * @returns {Promise<{scanned:number, sent:number, skipped:number, failed:number}>}
 */
export async function runWeeklySummarySweep({ db, sendMail, now = new Date(), logger = console, secret = process.env.JWT_SECRET, force = false } = {}) {
  const summary = { scanned: 0, sent: 0, skipped: 0, failed: 0 }
  if (!force && !isSummaryDay(now)) return summary

  const since = new Date(new Date(now).getTime() - 7 * MS_PER_DAY)
  const dashboardUrl = resolveDashboardUrl()

  let users = []
  try {
    users = await db.user.findMany({
      where: {
        status: { notIn: ['banned', 'suspended'] },
        accessExpiresAt: { gt: new Date(now) },
      },
      select: { id: true, name: true, email: true, status: true },
    })
  } catch (err) {
    logger?.error?.({ err: err?.message }, 'resumo semanal: falha ao carregar clientes')
    return summary
  }

  for (const user of users) {
    summary.scanned += 1
    try {
      if (!isDeliverableUser(user)) {
        summary.skipped += 1
        continue
      }

      const logs = await db.messageLog.findMany({
        where: { userId: user.id, status: 'success', sentAt: { gte: since } },
        select: { status: true, destGroup: true },
      }).catch(() => [])

      const cliques = await db.affiliateClick.count({
        where: { clickedAt: { gte: since }, link: { userId: user.id } },
      }).catch(() => 0)

      const numeros = summarizeWeek({ logs, cliques })
      // Semana sem nenhum envio não vira e-mail: seria só lembrar que não
      // funcionou. Esse caso já é coberto pelo aviso de "robô parado".
      if (numeros.ofertas === 0) {
        summary.skipped += 1
        continue
      }

      const result = await sendTemplateEmail({
        db,
        sendMail,
        slug: WEEKLY_SUMMARY_SLUG,
        user,
        vars: {
          ofertas_enviadas: String(numeros.ofertas),
          grupos_atendidos: String(numeros.grupos),
          cliques: String(numeros.cliques),
          link_historico: `${dashboardUrl}/painel/logs`,
        },
        mode: 'auto',
        now,
        secret,
        logger,
      })
      if (result.sent) summary.sent += 1
      else summary.skipped += 1
    } catch (err) {
      summary.failed += 1
      logger?.error?.({ err: err?.message, userId: user?.id }, 'resumo semanal: falha isolada num cliente')
    }
  }

  return summary
}
