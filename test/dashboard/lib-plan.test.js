import test from 'node:test'
import assert from 'node:assert/strict'

import { canAccessAdvancedPreservation, isTrialActive } from '../../dashboard/lib/plan.js'

test('isTrialActive: trial com accessExpiresAt futuro é true', () => {
  const future = new Date(Date.now() + 60_000).toISOString()
  assert.equal(isTrialActive({ plan: 'trial', accessExpiresAt: future }), true)
})

test('isTrialActive: trial com accessExpiresAt passado é false', () => {
  const past = new Date(Date.now() - 60_000).toISOString()
  assert.equal(isTrialActive({ plan: 'trial', accessExpiresAt: past }), false)
})

test('isTrialActive: trial sem accessExpiresAt é false', () => {
  assert.equal(isTrialActive({ plan: 'trial', accessExpiresAt: null }), false)
})

test('isTrialActive: plano basic é false mesmo com accessExpiresAt futuro', () => {
  const future = new Date(Date.now() + 60_000).toISOString()
  assert.equal(isTrialActive({ plan: 'basic', accessExpiresAt: future }), false)
})

test('isTrialActive: null/undefined retorna false sem lançar', () => {
  assert.equal(isTrialActive(null), false)
  assert.equal(isTrialActive(undefined), false)
  assert.equal(isTrialActive({}), false)
})

test('isTrialActive: accessExpiresAt inválido retorna false', () => {
  assert.equal(isTrialActive({ plan: 'trial', accessExpiresAt: 'não-é-data' }), false)
})

test('canAccessAdvancedPreservation: pro libera mesmo sem accessExpiresAt', () => {
  assert.equal(canAccessAdvancedPreservation({ plan: 'pro', accessExpiresAt: null }), true)
})

test('canAccessAdvancedPreservation: trial ativo libera', () => {
  const future = new Date(Date.now() + 60_000).toISOString()
  assert.equal(canAccessAdvancedPreservation({ plan: 'trial', accessExpiresAt: future }), true)
})

test('canAccessAdvancedPreservation: trial expirado bloqueia', () => {
  const past = new Date(Date.now() - 60_000).toISOString()
  assert.equal(canAccessAdvancedPreservation({ plan: 'trial', accessExpiresAt: past }), false)
})

test('canAccessAdvancedPreservation: basic bloqueia', () => {
  assert.equal(canAccessAdvancedPreservation({ plan: 'basic', accessExpiresAt: null }), false)
})

test('canAccessAdvancedPreservation: null/undefined retorna false sem lançar', () => {
  assert.equal(canAccessAdvancedPreservation(null), false)
  assert.equal(canAccessAdvancedPreservation(undefined), false)
})
