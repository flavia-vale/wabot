import test from 'node:test'
import assert from 'node:assert/strict'
import { calcBackoffDelayMs, registerReplacedAndDecide, registerCloseAndDecide, shouldResetBackoff, registerBadSessionAndDecide, registerStableCloseAndDecide } from '../src/core/reconnectPolicy.js'

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

// --- flap (closes genéricos 500/428/408) ---

test('flap: não aciona cooldown antes do limiar; aciona ao atingir', () => {
  const win = { windowMs: 600_000, flapThreshold: 3 }
  let r = registerCloseAndDecide([], 1_000, win)
  assert.equal(r.count, 1)
  assert.equal(r.flapping, false)
  r = registerCloseAndDecide(r.timestamps, 2_000, win)
  assert.equal(r.flapping, false)
  r = registerCloseAndDecide(r.timestamps, 3_000, win)
  assert.equal(r.count, 3)
  assert.equal(r.flapping, true)
})

test('flap: closes fora da janela são descartados (não aciona)', () => {
  const win = { windowMs: 60_000, flapThreshold: 3 }
  let r = registerCloseAndDecide([], 0, win)
  r = registerCloseAndDecide(r.timestamps, 10_000, win)
  r = registerCloseAndDecide(r.timestamps, 500_000, win)
  assert.equal(r.count, 1)
  assert.equal(r.flapping, false)
})

test('flap: registerCloseAndDecide não muta a entrada', () => {
  const input = [100]
  const r = registerCloseAndDecide(input, 200, { windowMs: 300_000, flapThreshold: 5 })
  assert.deepEqual(input, [100])
  assert.deepEqual(r.timestamps, [100, 200])
})

// --- shouldResetBackoff (estabilidade) ---

test('shouldResetBackoff: só zera após conexão estável o bastante', () => {
  // openedAt em t=0; minStable=60s
  assert.equal(shouldResetBackoff(0, 30_000, 60_000), false) // openedAt=0 (falsy) → nunca estável
  assert.equal(shouldResetBackoff(null, 999_999, 60_000), false) // nunca abriu
  assert.equal(shouldResetBackoff(1_000, 30_000, 60_000), false) // abriu há 29s → flap
  assert.equal(shouldResetBackoff(1_000, 61_000, 60_000), true) // abriu há 60s → estável
})

// --- badSession (500) → reset de auth ---

test('badSession: reseta auth só com repetição E sem conexão estável', () => {
  const base = { windowMs: 600_000, resetThreshold: 3, hadStableOpen: false }
  let r = registerBadSessionAndDecide([], 1_000, base)
  assert.equal(r.shouldResetAuth, false)
  r = registerBadSessionAndDecide(r.timestamps, 2_000, base)
  assert.equal(r.shouldResetAuth, false)
  r = registerBadSessionAndDecide(r.timestamps, 3_000, base)
  assert.equal(r.count, 3)
  assert.equal(r.shouldResetAuth, true)
})

test('badSession: NÃO reseta se a sessão estava estável (500 transitório)', () => {
  const win = { windowMs: 600_000, resetThreshold: 2, hadStableOpen: true }
  let r = registerBadSessionAndDecide([], 1_000, win)
  r = registerBadSessionAndDecide(r.timestamps, 2_000, win)
  r = registerBadSessionAndDecide(r.timestamps, 3_000, win)
  assert.ok(r.count >= 2)
  assert.equal(r.shouldResetAuth, false) // chip que recupera não tem cred apagada
})

test('badSession: resetThreshold <= 0 desliga o auto-reset', () => {
  const win = { windowMs: 600_000, resetThreshold: 0, hadStableOpen: false }
  let r = registerBadSessionAndDecide([], 1_000, win)
  r = registerBadSessionAndDecide(r.timestamps, 2_000, win)
  r = registerBadSessionAndDecide(r.timestamps, 3_000, win)
  assert.equal(r.shouldResetAuth, false)
})

test('badSession: janela descarta eventos antigos', () => {
  const win = { windowMs: 60_000, resetThreshold: 2, hadStableOpen: false }
  let r = registerBadSessionAndDecide([], 0, win)
  r = registerBadSessionAndDecide(r.timestamps, 500_000, win) // muito depois
  assert.equal(r.count, 1)
  assert.equal(r.shouldResetAuth, false)
})

// --- quedas periódicas de sessões estáveis ---

test('stable close: aciona cooldown ao atingir limiar dentro da janela', () => {
  const win = { windowMs: 3 * 60 * 60_000, cooldownThreshold: 3, hadStableOpen: true }
  let r = registerStableCloseAndDecide([], 1_000, win)
  assert.equal(r.count, 1)
  assert.equal(r.shouldCooldown, false)
  r = registerStableCloseAndDecide(r.timestamps, 50 * 60_000, win)
  assert.equal(r.shouldCooldown, false)
  r = registerStableCloseAndDecide(r.timestamps, 100 * 60_000, win)
  assert.equal(r.count, 3)
  assert.equal(r.shouldCooldown, true)
})

test('stable close: ignora close de sessão que não ficou estável', () => {
  const input = [1_000, 2_000]
  const r = registerStableCloseAndDecide(input, 3_000, {
    windowMs: 60_000,
    cooldownThreshold: 3,
    hadStableOpen: false,
  })
  assert.deepEqual(r.timestamps, input)
  assert.equal(r.count, 2)
  assert.equal(r.shouldCooldown, false)
})

test('stable close: janela descarta eventos antigos', () => {
  const win = { windowMs: 60_000, cooldownThreshold: 2, hadStableOpen: true }
  let r = registerStableCloseAndDecide([], 0, win)
  r = registerStableCloseAndDecide(r.timestamps, 500_000, win)
  assert.equal(r.count, 1)
  assert.equal(r.shouldCooldown, false)
})
