import { REVIEW_STATUS } from './reviewState.js'

export async function listReviewItems(db, { userId, automationId, statuses, cursor, limit = 30 }) {
  const take = Math.min(50, Math.max(1, Number(limit) || 30))
  return db.offerAutomationReviewItem.findMany({
    where: { userId, automationId, ...(statuses?.length ? { status: { in: statuses } } : {}) },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
}

export async function reviewCounts(db, userId, automationId) {
  const rows = await db.offerAutomationReviewItem.groupBy({ where: { userId, automationId }, by: ['status'], _count: { _all: true } })
  return Object.fromEntries(rows.map(row => [row.status, row._count._all]))
}

export async function transitionReviewItems(db, { userId, automationId, ids, from, to, now = new Date() }) {
  const uniqueIds = [...new Set(ids)].slice(0, 50)
  if (!uniqueIds.length) return 0
  const result = await db.offerAutomationReviewItem.updateMany({
    where: { id: { in: uniqueIds }, userId, automationId, status: { in: from } },
    data: { status: to, reviewedAt: now, reviewedAction: to, ...(to === REVIEW_STATUS.APPROVED ? { nextAttemptAt: null, lastError: null } : {}) },
  })
  return result.count
}

export async function claimNextReviewItem(db, { userId, automationId, now = new Date() }) {
  const item = await db.offerAutomationReviewItem.findFirst({
    where: { userId, automationId, status: REVIEW_STATUS.APPROVED, expiresAt: { gt: now }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  })
  if (!item) return null
  const claim = await db.offerAutomationReviewItem.updateMany({
    where: { id: item.id, userId, automationId, status: REVIEW_STATUS.APPROVED },
    data: { status: REVIEW_STATUS.SENDING, claimedAt: now, attemptCount: { increment: 1 } },
  })
  return claim.count === 1 ? { ...item, attemptCount: item.attemptCount + 1, claimedAt: now } : null
}
