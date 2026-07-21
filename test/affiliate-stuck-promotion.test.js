import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateStuckPromotion } from '../src/domain/affiliate/stuckPromotionAlarm.js'
import { checkStuckPromotions } from '../src/domain/affiliate/service.js'

// 009-affiliate-improvements-r1 (US6): evaluateStuckPromotion é módulo puro
// (sem acesso a DB/env).

const now = new Date('2026-07-21T12:00:00Z')
const THRESHOLD_MS = 24 * 60 * 60 * 1000

test('sem comissões vencidas além do limiar → shouldAlarm false', () => {
  const rows = [
    { id: 'c1', eligibleAt: new Date(now.getTime() - 1 * 60 * 60 * 1000) }, // 1h atrás
    { id: 'c2', eligibleAt: new Date(now.getTime() - 23 * 60 * 60 * 1000) }, // 23h atrás
  ]
  const result = evaluateStuckPromotion({ rows, now, thresholdMs: THRESHOLD_MS })
  assert.deepEqual(result, { shouldAlarm: false, count: 0, oldestMs: 0 })
})

test('comissões vencidas além do limiar → shouldAlarm true com count/oldestMs corretos', () => {
  const rows = [
    { id: 'c1', eligibleAt: new Date(now.getTime() - 25 * 60 * 60 * 1000) }, // 25h atrás
    { id: 'c2', eligibleAt: new Date(now.getTime() - 48 * 60 * 60 * 1000) }, // 48h atrás
    { id: 'c3', eligibleAt: new Date(now.getTime() - 10 * 60 * 60 * 1000) }, // 10h atrás, dentro do limiar
  ]
  const result = evaluateStuckPromotion({ rows, now, thresholdMs: THRESHOLD_MS })
  assert.equal(result.shouldAlarm, true)
  assert.equal(result.count, 2)
  assert.equal(result.oldestMs, 48 * 60 * 60 * 1000)
})

test('sem linhas → shouldAlarm false', () => {
  const result = evaluateStuckPromotion({ rows: [], now, thresholdMs: THRESHOLD_MS })
  assert.deepEqual(result, { shouldAlarm: false, count: 0, oldestMs: 0 })
})

test('respeita thresholdMs customizado', () => {
  const rows = [{ id: 'c1', eligibleAt: new Date(now.getTime() - 2 * 60 * 60 * 1000) }] // 2h atrás
  const strict = evaluateStuckPromotion({ rows, now, thresholdMs: 60 * 60 * 1000 }) // limiar de 1h
  assert.equal(strict.shouldAlarm, true)
  const lenient = evaluateStuckPromotion({ rows, now, thresholdMs: 3 * 60 * 60 * 1000 }) // limiar de 3h
  assert.equal(lenient.shouldAlarm, false)
})

// ---- checkStuckPromotions (service.js): db-free via fake db, sem AnalyticsEvent real ----
test('checkStuckPromotions: sem comissões vencidas → log.error não é chamado', async () => {
  const db = { affiliateCommission: { findMany: async () => [] } }
  let errorCalled = false
  const log = { error: () => { errorCalled = true } }
  const result = await checkStuckPromotions({ db, log, now, thresholdMs: THRESHOLD_MS })
  assert.equal(result.shouldAlarm, false)
  assert.equal(errorCalled, false)
})

test('checkStuckPromotions: comissões vencidas além do limiar → log.error chamado', async () => {
  const db = {
    affiliateCommission: {
      findMany: async () => [
        { id: 'c1', eligibleAt: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
      ],
    },
  }
  let errorPayload = null
  const log = { error: (payload) => { errorPayload = payload } }
  const result = await checkStuckPromotions({ db, log, now, thresholdMs: THRESHOLD_MS })
  assert.equal(result.shouldAlarm, true)
  assert.equal(result.count, 1)
  assert.ok(errorPayload)
})
