import test from 'node:test'
import assert from 'node:assert/strict'
import { consumeLoginAttempt, clearLoginAttempts, __debugLoginAttemptsSize } from '../src/api/routes/auth.js'

test('login attempts are blocked after configured threshold', () => {
  const prevMax = process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS
  process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS = '2'
  try {
    const a1 = consumeLoginAttempt({ email: 'u@example.com', ip: '1.1.1.1' })
    const a2 = consumeLoginAttempt({ email: 'u@example.com', ip: '1.1.1.1' })
    const a3 = consumeLoginAttempt({ email: 'u@example.com', ip: '1.1.1.1' })
    assert.equal(a1.blocked, false)
    assert.equal(a2.blocked, false)
    assert.equal(a3.blocked, true)
  } finally {
    clearLoginAttempts({ email: 'u@example.com', ip: '1.1.1.1' })
    if (prevMax === undefined) delete process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS
    else process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS = prevMax
  }
})

test('clearLoginAttempts removes tracked key', () => {
  consumeLoginAttempt({ email: 'c@example.com', ip: '2.2.2.2' })
  const before = __debugLoginAttemptsSize()
  clearLoginAttempts({ email: 'c@example.com', ip: '2.2.2.2' })
  const after = __debugLoginAttemptsSize()
  assert.ok(before >= after)
})
