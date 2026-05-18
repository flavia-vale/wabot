import test from 'node:test'
import assert from 'node:assert/strict'

import {
  FEATURE_CODES,
  buildFeatureGateError,
  canUseAdvancedPreservation,
  canUseChannels,
  getPlanEntitlements,
  normalizePlan,
} from '../src/billing/plans.js'

test('normalizePlan keeps known plans and falls back to trial', () => {
  assert.equal(normalizePlan('basic'), 'basic')
  assert.equal(normalizePlan('PRO'), 'pro')
  assert.equal(normalizePlan('unknown'), 'trial')
  assert.equal(normalizePlan(null), 'trial')
})

test('basic can use groups but cannot use channels or advanced preservation', () => {
  const entitlements = getPlanEntitlements({ plan: 'basic' })
  assert.equal(entitlements.canUseGroups, true)
  assert.equal(entitlements.canUseChannels, false)
  assert.equal(entitlements.canUseAdvancedPreservation, false)
  assert.equal(canUseChannels({ plan: 'basic' }), false)
  assert.equal(canUseAdvancedPreservation({ plan: 'basic' }), false)
})

test('active trial has temporary Pro-like channel and preservation access', () => {
  const accessExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const entitlements = getPlanEntitlements({ plan: 'trial', accessExpiresAt })
  assert.equal(entitlements.canUseGroups, true)
  assert.equal(entitlements.canUseChannels, true)
  assert.equal(entitlements.canUseAdvancedPreservation, true)
  assert.equal(entitlements.isTrialActive, true)
})

test('expired trial loses channel and advanced preservation access', () => {
  const accessExpiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const entitlements = getPlanEntitlements({ plan: 'trial', accessExpiresAt })
  assert.equal(entitlements.canUseGroups, true)
  assert.equal(entitlements.canUseChannels, false)
  assert.equal(entitlements.canUseAdvancedPreservation, false)
  assert.equal(entitlements.isTrialActive, false)
})

test('pro can use channels and advanced preservation', () => {
  assert.equal(canUseChannels({ plan: 'pro' }), true)
  assert.equal(canUseAdvancedPreservation({ plan: 'pro' }), true)
})

test('buildFeatureGateError returns stable upgrade payload', () => {
  assert.deepEqual(buildFeatureGateError(FEATURE_CODES.CHANNELS), {
    error: 'Canais estão disponíveis no Trial ativo e no plano Pro.',
    code: 'FEATURE_REQUIRES_PRO',
    feature: 'channels',
    requiredPlan: 'pro',
  })
})
