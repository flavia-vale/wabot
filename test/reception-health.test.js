import test from 'node:test'
import assert from 'node:assert/strict'
import { computeReceptionState, isReceptionProblem, RECEPTION_STATE } from '../src/core/receptionHealth.js'

const NOW = 1_800_000_000_000
const WINDOW = 20 * 60_000
const min = (n) => n * 60_000

function state(overrides = {}) {
  return computeReceptionState({
    now: NOW,
    connected: true,
    connectedSinceMs: NOW - min(120),
    lastUpsertAtMs: NOW - min(1),
    lastAcceptedAtMs: NOW - min(1),
    failuresInWindow: 0,
    hasMonitoredSources: true,
    windowMs: WINDOW,
    ...overrides,
  })
}

test('sessão desconectada não vira problema de recepção', () => {
  const result = state({ connected: false })
  assert.equal(result.state, RECEPTION_STATE.OFFLINE)
  assert.equal(isReceptionProblem(result.state), false)
})

test('mensagem aceita dentro da janela é ok', () => {
  const result = state({ lastAcceptedAtMs: NOW - min(5) })
  assert.equal(result.state, RECEPTION_STATE.OK)
  assert.equal(result.silentForMs, min(5))
})

// O quadro da Cynthia: conectado, ocupado, sem espelhar nada.
test('chegando e falhando sem nada aceito é blind', () => {
  const result = state({ lastAcceptedAtMs: NOW - min(90), lastUpsertAtMs: NOW - min(2), failuresInWindow: 5 })
  assert.equal(result.state, RECEPTION_STATE.BLIND)
  assert.equal(isReceptionProblem(result.state), true)
  assert.equal(result.silentForMs, min(90))
})

test('falha abaixo do mínimo não vira blind', () => {
  const result = state({ lastAcceptedAtMs: NOW - min(90), failuresInWindow: 2, minFailures: 3 })
  assert.notEqual(result.state, RECEPTION_STATE.BLIND)
})

test('silêncio SEM falha nenhuma não alarma (madrugada, fonte parada)', () => {
  const result = state({ lastAcceptedAtMs: NOW - min(60), lastUpsertAtMs: NOW - min(5), failuresInWindow: 0 })
  assert.equal(result.state, RECEPTION_STATE.QUIET)
  assert.equal(isReceptionProblem(result.state), false)
})

test('conexão recém-aberta tem carência e nunca alarma', () => {
  const result = state({ connectedSinceMs: NOW - min(3), lastAcceptedAtMs: null, lastUpsertAtMs: null, failuresInWindow: 50 })
  assert.equal(result.state, RECEPTION_STATE.OK)
  assert.equal(result.reason, 'conexão recente')
})

test('sem nada chegando por muito tempo com fonte monitorada vira starved (aviso fraco)', () => {
  const result = state({ lastAcceptedAtMs: null, lastUpsertAtMs: NOW - min(240), failuresInWindow: 0 })
  assert.equal(result.state, RECEPTION_STATE.STARVED)
  assert.equal(isReceptionProblem(result.state), false, 'starved é suspeita, não alarme automático')
})

test('conta SEM fonte monitorada nunca vira starved', () => {
  const result = state({ hasMonitoredSources: false, lastAcceptedAtMs: null, lastUpsertAtMs: NOW - min(240) })
  assert.equal(result.state, RECEPTION_STATE.QUIET)
})

test('sem nenhuma aceitação registrada, o silêncio conta desde a conexão', () => {
  const result = state({ lastAcceptedAtMs: null, lastUpsertAtMs: NOW - min(2), failuresInWindow: 9, connectedSinceMs: NOW - min(45) })
  assert.equal(result.state, RECEPTION_STATE.BLIND)
  assert.equal(result.silentForMs, min(45))
})

test('janela abaixo do piso é corrigida em vez de quebrar', () => {
  const result = state({ windowMs: 1, lastAcceptedAtMs: NOW - min(5) })
  assert.equal(result.windowMs, 60_000)
})

test('entrada vazia não quebra', () => {
  const result = computeReceptionState({})
  assert.equal(result.state, RECEPTION_STATE.OFFLINE)
})
