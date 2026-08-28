import test from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldResurrectSession,
  buildResurrectionWhere,
  resolveIncludeReconnecting,
} from '../src/core/sessionResurrectionPolicy.js'

test('sessão que estava conectada volta a subir (comportamento histórico)', () => {
  assert.equal(shouldResurrectSession({ status: 'connected', lifecycle: 'ready' }), true)
  assert.equal(shouldResurrectSession({ status: 'connecting', lifecycle: 'connecting' }), true)
})

// O caso do RCA 2026-08-27: depois de 2min presa, o worker grava
// status=disconnected com lifecycle=reconnecting. Antes, isso a tirava da
// lista de ressurreição e ela morria de vez.
test('sessão que o robô declarou "ainda tentando" volta a subir', () => {
  assert.equal(shouldResurrectSession({ status: 'disconnected', lifecycle: 'reconnecting' }), true)
})

test('quem parou de propósito NUNCA é ressuscitada', () => {
  for (const lifecycle of ['stopped_by_user', 'auth_reset_required', 'disconnected', 'authenticating']) {
    assert.equal(
      shouldResurrectSession({ status: 'disconnected', lifecycle }),
      false,
      `${lifecycle} não pode ser ressuscitada`
    )
  }
})

// A parada deliberada vence até o status antigo: se a cliente desligou logo
// após um connected, respeitamos a decisão dela.
test('parada deliberada vence o status', () => {
  assert.equal(shouldResurrectSession({ status: 'connected', lifecycle: 'stopped_by_user' }), false)
  assert.equal(shouldResurrectSession({ status: 'connecting', lifecycle: 'auth_reset_required' }), false)
})

test('status desconhecido não ressuscita', () => {
  assert.equal(shouldResurrectSession({ status: 'blocked', lifecycle: 'ready' }), false)
  assert.equal(shouldResurrectSession({}), false)
})

test('a chave de desligamento volta ao comportamento antigo', () => {
  assert.equal(shouldResurrectSession({ status: 'disconnected', lifecycle: 'reconnecting', includeReconnecting: false }), false)
  assert.equal(shouldResurrectSession({ status: 'connected', includeReconnecting: false }), true)
  assert.equal(resolveIncludeReconnecting('0'), false)
  assert.equal(resolveIncludeReconnecting(undefined), true)
  assert.equal(resolveIncludeReconnecting('1'), true)
})

test('o filtro do banco cobre os dois casos, sem varrer a base', () => {
  const where = buildResurrectionWhere({})
  assert.deepEqual(where.OR[0], { status: { in: ['connected', 'connecting'] } })
  assert.deepEqual(where.OR[1], { status: 'disconnected', lifecycle: 'reconnecting' })
})

test('com a chave desligada o filtro é o histórico', () => {
  assert.deepEqual(buildResurrectionWhere({ includeReconnecting: false }), { status: { in: ['connected', 'connecting'] } })
})

// Guardas de fiação: a correção precisa valer nos DOIS modos (inline e
// remote) e nos DOIS momentos (boot e monitor de saúde). Cobrir só um deles
// deixaria o bug vivo em metade dos ambientes — e impediria validar em
// staging, que roda inline.
import { readFileSync } from 'node:fs'

const supervisor = readFileSync(new URL('../src/supervisor/index.js', import.meta.url), 'utf8')
const sessionCore = readFileSync(new URL('../src/core/sessionCore.js', import.meta.url), 'utf8')

test('o supervisor (modo remote) usa a política nos dois momentos', () => {
  const ocorrencias = supervisor.match(/buildResurrectionWhere\(/g) || []
  assert.equal(ocorrencias.length, 2, 'boot e monitor de saúde')
  assert.match(supervisor, /shouldResurrectSession\(\{ \.\.\.row/)
})

test('o sessionCore (modo inline) usa a mesma política', () => {
  const ocorrencias = sessionCore.match(/buildResurrectionWhere\(/g) || []
  assert.equal(ocorrencias.length, 2, 'resume e monitor de saúde')
})

test('nenhum dos dois volta a filtrar só por connected/connecting na mão', () => {
  for (const [nome, fonte] of [['supervisor', supervisor], ['sessionCore', sessionCore]]) {
    assert.doesNotMatch(
      fonte,
      /where: \{ status: \{ in: \['connected', 'connecting'\] \} \}/,
      `${nome} voltou a usar o filtro antigo — o bug do RCA 2026-08-27 volta junto`
    )
  }
})

test('a ressurreição do caso do RCA deixa sinal para podermos medir', () => {
  assert.match(supervisor, /wa_session_resurrected/)
  assert.match(supervisor, /eraOrfaReconectando/)
})
