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

// Causa raiz das sessões "paradas sem evento de desconexão" (RCA 2026-08-26):
// quando o acesso vence, o próprio worker grava `disconnected` e SAI
// (bot-worker.js, "Acesso expirado — bot bloqueado"). Não há evento de queda,
// não há robô no ar, e o monitor do supervisor não ressuscita — de propósito.
test('acesso vencido é estado próprio, não "parada sem ninguém tentando"', () => {
  const r = owner({ accessExpiresAt: NOW - 86_400_000, lastEventType: 'reconnect_success' })
  assert.equal(r.owner, SESSION_OWNER.EXPIRED)
  assert.equal(r.canAdminRetry, false, 'subir o robô só repetiria o ciclo: sobe, vê que venceu, sai')
})

test('acesso vencido vence até o caso de QR', () => {
  const r = owner({ accessExpiresAt: NOW - 86_400_000, lastDisconnectCode: 401 })
  assert.equal(r.owner, SESSION_OWNER.EXPIRED, 'pedir QR para quem não pode usar seria pior')
})

test('acesso válido não muda nada', () => {
  const r = owner({ accessExpiresAt: NOW + 5 * 86_400_000, lastHeartbeatAt: null })
  assert.equal(r.owner, SESSION_OWNER.NOBODY)
  assert.equal(r.canAdminRetry, true)
})

test('sem data de acesso conhecida, não assume vencido', () => {
  assert.equal(owner({ accessExpiresAt: null }).owner, SESSION_OWNER.NOBODY)
})

test('sessão conectada com acesso vencido continua aparecendo como conectada', () => {
  const r = owner({ status: 'connected', accessExpiresAt: NOW - 86_400_000 })
  assert.equal(r.owner, SESSION_OWNER.CONNECTED)
})
