import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildStableSendMessageId } from '../../src/core/stableMessageId.js'

test('mesmo seed → mesmo id (determinístico/idempotente)', () => {
  const a = buildStableSendMessageId('log_abc123')
  const b = buildStableSendMessageId('log_abc123')
  assert.equal(a, b)
})

test('seeds diferentes → ids diferentes', () => {
  assert.notEqual(
    buildStableSendMessageId('log_a'),
    buildStableSendMessageId('log_b'),
  )
})

test('formato uppercase-hex com prefixo 3EB0 e 32 chars', () => {
  const id = buildStableSendMessageId('log_abc123')
  assert.match(id, /^3EB0[0-9A-F]{28}$/)
  assert.equal(id.length, 32)
})

test('seed vazio/nulo → null (deixa Baileys gerar o id)', () => {
  assert.equal(buildStableSendMessageId(''), null)
  assert.equal(buildStableSendMessageId('   '), null)
  assert.equal(buildStableSendMessageId(null), null)
  assert.equal(buildStableSendMessageId(undefined), null)
})

test('tolera seed não-string', () => {
  const id = buildStableSendMessageId(12345)
  assert.match(id, /^3EB0[0-9A-F]{28}$/)
  assert.equal(id, buildStableSendMessageId('12345'))
})
