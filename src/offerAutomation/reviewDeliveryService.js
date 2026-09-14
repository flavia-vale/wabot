import dbDefault from '../db.js'
import { sendBroadcast as sendBroadcastDefault, isRunning as isRunningDefault } from '../manager.js'
import { createAndEnqueueStory } from '../instagram/storyDeliveryService.js'
import { getInstagramDeliveryRuntime } from '../instagram/publishing/runtime.js'
import { DELIVERY_SOURCE_TYPE } from '../domain/delivery/constants.js'
import { claimNextReviewItem } from './reviewRepository.js'
import { REVIEW_STATUS } from './reviewState.js'

export const REVIEW_ITEM_LEASE_MS = Math.max(60_000, Number(process.env.OFFER_AUTOMATION_REVIEW_LEASE_MS) || 5 * 60_000)
export const REVIEW_ITEM_MAX_ATTEMPTS = Math.max(1, Number(process.env.OFFER_AUTOMATION_REVIEW_MAX_ATTEMPTS) || 3)
const deliveryLocks = new Set()

function parse(value, fallback) { try { return JSON.parse(value) } catch { return fallback } }
function retryDelay(attempt) { return Math.min(60_000 * (2 ** Math.max(0, attempt - 1)), 3_600_000) }
function addSent(existing, itemId) {
  const values = [...new Set([...parse(existing || '[]', []), String(itemId)])]
  return JSON.stringify(values.slice(-200))
}

export async function recoverReviewItems(deps = {}) {
  const db = deps.db ?? dbDefault
  const now = deps.now ? deps.now() : new Date()
  const cutoff = new Date(now.getTime() - REVIEW_ITEM_LEASE_MS)
  await db.offerAutomationReviewItem.updateMany({ where: { status: { in: [REVIEW_STATUS.AWAITING, REVIEW_STATUS.APPROVED] }, expiresAt: { lte: now } }, data: { status: REVIEW_STATUS.EXPIRED } })
  const failed = await db.offerAutomationReviewItem.updateMany({ where: { status: REVIEW_STATUS.SENDING, claimedAt: { lt: cutoff }, attemptCount: { gte: REVIEW_ITEM_MAX_ATTEMPTS } }, data: { status: REVIEW_STATUS.FAILED, lastError: 'Tempo de envio esgotado' } })
  const recovered = await db.offerAutomationReviewItem.updateMany({ where: { status: REVIEW_STATUS.SENDING, claimedAt: { lt: cutoff }, attemptCount: { lt: REVIEW_ITEM_MAX_ATTEMPTS } }, data: { status: REVIEW_STATUS.APPROVED, claimedAt: null, lastError: 'Envio interrompido; nova tentativa agendada' } })
  const retentionCutoff = new Date(now.getTime() - Math.max(7, Number(process.env.OFFER_AUTOMATION_REVIEW_RETENTION_DAYS) || 30) * 24 * 60 * 60_000)
  const pruned = await db.offerAutomationReviewItem.deleteMany({ where: { status: { in: [REVIEW_STATUS.SENT, REVIEW_STATUS.REMOVED, REVIEW_STATUS.EXPIRED] }, updatedAt: { lt: retentionCutoff } } })
  return { recovered: recovered.count, failed: failed.count, pruned: pruned.count }
}

