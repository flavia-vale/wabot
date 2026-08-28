import test from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldSelfHealReception,
  DEFAULT_SILENCE_MS,
  DEFAULT_MIN_BASELINE,
} from '../src/core/receptionSelfHeal.js'

const NOW = 1_800_000_000_000
const min = (n) => n * 60_000

function cenario(overrides = {}) {
  return shouldSelfHealReception({
    now: NOW,
    connected: true,
    connectedSinceMs: NOW - min(180),
    lastAcceptedAtMs: NOW - min(65),
    acceptedInBaselineWindow: 400,
    lastHealAtMs: null,
    healsToday: 0,
    ...overrides,
  })
}

// O caso da Cynthia: conta que recebe 4-14 mensagens por minuto ficou 65
// minutos sem nenhuma, com a sessão conectada e nenhum evento de queda.
test('conta que recebe muito e ficou uma hora muda dispara a auto-cura', () => {
  const r = cenario()
  assert.equal(r.heal, true)
  assert.equal(r.silentForMs, min(65))
})

test('conta que naturalmente recebe pouco NUNCA dispara', () => {
  assert.equal(cenario({ acceptedInBaselineWindow: 5 }).heal, false)
})

test('sessão desconectada não é caso de auto-cura (o status normal já cobre)', () => {
  assert.equal(cenario({ connected: false }).heal, false)
})

test('conexão recém-aberta tem carência', () => {
  assert.equal(cenario({ connectedSinceMs: NOW - min(5) }).heal, false)
})

test('silêncio curto não dispara', () => {
  assert.equal(cenario({ lastAcceptedAtMs: NOW - min(10) }).heal, false)
})

test('sessão que nunca recebeu nada não dispara (não dá para dizer que parou)', () => {
  assert.equal(cenario({ lastAcceptedAtMs: null }).heal, false)
})

// Reconexão repetida é o padrão que o WhatsApp associa a robô: os tetos são
// a parte mais importante desta política.
test('respeita cooldown de uma hora entre auto-curas', () => {
  assert.equal(cenario({ lastHealAtMs: NOW - min(20) }).heal, false)
  assert.equal(cenario({ lastHealAtMs: NOW - min(90) }).heal, true)
})

test('respeita o teto diário', () => {
  assert.equal(cenario({ healsToday: 2 }).heal, false)
  assert.equal(cenario({ healsToday: 1 }).heal, true)
})

test('teto zerado desliga a auto-cura por completo', () => {
  assert.equal(cenario({ maxPerDay: 0 }).heal, false)
  assert.equal(cenario({ minBaseline: 0 }).heal, false)
})

test('entrada vazia não dispara nada', () => {
  assert.equal(shouldSelfHealReception({}).heal, false)
})

test('os padrões são conservadores', () => {
  assert.ok(DEFAULT_SILENCE_MS >= 20 * 60_000, 'silêncio curto demais causaria reconexão à toa')
  assert.ok(DEFAULT_MIN_BASELINE >= 20, 'linha de base baixa pegaria conta naturalmente quieta')
})

// Guardas de fiação: as propriedades que importam vivem no bot-worker.
import { readFileSync } from 'node:fs'
const worker = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

test('a linha de base vive em escopo de módulo (sobrevive às reconexões)', () => {
  const antesDoStartBot = worker.slice(0, worker.indexOf('async function startBotInner'))
  assert.match(antesDoStartBot, /let acceptedTimestamps = \[\]/)
  assert.match(antesDoStartBot, /let selfHealTimestamps = \[\]/)
})

test('a auto-cura roda periodicamente, não só sob demanda', () => {
  assert.match(worker, /try \{ trySelfHealReception\(\) \} catch/)
})

// O ponto mais importante: auto-cura NÃO pode virar re-pareamento.
test('a auto-cura só fecha o socket — nunca apaga credencial nem gera QR', () => {
  const trecho = worker.slice(worker.indexOf('function trySelfHealReception'), worker.indexOf('function recordCryptoError'))
  assert.match(trecho, /activeSock\?\.end\?\.\(/)
  assert.doesNotMatch(trecho, /rm\(AUTH_DIR|auth_reset|requestPairingCode/)
})

test('cada auto-cura deixa evento e sinal para podermos medir', () => {
  assert.match(worker, /type: 'reception_self_heal'/)
  assert.match(worker, /recordOperationalSignal\('wa_reception_self_heal'/)
})
