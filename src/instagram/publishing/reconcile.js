import { getInstagramPublishingRuntime } from './runtime.js'

// Idade mínima antes de reconciliar. Uma resposta perdida de `media_publish`
// pode ser só lentidão da Meta; conferir cedo demais leria o container antes
// de ele virar PUBLISHED e concluiria o oposto.
export const RECONCILE_MIN_AGE_MS = Number(process.env.INSTAGRAM_RECONCILE_MIN_AGE_MS ?? 10 * 60_000)
export const RECONCILE_INTERVAL_MS = Number(process.env.INSTAGRAM_RECONCILE_INTERVAL_MS ?? 15 * 60_000)

/**
 * Reenfileira as publicações presas em `reconciliation_required`.
 *
 * O estado nasce quando `media_publish` pode ter publicado e não confirmou:
 * repetir às cegas duplicaria o Story, então o processor para ali de propósito.
 * O que faltava era alguém retomar — o processor JÁ sabe reconciliar (relê o
 * container e marca `published` se a Meta diz PUBLISHED), mas nada o chamava:
 * o retry manual recusava o status e não havia varredura nem tela. Na prática
 * a publicação ficava para sempre em "Conferência necessária", sem botão e sem
 * instrução.
 */
export async function runInstagramReconciliation({ db, queue = getInstagramPublishingRuntime(), now = () => new Date(), limit = 25, logger = console } = {}) {
  if (!db || !queue) return { skipped: 'runtime_unavailable' }
  const olderThan = new Date(now().getTime() - RECONCILE_MIN_AGE_MS)
  const rows = await db.storyPublication.findMany({
    // Sem container não há o que conferir na Meta: nada foi criado lá.
    where: { status: 'reconciliation_required', providerContainerId: { not: null }, updatedAt: { lt: olderThan } },
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  })
  let requeued = 0
  for (const row of rows) {
    try {
      if (queue.reenqueue) await queue.reenqueue(row.id, { delay: 0 })
      else await queue.enqueue(row.id, { delay: 0 })
      requeued++
    } catch (error) {
      logger.warn?.({ err: error.message, publicationId: row.id }, 'Falha ao reenfileirar conferência de Story')
    }
  }
  return { scanned: rows.length, requeued }
}

export function startInstagramReconciliation({ db, logger = console, intervalMs = RECONCILE_INTERVAL_MS } = {}) {
  const tick = () => runInstagramReconciliation({ db, logger })
    .then(result => { if (result.requeued) logger.info?.(result, 'Publicações de Story reenviadas para conferência') })
    .catch(error => logger.error?.({ err: error.message }, 'Falha na conferência de Stories'))
  const timer = setInterval(tick, Math.max(60_000, intervalMs))
  timer.unref?.()
  return () => clearInterval(timer)
}
