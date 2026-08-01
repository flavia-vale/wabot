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
  // Timers de jobs agendados (notBefore no futuro). Mantidos fora da fila
  // serial: um defer longo NÃO pode congelar o consumidor — ele reentra na
  // fila só quando a janela vence. Rastreados para o shutdown poder limpá-los.
  const scheduled = new Set()
  let processing = false
  let closed = false

  function process() {
    if (processing) return Promise.resolve()
    processing = true
    return (async () => {
      try {
        while (queue.length) {
          const job = queue.shift()
          await onDequeued(job)
        }
      } finally {
        processing = false
        if (queue.length) process().catch(() => {})
      }
    })()
  }

  function pushAndProcess(job) {
    queue.push(job)
    process().catch(err => logger.error({ err: err.message }, 'Erro na fila memory de envios'))
  }

  return /** @type {SendBackend} */ ({
    backend: 'memory',
    getQueueSize: () => queue.length,
    // Pressão POR DESTINO (RCA 2026-07): o freio progressivo anti-ban media a
    // fila TOTAL, então um destino lento (burstCap baixo) entupia a fila e
    // fazia TODOS os outros destinos pagarem o atraso máximo. Contar só o que
    // está esperando para ESTE destino mantém o freio local ao gargalo.
    // Jobs adiados (notBefore no futuro) vivem em `scheduled`, fora de `queue`
    // — logo já não contam como pressão, que é o comportamento correto: eles
    // não estão disputando o consumidor agora.
    getQueueSizeByDest: (destJid) => {
      if (!destJid) return queue.length
      let n = 0
      for (const job of queue) if (job?.destJid === destJid) n++
      return n
    },
    getScheduledSize: () => scheduled.size,
    getDlqSize: async () => 0,
    async close() {
      closed = true
      for (const timer of scheduled) clearTimeout(timer)
      scheduled.clear()
    },
    process,
    enqueue(job) {
      const delayMs = job?.notBefore != null ? Math.max(0, Number(job.notBefore) - Date.now()) : 0
      if (delayMs > 0) {
        // Job agendado (re-enfileiramento por defer longo). Não conta para o
        // maxSize: é trabalho já aceito sendo adiado, não pode ser descartado.
        // Reentra na fila quando a janela abre — sem busy-loop.
        const timer = setTimeout(() => {
          scheduled.delete(timer)
          if (closed) return
          pushAndProcess(job)
        }, delayMs)
        timer.unref?.()
        scheduled.add(timer)
        return true
      }
      if (queue.length >= maxSize) {
        onRejected?.()
        return false
      }
      pushAndProcess(job)
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
      // Guard contra regressão silenciosa: BullMQ serializa o job via
      // JSON.stringify. Funções viram null; Buffer vira
      // `{type:'Buffer',data:[...]}` que o Baileys NÃO reconhece como
      // mídia — a oferta sairia sem foto. Detectamos antes de enfileirar
      // e rejeitamos com erro alto, em vez de mandar texto puro em
      // silêncio. Quando esta linha disparar, a fix correta é manter o
      // valor LAZY (função buildPayload) em vez de embutir o Buffer no job.
      const offender = findUnserializableField(job)
      if (offender) {
        const err = new Error(`Job de envio contém campo não-serializável em "${offender.path}" (${offender.kind}). BullMQ perderia esse valor — use buildPayload (lazy) em vez de payload eager.`)
        logger.error({ err: err.message, logId: job?.logId, path: offender.path, kind: offender.kind }, 'BullMQ enqueue bloqueado: payload não-serializável')
        onRejected?.()
        return Promise.resolve(false).then(() => { throw err })
      }
      // Defer longo re-enfileira com notBefore: o BullMQ adia nativamente via
      // opts.delay (job entra em `delayed` e só vira `waiting` quando vence),
      // sem segurar o worker serial.
      const delay = job?.notBefore != null ? Math.max(0, Number(job.notBefore) - Date.now()) : 0
      // jobId distinto no re-enfileiramento por defer: o job original já
      // completou (e fica no set `completed` por removeOnComplete:500), então
      // re-adicionar com o mesmo `logId` cru seria descartado em silêncio
      // (mesma pegadinha do retry de DLQ, P2-3).
      const jobId = delay > 0 ? `defer:${job.logId}:${job.notBefore}` : String(job.logId)
      return queue
        .add('send', job, {
          removeOnComplete: 500,
          // Mantemos só os últimos 500 failed no histórico da fila principal;
          // a DLQ guarda cópia explícita das falhas para inspeção.
          removeOnFail: 500,
          jobId,
          ...(delay > 0 ? { delay } : {}),
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

/**
 * Procura recursivamente o primeiro campo que não sobrevive a
 * JSON.stringify/parse (funções e Buffers). Devolve { path, kind } ou null.
 * Limitado a 6 níveis de profundidade pra evitar loop em estruturas cíclicas.
 */
export function findUnserializableField(value, path = '$', depth = 0) {
  if (depth > 6) return null
  if (value === null || value === undefined) return null
  if (typeof value === 'function') return { path, kind: 'function' }
  if (Buffer.isBuffer(value)) return { path, kind: 'Buffer' }
  if (value instanceof Uint8Array) return { path, kind: 'Uint8Array' }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findUnserializableField(value[i], `${path}[${i}]`, depth + 1)
      if (found) return found
    }
    return null
  }
  if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      const found = findUnserializableField(value[key], `${path}.${key}`, depth + 1)
      if (found) return found
    }
  }
  return null
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
