import db from '../db.js'
import { runAutomation } from './dispatcher.js'

const TICK_MS = 60_000

async function tick() {
  const now = new Date()
  const automations = await db.offerAutomation.findMany({
    where: { enabled: true },
  })

  for (const automation of automations) {
    const dueAt = automation.lastSentAt
      ? new Date(automation.lastSentAt.getTime() + automation.intervalMinutes * 60_000)
      : new Date(0)

    if (now < dueAt) continue

    try {
      await runAutomation(automation)
    } catch (err) {
      console.error(`[offer-cron] automation ${automation.id} failed:`, err.message)
    }
  }
}

export function startOfferAutomationCron() {
  const interval = setInterval(() => {
    tick().catch(err => console.error('[offer-cron] tick error:', err.message))
  }, TICK_MS)
  interval.unref()
  return interval
}
