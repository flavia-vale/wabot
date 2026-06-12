import dbDefault from '../db.js'
import { isRunning as isRunningDefault, sendBroadcast as sendBroadcastDefault } from '../manager.js'
import { startOfSaoPauloDayUtc } from './time.js'

const drainingQueues = new Set()

export async function drainQueueOnce(queue, deps = {}) {
  const lockKey = `${queue.userId}:${queue.id}`
  if (drainingQueues.has(lockKey)) return { skipped: 'queue_busy' }
  drainingQueues.add(lockKey)
  try { return await drainQueueUnlocked(queue, deps) }
  finally { drainingQueues.delete(lockKey) }
}

async function drainQueueUnlocked(queue, deps = {}) {
  const db = deps.db ?? dbDefault
  const isRunning = deps.isRunning ?? isRunningDefault
  const sendBroadcast = deps.sendBroadcast ?? sendBroadcastDefault
  const now = deps.now ? deps.now() : new Date()
  if (!queue.enabled) return { skipped: 'queue_disabled' }
  const currentQueue = await db.offerQueue.findFirst({ where: { id: queue.id, userId: queue.userId, enabled: true } })
  if (!currentQueue) return { skipped: 'queue_disabled' }
  queue = currentQueue
  if (!await isRunning(queue.userId)) return { skipped: 'bot_offline' }
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
  const claim = await db.offerQueueItem.updateMany({
    where: { id: item.id, queueId: queue.id, userId: queue.userId, status: 'pending', queue: { enabled: true } },
    data: { status: 'queued' },
  })
  if (claim.count !== 1) return { skipped: 'claim_lost' }
  const stillEnabled = await db.offerQueue.findFirst({ where: { id: queue.id, userId: queue.userId, enabled: true }, select: { id: true } })
  if (!stillEnabled) {
    await db.offerQueueItem.updateMany({ where: { id: item.id, queueId: queue.id, userId: queue.userId, status: 'queued' }, data: { status: 'pending' } })
    return { skipped: 'queue_disabled' }
  }
  try {
    await sendBroadcast(queue.userId, item.text, JSON.parse(item.targetJids), { imageUrl: item.imageUrl ?? undefined, imageRefererUrl: item.imageRefererUrl ?? undefined, source: 'offerQueue', queueId: queue.id })
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