export async function deliverApprovedReviewItems(automation, deps = {}) {
  const key = `${automation.userId}:${automation.id}`
  if (deliveryLocks.has(key)) return { skipped: 'review_busy' }
  deliveryLocks.add(key)
  try {
    const db = deps.db ?? dbDefault
    const now = deps.now ? deps.now() : new Date()
    const sendBroadcast = deps.sendBroadcast ?? sendBroadcastDefault
    const isRunning = deps.isRunning ?? isRunningDefault
    const sendStory = deps.sendStory ?? createAndEnqueueStory
    const runtime = deps.instagramRuntime === undefined ? getInstagramDeliveryRuntime() : deps.instagramRuntime
    let sent = 0
    const failed = []
    for (let index = 0; index < automation.offersPerSend; index++) {
      const item = await claimNextReviewItem(db, { userId: automation.userId, automationId: automation.id, now })
      if (!item) break
      const targets = parse(item.targetSnapshot, {})
      const progress = parse(item.deliverySnapshot, {})
      progress.instagram ||= []
      try {
        // Items created before the price validation fix may already be in the
        // review queue. Never publish those stale snapshots without a price;
        // failing permanently is safer than retrying the same invalid content.
        if (!Number.isSafeInteger(item.priceCents) || item.priceCents <= 0) {
          throw Object.assign(new Error('Oferta sem preço válido; busque novas opções'), { permanent: true })
        }
        if (targets.whatsapp?.jid && !progress.whatsapp) {
          if (!await isRunning(automation.userId)) throw new Error('Bot não está conectado')
          await sendBroadcast(automation.userId, item.renderedText, [targets.whatsapp.jid], { imageUrl: item.imageUrl || undefined, imageRefererUrl: item.imageRefererUrl || undefined, source: 'offerAutomation' })
          progress.whatsapp = true
          await db.offerAutomationReviewItem.updateMany({ where: { id: item.id, status: REVIEW_STATUS.SENDING }, data: { deliverySnapshot: JSON.stringify(progress) } })
        }
        const product = parse(item.productSnapshot, {})
        for (const destination of targets.instagram || []) {
          if (progress.instagram.includes(destination.id)) continue
          if (!runtime) throw new Error('Fila do Instagram indisponível')
          await sendStory({ userId: automation.userId, destinationId: destination.id, sourceType: DELIVERY_SOURCE_TYPE.OFFER_AUTOMATION, sourceId: automation.id, idempotencyKey: `offer-review:${item.id}:${destination.id}`, offer: { ...product, offerKey: item.itemId, priceCents: item.priceCents, productUrl: item.productUrl, imageUrl: item.imageUrl } }, runtime)
          progress.instagram.push(destination.id)
          await db.offerAutomationReviewItem.updateMany({ where: { id: item.id, status: REVIEW_STATUS.SENDING }, data: { deliverySnapshot: JSON.stringify(progress) } })
        }
        await db.$transaction(async tx => {
          await tx.offerAutomationReviewItem.updateMany({ where: { id: item.id, userId: automation.userId, automationId: automation.id, status: REVIEW_STATUS.SENDING }, data: { status: REVIEW_STATUS.SENT, sentAt: now, claimedAt: null, lastError: null, deliverySnapshot: JSON.stringify(progress) } })
          await tx.offerAutomation.update({ where: { id: automation.id }, data: { lastSentAt: now, sentItemIds: addSent(automation.sentItemIds, item.itemId) } })
          if (targets.whatsapp?.jid) await tx.offerAutomationSentLog.create({ data: { userId: automation.userId, destGroupJid: targets.whatsapp.jid, productKey: item.productKey, priceCents: item.priceCents, itemId: item.itemId } })
        })
        automation.sentItemIds = addSent(automation.sentItemIds, item.itemId)
        sent++
      } catch (error) {
        const terminal = error.permanent === true || item.attemptCount >= REVIEW_ITEM_MAX_ATTEMPTS
        await db.offerAutomationReviewItem.updateMany({ where: { id: item.id, status: REVIEW_STATUS.SENDING }, data: terminal ? { status: REVIEW_STATUS.FAILED, claimedAt: null, lastError: String(error.message).slice(0, 500) } : { status: REVIEW_STATUS.APPROVED, claimedAt: null, nextAttemptAt: new Date(now.getTime() + retryDelay(item.attemptCount)), lastError: String(error.message).slice(0, 500), deliverySnapshot: JSON.stringify(progress) } })
        failed.push(item.id)
      }
    }
    return { sent, failed: failed.length }
  } finally { deliveryLocks.delete(key) }
}
