import test from 'node:test'
import assert from 'node:assert/strict'
import { STANDARD_TRIAL_DAYS, PROMO_VIP_TRIAL_DAYS } from '../src/api/routes/auth.js'

test('free trial registrations receive seven days of access', () => {
  assert.equal(STANDARD_TRIAL_DAYS, 7)
})

test('VIP promo trial remains aligned with the seven-day trial policy', () => {
  assert.equal(PROMO_VIP_TRIAL_DAYS, 7)
})
