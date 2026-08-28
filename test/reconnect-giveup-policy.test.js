import test from 'node:test'
import assert from 'node:assert/strict'
import {
  decideRetryPace,
  RETRY_ACTION,
  DEFAULT_GIVEUP_ATTEMPTS,
  DEFAULT_SLOW_INTERVAL_MS,
  DEFAULT_NEVER_CONNECTED_MAX,
} from '../src/core/reconnectGiveupPolicy.js'

const base = 5 * 60_000

test('sessão saudável que cai continua tentando no ritmo normal', () => {
  const r = decideRetryPace({ consecutiveFailures: 3, everConnected: true, baseDelayMs: base })
  assert.equal(r.action, RETRY_ACTION.RETRY)
  assert.equal(r.delayMs, base)
})

// O caso das três contas do RCA: 94 tentativas, zero conexões.
test('depois do teto, a sessão que já conectou passa a tentar devagar', () => {
  const r = decideRetryPace({ consecutiveFailures: DEFAULT_GIVEUP_ATTEMPTS, everConnected: true, baseDelayMs: base })
  assert.equal(r.action, RETRY_ACTION.SLOW)
  assert.equal(r.delayMs, DEFAULT_SLOW_INTERVAL_MS)
})

test('desacelerar NÃO é desistir: quem já conectou nunca é parada', () => {
  const r = decideRetryPace({ consecutiveFailures: 500, everConnected: true, baseDelayMs: base })
  assert.equal(r.action, RETRY_ACTION.SLOW, 'queda longa do WhatsApp precisa se recuperar sozinha')
})

test('sessão que nunca conectou para depois do limite (só QR resolve)', () => {
  const r = decideRetryPace({ consecutiveFailures: DEFAULT_NEVER_CONNECTED_MAX, everConnected: false, baseDelayMs: base })
  assert.equal(r.action, RETRY_ACTION.STOP)
  assert.equal(r.delayMs, null)
})

test('sessão que nunca conectou ainda tem as primeiras tentativas', () => {
  const r = decideRetryPace({ consecutiveFailures: 3, everConnected: false, baseDelayMs: base })
  assert.equal(r.action, RETRY_ACTION.RETRY)
})

test('o ritmo lento nunca é MENOR que o backoff já calculado', () => {
  const r = decideRetryPace({ consecutiveFailures: 50, everConnected: true, baseDelayMs: 30 * 60_000 })
  assert.equal(r.delayMs, 30 * 60_000)
})

test('teto zerado desliga a desaceleração (escape hatch)', () => {
  const r = decideRetryPace({ consecutiveFailures: 999, everConnected: true, baseDelayMs: base, giveupAttempts: 0 })
  assert.equal(r.action, RETRY_ACTION.RETRY)
})

test('limite de nunca-conectou zerado desliga a parada', () => {
  const r = decideRetryPace({ consecutiveFailures: 999, everConnected: false, baseDelayMs: base, neverConnectedMax: 0, giveupAttempts: 0 })
  assert.equal(r.action, RETRY_ACTION.RETRY)
})

test('entrada vazia não quebra e não afrouxa nada', () => {
  const r = decideRetryPace({})
  assert.equal(r.action, RETRY_ACTION.RETRY)
  assert.equal(r.delayMs, 0)
})

test('os padrões são conservadores o bastante para não atrapalhar a frota saudável', () => {
  // Hoje ninguém na frota chega perto disso sem conectar no meio.
  assert.ok(DEFAULT_GIVEUP_ATTEMPTS >= 10)
  assert.ok(DEFAULT_SLOW_INTERVAL_MS <= 30 * 60_000, 'espera longa demais quebraria a promessa de robô 24h')
})

// Guardas de fiação: as propriedades de segurança vivem no bot-worker, e é lá
// que somem num refactor distraído.
import { readFileSync } from 'node:fs'
const worker = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

test('conexão bem-sucedida zera o orçamento de tentativas', () => {
  assert.match(worker, /everOpened = true\n\s+consecutiveFailedReconnects = 0/)
})

test('o contador vive em escopo de módulo (sobrevive às reconexões do worker)', () => {
  const antesDoStartBot = worker.slice(0, worker.indexOf('async function startBotInner'))
  assert.match(antesDoStartBot, /let consecutiveFailedReconnects = 0/)
})

test('o teto só age no close genérico, não no pareamento nem no replaced', () => {
  const trecho = worker.slice(worker.indexOf('consecutiveFailedReconnects++'), worker.indexOf("scheduleReconnect(delayMs, { code, reason: f.flapping"))
  assert.match(trecho, /decideRetryPace\(\{/)
  assert.doesNotMatch(trecho, /pairing/i)
})

test('parar de tentar deixa a sessão marcada como precisando de ação', () => {
  assert.match(worker, /type: 'retry_giveup'/)
  assert.match(worker, /status: 'disconnected', lifecycle: 'disconnected'/)
})

test('desacelerar e desistir deixam sinal durável', () => {
  assert.match(worker, /recordOperationalSignal\('wa_retry_giveup'/)
  assert.match(worker, /recordOperationalSignal\('wa_retry_slowed'/)
})
