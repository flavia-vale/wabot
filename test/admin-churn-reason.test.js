import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHURN_REASONS, classifyChurnReason, describeChurnReason } from '../src/domain/admin/churnReason.js'

test('sem cobrança automática nunca é a mesma coisa (nunca chama de voluntário)', () => {
  assert.equal(classifyChurnReason({ everHadAutopay: false }), CHURN_REASONS.AMBIGUO_AVULSO)
  assert.equal(classifyChurnReason({ everHadAutopay: false, explicitCancel: true }), CHURN_REASONS.AMBIGUO_AVULSO)
})

test('recusa de cobrança é involuntário mesmo se também há cancelamento registrado depois', () => {
  assert.equal(
    classifyChurnReason({ everHadAutopay: true, hadRejectedChargeAfterFirstPayment: true, explicitCancel: true }),
    CHURN_REASONS.INVOLUNTARIO,
  )
})

test('cancelamento explícito sem recusa é voluntário', () => {
  assert.equal(
    classifyChurnReason({ everHadAutopay: true, explicitCancel: true }),
    CHURN_REASONS.VOLUNTARIO,
  )
})

test('cobrança automática sem recusa nem cancelamento é indeterminado, nunca afirma causa', () => {
  assert.equal(classifyChurnReason({ everHadAutopay: true }), CHURN_REASONS.INDETERMINADO)
})

test('toda categoria tem descrição em linguagem leiga (sem jargão de gateway)', () => {
  for (const reason of Object.values(CHURN_REASONS)) {
    const texto = describeChurnReason(reason)
    assert.ok(texto && texto.length > 5)
    assert.doesNotMatch(texto, /gateway|preapproval|webhook/i)
  }
})
