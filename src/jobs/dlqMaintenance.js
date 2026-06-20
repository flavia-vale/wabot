/**
 * Manutenção periódica da DLQ de envio (P2-1, follow-up operacional).
 *
 * A DLQ (`<queue>-dlq`) não tem worker: jobs ficam em `waiting` para sempre e
 * `removeOnComplete/Fail` nunca os toca (nunca completam). Sem poda por idade,
 * ela cresce indefinidamente quando `QUEUE_BACKEND=bullmq`. `pruneDlqOlderThan`
 * existia mas NINGUÉM a agendava — este job fecha essa lacuna.
 *
 * Só faz trabalho real quando o backend resolvido é `bullmq` (senão não há DLQ).
 * É best-effort: falha de Redis aqui nunca derruba a API.
 *
 * Também mantém um gauge in-process do total restante na DLQ (atualizado a cada
 * run), exposto no `/metrics` sem custo de round-trip por scrape.
 */

import logger from '../logger.js'
import { pruneDlqOlderThan, DLQ_RETENTION_MS } from './sendDlq.js'
import { resolveBackendMode } from '../sendQueueBackend.js'

const DEFAULT_INTERVAL_MS = Math.max(
  60 * 60 * 1000,
  Number(process.env.DLQ_MAINTENANCE_INTERVAL_MS || 24 * 60 * 60 * 1000),
)

let lastKnownDlqTotal = 0
let lastRunAt = 0
let lastRemovedTotal = 0

export function getDlqMaintenanceSnapshot() {
  return { lastKnownDlqTotal, lastRunAt, lastRemovedTotal }
}

/**
 * Poda a DLQ de todos os usuários com sessão (proxy de quem tem fila de envio).
 * Quando `BULLMQ_QUEUE_NAME` está setado (fila única compartilhada), poda uma
 * vez só — a DLQ é a mesma para todos.
 */
export async function pruneAllUserDlqs({
  db,
  redisUrl = process.env.REDIS_URL || '',
  queueBackendEnv = process.env.QUEUE_BACKEND,
  queueNameOverride = process.env.BULLMQ_QUEUE_NAME || null,
  olderThanMs = DLQ_RETENTION_MS,
  now = Date.now(),
  bullmqModule = null,
} = {}) {
  const mode = resolveBackendMode({ queueBackendEnv, redisUrl })
  if (mode !== 'bullmq') return { skipped: 'backend_not_bullmq', mode, removed: 0, remaining: 0 }

  let removed = 0
  let remaining = 0

  if (queueNameOverride) {
    // Fila única: userId é irrelevante para o nome da DLQ, poda uma vez.
    const r = await pruneDlqOlderThan({ redisUrl, userId: 'shared', queueNameOverride, olderThanMs, now, bullmqModule })
    removed += r.removed || 0
    remaining += r.remaining || 0
  } else {
    const sessions = await db.waSession.findMany({ select: { userId: true } })
    const userIds = [...new Set(sessions.map(s => s.userId))]
    for (const userId of userIds) {
      try {
        const r = await pruneDlqOlderThan({ redisUrl, userId, olderThanMs, now, bullmqModule })
        removed += r.removed || 0
        remaining += r.remaining || 0
      } catch (err) {
        logger.warn({ err: err?.message, userId }, 'dlqMaintenance: falha ao podar DLQ do usuário')
      }
    }
  }

  lastKnownDlqTotal = remaining
  lastRemovedTotal = removed
  lastRunAt = now
  if (removed > 0 || remaining > 0) {
    logger.info({ removed, remaining, olderThanMs }, 'dlqMaintenance: poda concluída')
  }
  return { ok: true, removed, remaining, mode }
}

/**
 * Agenda a poda periódica. Roda uma vez logo após o boot (com pequeno atraso
 * para não competir com a inicialização) e depois a cada `intervalMs`.
 * Retorna um stop().
 */
export function startDlqMaintenanceJob({ db, intervalMs = DEFAULT_INTERVAL_MS, log = logger } = {}) {
  const run = () => pruneAllUserDlqs({ db }).catch(err => {
    log.warn?.({ err: err?.message }, 'dlqMaintenance: tick falhou')
  })
  // Primeiro run com atraso curto para sair do caminho crítico do boot.
  const kickoff = setTimeout(run, 30_000)
  kickoff.unref?.()
  const timer = setInterval(run, intervalMs)
  timer.unref?.()
  return () => { clearTimeout(kickoff); clearInterval(timer) }
}
