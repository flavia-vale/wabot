import test from 'node:test'
import assert from 'node:assert/strict'
import { forecastCapacity } from '../src/ops/capacity/forecast.js'

const day = 86400000
const samples = (count, growth = 1, extra = {}) => Array.from({ length: count }, (_, index) => ({
  collectedAt: new Date(Date.UTC(2026, 4, 1) + index * day),
  connectedSessions: 10 + index * growth,
  safeSessionLimit: 30,
  policyVersion: 'capacity-policy-v1',
  hostProfileId: 'host-a',
  ...extra,
}))

test('forecast exige sete dias cobertos e crescimento positivo', () => {
  assert.equal(forecastCapacity(samples(6)).reasonUnavailable, 'minimum_history')
  assert.equal(forecastCapacity(samples(14, 0)).reasonUnavailable, 'non_positive_growth')
  assert.equal(forecastCapacity(samples(14, -1)).centralThresholdAt, null)
})

test('forecast seleciona janela explicavel e devolve faixa residual', () => {
  const result = forecastCapacity(samples(35, 0.25), { now: new Date(Date.UTC(2026, 5, 5)) })
  assert.equal(result.windowDays, 30)
  assert.equal(result.reasonUnavailable, null)
  assert.ok(result.centralThresholdAt)
  assert.ok(result.range.earliestAt)
  assert.ok(result.range.latestAt)
  assert.match(result.explanation, /30 dias/)
  assert.ok(['low', 'medium', 'high'].includes(result.confidence))
  assert.equal(result.growth[7].net, 1.75)
  assert.equal(result.growth[30].net, 7.5)
  assert.equal(result.growth[90].sampleCount, 35)
})

test('forecast usa somente segmento posterior a mudanca de host ou politica', () => {
  const input = samples(20).map((sample, index) => index < 10 ? sample : { ...sample, hostProfileId: 'host-b', connectedSessions: index })
  const result = forecastCapacity(input)
  assert.equal(result.coverage.sampleCount, 10)
  assert.equal(result.segment.hostProfileId, 'host-b')
})
