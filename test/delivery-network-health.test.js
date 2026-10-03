import test from 'node:test'
import assert from 'node:assert/strict'
import { HEALTH_SIGNAL, NETWORK_HEALTH, computeNetworkHealth, createHealthRecorder } from '../src/core/delivery/networkHealth.js'

// Feature 017, T063 (FR-041).

const now = 10_000_000
const s = (kind, secondsAgo) => ({ kind, at: now - secondsAgo * 1000 })

test('sem medição recente: sem_medicao, nunca vermelho', () => {
  assert.equal(computeNetworkHealth([], { now }).estado, NETWORK_HEALTH.SEM_MEDICAO)
  assert.equal(computeNetworkHealth([s(HEALTH_SIGNAL.INDISPONIVEL, 3600)], { now }).estado, NETWORK_HEALTH.SEM_MEDICAO)
})

test('os quatro estados, com motivo leigo', () => {
  const cases = [
    [[s('ok', 10)], NETWORK_HEALTH.FUNCIONANDO],
    // Limite em DOIS grupos diferentes (um grupo só é normal — revisão crítica, item 13).
    [[s('ok', 60), { ...s('limite', 30), chave: 'tg:-1' }, { ...s('limite', 20), chave: 'tg:-2' }, s('ok', 5)], NETWORK_HEALTH.LIMITADO],
    [[s('ok', 60), s('bloqueado', 5)], NETWORK_HEALTH.BLOQUEADO],
    [[s('indisponivel', 30), s('indisponivel', 20), s('indisponivel', 10)], NETWORK_HEALTH.INDISPONIVEL],
  ]
  for (const [signals, estado] of cases) {
    const h = computeNetworkHealth(signals, { now })
    assert.equal(h.estado, estado)
    assert.ok(h.motivo.length > 20)
    assert.doesNotMatch(h.motivo, /\b(token|webhook|Bot API|429|401)\b/)
  }
})

test('uma falha isolada não vira "fora do ar"', () => {
  assert.equal(computeNetworkHealth([s('ok', 30), s('indisponivel', 5)], { now }).estado, NETWORK_HEALTH.FUNCIONANDO)
})

test('registro em memória é limitado', () => {
  const r = createHealthRecorder({ max: 3 })
  for (let i = 0; i < 10; i++) r.record('telegram', 'ok', i)
  assert.equal(r.signals('telegram').length, 3)
})
