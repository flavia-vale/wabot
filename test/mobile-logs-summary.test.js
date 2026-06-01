import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSummaryCounts, summaryDeliveryRateLabel } from '../dashboard/lib/mobileLogsSummary.js'

test('normalizeSummaryCounts retorna todos zeros para null', () => {
  const result = normalizeSummaryCounts(null)
  assert.deepEqual(result, {
    success: 0,
    skippedDedup: 0,
    skippedConfig: 0,
    timeoutTotal: 0,
    errorOther: 0,
    inFlight: 0,
  })
})

test('normalizeSummaryCounts retorna todos zeros para undefined', () => {
  const result = normalizeSummaryCounts(undefined)
  assert.deepEqual(result, {
    success: 0,
    skippedDedup: 0,
    skippedConfig: 0,
    timeoutTotal: 0,
    errorOther: 0,
    inFlight: 0,
  })
})

test('normalizeSummaryCounts retorna todos zeros para objeto vazio', () => {
  const result = normalizeSummaryCounts({})
  assert.deepEqual(result, {
    success: 0,
    skippedDedup: 0,
    skippedConfig: 0,
    timeoutTotal: 0,
    errorOther: 0,
    inFlight: 0,
  })
})

test('normalizeSummaryCounts preserva valores presentes e preenche ausentes com zero', () => {
  const result = normalizeSummaryCounts({ success: 42, errorOther: 5 })
  assert.equal(result.success, 42)
  assert.equal(result.errorOther, 5)
  assert.equal(result.skippedDedup, 0)
  assert.equal(result.skippedConfig, 0)
  assert.equal(result.timeoutTotal, 0)
  assert.equal(result.inFlight, 0)
})

test('normalizeSummaryCounts converte valores numéricos corretamente', () => {
  const result = normalizeSummaryCounts({
    success: 100,
    skippedDedup: 20,
    skippedConfig: 15,
    timeoutTotal: 3,
    errorOther: 7,
    inFlight: 2,
  })
  assert.deepEqual(result, {
    success: 100,
    skippedDedup: 20,
    skippedConfig: 15,
    timeoutTotal: 3,
    errorOther: 7,
    inFlight: 2,
  })
})

test('normalizeSummaryCounts trata valores NaN como zero', () => {
  const result = normalizeSummaryCounts({ success: NaN, skippedDedup: 'abc' })
  assert.equal(result.success, 0)
  assert.equal(result.skippedDedup, 0)
})

test('summaryDeliveryRateLabel formata 0.873 como 87%', () => {
  assert.equal(summaryDeliveryRateLabel(0.873), '87%')
})

test('summaryDeliveryRateLabel formata 0 como 0%', () => {
  assert.equal(summaryDeliveryRateLabel(0), '0%')
})

test('summaryDeliveryRateLabel formata 1 como 100%', () => {
  assert.equal(summaryDeliveryRateLabel(1), '100%')
})

test('summaryDeliveryRateLabel formata 0.5 como 50%', () => {
  assert.equal(summaryDeliveryRateLabel(0.5), '50%')
})

test('summaryDeliveryRateLabel retorna — para null', () => {
  assert.equal(summaryDeliveryRateLabel(null), '—')
})

test('summaryDeliveryRateLabel retorna — para NaN', () => {
  assert.equal(summaryDeliveryRateLabel(NaN), '—')
})

test('summaryDeliveryRateLabel retorna — para valor acima de 1', () => {
  assert.equal(summaryDeliveryRateLabel(2), '—')
})

test('summaryDeliveryRateLabel retorna — para valor negativo', () => {
  assert.equal(summaryDeliveryRateLabel(-0.5), '—')
})

test('summaryDeliveryRateLabel retorna — para string', () => {
  assert.equal(summaryDeliveryRateLabel('87%'), '—')
})

test('summaryDeliveryRateLabel retorna — para undefined', () => {
  assert.equal(summaryDeliveryRateLabel(undefined), '—')
})
