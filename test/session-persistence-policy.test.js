import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAuthResetSessionPatch, buildCloseSessionPatch, buildHeartbeatSessionPatch, computeHeartbeatState, DEFAULT_MAX_RECONNECTING_MS } from '../src/core/sessionPersistencePolicy.js'

test('close transitório fica resumível para blindar sessões ativas', () => {
  const now = new Date('2026-06-30T12:00:00.000Z')
  const patch = buildCloseSessionPatch({ code: 428, terminal: false, ownerInstance: 'api-1', now })

  assert.equal(patch.status, 'connecting')
  assert.equal(patch.lifecycle, 'reconnecting')
  assert.equal(patch.lastDisconnectCode, '428')
  assert.equal(patch.ownerInstance, 'api-1')
  assert.equal(patch.lastHeartbeatAt, now)
})

test('close terminal pode marcar disconnected', () => {
  const patch = buildCloseSessionPatch({ code: 401, terminal: true })

  assert.equal(patch.status, 'disconnected')
  assert.equal(patch.lifecycle, 'disconnected')
  assert.equal(patch.lastDisconnectCode, '401')
})

test('reset explícito de auth marca necessidade de reparar sem parecer queda transitória', () => {
  const patch = buildAuthResetSessionPatch({ code: 500, ownerInstance: 'worker-1' })

  assert.equal(patch.status, 'disconnected')
  assert.equal(patch.lifecycle, 'auth_reset_required')
  assert.equal(patch.lastDisconnectCode, '500')
  assert.equal(patch.ownerInstance, 'worker-1')
})

test('computeHeartbeatState: socket ativo é sempre connected', () => {
  assert.equal(
    computeHeartbeatState({ hasActiveSock: true, hasPendingSock: false, hasReconnectScheduled: false }),
    'connected',
  )
})

test('computeHeartbeatState: socket pendente (handshake em curso) é connecting', () => {
  assert.equal(
    computeHeartbeatState({ hasActiveSock: false, hasPendingSock: true, hasReconnectScheduled: false }),
    'connecting',
  )
})

test('computeHeartbeatState: reconexão automática agendada NÃO pode virar idle (bug do falso offline)', () => {
  assert.equal(
    computeHeartbeatState({ hasActiveSock: false, hasPendingSock: false, hasReconnectScheduled: true }),
    'connecting',
  )
})

test('computeHeartbeatState: sem socket e sem reconexão agendada é idle de verdade', () => {
  assert.equal(
    computeHeartbeatState({ hasActiveSock: false, hasPendingSock: false, hasReconnectScheduled: false }),
    'idle',
  )
})

test('computeHeartbeatState: reconexão agendada mas dentro do teto continua connecting', () => {
  assert.equal(
    computeHeartbeatState({
      hasActiveSock: false,
      hasPendingSock: false,
      hasReconnectScheduled: true,
      disconnectedForMs: 60_000,
      maxReconnectingMs: 300_000,
    }),
    'connecting',
  )
})

test('computeHeartbeatState: válvula de segurança — preso reconectando além do teto vira idle mesmo com reconexão agendada', () => {
  assert.equal(
    computeHeartbeatState({
      hasActiveSock: false,
      hasPendingSock: false,
      hasReconnectScheduled: true,
      disconnectedForMs: 6 * 60_000,
      maxReconnectingMs: 5 * 60_000,
    }),
    'idle',
  )
})

test('computeHeartbeatState: default de alta disponibilidade expõe reconnect preso após 2min', () => {
  assert.equal(DEFAULT_MAX_RECONNECTING_MS, 2 * 60_000)
  assert.equal(
    computeHeartbeatState({
      hasActiveSock: false,
      hasPendingSock: false,
      hasReconnectScheduled: true,
      disconnectedForMs: DEFAULT_MAX_RECONNECTING_MS + 1,
    }),
    'idle',
  )
})

test('buildHeartbeatSessionPatch: idle com reconexão agendada é honesto (disconnected) mas lifecycle=reconnecting', () => {
  // Ainda tentando sozinho: status honesto disconnected, mas painel pode tranquilizar.
  assert.deepEqual(
    buildHeartbeatSessionPatch({ state: 'idle', reconnectScheduled: true }),
    { status: 'disconnected', lifecycle: 'reconnecting' },
  )
  // Idle sem reconexão agendada = parada de verdade.
  assert.deepEqual(
    buildHeartbeatSessionPatch({ state: 'idle', reconnectScheduled: false }),
    { status: 'disconnected', lifecycle: 'disconnected' },
  )
  // Nunca mascara: idle jamais vira 'connecting'/'connected'.
  assert.equal(buildHeartbeatSessionPatch({ state: 'idle', reconnectScheduled: true }).status, 'disconnected')
  // connecting mapeia direto.
  assert.deepEqual(buildHeartbeatSessionPatch({ state: 'connecting' }), { status: 'connecting', lifecycle: 'connecting' })
  // connected não força status (deixa o caminho de 'open' escrever ready).
  assert.deepEqual(buildHeartbeatSessionPatch({ state: 'connected' }), {})
})

test('computeHeartbeatState: válvula de segurança também vale com pendingSock vivo (handshake que nunca fecha)', () => {
  assert.equal(
    computeHeartbeatState({
      hasActiveSock: false,
      hasPendingSock: true,
      hasReconnectScheduled: false,
      disconnectedForMs: 10 * 60_000,
      maxReconnectingMs: 5 * 60_000,
    }),
    'idle',
  )
})

test('computeHeartbeatState: sem disconnectedForMs informado, usa 0 (comportamento antigo preservado)', () => {
  assert.equal(
    computeHeartbeatState({ hasActiveSock: false, hasPendingSock: false, hasReconnectScheduled: true }),
    'connecting',
  )
})
