// Retenção de AnalyticsEvent `ops_*` em lotes (RCA docs/rca/admin.md, 2026-10-03).
// Módulo sem import de banco: recebe `db` e `sleep` por parâmetro (testável).
import { OPS_RETENTION_EVENTS } from './operationalSignals.js'

export const OPS_RETENTION_DEFAULT_DAYS = 90
export const OPS_RETENTION_BATCH_SIZE = 5000
export const OPS_RETENTION_MAX_BATCHES = 40 // 200 mil linhas por passada; o resto vai na próxima
export const OPS_RETENTION_PAUSE_MS = 200

export async function purgeOldOpsEvents({
  db,
  retentionDays = OPS_RETENTION_DEFAULT_DAYS,
  now = Date.now(),
  events = OPS_RETENTION_EVENTS,
  batchSize = OPS_RETENTION_BATCH_SIZE,
  maxBatches = OPS_RETENTION_MAX_BATCHES,
  pauseMs = OPS_RETENTION_PAUSE_MS,
  sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return { deleted: 0, batches: 0, capped: false }
  const cutoff = new Date(now - retentionDays * 24 * 60 * 60 * 1000)
  let deleted = 0
  let batches = 0
  while (batches < maxBatches) {
    const rows = await db.analyticsEvent.findMany({
      where: { event: { in: events }, createdAt: { lt: cutoff } },
      select: { id: true },
      take: batchSize,
    })
    if (!rows.length) return { deleted, batches, capped: false, cutoff }
    const result = await db.analyticsEvent.deleteMany({ where: { id: { in: rows.map(r => r.id) } } })
    deleted += result.count
    batches += 1
    if (rows.length < batchSize) return { deleted, batches, capped: false, cutoff }
    if (pauseMs > 0) await sleep(pauseMs)
  }
  return { deleted, batches, capped: true, cutoff }
}
