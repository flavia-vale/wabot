import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FEATURE_CODES,
  PLAN_IDS,
  canUseMultiNetwork,
  buildFeatureGateError,
} from '../src/billing/plans.js'

// Feature 017 (arquitetura multicanal de entrega), D2/FR-046/FR-048.
//
// O multicanal é recurso de plano SUPERIOR (Premium), com código próprio —
// NUNCA reaproveitando `channels` (que já significa Canal do WhatsApp). Ao
// contrário de Canal/preservação/automações/filas (liberados no Trial ativo
// e no Pro), o multicanal NÃO é herdado pelo Trial nem pelo Pro — mesmo
// padrão de canUseInstagramStories, porque reaproveita a MESMA reserva de
// plano (PLAN_IDS.PREMIUM).

test('FEATURE_CODES.MULTI_NETWORK existe e é distinto de "channels"', () => {
  assert.equal(FEATURE_CODES.MULTI_NETWORK, 'multi_network')
  assert.notEqual(FEATURE_CODES.MULTI_NETWORK, FEATURE_CODES.CHANNELS)
})

test('canUseMultiNetwork: false para trial (mesmo ativo), basic e pro', () => {
  const now = new Date('2026-09-23T12:00:00Z')
  const future = new Date('2026-12-01T00:00:00Z')

  assert.equal(canUseMultiNetwork({ plan: PLAN_IDS.BASIC }, { now }), false)
  assert.equal(canUseMultiNetwork({ plan: PLAN_IDS.PRO }, { now }), false)
  assert.equal(canUseMultiNetwork({ plan: PLAN_IDS.TRIAL, accessExpiresAt: future }, { now }), false, 'trial ATIVO também não pode usar multicanal')
  assert.equal(canUseMultiNetwork({ plan: PLAN_IDS.TRIAL, accessExpiresAt: null }, { now }), false)
})

test('canUseMultiNetwork: true só para premium', () => {
  assert.equal(canUseMultiNetwork({ plan: PLAN_IDS.PREMIUM }), true)
})

test('buildFeatureGateError(MULTI_NETWORK) nunca devolve frase seca do tipo "seu plano não permite"', () => {
  const result = buildFeatureGateError(FEATURE_CODES.MULTI_NETWORK)
  assert.equal(result.feature, FEATURE_CODES.MULTI_NETWORK)
  assert.equal(result.requiredPlan, PLAN_IDS.PREMIUM)
  assert.doesNotMatch(result.error.toLowerCase(), /seu plano n[ãa]o permite/)
  assert.ok(result.error.length > 10, 'a explicação precisa dizer o que o recurso faz, não só recusar')
})

test('buildFeatureGateError(MULTI_NETWORK) não menciona preço (decisão comercial separada)', () => {
  const result = buildFeatureGateError(FEATURE_CODES.MULTI_NETWORK)
  assert.doesNotMatch(result.error, /R\$/)
})
