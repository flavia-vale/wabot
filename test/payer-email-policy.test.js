import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyPayerEmail, isFallbackPayerEmail, isValidPayerEmailFormat } from '../src/domain/payments/payerEmail.js'

test('e-mail real e bem-formado passa (retorna null)', () => {
  assert.equal(classifyPayerEmail('flavia.vale@usp.br'), null)
  assert.equal(classifyPayerEmail('cliente@gmail.com'), null)
  assert.equal(classifyPayerEmail('  Cliente@Gmail.com  '), null)
})

test('e-mail ausente é bloqueado com reason=missing', () => {
  for (const v of [null, undefined, '', '   ', 123]) {
    const issue = classifyPayerEmail(v)
    assert.equal(issue?.reason, 'missing')
    assert.ok(issue.message.length > 0)
  }
})

test('fallback @sistema.com é bloqueado com reason=fallback', () => {
  const issue = classifyPayerEmail('user_a1b2c3@sistema.com')
  assert.equal(issue?.reason, 'fallback')
  assert.ok(isFallbackPayerEmail('user_a1b2c3@sistema.com'))
  assert.ok(isFallbackPayerEmail('USER_X@SISTEMA.COM'))
  assert.ok(!isFallbackPayerEmail('cliente@gmail.com'))
})

test('formato inválido é bloqueado com reason=invalid_format', () => {
  for (const v of ['semarroba', 'a@b', 'a@b@c.com', 'sem@dominio', '@gmail.com']) {
    const issue = classifyPayerEmail(v)
    assert.equal(issue?.reason, 'invalid_format', `esperado invalid_format para ${v}`)
  }
})

test('isValidPayerEmailFormat aceita/rejeita coerentemente', () => {
  assert.ok(isValidPayerEmailFormat('a@b.co'))
  assert.ok(!isValidPayerEmailFormat('a@b'))
  assert.ok(!isValidPayerEmailFormat(''))
  assert.ok(!isValidPayerEmailFormat(null))
})
