class FallbackUnrecoverableError extends Error {
  constructor(message) { super(message); this.name = 'UnrecoverableError' }
}

class FallbackDelayedError extends Error {
  constructor(message) { super(message); this.name = 'DelayedError' }
}

export const INSTAGRAM_QUEUE = 'instagram-stories'
export const INSTAGRAM_DLQ = 'instagram-stories-dlq'

export async function createInstagramPublishingQueue({ redisUrl, processor, onFinalFailure = null, logger = console, bullmqModule = null, concurrency = 2 } = {}) {
  if (!redisUrl) throw new Error('REDIS_URL obrigatório para publicar Stories')
  // Fallbacks nomeados: `= Error` faria `error instanceof DelayedError` casar
  // com QUALQUER erro e a DLQ nunca mais receberia nada.
  const { Queue, Worker, UnrecoverableError = FallbackUnrecoverableError, DelayedError = FallbackDelayedError } = bullmqModule || await import('bullmq')
  const connection = { url: redisUrl }
  const queue = new Queue(INSTAGRAM_QUEUE, { connection })
  const dlq = new Queue(INSTAGRAM_DLQ, { connection })
  const worker = new Worker(INSTAGRAM_QUEUE, async job => {
    try { return await processor(job.data.publicationId) } catch (error) {
      if (!error.retryable) { const fatal = new UnrecoverableError(error.message); fatal.code = 'UNRECOVERABLE'; throw fatal }
      // Espera LONGA (cota diária da Meta, cadência entre Stories) não pode
      // gastar tentativa: com 5 tentativas e backoff de 30s a publicação
      // morria em ~8 min por um limite cuja janela é de 24h. Aqui o job é
      // reagendado no relógio da causa e a contagem de tentativas fica intacta.
      if (Number(error.retryAfterMs) > 0) {
        await job.moveToDelayed(Date.now() + Number(error.retryAfterMs), job.token).catch(() => {})
        throw new DelayedError()
      }
      throw error
    }
  }, { connection, concurrency })
  worker.on('failed', async (job, error) => {
    if (error?.name === 'DelayedError') return
    if (error?.code !== 'UNRECOVERABLE' && job?.attemptsMade < (job?.opts?.attempts || 1)) return
    await dlq.add('failed', { publicationId: job?.data?.publicationId, originalJobId: job?.id, error: String(error?.message || error).slice(0, 500), failedAt: Date.now() }, { removeOnComplete: false, removeOnFail: false }).catch(dlqError => logger.error?.({ err: dlqError.message }, 'Falha ao registrar DLQ Instagram'))
    if (onFinalFailure) await Promise.resolve(onFinalFailure(job?.data?.publicationId, error)).catch(persistError => logger.error?.({ err: persistError.message }, 'Falha ao persistir estado final do Story'))
  })
  const add = (publicationId, delay = 0) => queue.add('publish', { publicationId }, { jobId: publicationId, attempts: 5, backoff: { type: 'exponential', delay: 30_000 }, delay, removeOnComplete: 500, removeOnFail: 500 })
  return Object.freeze({
    enqueue(publicationId, { delay = 0 } = {}) { return add(publicationId, delay) },
    async reenqueue(publicationId, { delay = 0 } = {}) { const existing = await queue.getJob(publicationId); if (existing) await existing.remove(); return add(publicationId, delay) },
    async cancel(publicationId) { const job = await queue.getJob(publicationId); if (!job) return false; await job.remove(); return true },
    async close() { await worker.close(); await queue.close(); await dlq.close() },
  })
}
