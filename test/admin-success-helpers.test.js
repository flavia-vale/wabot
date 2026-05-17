import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getSuggestedAction,
  computePriorityScore,
  scoreFinancialWeight,
  selectContactExperimentVariant,
} from '../src/api/routes/admin.js'

test('getSuggestedAction retorna ação por motivo prioritário', () => {
  assert.equal(getSuggestedAction(['wa_disconnected']), 'Reconectar WhatsApp e validar sessão')
  assert.equal(getSuggestedAction(['onboarding_incomplete']), 'Concluir onboarding (credenciais e grupos)')
  assert.equal(getSuggestedAction(['unknown_reason']), 'Realizar contato de diagnóstico')
})

test('computePriorityScore considera risco + expiração + peso financeiro', () => {
  const high = computePriorityScore({
    riskFlags: ['wa_disconnected', 'high_errors_24h', 'expiring_soon'],
    errorCount24h: 8,
    accessExpiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastSupportContactAt: null,
    financialWeight: 20,
  })
  const low = computePriorityScore({
    riskFlags: [],
    errorCount24h: 0,
    accessExpiresAt: null,
    lastSupportContactAt: new Date().toISOString(),
    financialWeight: 0,
  })
  assert.ok(high > low)
  assert.ok(high <= 100)
})

test('scoreFinancialWeight pondera plano e pagamentos', () => {
  assert.equal(scoreFinancialWeight({ plan: 'pro', _count: { payments: 2 } }), 30)
  assert.equal(scoreFinancialWeight({ plan: 'basic', _count: { payments: 0 } }), 12)
  assert.equal(scoreFinancialWeight({ plan: 'trial', _count: { payments: 0 } }), 4)
})

test('selectContactExperimentVariant é determinístico por usuário e estratégia', () => {
  const a = selectContactExperimentVariant('user-123', 'risk_first')
  const b = selectContactExperimentVariant('user-123', 'risk_first')
  const c = selectContactExperimentVariant('user-123', 'value_first')
  assert.equal(a, b)
  assert.ok(['risk_copy_a', 'risk_copy_b'].includes(a))
  assert.ok(['value_copy_a', 'value_copy_b'].includes(c))
})
