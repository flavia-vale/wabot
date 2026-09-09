// Guarda do aviso "está acabando vaga de robô". Puro: sem banco, sem SMTP,
// sem Redis — o db e o sendMail são dublês.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_CAPACITY_ALERT_EMAIL,
  resolveAlertCooldownMs,
  resolveAlertFreeSlots,
  resolveAlertRecipients,
  resolveSessionCapacityMax,
  isCapacityAlertEnabled,
  shouldAlertSessionCapacity,
} from '../src/ops/sessionCapacityAlertPolicy.js'
import {
  buildCapacityAlertEmail,
  countRunningBots,
  runSessionCapacityAlertSweep,
} from '../src/ops/sessionCapacityAlertSweep.js'

const COOLDOWN = 12 * 60 * 60 * 1000

function fakeDb({ lastEvent = null } = {}) {
  const created = []
  return {
    created,
    analyticsEvent: {
      findFirst: async () => lastEvent,
      create: async ({ data }) => { created.push(data); return data },
    },
  }
}

test('o teto default é o mesmo do supervisor (20)', () => {
  assert.equal(resolveSessionCapacityMax({}), 20)
  assert.equal(resolveSessionCapacityMax({ MAX_SESSIONS_PER_PROCESS: '30' }), 30)
  // valor inválido (o supervisor produz NaN com a mesma fórmula) não pode
  // virar aviso: a política trata teto não confiável como "não sei" e cala.
  const tetoLixo = resolveSessionCapacityMax({ MAX_SESSIONS_PER_PROCESS: 'abc' })
  const d = shouldAlertSessionCapacity({ running: 19, max: tetoLixo, freeSlots: 2, cooldownMs: COOLDOWN })
  assert.equal(d.alert, false)
  assert.equal(d.reason, 'teto_indisponivel')
})

test('avisa faltando 2 vagas, como pedido', () => {
  const base = { max: 20, freeSlots: 2, cooldownMs: COOLDOWN }
  assert.equal(shouldAlertSessionCapacity({ ...base, running: 17 }).alert, false)
  assert.equal(shouldAlertSessionCapacity({ ...base, running: 18 }).alert, true)
  assert.equal(shouldAlertSessionCapacity({ ...base, running: 19 }).alert, true)
  assert.equal(shouldAlertSessionCapacity({ ...base, running: 20 }).reason, 'sem_vaga')
})

test('contagem indisponível NÃO avisa (fail-safe)', () => {
  for (const running of [null, undefined, NaN, -1, 'muitos']) {
    const d = shouldAlertSessionCapacity({ running, max: 20, freeSlots: 2, cooldownMs: COOLDOWN })
    assert.equal(d.alert, false, `running=${String(running)}`)
    assert.equal(d.reason, 'contagem_indisponivel')
  }
})

test('não repete o aviso dentro da janela, e volta a avisar depois dela', () => {
  const now = new Date('2026-09-09T12:00:00Z')
  const dentro = shouldAlertSessionCapacity({
    running: 19, max: 20, freeSlots: 2, cooldownMs: COOLDOWN, now,
    lastAlertAt: new Date('2026-09-09T09:00:00Z'),
  })
  assert.equal(dentro.alert, false)
  assert.equal(dentro.reason, 'avisado_recentemente')

  const depois = shouldAlertSessionCapacity({
    running: 19, max: 20, freeSlots: 2, cooldownMs: COOLDOWN, now,
    lastAlertAt: new Date('2026-09-08T12:00:00Z'),
  })
  assert.equal(depois.alert, true)
})

test('destinatário default é o endereço pedido; env sobrescreve e vazio desliga', () => {
  assert.deepEqual(resolveAlertRecipients({}), [DEFAULT_CAPACITY_ALERT_EMAIL])
  assert.deepEqual(resolveAlertRecipients({ CAPACITY_ALERT_EMAIL: 'a@x.com, b@y.com' }), ['a@x.com', 'b@y.com'])
  assert.deepEqual(resolveAlertRecipients({ CAPACITY_ALERT_EMAIL: '' }), [])
  assert.equal(isCapacityAlertEnabled({ CAPACITY_ALERT_ENABLED: 'false' }), false)
  assert.equal(resolveAlertFreeSlots({}), 2)
  assert.equal(resolveAlertCooldownMs({}), COOLDOWN)
})

test('contagem aceita as formas que o manager devolve, e engole falha', async () => {
  assert.equal(await countRunningBots(async () => ['a', 'b']), 2)
  assert.equal(await countRunningBots(async () => 7), 7)
  assert.equal(await countRunningBots(async () => ({ bots: ['a'] })), 1)
  assert.equal(await countRunningBots(async () => { throw new Error('timeout') }), null)
})

test('linguagem leiga: sem jargão de processo/worker/shard na mensagem', () => {
  const { subject, html, text } = buildCapacityAlertEmail({ running: 18, max: 20, free: 2 })
  const tudo = `${subject} ${html} ${text}`.toLowerCase()
  for (const jargao of ['worker', 'shard', 'circuit breaker', 'process', 'supervisor', 'session']) {
    assert.ok(!tudo.includes(jargao), `jargão "${jargao}" chegou à mensagem`)
  }
  assert.ok(subject.includes('18') && subject.includes('20'))
})

test('passada envia uma vez e registra o evento durável', async () => {
  const db = fakeDb()
  const enviados = []
  const summary = await runSessionCapacityAlertSweep({
    db,
    listRunningBots: async () => Array.from({ length: 18 }, (_, i) => String(i)),
    sendMail: async (msg) => { enviados.push(msg); return { skipped: false } },
    env: {},
    now: new Date('2026-09-09T12:00:00Z'),
    logger: { warn() {}, error() {} },
  })
  assert.equal(summary.sent, 1)
  assert.equal(enviados.length, 1)
  assert.equal(enviados[0].to, DEFAULT_CAPACITY_ALERT_EMAIL)
  assert.equal(db.created.length, 1)
  assert.equal(db.created[0].event, 'ops_session_capacity_warning')
})

test('sem SMTP não grava o evento — a janela anti-spam não pode queimar à toa', async () => {
  const db = fakeDb()
  const summary = await runSessionCapacityAlertSweep({
    db,
    listRunningBots: async () => Array.from({ length: 19 }, (_, i) => String(i)),
    sendMail: async () => ({ skipped: true }),
    env: {},
    logger: { warn() {}, error() {} },
  })
  assert.equal(summary.sent, 0)
  assert.equal(summary.reason, 'sem_smtp')
  assert.equal(db.created.length, 0)
})

test('com folga de vaga não envia nada', async () => {
  const db = fakeDb()
  let chamou = false
  const summary = await runSessionCapacityAlertSweep({
    db,
    listRunningBots: async () => ['a', 'b', 'c'],
    sendMail: async () => { chamou = true; return { skipped: false } },
    env: {},
    logger: { warn() {}, error() {} },
  })
  assert.equal(chamou, false)
  assert.equal(summary.reason, 'ainda_tem_vaga')
})

test('o evento está na allowlist de analytics (senão sumiria em silêncio)', async () => {
  // Leitura do source (não import): analytics.js puxa o Prisma Client, e a
  // suíte é db-free de propósito.
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../src/analytics.js', import.meta.url), 'utf8')
  assert.ok(src.includes("'ops_session_capacity_warning'"))
})
