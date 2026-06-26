import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PRESERVATION_FEATURE,
  ACCOUNT_PRESERVATION_FEATURES,
  isPreservationFeatureEnabled,
  shouldMutateOutgoingImage,
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

test('Plano B/Fase 3: features de conta excluem throttle/quiet (que viraram por destino)', () => {
  assert.ok(ACCOUNT_PRESERVATION_FEATURES.includes(PRESERVATION_FEATURE.FOLLOW_GUARD))
  assert.ok(ACCOUNT_PRESERVATION_FEATURES.includes(PRESERVATION_FEATURE.COPY_VARIATION))
  assert.ok(ACCOUNT_PRESERVATION_FEATURES.includes(PRESERVATION_FEATURE.IMAGE_MUTATION))
  assert.ok(ACCOUNT_PRESERVATION_FEATURES.includes(PRESERVATION_FEATURE.PROBE))
  assert.ok(!ACCOUNT_PRESERVATION_FEATURES.includes(PRESERVATION_FEATURE.CHANNEL_THROTTLE))
  assert.ok(!ACCOUNT_PRESERVATION_FEATURES.includes(PRESERVATION_FEATURE.QUIET_HOURS))
})

test('nomes legados não são aceitos como opt-in de mutação', () => {
  assert.equal(isPreservationFeatureEnabled(true, { imageMutationEnabled: true }, PRESERVATION_FEATURE.IMAGE_MUTATION), false)
  assert.equal(isPreservationFeatureEnabled(true, { imageMutationActive: true }, PRESERVATION_FEATURE.IMAGE_MUTATION), true)
})

// shouldMutateOutgoingImage aceita canal e grupo (predicado amplo), mas o
// bot-worker NÃO a usa no gate de mutação — usa isChannelDest diretamente
// para evitar dupla compressão JPEG em grupos (vide invariante no bot-worker).
// Esta função existe como ponto de extensão futuro. Não restaurar o uso em
// grupos sem antes unificar normalizeImageForWhatsApp+mutate em um passo só.
test('shouldMutateOutgoingImage: predicado aceita canal e grupo (mas não é usado em grupos no bot-worker)', () => {
  const cfg = { imageMutationActive: true }
  assert.equal(shouldMutateOutgoingImage('123@newsletter', true, cfg), true, 'canal')
  assert.equal(shouldMutateOutgoingImage('123@g.us', true, cfg), true, 'grupo — aceitável no predicado, mas gate real no bot-worker usa isChannelDest')
})

test('mutação respeita o opt-in global e o módulo de preservação', () => {
  assert.equal(shouldMutateOutgoingImage('123@g.us', true, { imageMutationActive: false }), false, 'toggle off')
  assert.equal(shouldMutateOutgoingImage('123@g.us', false, { imageMutationActive: true }), false, 'preservação inativa')
  assert.equal(shouldMutateOutgoingImage('123@g.us', true, {}), false, 'sem config')
})

test('mutação ignora destino que não é canal nem grupo (defensivo)', () => {
  const cfg = { imageMutationActive: true }
  assert.equal(shouldMutateOutgoingImage('5511999@s.whatsapp.net', true, cfg), false, 'DM')
  assert.equal(shouldMutateOutgoingImage('', true, cfg), false, 'vazio')
  assert.equal(shouldMutateOutgoingImage(null, true, cfg), false, 'null')
})
