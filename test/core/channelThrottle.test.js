import test from 'node:test'
import assert from 'node:assert/strict'

import { checkAndReserve, recordPost } from '../../src/core/channelThrottle.js'

test('checkAndReserve skeleton sempre permite', () => {
  const decision = checkAndReserve('group-x', {})
  assert.equal(decision.allow, true)
})

test('recordPost skeleton é no-op', async () => {
  const result = await recordPost('group-x')
  assert.equal(result, null)
})
