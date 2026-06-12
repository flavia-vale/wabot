import db from '../db.js'
import { runAutomation } from './dispatcher.js'
import { isOfferAutomationDue } from './schedule.js'
import { getPlanAccess as getPlanAccessDefault } from '../billing/plans.js'

const TICK_MS = 60_000

let running = false

export async function tickOfferAutomations(deps = {}) {
  if (running) return
  running = true
  const database = deps.db ?? db
  const run = deps.runAutomationFn ?? runAutomation
  const getPlanAccess = deps.getPlanAccessFn ?? getPlanAccessDefault
  try {
    const now = deps.now ? deps.now() : new Date()
    const automations = await database.offerAutomation.findMany({
      where: { enabled: true },
    })

    for (const automation of automations) {
      if (!isOfferAutomationDue(automation, now)) continue

      // Ofertas automáticas são feature Pro/Trial ativo. Automações criadas
      // antes de um downgrade (ou com acesso expirado) ficam no banco, mas
      // não executam até o plano voltar a permitir.
      const { entitlements } = await getPlanAccess(automation.userId, { db: database })
      if (!entitlements.canUseOfferAutomations) {
        console.warn(`[offer-cron] automation ${automation.id} skipped: plano do usuário ${automation.userId} não permite ofertas automáticas`)
        continue
      }

      try {
        await run(automation)
      } catch (err) {
        console.error(`[offer-cron] automation ${automation.id} failed:`, err.message)
      }
    }
  } finally {
    running = false
  }
}

export function startOfferAutomationCron() {
  const interval = setInterval(() => {
    tickOfferAutomations().catch(err => console.error('[offer-cron] tick error:', err.message))
  }, TICK_MS)
  interval.unref()
  return interval
}
