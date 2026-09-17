import test from 'node:test'
import assert from 'node:assert/strict'

import {
  FEATURE_CODES,
  buildFeatureGateError,
  canUseAdvancedPreservation,
  canUseChannels,
  canUseOfferAutomations,
  canUseOfferQueues,
  canUseInstagramStories,
  getPlanEntitlements,
  isPreservationActive,
  normalizePlan,
} from '../src/billing/plans.js'

test('normalizePlan keeps known plans and falls back to trial', () => {
  assert.equal(normalizePlan('basic'), 'basic')
  assert.equal(normalizePlan('PRO'), 'pro')
  assert.equal(normalizePlan('PREMIUM'), 'premium')
  assert.equal(normalizePlan('unknown'), 'trial')
  assert.equal(normalizePlan(null), 'trial')
})

test('Instagram Stories pertence exclusivamente ao plano futuro acima do Pro', () => {
  const activeTrial = { plan: 'trial', accessExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
  assert.equal(canUseInstagramStories({ plan: 'basic' }), false)
  assert.equal(canUseInstagramStories({ plan: 'pro' }), false)
  assert.equal(canUseInstagramStories(activeTrial), false)
  assert.equal(canUseInstagramStories({ plan: 'premium' }), true)
})

test('basic can use groups but cannot use channels or advanced preservation', () => {
  const entitlements = getPlanEntitlements({ plan: 'basic' })
  assert.equal(entitlements.canUseGroups, true)
  assert.equal(entitlements.canUseChannels, false)
  assert.equal(entitlements.canUseAdvancedPreservation, false)
  assert.equal(canUseChannels({ plan: 'basic' }), false)
  assert.equal(canUseAdvancedPreservation({ plan: 'basic' }), false)
})

test('basic cannot use offer automations or offer queues', () => {
  const entitlements = getPlanEntitlements({ plan: 'basic' })
  assert.equal(entitlements.canUseOfferAutomations, false)
  assert.equal(entitlements.canUseOfferQueues, false)
  assert.equal(canUseOfferAutomations({ plan: 'basic' }), false)
  assert.equal(canUseOfferQueues({ plan: 'basic' }), false)
})

test('pro and active trial can use offer automations and offer queues', () => {
  assert.equal(canUseOfferAutomations({ plan: 'pro' }), true)
  assert.equal(canUseOfferQueues({ plan: 'pro' }), true)
  const accessExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  assert.equal(canUseOfferAutomations({ plan: 'trial', accessExpiresAt }), true)
  assert.equal(canUseOfferQueues({ plan: 'trial', accessExpiresAt }), true)
})

test('expired trial loses offer automations and offer queues', () => {
  const accessExpiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000)
  assert.equal(canUseOfferAutomations({ plan: 'trial', accessExpiresAt }), false)
  assert.equal(canUseOfferQueues({ plan: 'trial', accessExpiresAt }), false)
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

test('isPreservationActive requires plan access and at least one enabled defense', () => {
  assert.equal(isPreservationActive({ active: true }, {}), false)
  assert.equal(isPreservationActive({ active: true }, null), false)
  assert.equal(isPreservationActive({ active: false }, { followGuardEnabled: true }), false)
  // Plano B/Fase 3: throttle/quiet viraram config por destino (sempre ativa) e
  // NÃO definem mais "preservação ativa" da conta — sozinhos não ativam o módulo.
  assert.equal(isPreservationActive({ active: true }, { channelThrottleEnabled: true }), false)
  assert.equal(isPreservationActive({ active: true }, { quietHoursEnabled: true }), false)
  // As features opcionais que seguem globais continuam ativando.
  assert.equal(isPreservationActive({ active: true }, { followGuardEnabled: true }), true)
  assert.equal(isPreservationActive({ active: true }, { copyVariationEnabled: true }), true)
  assert.equal(isPreservationActive({ active: true }, { imageMutationActive: true }), true)
  assert.equal(isPreservationActive({ active: true }, { probeEnabled: true }), true)
})

test('isPreservationActive accepts a boolean plan-access shorthand', () => {
  assert.equal(isPreservationActive(true, { copyVariationEnabled: true }), true)
  assert.equal(isPreservationActive(false, { copyVariationEnabled: true }), false)
  assert.equal(isPreservationActive(true, { copyVariationEnabled: false }), false)
})


test('PRESERVATION_FEATURE_SELECT cobre exatamente os flags usados no runtime', async () => {
  const { PRESERVATION_FEATURE_SELECT } = await import('../src/billing/plans.js')
  // Plano B / Fase 3: throttle/quiet saíram (viraram config por destino).
  assert.deepEqual(Object.keys(PRESERVATION_FEATURE_SELECT).sort(), [
    'copyVariationEnabled',
    'followGuardEnabled',
    'imageMutationActive',
    'probeEnabled',
  ])
  assert.equal(isPreservationActive(true, { preservationEnabled: true }), false, 'toggle mestre legado não pode reativar o módulo')
  assert.equal(isPreservationActive(true, { imageMutationEnabled: true }), false, 'preferência legada da imagem não é o opt-in')
})

test('buildFeatureGateError returns stable upgrade payload', () => {
  assert.deepEqual(buildFeatureGateError(FEATURE_CODES.CHANNELS), {
    error: 'Canais estão disponíveis no Trial ativo e no plano Pro.',
    code: 'FEATURE_REQUIRES_PRO',
    feature: 'channels',
    requiredPlan: 'pro',
  })
})

test('Instagram Stories retorna gate específico do plano superior', () => {
  assert.deepEqual(buildFeatureGateError(FEATURE_CODES.INSTAGRAM_STORIES), {
    error: 'A publicação de Stories no Instagram estará disponível em um novo plano acima do Pro.',
    code: 'FEATURE_REQUIRES_PREMIUM',
    feature: 'instagram_stories',
    requiredPlan: 'premium',
  })
})

test('buildFeatureGateError covers offer automations and offer queues', () => {
  assert.deepEqual(buildFeatureGateError(FEATURE_CODES.OFFER_AUTOMATIONS), {
    error: 'As ofertas automáticas estão disponíveis no Trial ativo e no plano Pro.',
    code: 'FEATURE_REQUIRES_PRO',
    feature: 'offer_automations',
    requiredPlan: 'pro',
  })
  assert.deepEqual(buildFeatureGateError(FEATURE_CODES.OFFER_QUEUES), {
    error: 'As filas de ofertas estão disponíveis no Trial ativo e no plano Pro.',
    code: 'FEATURE_REQUIRES_PRO',
    feature: 'offer_queues',
    requiredPlan: 'pro',
  })
})
