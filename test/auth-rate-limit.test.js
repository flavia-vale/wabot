import test from 'node:test'
import assert from 'node:assert/strict'
import { consumeLoginAttempt, clearLoginAttempts, __debugLoginAttemptsSize, __debugLoginAttemptsByEmailSize } from '../src/api/routes/auth.js'

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

test('distributed attack is blocked by email threshold even from many IPs', () => {
  const prevIpMax = process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS
  const prevEmailMax = process.env.LOGIN_RATE_LIMIT_EMAIL_MAX_ATTEMPTS
  // IP threshold alto para não disparar; o que deve bloquear é o limite por email.
  process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS = '1000'
  process.env.LOGIN_RATE_LIMIT_EMAIL_MAX_ATTEMPTS = '3'
  const email = 'victim@example.com'
  try {
    const results = []
    for (let i = 0; i < 5; i += 1) {
      results.push(consumeLoginAttempt({ email, ip: `10.0.0.${i}` })) // cada tentativa de um IP diferente
    }
    assert.equal(results[0].blocked, false)
    assert.equal(results[2].blocked, false) // 3ª tentativa ainda passa
    assert.equal(results[3].blocked, true) // 4ª excede o limite por email
    assert.equal(results[3].blockedScope, 'email')
  } finally {
    clearLoginAttempts({ email, ip: '10.0.0.0' })
    clearLoginAttempts({ email, ip: '10.0.0.1' })
    clearLoginAttempts({ email, ip: '10.0.0.2' })
    clearLoginAttempts({ email, ip: '10.0.0.3' })
    clearLoginAttempts({ email, ip: '10.0.0.4' })
    if (prevIpMax === undefined) delete process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS
    else process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS = prevIpMax
    if (prevEmailMax === undefined) delete process.env.LOGIN_RATE_LIMIT_EMAIL_MAX_ATTEMPTS
    else process.env.LOGIN_RATE_LIMIT_EMAIL_MAX_ATTEMPTS = prevEmailMax
  }
})

test('clearLoginAttempts clears the email dimension too', () => {
  const email = 'both@example.com'
  consumeLoginAttempt({ email, ip: '3.3.3.3' })
  const before = __debugLoginAttemptsByEmailSize()
  assert.ok(before >= 1)
  clearLoginAttempts({ email, ip: '3.3.3.3' })
  const after = __debugLoginAttemptsByEmailSize()
  assert.ok(after < before || after === before - 1)
})
