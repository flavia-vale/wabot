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

// RCA 2026-08-28 (Cynthia, terceira vez): a mensagem era ACEITA — então o
// marcador de recepção ficava fresco e o alerta via tudo verde — mas a fila da
// origem estava travada e nada era processado. Cliente sem oferta nenhuma,
// painel online, e nós sem saber.
test('fila de entrada parada com mensagem esperando é blind, mesmo com aceitação recente', () => {
  const result = state({
    lastAcceptedAtMs: NOW - min(1),
    lastUpsertAtMs: NOW - min(1),
    failuresInWindow: 0,
    incomingPending: 4,
    lastProcessedAtMs: NOW - min(90),
  })
  assert.equal(result.state, RECEPTION_STATE.BLIND)
  assert.match(result.reason, /fila de entrada parada/)
  assert.equal(result.silentForMs, min(90))
})

test('fila com pendência mas andando não alarma', () => {
  const result = state({ incomingPending: 4, lastProcessedAtMs: NOW - min(2) })
  assert.equal(result.state, RECEPTION_STATE.OK)
})

test('fila vazia e parada não alarma (é só silêncio da fonte)', () => {
  const result = state({ incomingPending: 0, lastProcessedAtMs: NOW - min(300), lastAcceptedAtMs: NOW - min(1) })
  assert.equal(result.state, RECEPTION_STATE.OK)
})

test('worker recém-subido, sem nada processado ainda, não alarma', () => {
  const result = state({ incomingPending: 2, lastProcessedAtMs: null, lastAcceptedAtMs: NOW - min(1) })
  assert.equal(result.state, RECEPTION_STATE.OK, 'sem histórico não dá para dizer que parou')
})

// ---------------------------------------------------------------------------
// RCA 2026-09-14 (viviloppes@gmail.com): cegueira que atravessa reconexões.
//
// Números reais da conta, medidos em produção: espelhamento de ~1.100/dia para
// ZERO por dois dias, 29 quedas em 24h (código 500, `stuckMsg:true`, todas com
// `hadStableOpen`), worker de pé há 11h sem aceitar UMA mensagem — e nenhum
// sinal `ops_wa_reception_blind` emitido em nenhum momento.
// ---------------------------------------------------------------------------

const h = (n) => n * 60 * 60_000

// A conta dela como estava às 13:42Z: reconectou faz 8 minutos (dentro da
// carência de 20min), nada aceito desde o boot do worker, 11h atrás.
function viviane(overrides = {}) {
  return computeReceptionState({
    now: NOW,
    connected: true,
    connectedSinceMs: NOW - min(8),
    lastUpsertAtMs: null,
    lastAcceptedAtMs: null,
    // A rajada de decrypt acontece no dreno da fila offline logo após conectar,
    // então a janela curta de 10min já a podou quando o julgamento começaria.
    failuresInWindow: 0,
    observedSinceMs: NOW - h(11),
    failuresSinceLastAccepted: 170,
    stableDropsSinceLastAccepted: 29,
    hasMonitoredSources: true,
    windowMs: WINDOW,
    ...overrides,
  })
}

test('REGRESSÃO: conta cega há 11h dentro da carência da reconexão é blind', () => {
  const r = viviane()
  assert.equal(r.state, RECEPTION_STATE.BLIND)
  assert.equal(r.blindAcrossReconnects, true)
  assert.equal(isReceptionProblem(r.state), true)
  // O silêncio reportado é o real (11h), não os 8 minutos da conexão atual —
  // era essa troca de relógio que escondia o caso.
  assert.equal(r.silentForMs, h(11))
})

test('sem a regra nova, o mesmo quadro voltaria a ser escondido pela carência', () => {
  const r = viviane({ blindAcrossReconnectsMs: 0 })
  assert.equal(r.state, RECEPTION_STATE.OK)
  assert.equal(r.reason, 'conexão recente')
})

test('queda repetida sozinha basta como evidência, sem falha de decrypt', () => {
  const r = viviane({ failuresSinceLastAccepted: 0, stableDropsSinceLastAccepted: 5 })
  assert.equal(r.state, RECEPTION_STATE.BLIND)
  assert.match(r.reason, /caindo repetidamente/)
})

test('silêncio SEM evidência nenhuma nunca vira alarme', () => {
  const r = viviane({ failuresSinceLastAccepted: 0, stableDropsSinceLastAccepted: 0 })
  assert.notEqual(r.state, RECEPTION_STATE.BLIND)
})

test('conta recém-iniciada não é acusada: cegueira curta demais', () => {
  const r = viviane({ observedSinceMs: NOW - min(10) })
  assert.notEqual(r.state, RECEPTION_STATE.BLIND)
})

test('sem observedSinceMs confiável não acusa (fail-safe)', () => {
  for (const valor of [null, undefined, 0, NaN, 'ontem']) {
    const r = viviane({ observedSinceMs: valor })
    assert.notEqual(r.state, RECEPTION_STATE.BLIND, `observedSinceMs=${String(valor)}`)
  }
})

test('sessão desconectada nunca vira blind por essa regra', () => {
  const r = viviane({ connected: false })
  assert.equal(r.state, RECEPTION_STATE.OFFLINE)
})

test('voltar a aceitar mensagem zera a cegueira (contadores voltam a zero)', () => {
  const r = viviane({
    lastAcceptedAtMs: NOW - min(2),
    observedSinceMs: NOW - min(2),
    failuresSinceLastAccepted: 0,
    stableDropsSinceLastAccepted: 0,
  })
  assert.equal(r.state, RECEPTION_STATE.OK)
})

test('cada teto de evidência pode ser desligado sozinho sem matar a regra', () => {
  const soQueda = viviane({ blindMinFailures: 0, failuresSinceLastAccepted: 999 })
  assert.equal(soQueda.state, RECEPTION_STATE.BLIND, 'queda ainda sustenta')
  const nenhuma = viviane({ blindMinFailures: 0, blindMinDrops: 0 })
  assert.notEqual(nenhuma.state, RECEPTION_STATE.BLIND, 'sem nenhuma evidência habilitada, não acusa')
})
