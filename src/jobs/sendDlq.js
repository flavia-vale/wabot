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

function dlqNameForUser(userId, { queueNameOverride } = {}) {
  const base = queueNameOverride || `wabot-send-${userId}`
  return `${base}-dlq`
}

async function withDlq({ redisUrl, userId, queueNameOverride }, fn) {
  if (!redisUrl) throw new Error('REDIS_URL ausente — DLQ só funciona com backend BullMQ')
  if (!userId) throw new Error('userId obrigatório')
  const { Queue } = await import('bullmq')
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
export async function listDlq({ redisUrl, userId, limit = 100, queueNameOverride } = {}) {
  return withDlq({ redisUrl, userId, queueNameOverride }, async (queue, name) => {
    const jobs = await queue.getJobs(['waiting', 'delayed', 'completed', 'failed'], 0, limit - 1, false)
    return {
      queue: name,
      total: jobs.length,
      jobs: jobs.map(j => ({
        id: j.id,
        data: j.data,
        failedAt: j.data?.failedAt ?? null,
        error: j.data?.error ?? null,
        originalJobId: j.data?.originalJobId ?? null,
      })),
    }
  })
}

/**
 * Recoloca um job da DLQ de volta na fila principal de envio.
 * Idempotente: se o jobId já existir na principal, BullMQ rejeita o
 * duplicado silenciosamente.
 */
export async function retryDlqJob({ redisUrl, userId, dlqJobId, queueNameOverride } = {}) {
  if (!dlqJobId) throw new Error('dlqJobId obrigatório')
  return withDlq({ redisUrl, userId, queueNameOverride }, async (dlq) => {
    const job = await dlq.getJob(dlqJobId)
    if (!job) return { ok: false, reason: 'job não encontrado na DLQ' }
    const original = job.data?.originalData
    const originalQueue = job.data?.originalQueue
    if (!original || !originalQueue) {
      return { ok: false, reason: 'job da DLQ sem originalData/originalQueue — não dá para reenfileirar com segurança' }
    }
    const { Queue } = await import('bullmq')
    const main = new Queue(originalQueue, { connection: { url: redisUrl } })
    try {
      await main.add('send', original, {
        removeOnComplete: 500,
        removeOnFail: 500,
        jobId: original.logId ? String(original.logId) : undefined,
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
export async function discardDlqJob({ redisUrl, userId, dlqJobId, queueNameOverride } = {}) {
  if (!dlqJobId) throw new Error('dlqJobId obrigatório')
  return withDlq({ redisUrl, userId, queueNameOverride }, async (dlq) => {
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
export async function purgeDlq({ redisUrl, userId, queueNameOverride } = {}) {
  return withDlq({ redisUrl, userId, queueNameOverride }, async (dlq, name) => {
    const jobs = await dlq.getJobs(['waiting', 'delayed', 'completed', 'failed'], 0, -1, false)
    logger.warn({ queue: name, count: jobs.length }, 'Purgando DLQ — ação manual')
    for (const j of jobs) await j.remove().catch(() => {})
    return { ok: true, removed: jobs.length }
  })
}
