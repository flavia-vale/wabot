export const REVIEW_STATUS = Object.freeze({
  AWAITING: 'awaiting_review', APPROVED: 'approved', SENDING: 'sending', SENT: 'sent',
  REMOVED: 'removed', EXPIRED: 'expired', FAILED: 'failed',
})

const transitions = new Map([
  [REVIEW_STATUS.AWAITING, new Set([REVIEW_STATUS.APPROVED, REVIEW_STATUS.REMOVED, REVIEW_STATUS.EXPIRED])],
  [REVIEW_STATUS.APPROVED, new Set([REVIEW_STATUS.REMOVED, REVIEW_STATUS.SENDING, REVIEW_STATUS.EXPIRED])],
  [REVIEW_STATUS.SENDING, new Set([REVIEW_STATUS.APPROVED, REVIEW_STATUS.SENT, REVIEW_STATUS.FAILED])],
  [REVIEW_STATUS.FAILED, new Set([REVIEW_STATUS.APPROVED])],
])

export function canTransitionReviewItem(from, to) {
  return from === to || Boolean(transitions.get(from)?.has(to))
}

export function reviewTransition(from, to) {
  if (!canTransitionReviewItem(from, to)) return { ok: false, code: 'invalid_transition' }
  return { ok: true, changed: from !== to, status: to }
}
