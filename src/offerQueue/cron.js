import db from '../db.js'
import { drainQueueOnce, recoverStuckQueueItems } from './dispatcher.js'

const TICK_MS = 60_000
let ticking = false

export async function tickOfferQueues(deps = {}) {
  if (ticking) return
  ticking = true
  const database = deps.db ?? db
  try {
    // Watchdog antes do drain: devolve itens 'queued' com lease expirada
    // (processo caiu entre claim e envio) para 'pending'.
    try {
      const recovered = await recoverStuckQueueItems({ ...deps, db: database })
      if (recovered.requeued > 0 || recovered.exhausted > 0) {
        console.warn(`[offer-queue-cron] itens presos recuperados: requeued=${recovered.requeued} exhausted=${recovered.exhausted}`)
      }
    } catch (error) {
      console.error('[offer-queue-cron] watchdog failed:', error.message)
    }
    const queues = await database.offerQueue.findMany({ where: { enabled: true, items: { some: { status: 'pending' } } } })
    for (const queue of queues) {
      try { await drainQueueOnce(queue, { ...deps, db: database }) }
      catch (error) { console.error(`[offer-queue-cron] queue ${queue.id} failed:`, error.message) }
    }
  } finally { ticking = false }
}

export function startOfferQueueCron() {
  const interval = setInterval(() => tickOfferQueues().catch((error) => console.error('[offer-queue-cron] tick error:', error.message)), TICK_MS)
  interval.unref()
  return interval
}
