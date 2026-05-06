import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEmail } from '../src/api/auth-utils.js'

test('normalizes login email with whitespace and casing', () => {
  assert.equal(normalizeEmail('  Flavia.Vale@USP.BR  '), 'flavia.vale@usp.br')
})

test('normalizes missing or non-string email to empty string', () => {
  assert.equal(normalizeEmail(undefined), '')
  assert.equal(normalizeEmail(null), '')
  assert.equal(normalizeEmail(123), '')
})
