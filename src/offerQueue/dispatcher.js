import dbDefault from '../db.js'
import { isRunning as isRunningDefault, sendBroadcast as sendBroadcastDefault } from '../manager.js'
import { parseQuietHours, quietHoursState } from '../core/channelThrottle.js'
import { startOfSaoPauloDayUtc } from './time.js'
import { isOutsideOperatingHours } from './operatingHours.js'

const drainingQueues = new Set()

// Lease do claim: se o processo cair entre pending->queued e o desfecho do
// envio, o watchdog devolve o item para 'pending' depois deste prazo.
export const OFFER_QUEUE_LEASE_MS = Math.max(60_000, Number(process.env.OFFER_QUEUE_LEASE_MS || 5 * 60_000))
export const OFFER_QUEUE_MAX_ATTEMPTS = Math.max(1, Number(process.env.OFFER_QUEUE_MAX_ATTEMPTS || 3))
const RETRY_BASE_MS = 60_000
const RETRY_MAX_MS = 3_600_000

export function getOfferQueueRetryDelayMs(attemptCount) {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attemptCount - 1), RETRY_MAX_MS)
}

function truncateError(error) {
  return String(error?.message ?? error ?? 'unknown').slice(0, 500)
}

// Watchdog: recupera itens cujo processo morreu entre o claim e o envio.
// - lease expirada + tentativas restantes -> volta para 'pending' (re-envio)
// - lease expirada + tentativas esgotadas -> 'failed' terminal com lastError
// - claimedAt null cobre linhas presas de antes da migration (legado).
export async function recoverStuckQueueItems(deps = {}) {
  const db = deps.db ?? dbDefault
  const now = deps.now ? deps.now() : new Date()
  const cutoff = new Date(now.getTime() - OFFER_QUEUE_LEASE_MS)
  const staleWhere = {
    status: 'queued',
    OR: [{ claimedAt: null }, { claimedAt: { lt: cutoff } }],
  }
  const exhausted = await db.offerQueueItem.updateMany({
    where: { ...staleWhere, attemptCount: { gte: OFFER_QUEUE_MAX_ATTEMPTS } },
    data: { status: 'failed', lastError: 'stuck_queued: lease expirado após esgotar tentativas' },
  })
  const requeued = await db.offerQueueItem.updateMany({
    where: staleWhere,
    data: { status: 'pending', claimedAt: null, lastError: 'stuck_queued: lease expirado, reencaminhado' },
  })
  return { requeued: requeued.count, exhausted: exhausted.count }
}

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
  // Horário por fila (override) vs. janela silenciosa global. Centralizado aqui
  // porque é o único ponto que conhece o objeto `queue` e pode carregar o
  // BotConfig do usuário antes de o envio sair pelo caminho IPC.
  if (queue.operatingHoursEnabled) {
    if (isOutsideOperatingHours(now, queue.operatingHoursStart, queue.operatingHoursEnd)) return { skipped: 'outside_operating_hours' }
  } else {
    const botConfig = await db.botConfig?.findFirst?.({ where: { userId: queue.userId } })
    if (botConfig?.quietHoursEnabled === true && quietHoursState(now.getTime(), parseQuietHours(botConfig.channelQuietHoursJson)).inQuiet) return { skipped: 'quiet_hours' }
  }
  if (queue.intervalEnabled && queue.lastSentAt && now - new Date(queue.lastSentAt) < queue.intervalMinutes * 60_000) return { skipped: 'interval_limit' }
  if (queue.hourlyCapEnabled) {
    const count = await db.offerQueueItem.count({ where: { queueId: queue.id, userId: queue.userId, status: 'sent', sentAt: { gte: new Date(now.getTime() - 3_600_000) } } })
    if (count >= queue.hourlyCap) return { skipped: 'hourly_limit' }
  }
  if (queue.dailyCapEnabled) {
    const count = await db.offerQueueItem.count({ where: { queueId: queue.id, userId: queue.userId, status: 'sent', sentAt: { gte: startOfSaoPauloDayUtc(now) } } })
    if (count >= queue.dailyCap) return { skipped: 'daily_limit' }
  }
  const item = await db.offerQueueItem.findFirst({
    where: {
      queueId: queue.id,
      userId: queue.userId,
      status: 'pending',
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { position: 'asc' },
  })
  if (!item) return { skipped: 'empty' }
  const claim = await db.offerQueueItem.updateMany({
    where: { id: item.id, queueId: queue.id, userId: queue.userId, status: 'pending', queue: { enabled: true } },
    data: { status: 'queued', claimedAt: now, attemptCount: { increment: 1 } },
  })
  if (claim.count !== 1) return { skipped: 'claim_lost' }
  const attemptCount = (item.attemptCount ?? 0) + 1
  const stillEnabled = await db.offerQueue.findFirst({ where: { id: queue.id, userId: queue.userId, enabled: true }, select: { id: true } })
  if (!stillEnabled) {
    await db.offerQueueItem.updateMany({ where: { id: item.id, queueId: queue.id, userId: queue.userId, status: 'queued' }, data: { status: 'pending', claimedAt: null } })
    return { skipped: 'queue_disabled' }
  }
  try {
    await sendBroadcast(queue.userId, item.text, JSON.parse(item.targetJids), { imageUrl: item.imageUrl ?? undefined, imageRefererUrl: item.imageRefererUrl ?? undefined, source: 'offerQueue', queueId: queue.id })
    await db.$transaction([
      db.offerQueueItem.updateMany({ where: { id: item.id, queueId: queue.id, userId: queue.userId, status: 'queued' }, data: { status: 'sent', sentAt: now, lastError: null } }),
      db.offerQueue.updateMany({ where: { id: queue.id, userId: queue.userId }, data: { lastSentAt: now } }),
    ])
    return { sent: item.id }
  } catch (error) {
    // Falha transitória ganha retry com backoff; tentativas esgotadas viram
    // 'failed' terminal com o motivo registrado (antes: 'failed' direto na
    // primeira falha, sem retry e sem lastError).
    const terminal = attemptCount >= OFFER_QUEUE_MAX_ATTEMPTS
    await db.offerQueueItem.updateMany({
      where: { id: item.id, queueId: queue.id, userId: queue.userId, status: 'queued' },
      data: terminal
        ? { status: 'failed', lastError: truncateError(error) }
        : { status: 'pending', claimedAt: null, nextAttemptAt: new Date(now.getTime() + getOfferQueueRetryDelayMs(attemptCount)), lastError: truncateError(error) },
    })
    return terminal ? { failed: item.id, error } : { retrying: item.id, attemptCount, error }
  }
}
