// Fila lenta dos disparos manuais em massa.
//
// Por que fila e não mandar tudo de uma vez: domínio novo que dispara 500
// e-mails num minuto vira spam na caixa de todo mundo, e o provedor (Brevo)
// tem teto diário. A fila sai devagar, com teto por rodada e teto por dia.
//
// Onde roda: `setInterval` + `unref()` na própria API (mesmo padrão de
// startLeadNurtureSweep) — SEM processo PM2 novo, SEM worker, SEM Redis. O
// estado mora no banco (EmailSendLog.status='queued'), então reinício da API
// não perde a campanha: a próxima rodada continua de onde parou.

import { sendTemplateEmail, isDeliverableUser } from './dispatcher.js'
import { getTemplateDefinition } from './registry.js'

export function resolveBatchSize(env = process.env) {
  const raw = Number(env.EMAIL_QUEUE_BATCH_SIZE)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 10
}

/**
 * Cria um disparo em massa: uma linha de campanha + uma linha de histórico
 * (status 'queued') por destinatário. Quem não pode receber já entra como
 * 'skipped' com o motivo — a campanha nasce com a prestação de contas pronta.
 *
 * @param {{ db: object, slug: string, recipients: Array<{id: string, email: string, status?: string}>,
 *           filters?: object, createdByUserId?: string|null, now?: Date }} params
 * @returns {Promise<{ batchId: string, queued: number, skipped: number, total: number }>}
 */
export async function enqueueEmailBatch({ db, slug, recipients = [], filters = {}, createdByUserId = null, now = new Date() }) {
  const definition = getTemplateDefinition(slug)
  if (!definition) throw new Error(`E-mail desconhecido: ${slug}`)

  const batch = await db.emailBatch.create({
    data: {
      slug,
      createdByUserId,
      filters: JSON.stringify(filters ?? {}),
      total: recipients.length,
      status: 'running',
      createdAt: new Date(now),
    },
  })

  let queued = 0
  let skipped = 0
  const seen = new Set()
  for (const recipient of recipients) {
    const key = String(recipient?.id ?? recipient?.email ?? '')
    if (!key || seen.has(key)) continue
    seen.add(key)

    const deliverable = isDeliverableUser(recipient)
    await db.emailSendLog.create({
      data: {
        slug,
        userId: recipient.id ?? null,
        email: recipient.email ?? '',
        category: definition.category,
        mode: 'manual',
        batchId: batch.id,
        status: deliverable ? 'queued' : 'skipped',
        skipReason: deliverable ? null : 'undeliverable_user',
        scheduledAt: new Date(now),
      },
    })
    if (deliverable) queued += 1
    else skipped += 1
  }

  if (queued === 0) {
    await db.emailBatch.update({ where: { id: batch.id }, data: { status: 'done', finishedAt: new Date(now) } })
  }

  return { batchId: batch.id, queued, skipped, total: recipients.length }
}

/**
 * Uma rodada da fila: manda até `limit` e-mails e para. Nunca lança.
 * @returns {Promise<{ picked: number, sent: number, skipped: number, failed: number }>}
 */
export async function runEmailQueueTick({
  db,
  sendMail,
  limit = resolveBatchSize(),
  now = new Date(),
  logger = console,
  secret = process.env.JWT_SECRET,
} = {}) {
  const summary = { picked: 0, sent: 0, skipped: 0, failed: 0 }

  let rows = []
  try {
    rows = await db.emailSendLog.findMany({
      where: { status: 'queued', scheduledAt: { lte: new Date(now) } },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    })
  } catch (err) {
    logger?.error?.({ err: err?.message }, 'fila de e-mail: falha ao ler a fila')
    return summary
  }

  for (const row of rows) {
    summary.picked += 1
    try {
      const user = row.userId
        ? await db.user.findUnique({ where: { id: row.userId } })
        : { id: null, email: row.email, name: '', status: 'active' }
      if (!user) {
        await db.emailSendLog.update({ where: { id: row.id }, data: { status: 'skipped', skipReason: 'user_removed' } })
        summary.skipped += 1
        continue
      }

      const result = await sendTemplateEmail({
        db,
        sendMail,
        slug: row.slug,
        user,
        mode: row.mode || 'manual',
        batchId: row.batchId,
        logRowId: row.id,
        now,
        secret,
        logger,
      })

      if (result.sent) summary.sent += 1
      else if (result.retryLater) {
        // Teto diário ou SMTP desligado: a linha fica em 'queued' e a rodada
        // para aqui — insistir nas próximas linhas daria o mesmo resultado.
        logger?.info?.(
          { reason: result.reason, voltaEm: result.retryAtLabel ?? null },
          'fila de e-mail: rodada interrompida, continua depois',
        )
        break
      } else summary.skipped += 1
    } catch (err) {
      summary.failed += 1
      logger?.error?.({ err: err?.message, id: row.id }, 'fila de e-mail: falha isolada num item')
      await db.emailSendLog.update({
        where: { id: row.id },
        data: { status: 'error', error: String(err?.message ?? err).slice(0, 500) },
      }).catch(() => {})
    }
  }

  await closeFinishedBatches({ db, now }).catch(() => {})
  return summary
}

/** Marca como concluída toda campanha que não tem mais item na fila. */
export async function closeFinishedBatches({ db, now = new Date() }) {
  const running = await db.emailBatch.findMany({ where: { status: 'running' } })
  let closed = 0
  for (const batch of running) {
    const pending = await db.emailSendLog.count({ where: { batchId: batch.id, status: 'queued' } })
    if (pending > 0) continue
    await db.emailBatch.update({ where: { id: batch.id }, data: { status: 'done', finishedAt: new Date(now) } })
    closed += 1
  }
  return { closed }
}

/** Cancela uma campanha: o que ainda não saiu não sai. */
export async function cancelEmailBatch({ db, batchId, now = new Date() }) {
  const { count } = await db.emailSendLog.updateMany({
    where: { batchId, status: 'queued' },
    data: { status: 'skipped', skipReason: 'batch_canceled' },
  })
  await db.emailBatch.update({
    where: { id: batchId },
    data: { status: 'canceled', finishedAt: new Date(now) },
  }).catch(() => {})
  return { canceled: count }
}
