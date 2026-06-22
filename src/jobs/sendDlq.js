/**
 * Helpers para inspecionar / drenar a DLQ do pipeline de envio.
 *
 * A DLQ é uma fila BullMQ chamada `<queueName>-dlq` (ver
 * createBullmqSendBackend em src/sendQueueBackend.js). Jobs ficam parados
 * sem worker associado — só são manipulados por estas funções via rota
 * admin ou scripts one-off.
 *
 * Convenção de naming (deve casar com bot-worker.js):
 *   queueName     = BULLMQ_QUEUE_NAME ou `wabot-send-${userId}`
 *   dlqQueueName  = `${queueName}-dlq`
 */

import logger from '../logger.js'

/**
 * @typedef {Object} DlqListItem
 * @property {string|number|null} id
 * @property {Object<string, any>} data
 * @property {number|null} failedAt
 * @property {string|null} error
 * @property {string|number|null} originalJobId
 */

/**
 * @typedef {Object} DlqListResult
 * @property {string} queue
 * @property {number} total
 * @property {DlqListItem[]} jobs
 */

function dlqNameForUser(userId, { queueNameOverride } = {}) {
  const base = queueNameOverride || `wabot-send-${userId}`
  return `${base}-dlq`
}

async function withDlq({ redisUrl, userId, queueNameOverride, bullmqModule = null }, fn) {
  if (!redisUrl) throw new Error('REDIS_URL ausente — DLQ só funciona com backend BullMQ')
  if (!userId) throw new Error('userId obrigatório')
  const { Queue } = bullmqModule ?? (await import('bullmq'))
  const name = dlqNameForUser(userId, { queueNameOverride })
  const queue = new Queue(name, { connection: { url: redisUrl } })
  try {
    return await fn(queue, name)
  } finally {
    await queue.close().catch(() => {})
  }
}

/**
 * Lista jobs presentes na DLQ. Limita por padrão a 100 entradas para
 * proteger a UI/admin.
 */
export async function listDlq({ redisUrl, userId, limit = 100, queueNameOverride, bullmqModule = null } = {}) {
  return withDlq({ redisUrl, userId, queueNameOverride, bullmqModule }, async (queue, name) => {
    const jobs = await queue.getJobs(['waiting', 'delayed', 'completed', 'failed'], 0, limit - 1, false)
    return /** @type {DlqListResult} */ ({
      queue: name,
      total: jobs.length,
      jobs: jobs.map(j => ({
        id: j.id,
        data: j.data,
        failedAt: j.data?.failedAt ?? null,
        error: j.data?.error ?? null,
        originalJobId: j.data?.originalJobId ?? null,
      })),
    })
  })
}

/**
 * Recoloca um job da DLQ de volta na fila principal de envio.
 * Idempotente: se o jobId já existir na principal, BullMQ rejeita o
 * duplicado silenciosamente.
 */
export async function retryDlqJob({ redisUrl, userId, dlqJobId, queueNameOverride, bullmqModule = null } = {}) {
  if (!dlqJobId) throw new Error('dlqJobId obrigatório')
  return withDlq({ redisUrl, userId, queueNameOverride, bullmqModule }, async (dlq) => {
    const job = await dlq.getJob(dlqJobId)
    if (!job) return { ok: false, reason: 'job não encontrado na DLQ' }
    const original = job.data?.originalData
    const originalQueue = job.data?.originalQueue
    if (!original || !originalQueue) {
      return { ok: false, reason: 'job da DLQ sem originalData/originalQueue — não dá para reenfileirar com segurança' }
    }
    const { Queue } = bullmqModule ?? (await import('bullmq'))
    const main = new Queue(originalQueue, { connection: { url: redisUrl } })
    try {
      // P2-3: NÃO reusar `logId` como jobId aqui. A fila principal mantém
      // histórico (removeOnComplete/Fail: 500); se a linha do envio original
      // ainda está lá, um `add` com o MESMO jobId é IGNORADO silenciosamente
      // pelo BullMQ e o retry se perde. Usamos um jobId único por entrada de
      // DLQ (rastreável), garantindo que o reenfileiramento de fato aconteça.
      // O `logId` real continua em `original.logId` (data), então o
      // processSendJob ainda atualiza o MessageLog certo.
      await main.add('send', original, {
        removeOnComplete: 500,
        removeOnFail: 500,
        jobId: `dlq-retry:${original.logId ?? 'na'}:${job.id}`,
      })
    } finally {
      await main.close().catch(() => {})
    }
    await job.remove()
    return { ok: true, requeuedTo: originalQueue, logId: original.logId ?? null }
  })
}

