import db from '../db.js'
import { runAutomation } from './dispatcher.js'
import { isOfferAutomationDue } from './schedule.js'

const TICK_MS = 60_000

let running = false

async function tick() {
  if (running) return
  running = true
  try {
    const now = new Date()
    const automations = await db.offerAutomation.findMany({
      where: { enabled: true },
    })

    for (const automation of automations) {
      if (!isOfferAutomationDue(automation, now)) continue

      try {
        await runAutomation(automation)
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
    tick().catch(err => console.error('[offer-cron] tick error:', err.message))
  }, TICK_MS)
  interval.unref()
  return interval
}
