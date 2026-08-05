// Passada diária da trilha de nutrição de leads (011-lead-nurture-emails).
//
// Efeitos isolados aqui (db + sendMail injetáveis) para manter a lógica de
// elegibilidade em policy.js pura e testável db-free. Nunca lança para o
// chamador — o setInterval do boot não pode morrer por causa desta feature
// (FR-009: isolamento por item via try/catch + continue).

import { randomUUID } from 'crypto'
import { isRealEmail, isWithinActiveWindow, elapsedDays, computeDueSteps } from './policy.js'
import { buildNurtureEmail } from '../email/nurtureEmails.js'
import { signUnsubscribeToken } from './unsubscribeToken.js'

const NURTURE_EMAIL_SENT_EVENT = 'nurture_email_sent'
const NURTURE_UNSUBSCRIBED_EVENT = 'nurture_unsubscribed'

/**
 * Conjunto de passos já enviados (via evento durável) para um lead.
 * @param {{db: object, userId: string}} params
 * @returns {Promise<Set<number>>}
 */
export async function sentSteps({ db, userId }) {
  const events = await db.analyticsEvent.findMany({
    where: { userId, event: NURTURE_EMAIL_SENT_EVENT },
  })
  const steps = new Set()
  for (const e of events) {
    try {
      const metadata = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : (e.metadata || {})
      if (typeof metadata.step === 'number') steps.add(metadata.step)
    } catch {
      // metadata malformada — ignora esse registro isolado, não aborta a leitura
    }
  }
  return steps
}

/**
 * Um lead descadastrado prevalece para sempre (LGPD — US2 cenário 3).
 * @param {{db: object, userId: string}} params
 * @returns {Promise<boolean>}
 */
export async function isUnsubscribed({ db, userId }) {
  const count = await db.analyticsEvent.count({
    where: { userId, event: NURTURE_UNSUBSCRIBED_EVENT },
  })
  return count > 0
}

function resolveBaseUrl(baseUrl) {
  const raw = (baseUrl || process.env.DASHBOARD_URL || process.env.API_URL || 'https://espelhagrupos.com.br').trim()
  return raw.replace(/\/+$/, '')
}

function buildUnsubscribeUrl({ userId, secret, baseUrl }) {
  const token = signUnsubscribeToken(userId, secret)
  return `${resolveBaseUrl(baseUrl)}/api/lead-nurture/unsubscribe?token=${encodeURIComponent(token)}`
}

/**
 * Executa uma passada da trilha: para cada lead elegível na janela ativa,
 * envia os passos devidos (2/5/7) que ainda não foram enviados, respeitando
 * opt-out. Isolamento por item: erro num lead não impede os demais.
 * Sem SMTP configurado, sendMail devolve {skipped:true} e o passo NÃO é
 * gravado como enviado (não queima o passo — FR-007/SC-006).
 *
 * @param {{db: object, sendMail: function, now?: Date, logger?: object, secret: string, baseUrl?: string}} params
 * @returns {Promise<{scanned: number, sent: number, skipped: number, failed: number, failures: Array}>}
 */
export async function runNurtureSweep({ db, sendMail, now = new Date(), logger = console, secret, baseUrl } = {}) {
  const summary = { scanned: 0, sent: 0, skipped: 0, failed: 0, failures: [] }

  let leads = []
  try {
    const windowStart = new Date(new Date(now).getTime() - 8 * 24 * 60 * 60 * 1000)
    leads = await db.user.findMany({
      where: { createdAt: { gte: windowStart, lte: now } },
    })
  } catch (err) {
    logger?.error?.({ err: err?.message }, 'lead-nurture: falha ao buscar leads da janela ativa')
    return summary
  }

  for (const lead of leads) {
    summary.scanned += 1
    try {
      if (!isRealEmail(lead.email)) continue
      if (!isWithinActiveWindow(lead.createdAt, now)) continue

      const [sent, unsub] = await Promise.all([
        sentSteps({ db, userId: lead.id }),
        isUnsubscribed({ db, userId: lead.id }),
      ])

      const due = computeDueSteps({ createdAt: lead.createdAt, now, sentSteps: sent, isUnsubscribed: unsub })
      for (const step of due) {
        const unsubscribeUrl = buildUnsubscribeUrl({ userId: lead.id, secret, baseUrl })
        const { subject, text, html } = buildNurtureEmail(step, { name: lead.name, unsubscribeUrl })
        const res = await sendMail({ to: lead.email, subject, text, html })
        if (res?.skipped) {
          summary.skipped += 1
          continue
        }
        await db.analyticsEvent.create({
          data: {
            id: randomUUID(),
            userId: lead.id,
            event: NURTURE_EMAIL_SENT_EVENT,
            metadata: JSON.stringify({ step }),
            createdAt: new Date(),
          },
        })
        summary.sent += 1
      }
    } catch (err) {
      summary.failed += 1
      summary.failures.push({ userId: lead?.id, step: null, error: String(err?.message ?? err) })
      logger?.error?.({ err: err?.message, userId: lead?.id }, 'lead-nurture: falha isolada num lead')
    }
  }

  return summary
}