/**
 * Remove permanentemente um job da DLQ.
 */
export async function discardDlqJob({ redisUrl, userId, dlqJobId, queueNameOverride, bullmqModule = null } = {}) {
  if (!dlqJobId) throw new Error('dlqJobId obrigatório')
  return withDlq({ redisUrl, userId, queueNameOverride, bullmqModule }, async (dlq) => {
    const job = await dlq.getJob(dlqJobId)
    if (!job) return { ok: false, reason: 'job não encontrado' }
    await job.remove()
    return { ok: true }
  })
}

/**
 * Drena toda a DLQ — útil em manutenção. Retorna a contagem de jobs
 * removidos. Loga antes de remover para deixar rastro em caso de operação
 * acidental.
 */
export async function purgeDlq({ redisUrl, userId, queueNameOverride, bullmqModule = null } = {}) {
  return withDlq({ redisUrl, userId, queueNameOverride, bullmqModule }, async (dlq, name) => {
    const jobs = await dlq.getJobs(['waiting', 'delayed', 'completed', 'failed'], 0, -1, false)
    logger.warn({ queue: name, count: jobs.length }, 'Purgando DLQ — ação manual')
    for (const j of jobs) await j.remove().catch(() => {})
    return { ok: true, removed: jobs.length }
  })
}

// Retenção default da DLQ (P2-1). A DLQ não tem worker, então os jobs ficam em
// `waiting` pra sempre — `removeOnComplete/Fail` não os toca (nunca completam).
// O único mecanismo de limpeza é a poda por idade. Default 30 dias, override
// por env. Pensado para rodar no cron de manutenção (ex.: snapshot-cron).
export const DLQ_RETENTION_MS = Math.max(0, Number(process.env.SEND_DLQ_RETENTION_MS ?? 30 * 24 * 60 * 60 * 1000))

/**
 * Remove jobs da DLQ mais velhos que `olderThanMs` (default DLQ_RETENTION_MS),
 * usando o `failedAt` gravado no payload. Idempotente. Retorna quantos removeu.
 * Mantém a DLQ útil para inspeção sem deixá-la crescer indefinidamente.
 */
export async function pruneDlqOlderThan({ redisUrl, userId, olderThanMs = DLQ_RETENTION_MS, now = Date.now(), queueNameOverride, bullmqModule = null } = {}) {
  if (!Number.isFinite(olderThanMs) || olderThanMs <= 0) return { ok: true, removed: 0, remaining: 0, skipped: 'retention_disabled' }
  return withDlq({ redisUrl, userId, queueNameOverride, bullmqModule }, async (dlq, name) => {
    const jobs = await dlq.getJobs(['waiting', 'delayed', 'completed', 'failed'], 0, -1, false)
    const cutoff = now - olderThanMs
    let removed = 0
    for (const j of jobs) {
      const failedAt = Number(j.data?.failedAt ?? 0)
      // Sem failedAt confiável, usa o timestamp do próprio job como fallback.
      const ref = Number.isFinite(failedAt) && failedAt > 0 ? failedAt : Number(j.timestamp ?? 0)
      if (ref > 0 && ref < cutoff) {
        await j.remove().catch(() => {})
        removed++
      }
    }
    if (removed > 0) logger.info({ queue: name, removed, olderThanMs }, 'DLQ podada por retenção')
    // `remaining` é grátis (já temos a lista completa) e alimenta o gauge de
    // /metrics sem um round-trip extra de COUNT.
    return { ok: true, removed, remaining: Math.max(0, jobs.length - removed) }
  })
}
