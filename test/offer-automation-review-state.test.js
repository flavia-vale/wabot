import test from 'node:test'
import assert from 'node:assert/strict'
import { REVIEW_STATUS, canTransitionReviewItem, reviewTransition } from '../src/offerAutomation/reviewState.js'
import { canDeliverReview, canUseReview, reviewDeliveryEnabled, reviewFeatureEnabled } from '../src/offerAutomation/reviewFlags.js'

test('flags da revisão são fail-closed e respeitam allowlist', () => {
  assert.equal(reviewFeatureEnabled({}), false)
  assert.equal(reviewFeatureEnabled({ OFFER_AUTOMATION_REVIEW_ENABLED: '1' }), false)
  assert.equal(reviewDeliveryEnabled({ OFFER_AUTOMATION_REVIEW_ENABLED: 'true', OFFER_AUTOMATION_REVIEW_DELIVERY_ENABLED: 'true' }), true)
  const env = { OFFER_AUTOMATION_REVIEW_ENABLED: 'true', OFFER_AUTOMATION_REVIEW_DELIVERY_ENABLED: 'true', OFFER_AUTOMATION_REVIEW_USER_IDS: 'u1,u2' }
  assert.equal(canUseReview('u1', env), true)
  assert.equal(canUseReview('u3', env), false)
  assert.equal(canDeliverReview('u2', env), true)
})

test('máquina de estados não permite publicar sem aprovação', () => {
  assert.equal(canTransitionReviewItem(REVIEW_STATUS.AWAITING, REVIEW_STATUS.SENDING), false)
  assert.equal(canTransitionReviewItem(REVIEW_STATUS.AWAITING, REVIEW_STATUS.SENT), false)
  assert.equal(canTransitionReviewItem(REVIEW_STATUS.AWAITING, REVIEW_STATUS.APPROVED), true)
  assert.equal(canTransitionReviewItem(REVIEW_STATUS.APPROVED, REVIEW_STATUS.SENDING), true)
  assert.equal(canTransitionReviewItem(REVIEW_STATUS.SENDING, REVIEW_STATUS.SENT), true)
  assert.deepEqual(reviewTransition(REVIEW_STATUS.SENT, REVIEW_STATUS.APPROVED), { ok: false, code: 'invalid_transition' })
})
