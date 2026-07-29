import test from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldResumeSession,
  STOPPED_BY_USER_LIFECYCLE,
  ALWAYS_RESUMABLE_STATUSES,
} from '../src/core/sessionResumePolicy.js'

const activeUser = { userStatus: 'active', accessExpiresAt: null }

test('sessão abandonada por incidente, com credencial, é retomada', () => {
  // O caso do RCA: o heartbeat marcou 'disconnected' durante o apagão do 405 e
  // a sessão sumiu da retomada, mesmo com a credencial intacta no disco.
  const v = shouldResumeSession({
    status: 'disconnected',
    lifecycle: 'reconnecting',
    hasCredential: true,
    ...activeUser,
  })
  assert.deepEqual(v, { resume: true, reason: 'abandoned_with_credential' })
})

test('quem desligou pelo painel NÃO é religado', () => {
  // Invariante mais importante do módulo: POST /session/stop grava o MESMO
  // status 'disconnected' que o incidente. Sem respeitar a intenção, a
  // "correção" religaria o robô de quem desligou de propósito.
  const v = shouldResumeSession({
    status: 'disconnected',
    lifecycle: STOPPED_BY_USER_LIFECYCLE,
    hasCredential: true,
    ...activeUser,
  })
  assert.deepEqual(v, { resume: false, reason: 'stopped_by_user' })
})

test('sem credencial não retoma — só geraria QR que ninguém pediu', () => {
  // Caso real: sessão encerrada por logout (401) tem o auth apagado de
  // propósito. Subir um socket aí só produz QR sem ninguém esperando.
  const v = shouldResumeSession({
    status: 'disconnected',
    lifecycle: 'disconnected',
    hasCredential: false,
    ...activeUser,
  })
  assert.deepEqual(v, { resume: false, reason: 'no_credential' })
})

test('lifecycle ausente (linha legada) com credencial ainda é retomada', () => {
  const v = shouldResumeSession({ status: 'disconnected', hasCredential: true, ...activeUser })
  assert.equal(v.resume, true)
})

test('status histórico continua retomando exatamente como antes', () => {
  for (const status of ALWAYS_RESUMABLE_STATUSES) {
    const v = shouldResumeSession({ status, hasCredential: false, ...activeUser })
    assert.deepEqual(v, { resume: true, reason: 'persisted_active' }, `status ${status}`)
  }
})

test('status histórico ignora o marcador de parada manual', () => {
  // Se a sessão voltou a 'connecting', a cliente mandou ligar de novo — o
  // marcador antigo não pode segurar.
  const v = shouldResumeSession({
    status: 'connecting',
    lifecycle: STOPPED_BY_USER_LIFECYCLE,
    hasCredential: true,
    ...activeUser,
  })
  assert.equal(v.resume, true)
})

test('conta bloqueada nunca sobe, nem com status ativo', () => {
  for (const userStatus of ['banned', 'suspended']) {
    const v = shouldResumeSession({ status: 'connected', hasCredential: true, userStatus, accessExpiresAt: null })
    assert.deepEqual(v, { resume: false, reason: 'account_blocked' }, userStatus)
  }
})

test('assinatura vencida não sobe — mesma regra do botão Conectar', () => {
  const now = new Date('2026-07-29T12:00:00Z')
  const v = shouldResumeSession({
    status: 'disconnected',
    hasCredential: true,
    userStatus: 'active',
    accessExpiresAt: new Date('2026-07-01T00:00:00Z'),
  }, now)
  assert.deepEqual(v, { resume: false, reason: 'access_expired' })
})

test('assinatura em dia sobe normalmente', () => {
  const now = new Date('2026-07-29T12:00:00Z')
  const v = shouldResumeSession({
    status: 'disconnected',
    hasCredential: true,
    userStatus: 'active',
    accessExpiresAt: new Date('2026-12-01T00:00:00Z'),
  }, now)
  assert.equal(v.resume, true)
})

test('accessExpiresAt inválido não bloqueia por engano', () => {
  const v = shouldResumeSession({
    status: 'connected',
    hasCredential: true,
    userStatus: 'active',
    accessExpiresAt: 'data-invalida',
  })
  assert.equal(v.resume, true)
})

test('status desconhecido não é retomado', () => {
  const v = shouldResumeSession({ status: 'auth_reset_required', hasCredential: true, ...activeUser })
  assert.deepEqual(v, { resume: false, reason: 'status_not_resumable' })
})

test('entrada vazia não explode e não retoma', () => {
  assert.deepEqual(shouldResumeSession(null), { resume: false, reason: 'status_not_resumable' })
  assert.deepEqual(shouldResumeSession({}), { resume: false, reason: 'status_not_resumable' })
})
