import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldShowStuckQueueRecovery, STUCK_QUEUE_RECOVERY_MS } from '../src/domain/painel/stuckQueueRecovery.js'

const now = Date.parse('2026-09-28T12:00:00Z')

test('ação destrutiva fica escondida com fila vazia, andando ou sem idade confiável', () => {
  assert.equal(shouldShowStuckQueueRecovery({ inFlight: 0, oldestInFlightAt: '2026-09-28T00:00:00Z', now }), false)
  assert.equal(shouldShowStuckQueueRecovery({ inFlight: 1, oldestInFlightAt: null, now }), false)
  assert.equal(shouldShowStuckQueueRecovery({ inFlight: 1, oldestInFlightAt: new Date(now - STUCK_QUEUE_RECOVERY_MS + 1).toISOString(), now }), false)
})

test('ação aparece somente após o limite de fila presa', () => {
  assert.equal(shouldShowStuckQueueRecovery({ inFlight: 1, oldestInFlightAt: new Date(now - STUCK_QUEUE_RECOVERY_MS).toISOString(), now }), true)
})

