import test from 'node:test'
import assert from 'node:assert/strict'
import { calcBackoffDelayMs, registerReplacedAndDecide } from '../src/core/reconnectPolicy.js'

test('backoff cresce exponencialmente a partir de baseMs', () => {
  const opts = { baseMs: 5_000, maxMs: 300_000, jitterRatio: 0, random: () => 0.5 }
  // random()=0.5 → jitter = base * ratio * 0 = 0 (sem ruído)
  assert.equal(calcBackoffDelayMs(0, opts), 5_000)
  assert.equal(calcBackoffDelayMs(1, opts), 10_000)
  assert.equal(calcBackoffDelayMs(2, opts), 20_000)
  assert.equal(calcBackoffDelayMs(3, opts), 40_000)
})

test('backoff satura em maxMs', () => {
  const opts = { baseMs: 5_000, maxMs: 60_000, jitterRatio: 0, random: () => 0.5 }
  assert.equal(calcBackoffDelayMs(10, opts), 60_000)
  assert.equal(calcBackoffDelayMs(100, opts), 60_000)
})

test('jitter fica dentro de ±jitterRatio e nunca negativo', () => {
  const base = { baseMs: 5_000, maxMs: 300_000, jitterRatio: 0.2 }
  for (const r of [0, 0.25, 0.5, 0.75, 1]) {
    const d = calcBackoffDelayMs(0, { ...base, random: () => r })
    assert.ok(d >= 4_000 && d <= 6_000, `delay ${d} fora da faixa de jitter`)
    assert.ok(d >= 0)
  }
})

test('attempt negativo é tratado como 0', () => {
  const opts = { baseMs: 5_000, maxMs: 300_000, jitterRatio: 0, random: () => 0.5 }
  assert.equal(calcBackoffDelayMs(-3, opts), 5_000)
})

test('replaced: não escala antes do limiar', () => {
  const win = { windowMs: 300_000, giveUpThreshold: 3 }
  let ts = []
  let r = registerReplacedAndDecide(ts, 1_000, win)
  assert.equal(r.count, 1)
  assert.equal(r.escalate, false)
  r = registerReplacedAndDecide(r.timestamps, 2_000, win)
  assert.equal(r.count, 2)
  assert.equal(r.escalate, false)
})

test('replaced: escala ao atingir o limiar dentro da janela', () => {
  const win = { windowMs: 300_000, giveUpThreshold: 3 }
  let r = registerReplacedAndDecide([], 1_000, win)
  r = registerReplacedAndDecide(r.timestamps, 2_000, win)
  r = registerReplacedAndDecide(r.timestamps, 3_000, win)
  assert.equal(r.count, 3)
  assert.equal(r.escalate, true)
})

test('replaced: eventos fora da janela são descartados (não escala)', () => {
  const win = { windowMs: 60_000, giveUpThreshold: 3 }
  // dois eventos antigos + um novo muito depois → janela só vê o novo
  let r = registerReplacedAndDecide([], 0, win)
  r = registerReplacedAndDecide(r.timestamps, 10_000, win)
  r = registerReplacedAndDecide(r.timestamps, 500_000, win)
  assert.equal(r.count, 1)
  assert.equal(r.escalate, false)
})

test('registerReplacedAndDecide não muta a lista de entrada', () => {
  const input = [100]
  const r = registerReplacedAndDecide(input, 200, { windowMs: 300_000, giveUpThreshold: 5 })
  assert.deepEqual(input, [100])
  assert.deepEqual(r.timestamps, [100, 200])
})
