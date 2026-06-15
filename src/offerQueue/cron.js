import db from '../db.js'
import { drainQueueOnce, recoverStuckQueueItems } from './dispatcher.js'
import { getPlanAccess as getPlanAccessDefault } from '../billing/plans.js'

const TICK_MS = 60_000
let ticking = false

export async function tickOfferQueues(deps = {}) {
  if (ticking) return
  ticking = true
  const database = deps.db ?? db
  const getPlanAccess = deps.getPlanAccessFn ?? getPlanAccessDefault
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
      // Filas de ofertas são feature Pro/Trial ativo. Filas criadas antes de
      // um downgrade (ou com acesso expirado) ficam no banco, mas não drenam
      // até o plano voltar a permitir.
      const { entitlements } = await getPlanAccess(queue.userId, { db: database })
      if (!entitlements.canUseOfferQueues) {
        console.warn(`[offer-queue-cron] queue ${queue.id} skipped: plano do usuário ${queue.userId} não permite filas de ofertas`)
        continue
      }
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
