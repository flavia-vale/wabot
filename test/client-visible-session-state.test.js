import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveClientVisibleState, CLIENT_SESSION_STATE, DEFAULT_CLIENT_GRACE_MS } from '../src/core/clientVisibleSessionState.js'

const min = (n) => n * 60_000

test('conectado e recebendo: nada de especial na tela', () => {
  const r = resolveClientVisibleState({ running: true, status: 'connected', receptionState: 'ok' })
  assert.equal(r.state, CLIENT_SESSION_STATE.CONNECTED)
  assert.equal(r.needsAction, false)
})

test('conectado e sem receber vira aviso próprio (não some no verde)', () => {
  const r = resolveClientVisibleState({ running: true, status: 'connected', receptionState: 'blind' })
  assert.equal(r.state, CLIENT_SESSION_STATE.NOT_RECEIVING)
  assert.equal(r.needsAction, false, 'o robô ainda está tentando; não é ação dela')
})

test('queda que o robô resolve rápido NÃO aparece para a cliente', () => {
  const r = resolveClientVisibleState({
    running: true, status: 'connecting', lifecycle: 'reconnecting', disconnectedForMs: min(1),
  })
  assert.equal(r.state, CLIENT_SESSION_STATE.CONNECTED)
  assert.equal(r.hiddenByGrace, true)
})

test('passada a carência, mostra que está se recuperando sozinho', () => {
  const r = resolveClientVisibleState({
    running: true, status: 'disconnected', lifecycle: 'reconnecting', disconnectedForMs: min(5),
  })
  assert.equal(r.state, CLIENT_SESSION_STATE.RECOVERING)
  assert.equal(r.needsAction, false)
})

// LIMITE 1: ação necessária nunca espera carência.
test('deslogada no celular (401) aparece na hora, mesmo dentro da carência', () => {
  const r = resolveClientVisibleState({
    running: true, status: 'connecting', lifecycle: 'reconnecting', lastDisconnectCode: 401, disconnectedForMs: 5_000,
  })
  assert.equal(r.state, CLIENT_SESSION_STATE.ACTION_REQUIRED)
  assert.equal(r.needsAction, true)
  assert.equal(r.hiddenByGrace, false)
})

test('bloqueio do WhatsApp (403) aparece na hora', () => {
  const r = resolveClientVisibleState({ running: true, status: 'disconnected', lastDisconnectCode: '403', disconnectedForMs: 1_000 })
  assert.equal(r.state, CLIENT_SESSION_STATE.ACTION_REQUIRED)
  assert.equal(r.reason, 'bloqueio')
})

test('parada pedida pela cliente é estado próprio, não alarme', () => {
  const r = resolveClientVisibleState({ running: false, status: 'disconnected', lifecycle: 'stopped_by_user', disconnectedForMs: 1_000 })
  assert.equal(r.state, CLIENT_SESSION_STATE.STOPPED)
})

// LIMITE 2: a carência não pode passar do teto de reconexão presa.
test('carência é limitada pelo teto de reconexão presa', () => {
  const r = resolveClientVisibleState({
    running: true, status: 'connecting', lifecycle: 'reconnecting',
    disconnectedForMs: min(2.5), graceMs: min(10), maxReconnectingMs: min(2),
  })
  assert.equal(r.state, CLIENT_SESSION_STATE.RECOVERING, 'o teto vence a carência')
})

// LIMITE 3: na dúvida, mostra a verdade.
test('sem saber há quanto tempo caiu, não esconde nada', () => {
  const r = resolveClientVisibleState({ running: true, status: 'connecting', lifecycle: 'reconnecting', disconnectedForMs: null })
  assert.equal(r.state, CLIENT_SESSION_STATE.RECOVERING)
  assert.equal(r.hiddenByGrace, false)
})

test('pareamento em curso é conectando, não queda', () => {
  const r = resolveClientVisibleState({ running: true, status: 'connecting', awaitingUserAction: true })
  assert.equal(r.state, CLIENT_SESSION_STATE.CONNECTING)
})

test('parada de verdade, sem reconexão agendada, pede ação', () => {
  const r = resolveClientVisibleState({ running: false, status: 'disconnected', lifecycle: 'idle' })
  assert.equal(r.state, CLIENT_SESSION_STATE.ACTION_REQUIRED)
  assert.equal(r.needsAction, true)
})

test('carência padrão é de minutos, não de horas', () => {
  assert.ok(DEFAULT_CLIENT_GRACE_MS <= min(5), 'carência longa demais esconderia queda real')
})
