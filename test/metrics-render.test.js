import test from 'node:test'
import assert from 'node:assert/strict'

import { renderPrometheusMetrics } from '../src/api/metrics.js'

test('renderPrometheusMetrics exposes supervisor counters', () => {
  const text = renderPrometheusMetrics({
    sessionOwnerMismatchTotal: 3,
    sessionCircuitBreakerAlertTotal: 2,
  })
  assert.match(text, /wabot_supervisor_session_owner_mismatch_total 3/)
  assert.match(text, /wabot_supervisor_session_circuit_breaker_alert_total 2/)
})

test('isPrivateAddress: loopback e redes privadas passam, IP público não', async () => {
  const { isPrivateAddress } = await import('../src/api/metrics.js')
  assert.equal(isPrivateAddress('127.0.0.1'), true)
  assert.equal(isPrivateAddress('::1'), true)
  assert.equal(isPrivateAddress('::ffff:127.0.0.1'), true)
  assert.equal(isPrivateAddress('10.1.2.3'), true)
  assert.equal(isPrivateAddress('192.168.0.10'), true)
  assert.equal(isPrivateAddress('172.16.5.5'), true)
  assert.equal(isPrivateAddress('172.32.0.1'), false)
  assert.equal(isPrivateAddress('178.105.54.10'), false)
  assert.equal(isPrivateAddress(''), false)
})
