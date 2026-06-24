import test from 'node:test'
import assert from 'node:assert/strict'
import { redactAdminPayload, serializeAdminAuditValue } from '../src/adminRedaction.js'

test('redactAdminPayload removes secrets and hashes direct identifiers', () => {
  const redacted = redactAdminPayload({
    email: 'User@Example.com',
    contactPhone: '+55 11 99999-0000',
    destJid: '120363000000000@g.us',
    accessToken: 'secret-token',
    originalUrl: 'https://example.com/product?token=abc&utm=1',
    nested: { cookie: 'session=secret' },
  })

  assert.match(redacted.email, /^email_hash:/)
  assert.match(redacted.contactPhone, /^phone_hash:/)
  assert.match(redacted.destJid, /^id_hash:/)
  assert.equal(redacted.accessToken, '[REDACTED]')
  assert.equal(redacted.originalUrl, 'https://example.com/product?[REDACTED_QUERY]')
  assert.equal(redacted.nested.cookie, '[REDACTED]')
})

test('serializeAdminAuditValue redacts JSON strings before persistence', () => {
  const serialized = serializeAdminAuditValue(JSON.stringify({ token: 'abc', email: 'user@example.com' }))
  const parsed = JSON.parse(serialized)
  assert.equal(parsed.token, '[REDACTED]')
  assert.match(parsed.email, /^email_hash:/)
})
