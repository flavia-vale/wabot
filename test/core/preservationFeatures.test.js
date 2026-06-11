import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PRESERVATION_FEATURE,
  isPreservationFeatureEnabled,
  shouldRunChannelScheduler,
} from '../../src/core/preservationFeatures.js'

test('cada funcionalidade depende simultaneamente do plano/módulo efetivo e do próprio toggle', () => {
  for (const feature of Object.values(PRESERVATION_FEATURE)) {
    assert.equal(isPreservationFeatureEnabled(true, { [feature]: true }, feature), true, feature)
    assert.equal(isPreservationFeatureEnabled(true, { [feature]: false }, feature), false, feature)
    assert.equal(isPreservationFeatureEnabled(false, { [feature]: true }, feature), false, feature)
    assert.equal(isPreservationFeatureEnabled(true, {}, feature), false, feature)
  }
})

test('um toggle não ativa outra funcionalidade', () => {
  const features = Object.values(PRESERVATION_FEATURE)
  for (const enabled of features) {
    for (const checked of features) {
      assert.equal(
        isPreservationFeatureEnabled(true, { [enabled]: true }, checked),
        enabled === checked,
        `${enabled} não deve ativar ${checked}`,
      )
    }
  }
})

test('scheduler roda somente para throttle ou janela silenciosa', () => {
  assert.equal(shouldRunChannelScheduler(true, { channelThrottleEnabled: true }), true)
  assert.equal(shouldRunChannelScheduler(true, { quietHoursEnabled: true }), true)
  assert.equal(shouldRunChannelScheduler(true, { copyVariationEnabled: true }), false)
  assert.equal(shouldRunChannelScheduler(true, { imageMutationActive: true }), false)
  assert.equal(shouldRunChannelScheduler(false, { channelThrottleEnabled: true, quietHoursEnabled: true }), false)
})

test('nomes legados não são aceitos como opt-in de mutação', () => {
  assert.equal(isPreservationFeatureEnabled(true, { imageMutationEnabled: true }, PRESERVATION_FEATURE.IMAGE_MUTATION), false)
  assert.equal(isPreservationFeatureEnabled(true, { imageMutationActive: true }, PRESERVATION_FEATURE.IMAGE_MUTATION), true)
})
