import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveSessionOwner, SESSION_OWNER } from '../src/core/sessionOwnership.js'

const NOW = 1_800_000_000_000
const min = (n) => n * 60_000

function owner(overrides = {}) {
  return resolveSessionOwner({ status: 'disconnected', workerRunning: false, now: NOW, ...overrides })
}

test('conectado não tem dono de problema', () => {
  assert.equal(owner({ status: 'connected' }).owner, SESSION_OWNER.CONNECTED)
})

test('desvinculou o aparelho (401) precisa da cliente — e o botão NÃO resolve', () => {
  const r = owner({ lastDisconnectCode: 401, lastEventType: 'disconnect_terminal' })
  assert.equal(r.owner, SESSION_OWNER.CLIENT)
  assert.equal(r.canAdminRetry, false, 'reconectar daqui só geraria um QR que só ela pode ler')
})

test('auth apagado por nós também precisa da cliente', () => {
  assert.equal(owner({ lastEventType: 'auth_reset' }).owner, SESSION_OWNER.CLIENT)
})

test('número recusado pelo WhatsApp (403) é caso à parte e não oferece clique', () => {
  const r = owner({ lastDisconnectCode: '403' })
  assert.equal(r.owner, SESSION_OWNER.BLOCKED)
  assert.equal(r.canAdminRetry, false)
})

test('desligou pelo painel é escolha dela, mas o clique pode religar', () => {
  const r = owner({ lastEventType: 'manual_stop_requested' })
  assert.equal(r.owner, SESSION_OWNER.CLIENT_STOPPED)
  assert.equal(r.canAdminRetry, true)
})

test('lifecycle stopped_by_user também conta como desligado por ela', () => {
  assert.equal(owner({ lifecycle: 'stopped_by_user' }).owner, SESSION_OWNER.CLIENT_STOPPED)
})

test('robô vivo com heartbeat fresco está tentando sozinho', () => {
  const r = owner({ workerRunning: true, lastHeartbeatAt: NOW - min(1), lastDisconnectCode: 500 })
  assert.equal(r.owner, SESSION_OWNER.ROBOT)
  assert.equal(r.canAdminRetry, false, 'não atropelar quem já está tentando')
})

// O caso que passava despercebido: 13 workers no ar para 67 sessões caídas.
test('sem robô e sem heartbeat recente: ninguém está tentando', () => {
  const r = owner({ workerRunning: false, lastHeartbeatAt: NOW - min(90), lastDisconnectCode: 500 })
  assert.equal(r.owner, SESSION_OWNER.NOBODY)
  assert.equal(r.canAdminRetry, true)
})

test('último evento "reconectou" mas sem robô no ar continua sendo ninguém tentando', () => {
  const r = owner({ lastEventType: 'reconnect_success', workerRunning: false, lastHeartbeatAt: NOW - min(120) })
  assert.equal(r.owner, SESSION_OWNER.NOBODY)
})

test('sem saber se o robô está de pé, heartbeat fresco não oferece o clique', () => {
  const r = owner({ workerRunning: null, lastHeartbeatAt: NOW - min(2) })
  assert.equal(r.owner, SESSION_OWNER.ROBOT)
  assert.equal(r.canAdminRetry, false)
})

test('sessão sem heartbeat nenhum (nunca conectou) é ninguém tentando', () => {
  assert.equal(owner({ lastHeartbeatAt: null }).owner, SESSION_OWNER.NOBODY)
})

test('a ação da cliente tem precedência sobre o robô estar vivo', () => {
  const r = owner({ lastDisconnectCode: 401, workerRunning: true, lastHeartbeatAt: NOW - min(1) })
  assert.equal(r.owner, SESSION_OWNER.CLIENT, 'worker vivo não conserta credencial apagada')
})
