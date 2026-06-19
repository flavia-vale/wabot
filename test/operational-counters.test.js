import test from 'node:test'
import assert from 'node:assert/strict'

import { getSupervisorOperationalCounters } from '../src/supervisor/operationalCounters.js'

test('returns safe defaults when redis url is missing', async () => {
  const result = await getSupervisorOperationalCounters({ redisUrl: '' })
  assert.equal(result.redisAvailable, false)
  assert.equal(result.sessionOwnerMismatchTotal, null)
  assert.equal(result.sessionCircuitBreakerAlertTotal, null)
})

// P2-5: agrega via UM mget por prefixo (não GET por chave). Mock injetado.
function createMockIoredis(store) {
  let getCalls = 0
  let mgetCalls = 0
  class Redis {
    constructor() {}
    async connect() {}
    async quit() {}
    async scan(_cursor, _match, pattern, _count, count) {
      const prefix = pattern.replace(/\*$/, '')
      const keys = Object.keys(store).filter(k => k.startsWith(prefix))
      return ['0', keys]
    }
    async get() { getCalls++; return null }
    async mget(keys) { mgetCalls++; return keys.map(k => store[k]) }
  }
  return { module: { default: Redis }, stats: () => ({ getCalls, mgetCalls }) }
}

test('agrega contadores via mget e não usa GET por chave (P2-5)', async () => {
  const store = {
    'supervisor:session_owner_mismatch_total:shardA': '2',
    'supervisor:session_owner_mismatch_total:shardB': '3',
    'supervisor:session_circuit_breaker_alert:shardA': '1',
    'supervisor:session_quarantine_total:shardA': '5',
  }
  const mock = createMockIoredis(store)
  const result = await getSupervisorOperationalCounters({ redisUrl: 'redis://fake', skipCache: true, ioredisModule: mock.module })
  assert.equal(result.redisAvailable, true)
  assert.equal(result.sessionOwnerMismatchTotal, 5)
  assert.deepEqual(result.sessionOwnerMismatchByShard, { shardA: 2, shardB: 3 })
  assert.equal(result.sessionCircuitBreakerAlertTotal, 1)
  assert.equal(result.sessionQuarantineTotal, 5)
  const { getCalls, mgetCalls } = mock.stats()
  assert.equal(getCalls, 0, 'não deve usar GET por chave')
  assert.ok(mgetCalls >= 1, 'deve usar mget')
})

