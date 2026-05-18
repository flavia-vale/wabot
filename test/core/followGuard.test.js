import test from 'node:test'
import assert from 'node:assert/strict'

import { canFollowNow, logFollow } from '../../src/core/followGuard.js'

test('canFollowNow skeleton sempre permite', () => {
  const decision = canFollowNow('user-x')
  assert.equal(decision.ok, true)
})

test('logFollow skeleton é no-op', async () => {
  const result = await logFollow('user-x', '123@newsletter', 'ok')
  assert.equal(result, null)
})
