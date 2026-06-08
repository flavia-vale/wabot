import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import {
  encryptCredential,
  decryptCredential,
  validateEncryptionKey,
  isEncryptionConfigured,
  __testing,
} from '../src/credentialCrypto.js'

const VALID_KEY = randomBytes(32).toString('hex')

function withKey(key, fn) {
  const prev = process.env.CREDENTIAL_ENCRYPTION_KEY
  if (key === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY
  else process.env.CREDENTIAL_ENCRYPTION_KEY = key
  try {
    return fn()
  } finally {
    if (prev === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY
    else process.env.CREDENTIAL_ENCRYPTION_KEY = prev
  }
}

test('encrypt then decrypt round-trips the plaintext', () => {
  withKey(VALID_KEY, () => {
    const plaintext = JSON.stringify({ cookie: 'session=abc123', tag: 'aff-99' })
    const ciphertext = encryptCredential(plaintext)
    assert.ok(ciphertext.startsWith('v1:'))
    assert.notEqual(ciphertext, plaintext)
    assert.equal(decryptCredential(ciphertext), plaintext)
  })
})

test('ciphertext is non-deterministic (random IV per call)', () => {
  withKey(VALID_KEY, () => {
    const a = encryptCredential('same input')
    const b = encryptCredential('same input')
    assert.notEqual(a, b)
    assert.equal(decryptCredential(a), 'same input')
    assert.equal(decryptCredential(b), 'same input')
  })
})

test('decrypt is transparent for legacy plaintext (no v1: prefix)', () => {
  withKey(VALID_KEY, () => {
    const legacy = JSON.stringify({ tag: 'plaintext-legacy' })
    assert.equal(decryptCredential(legacy), legacy)
  })
})

test('encrypt is idempotent — does not re-encrypt already-encrypted value', () => {
  withKey(VALID_KEY, () => {
    const once = encryptCredential('payload')
    const twice = encryptCredential(once)
    assert.equal(once, twice)
    assert.equal(decryptCredential(twice), 'payload')
  })
})

test('without key configured, encrypt/decrypt are no-ops (db-free tests)', () => {
  withKey(undefined, () => {
    assert.equal(isEncryptionConfigured(), false)
    assert.equal(encryptCredential('hello'), 'hello')
    assert.equal(decryptCredential('hello'), 'hello')
  })
})

test('tampered ciphertext fails GCM auth and returns stored value (no throw)', () => {
  withKey(VALID_KEY, () => {
    const ciphertext = encryptCredential('sensitive')
    const parts = ciphertext.split(':')
    // corrompe o último byte do ciphertext
    const ct = parts[3]
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${ct.slice(0, -2)}${ct.slice(-2) === 'ff' ? '00' : 'ff'}`
    const result = decryptCredential(tampered)
    assert.notEqual(result, 'sensitive') // não decifra adulterado
  })
})

test('validateEncryptionKey rejects missing key', () => {
  withKey(undefined, () => {
    assert.throws(() => validateEncryptionKey(), /ausente/)
  })
})

test('validateEncryptionKey rejects malformed key', () => {
  withKey('not-hex-and-too-short', () => {
    assert.throws(() => validateEncryptionKey(), /inválida/)
  })
})

test('validateEncryptionKey accepts valid 64-char hex key', () => {
  withKey(VALID_KEY, () => {
    assert.equal(validateEncryptionKey(), true)
  })
})

test('isEncrypted helper detects v1 prefix', () => {
  assert.equal(__testing.isEncrypted('v1:a:b:c'), true)
  assert.equal(__testing.isEncrypted('plain'), false)
  assert.equal(__testing.isEncrypted(123), false)
})
