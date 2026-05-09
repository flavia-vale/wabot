import logger from './logger.js'

function withSafeOnDone(onDone, job, result) {
  if (typeof onDone !== 'function') return Promise.resolve()
  return onDone(result).catch(err => {
    logger.error({ err: err.message, destJid: job.destJid, type: job.type }, 'Erro ao finalizar job da fila')
  })
}

export function createMemorySendBackend({ maxSize, onRejected, onDequeued }) {
  const queue = []
  let processing = false

  return {
    backend: 'memory',
    getQueueSize: () => queue.length,
    async close() {},
    async process() {
      if (processing) return
      processing = true
      try {
        while (queue.length) {
          const job = queue.shift()
          await onDequeued(job)
        }
      } finally {
        processing = false
        if (queue.length) this.process().catch(() => {})
      }
    },
    enqueue(job) {
      if (queue.length >= maxSize) {
        onRejected?.()
        return false
      }
      queue.push(job)
      this.process().catch(err => logger.error({ err: err.message }, 'Erro na fila memory de envios'))
      return true
    },
    getProcessing: () => processing,
  }
}

export async function createBullmqSendBackend({ redisUrl, queueName, onRejected, onDequeued, concurrency = 1 }) {
  const { Queue, Worker } = await import('bullmq')
  const queue = new Queue(queueName, { connection: { url: redisUrl } })
  const worker = new Worker(
    queueName,
    async bullJob => {
      await onDequeued(bullJob.data)
    },
    { connection: { url: redisUrl }, concurrency },
  )

  worker.on('failed', (job, err) => {
    logger.error({ err: err?.message, jobId: job?.id }, 'Falha no worker BullMQ de envios')
  })

  return {
    backend: 'bullmq',
    getQueueSize: async () => queue.getWaitingCount(),
    getProcessing: () => true,
    async close() {
      await worker.close()
      await queue.close()
    },
    enqueue(job) {
      return queue
        .add('send', job, {
          removeOnComplete: 500,
          removeOnFail: 500,
          jobId: String(job.logId),
        })
        .then(() => true)
        .catch(err => {
          logger.warn({ err: err.message, logId: job.logId }, 'Falha ao enfileirar no BullMQ')
          onRejected?.()
          return false
        })
    },
  }
}

export async function finalizeSendJob(onDone, job, result) {
  await withSafeOnDone(onDone, job, result)
}
