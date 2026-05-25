import test from 'node:test'
import assert from 'node:assert/strict'

import { getSupervisorOperationalCounters } from '../src/supervisor/operationalCounters.js'

test('returns safe defaults when redis url is missing', async () => {
  const result = await getSupervisorOperationalCounters({ redisUrl: '' })
  assert.equal(result.redisAvailable, false)
  assert.equal(result.sessionOwnerMismatchTotal, null)
  assert.equal(result.sessionCircuitBreakerAlertTotal, null)
})

