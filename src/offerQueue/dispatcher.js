import dbDefault from '../db.js'
import { isRunning as isRunningDefault, sendBroadcast as sendBroadcastDefault } from '../manager.js'
import { startOfSaoPauloDayUtc } from './time.js'

export async function drainQueueOnce(queue, deps = {}) {
  const db = deps.db ?? dbDefault
  const isRunning = deps.isRunning ?? isRunningDefault
  const sendBroadcast = deps.sendBroadcast ?? sendBroadcastDefault
  const now = deps.now ? deps.now() : new Date()
  if (!queue.enabled) return { skipped: 'queue_disabled' }
  if (!isRunning(queue.userId)) return { skipped: 'bot_offline' }
  if (queue.intervalEnabled && queue.lastSentAt && now - new Date(queue.lastSentAt) < queue.intervalMinutes * 60_000) return { skipped: 'interval_limit' }
  if (queue.hourlyCapEnabled) {
    const count = await db.offerQueueItem.count({ where: { queueId: queue.id, userId: queue.userId, status: 'sent', sentAt: { gte: new Date(now.getTime() - 3_600_000) } } })
    if (count >= queue.hourlyCap) return { skipped: 'hourly_limit' }
  }
  if (queue.dailyCapEnabled) {
    const count = await db.offerQueueItem.count({ where: { queueId: queue.id, userId: queue.userId, status: 'sent', sentAt: { gte: startOfSaoPauloDayUtc(now) } } })
    if (count >= queue.dailyCap) return { skipped: 'daily_limit' }
  }
  const item = await db.offerQueueItem.findFirst({ where: { queueId: queue.id, userId: queue.userId, status: 'pending' }, orderBy: { position: 'asc' } })
  if (!item) return { skipped: 'empty' }
  const claim = await db.offerQueueItem.updateMany({ where: { id: item.id, queueId: queue.id, userId: queue.userId, status: 'pending' }, data: { status: 'queued' } })
  if (claim.count !== 1) return { skipped: 'claim_lost' }
  try {
    await sendBroadcast(queue.userId, item.text, JSON.parse(item.targetJids), { imageUrl: item.imageUrl ?? undefined, imageRefererUrl: item.imageRefererUrl ?? undefined })
    await db.$transaction([
      db.offerQueueItem.updateMany({ where: { id: item.id, queueId: queue.id, userId: queue.userId, status: 'queued' }, data: { status: 'sent', sentAt: now } }),
      db.offerQueue.updateMany({ where: { id: queue.id, userId: queue.userId }, data: { lastSentAt: now } }),
    ])
    return { sent: item.id }
  } catch (error) {
    await db.offerQueueItem.updateMany({ where: { id: item.id, queueId: queue.id, userId: queue.userId, status: 'queued' }, data: { status: 'failed' } })
    return { failed: item.id, error }
  }
}
