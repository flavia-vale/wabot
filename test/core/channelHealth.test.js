import test from 'node:test'
import assert from 'node:assert/strict'

import {
  HEALTH_STATUS,
  getHealth,
  recomputeHealth,
  recordSendResult,
  recordStreamError,
} from '../../src/core/channelHealth.js'

test('HEALTH_STATUS expõe os 4 estados imutáveis', () => {
  assert.equal(HEALTH_STATUS.GREEN, 'green')
  assert.equal(HEALTH_STATUS.YELLOW, 'yellow')
  assert.equal(HEALTH_STATUS.RED, 'red')
  assert.equal(HEALTH_STATUS.CRITICAL, 'critical')
  assert.throws(() => { HEALTH_STATUS.GREEN = 'x' }, TypeError)
})

test('getHealth skeleton retorna green', async () => {
  const snap = await getHealth('group-x')
  assert.equal(snap.status, 'green')
})

test('recordSendResult / recordStreamError / recomputeHealth são no-op', async () => {
  assert.equal(await recordSendResult('g', { ok: true }), null)
  assert.equal(await recordStreamError('u', 'rate-overlimit'), null)
  assert.equal(await recomputeHealth('g'), null)
})
