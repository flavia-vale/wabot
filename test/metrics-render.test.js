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
