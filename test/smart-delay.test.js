import test from 'node:test'
import assert from 'node:assert/strict'

import { calculateJitterDelayMs, calculateProgressiveDelayMs, calculateRestWindowDelayMs, calculateTypingDelayMs } from '../src/smartDelay.js'

test('calculateJitterDelayMs sorteia dentro do range inclusivo em segundos', () => {
  assert.equal(calculateJitterDelayMs({ delayMin: 27, delayMax: 35, random: () => 0 }), 27_000)
  assert.equal(calculateJitterDelayMs({ delayMin: 27, delayMax: 35, random: () => 0.999 }), 35_000)
})

test('calculateJitterDelayMs normaliza ranges invertidos ou zerados', () => {
  assert.equal(calculateJitterDelayMs({ delayMin: 35, delayMax: 27, random: () => 0 }), 27_000)
  assert.equal(calculateJitterDelayMs({ delayMin: 0, delayMax: 0 }), 0)
})

test('calculateProgressiveDelayMs aumenta delay quando a fila entra em pressão', () => {
  assert.equal(calculateProgressiveDelayMs({ baseDelayMs: 30_000, queueSize: 19, threshold: 20, stepMs: 5_000 }), 30_000)
  assert.equal(calculateProgressiveDelayMs({ baseDelayMs: 30_000, queueSize: 20, threshold: 20, stepMs: 5_000 }), 35_000)
  assert.equal(calculateProgressiveDelayMs({ baseDelayMs: 30_000, queueSize: 60, threshold: 20, stepMs: 5_000 }), 45_000)
})

test('calculateRestWindowDelayMs pausa apenas nos múltiplos configurados', () => {
  assert.equal(calculateRestWindowDelayMs({ sentCount: 49, every: 50, durationMs: 120_000 }), 0)
  assert.equal(calculateRestWindowDelayMs({ sentCount: 50, every: 50, durationMs: 120_000 }), 120_000)
})

test('calculateTypingDelayMs estima composição limitada por mínimo e máximo', () => {
  assert.equal(calculateTypingDelayMs({ text: 'curto', minMs: 1000, maxMs: 5000, charsPerSecond: 20 }), 1000)
  assert.equal(calculateTypingDelayMs({ text: 'x'.repeat(200), minMs: 1000, maxMs: 5000, charsPerSecond: 20 }), 5000)
})
