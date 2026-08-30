import logger from './logger.js'

// Fila assíncrona com:
// - concorrência configurável
// - timeout individual por job (Promise.race)
// - watchdog que libera slots travados
// - ordering opcional por chave (mantém ordem dentro de um mesmo source group)
// Obs: timeout libera o slot mas não aborta IO subjacente — o trabalho residual
// é descartado silenciosamente. Aceitável aqui por escopo.
export function createMessageQueue({
  name = 'queue',
  concurrency = 2,
  taskTimeoutMs = 15_000,
  watchdogIntervalMs = 5_000,
  watchdogStallMs = 30_000,
  maxSize = 500,
} = {}) {
  const pending = []
  const active = new Set()
  let running = 0
  let closed = false
  const orderTails = new Map()

  const stats = {
    enqueued: 0,
    processed: 0,
    failed: 0,
    timedOut: 0,
    watchdogResets: 0,
    rejected: 0,
    // Quando um job saiu da fila pela última vez (concluído, com erro ou por
    // timeout). É o que separa "não está chegando nada" de "está chegando e a
    // fila parou de andar" — o quadro do RCA 2026-08-28.
    lastCompletedAt: null,
  }

  function tick() {
    while (!closed && running < concurrency && pending.length) {
      const job = pending.shift()
      running++
      run(job)
    }
  }

  async function run(job) {
    const tracker = { startedAt: Date.now(), label: job.label, abandoned: false, done: job.done }
    active.add(tracker)
    let timeoutHandle
    try {
      await Promise.race([
        Promise.resolve().then(() => job.fn()),
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error(`timeout ${taskTimeoutMs}ms: ${job.label}`)),
            taskTimeoutMs,
          )
          timeoutHandle.unref?.()
        }),
      ])
      stats.processed++
    } catch (err) {
      stats.failed++
      if (/timeout/i.test(err.message)) stats.timedOut++
      logger.error({ queue: name, err: err.message, label: job.label }, 'Falha em job da fila')
      if (job.onError) {
        try { await job.onError(err) } catch (e) {
          logger.error({ queue: name, err: e.message, label: job.label }, 'onError lançou — ignorando para não parar a fila')
        }
      }
    } finally {
      clearTimeout(timeoutHandle)
      if (!tracker.abandoned) {
        active.delete(tracker)
        running--
      }
      // RCA 2026-08-28: a corrente de ordem da origem avança quando a FILA
      // termina de esperar por este job — inclusive quando ele estourou o
      // timeout. Antes ela só avançava quando a função do job resolvia, e o
      // timeout não cancela a função: uma mensagem travada para sempre deixava
      // a origem inteira surda, com a sessão conectada e nada saindo.
      stats.lastCompletedAt = Date.now()
      job.done?.()
      tick()
    }
  }

  const watchdogTimer = setInterval(() => {
    const now = Date.now()
    for (const tracker of active) {
      if (tracker.abandoned) continue
      if (now - tracker.startedAt > watchdogStallMs) {
        tracker.abandoned = true
        active.delete(tracker)
        running = Math.max(0, running - 1)
        stats.watchdogResets++
        // Mesma razão do `job.done?.()` acima: soltar o slot sem soltar a
        // corrente deixaria a origem travada para sempre.
        tracker.done?.()
        logger.warn(
          { queue: name, label: tracker.label, durationMs: now - tracker.startedAt },
          'Watchdog: slot liberado por job travado',
        )
        tick()
      }
    }
  }, watchdogIntervalMs)
  watchdogTimer.unref?.()

  function enqueue(fn, { label = 'task', onError = null, orderKey = null } = {}) {
    if (closed) {
      stats.rejected++
      return false
    }
    if (pending.length >= maxSize) {
      stats.rejected++
      logger.warn({ queue: name, label, maxSize }, 'Fila cheia — job rejeitado')
      return false
    }

    if (!orderKey) {
      stats.enqueued++
      pending.push({ fn, label, onError })
      tick()
      return true
    }

    // Mantém ordem dentro da chave: encadeia o novo fn após o anterior do mesmo
    // grupo. `completion` resolve quando a fila TERMINA DE ESPERAR pelo job
    // (função concluída, erro ou timeout) — nunca depende de a função resolver
    // sozinha, senão uma tarefa travada bloqueia a origem para sempre.
    const prev = orderTails.get(orderKey) || Promise.resolve()
    let liberar
    const completion = new Promise(resolve => { liberar = resolve })
    stats.enqueued++
    pending.push({
      label,
      fn: () => prev.catch(() => {}).then(() => fn()),
      onError,
      done: liberar,
    })
    orderTails.set(orderKey, completion)
    completion.finally(() => {
      if (orderTails.get(orderKey) === completion) orderTails.delete(orderKey)
    })
    tick()
    return true
  }

  function getStats() {
    return {
      ...stats,
      pending: pending.length,
      active: active.size,
      running,
      concurrency,
      maxSize,
    }
  }

  function close() { closed = true; clearInterval(watchdogTimer) }

  return { enqueue, getStats, close }
}
