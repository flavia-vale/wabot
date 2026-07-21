import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveOrphanTouchDecision } from '../src/domain/affiliate/orphanTouchPolicy.js'

// 009-affiliate-improvements-r1 (US4): resolveOrphanTouchDecision é módulo
// puro (sem acesso a DB/env) — cobre os 4 modos × dentro/fora da janela.

test('off: dentro da janela legado (30d) → sem hold', () => {
  const result = resolveOrphanTouchDecision({ orphanTouchWindowDays: 7, orphanTouchMode: 'off', touchAgeDays: 20 })
  assert.equal(result.withinWindow, true)
  assert.equal(result.shouldHold, false)
})

test('off: fora da janela legado (30d) → não atribui', () => {
  const result = resolveOrphanTouchDecision({ orphanTouchWindowDays: 7, orphanTouchMode: 'off', touchAgeDays: 31 })
  assert.equal(result.withinWindow, false)
  assert.equal(result.shouldHold, false)
})

test('off: ignora orphanTouchWindowDays configurado (usa sempre 30 dias)', () => {
  const result = resolveOrphanTouchDecision({ orphanTouchWindowDays: 3, orphanTouchMode: 'off', touchAgeDays: 10 })
  assert.equal(result.withinWindow, true)
})

test('window: dentro da janela endurecida → sem hold, fluxo normal', () => {
  const result = resolveOrphanTouchDecision({ orphanTouchWindowDays: 7, orphanTouchMode: 'window', touchAgeDays: 5 })
  assert.equal(result.withinWindow, true)
  assert.equal(result.shouldHold, false)
})

test('window: fora da janela endurecida → nenhuma atribuição', () => {
  const result = resolveOrphanTouchDecision({ orphanTouchWindowDays: 7, orphanTouchMode: 'window', touchAgeDays: 8 })
  assert.equal(result.withinWindow, false)
})

test('hold: dentro da janela endurecida → held', () => {
  const result = resolveOrphanTouchDecision({ orphanTouchWindowDays: 7, orphanTouchMode: 'hold', touchAgeDays: 5 })
  assert.equal(result.withinWindow, true)
  assert.equal(result.shouldHold, true)
})

test('hold: fora da janela endurecida → nenhuma atribuição (não importa hold)', () => {
  const result = resolveOrphanTouchDecision({ orphanTouchWindowDays: 7, orphanTouchMode: 'hold', touchAgeDays: 8 })
  assert.equal(result.withinWindow, false)
  assert.equal(result.shouldHold, false)
})

test('both (default seguro): dentro da janela endurecida → held', () => {
  const result = resolveOrphanTouchDecision({ orphanTouchWindowDays: 7, orphanTouchMode: 'both', touchAgeDays: 6 })
  assert.equal(result.withinWindow, true)
  assert.equal(result.shouldHold, true)
})

test('both: fora da janela endurecida → nenhuma atribuição', () => {
  const result = resolveOrphanTouchDecision({ orphanTouchWindowDays: 7, orphanTouchMode: 'both', touchAgeDays: 10 })
  assert.equal(result.withinWindow, false)
  assert.equal(result.shouldHold, false)
})

test('defaults: sem parâmetros usa orphanTouchWindowDays=7 e modo both', () => {
  const result = resolveOrphanTouchDecision({ touchAgeDays: 3 })
  assert.equal(result.withinWindow, true)
  assert.equal(result.shouldHold, true)
})
