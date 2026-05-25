import logger from './logger.js'

/**
 * @typedef {Object} SendJob
 * @property {string|number} logId
 * @property {string} [destJid]
 * @property {string} [type]
 * @property {Function} [onDone]
 * @property {Object<string, any>} [extra]
 */

/**
 * @typedef {Object} SendBackend
 * @property {'memory'|'bullmq'} backend
 * @property {() => (number|Promise<number>)} getQueueSize
 * @property {() => (number|Promise<number>)} getDlqSize
 * @property {() => boolean} getProcessing
 * @property {(job: SendJob) => (boolean|Promise<boolean>)} enqueue
 * @property {() => Promise<void>} close
 */

function withSafeOnDone(onDone, job, result) {
  if (typeof onDone !== 'function') return Promise.resolve()
  return onDone(result).catch(err => {
    logger.error({ err: err.message, destJid: job.destJid, type: job.type }, 'Erro ao finalizar job da fila')
  })
}

export function createMemorySendBackend({ maxSize, onRejected, onDequeued }) {
  const queue = []
  let processing = false

  return /** @type {SendBackend} */ ({
    backend: 'memory',
    getQueueSize: () => queue.length,
    getDlqSize: async () => 0,
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
  })
}

/**
 * Backend BullMQ com DLQ explícita.
 *
 * Persistência: jobs ficam no Redis até serem processados. Reinício do
 * worker NÃO perde jobs em vôo (eles voltam para `waiting` no boot seguinte).
 *
 * Política de falha: o handler do Worker BullMQ é o `onDequeued` (que chama
 * `processSendJob` no bot-worker). `processSendJob` já tem seu próprio loop
 * de retries (SEND_MAX_ATTEMPTS) — então se ele lançou, é falha DEFINITIVA.
 * Nesse caso publicamos uma cópia do job na DLQ `${queueName}-dlq` para
 * inspeção/retry manual via rota admin.
 *
 * DLQ é uma Queue BullMQ sem Worker associado: jobs ficam parados,
 * removeOnComplete/Fail desligados. Inspeção via `src/jobs/sendDlq.js`.
 */
export async function createBullmqSendBackend({
  redisUrl,
  queueName,
  onRejected,
  onDequeued,
  concurrency = 1,
  dlqQueueName = `${queueName}-dlq`,
  // Injeção opcional usada em testes — permite substituir bullmq por mock
  // sem precisar de Redis real. Em produção fica undefined e cai no import
  // dinâmico padrão.
  bullmqModule = null,
}) {
  const { Queue, Worker } = bullmqModule ?? (await import('bullmq'))
  const connection = { url: redisUrl }
  const queue = new Queue(queueName, { connection })
  const dlq = new Queue(dlqQueueName, { connection })

  const worker = new Worker(
    queueName,
    async bullJob => {
      await onDequeued(bullJob.data)
    },
    { connection, concurrency },
  )

  worker.on('failed', async (bullJob, err) => {
    const errMsg = err?.message ?? String(err)
    logger.error({ err: errMsg, jobId: bullJob?.id, name: bullJob?.name }, 'Falha definitiva no worker BullMQ — empurrando para DLQ')
    try {
      await dlq.add(
        'failed',
        {
          originalQueue: queueName,
          originalJobId: bullJob?.id ?? null,
          originalData: bullJob?.data ?? null,
          error: errMsg,
          failedAt: Date.now(),
        },
        {
          // DLQ é para inspeção humana — não auto-expira.
          removeOnComplete: false,
          removeOnFail: false,
        },
      )
    } catch (dlqErr) {
      logger.error({ err: dlqErr.message }, 'Falha ao empurrar para DLQ — job perdido')
    }
  })

  return /** @type {SendBackend} */ ({
    backend: 'bullmq',
    queueName,
    dlqQueueName,
    getQueueSize: () => queue.getWaitingCount(),
    getDlqSize: () => dlq.getJobCountByTypes('waiting', 'delayed', 'active', 'completed', 'failed'),
    getProcessing: () => true,
    async close() {
      await worker.close()
      await queue.close()
      await dlq.close()
    },
    enqueue(job) {
      return queue
        .add('send', job, {
          removeOnComplete: 500,
          // Mantemos só os últimos 500 failed no histórico da fila principal;
          // a DLQ guarda cópia explícita das falhas para inspeção.
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
  })
}

export async function finalizeSendJob(onDone, job, result) {
  await withSafeOnDone(onDone, job, result)
}

/**
 * Decide qual backend usar.
 *
 *   QUEUE_BACKEND   REDIS_URL   resultado
 *   -------------   ---------   ---------
 *   'bullmq'        set         bullmq (explícito)
 *   'bullmq'        empty       memory-fallback (warn)
 *   'memory'        *           memory (explícito)
 *   unset/auto      *           memory (default seguro)
 *
 * Por que NÃO auto-switch para bullmq quando há REDIS_URL: o payload de
 * envio carrega `image.buffer` (Buffer real) quando há mídia. BullMQ
 * serializa o job via JSON.stringify, e Buffer vira `{type:'Buffer',
 * data:[...]}` na deserialização — o Baileys não reconhece como mídia e
 * a oferta sai sem imagem. Até existir um caminho que serialize só a
 * "receita" (URL/flags) e reconstrua a payload pós-dequeue, o BullMQ
 * precisa ser opt-in explícito via `QUEUE_BACKEND=bullmq` (e nesse caso
 * o operador aceita o trade-off ou roda só com texto).
 */
export function resolveBackendMode({ queueBackendEnv, redisUrl }) {
  const explicit = String(queueBackendEnv || '').toLowerCase()
  if (explicit === 'memory') return 'memory'
  if (explicit === 'bullmq') return redisUrl ? 'bullmq' : 'memory-fallback'
  return 'memory'
}
