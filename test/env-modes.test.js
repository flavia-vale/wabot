import test from 'node:test'
import assert from 'node:assert/strict'

import { parseEnumEnv } from '../src/core/envModes.js'

test('parseEnumEnv accepts valid values case-insensitively with trim', () => {
  const v = parseEnumEnv('X_MODE', '  OPEN  ', ['open', 'closed'], 'closed', { log: null })
  assert.equal(v, 'open')
})

test('parseEnumEnv falls back for invalid values', () => {
  const v = parseEnumEnv('X_MODE', 'invalid', ['open', 'closed'], 'closed', { log: null })
  assert.equal(v, 'closed')
})

test('parseEnumEnv falls back for empty values', () => {
  const v = parseEnumEnv('X_MODE', '', ['open', 'closed'], 'closed', { log: null })
  assert.equal(v, 'closed')
})
