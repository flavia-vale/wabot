// Guarda do aviso "está acabando vaga de robô". Puro: sem banco, sem SMTP,
// sem Redis — o db e o envio do aviso são dublês.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  CAPACITY_ALERT_SLUG,
  buildCapacityAlertVars,
  resolveAlertCooldownHours,
  resolveAlertFreeSlots,
  resolveSessionCapacityMax,
  isCapacityAlertEnabled,
  shouldAlertSessionCapacity,
} from '../src/ops/sessionCapacityAlertPolicy.js'
import {
  countRunningBots,
  runSessionCapacityAlertSweep,
} from '../src/ops/sessionCapacityAlertSweep.js'
import { getTemplateDefinition } from '../src/email/registry.js'

function fakeDb() {
  const created = []
  return { created, analyticsEvent: { create: async ({ data }) => { created.push(data); return data } } }
}

const quietLogger = { warn() {}, error() {} }

test('o teto default é o mesmo do supervisor (20) e a env manda', () => {
  assert.equal(resolveSessionCapacityMax({}), 20)
  assert.equal(resolveSessionCapacityMax({ MAX_SESSIONS_PER_PROCESS: '40' }), 40)
  // Valor inválido (a fórmula do supervisor produz NaN) não pode virar aviso:
  // a política trata teto não confiável como "não sei" e cala.
  const tetoLixo = resolveSessionCapacityMax({ MAX_SESSIONS_PER_PROCESS: 'abc' })
  const d = shouldAlertSessionCapacity({ running: 19, max: tetoLixo, freeSlots: 2 })
  assert.equal(d.alert, false)
  assert.equal(d.reason, 'teto_indisponivel')
})

test('avisa faltando 2 vagas, como pedido', () => {
  const base = { max: 40, freeSlots: 2 }
  assert.equal(shouldAlertSessionCapacity({ ...base, running: 37 }).alert, false)
  assert.equal(shouldAlertSessionCapacity({ ...base, running: 38 }).alert, true)
  assert.equal(shouldAlertSessionCapacity({ ...base, running: 39 }).alert, true)
  assert.equal(shouldAlertSessionCapacity({ ...base, running: 40 }).reason, 'sem_vaga')
})

test('contagem indisponível NÃO avisa (fail-safe)', () => {
  for (const running of [null, undefined, NaN, -1, 'muitos']) {
    const d = shouldAlertSessionCapacity({ running, max: 20, freeSlots: 2 })
    assert.equal(d.alert, false, `running=${String(running)}`)
    assert.equal(d.reason, 'contagem_indisponivel')
  }
})

test('interruptores têm os defaults declarados', () => {
  assert.equal(resolveAlertFreeSlots({}), 2)
  assert.equal(resolveAlertCooldownHours({}), 12)
  assert.equal(isCapacityAlertEnabled({}), true)
  assert.equal(isCapacityAlertEnabled({ CAPACITY_ALERT_ENABLED: 'false' }), false)
})

test('contagem aceita as formas que o manager devolve, e engole falha', async () => {
  assert.equal(await countRunningBots(async () => ['a', 'b']), 2)
  assert.equal(await countRunningBots(async () => 7), 7)
  assert.equal(await countRunningBots(async () => ({ bots: ['a'] })), 1)
  assert.equal(await countRunningBots(async () => { throw new Error('timeout') }), null)
})

test('o aviso é um template INTERNO — nunca vai para cliente', () => {
  const def = getTemplateDefinition(CAPACITY_ALERT_SLUG)
  assert.ok(def, 'template do aviso de vagas precisa existir no catálogo')
  assert.equal(def.audience, 'admin')
  assert.equal(def.group, 'interno')
})

test('linguagem leiga: sem jargão de processo/worker/shard no texto', () => {
  const vars = buildCapacityAlertVars({ running: 38, max: 40, free: 2 })
  const def = getTemplateDefinition(CAPACITY_ALERT_SLUG)
  const tudo = `${vars.resumo} ${vars.situacao} ${def.subject} ${def.body}`.toLowerCase()
  for (const jargao of ['worker', 'shard', 'circuit breaker', 'supervisor', 'sessão por processo', 'session']) {
    assert.ok(!tudo.includes(jargao), `jargão "${jargao}" chegou ao aviso`)
  }
  assert.ok(vars.resumo.includes('38') && vars.resumo.includes('40'))
})

test('passada envia pelo caminho de aviso interno e registra o sinal', async () => {
  const db = fakeDb()
  const enviados = []
  const summary = await runSessionCapacityAlertSweep({
    db,
    listRunningBots: async () => Array.from({ length: 38 }, (_, i) => String(i)),
    sendAlert: async (args) => { enviados.push(args); return { sent: true } },
    env: { MAX_SESSIONS_PER_PROCESS: '40' },
    now: new Date('2026-09-09T12:00:00Z'),
    logger: quietLogger,
  })
  assert.equal(summary.sent, 1)
  assert.equal(enviados.length, 1)
  assert.equal(enviados[0].slug, CAPACITY_ALERT_SLUG)
  assert.equal(enviados[0].cooldownHours, 12)
  assert.equal(enviados[0].key, 'max=40')
  assert.equal(db.created.length, 1)
  assert.equal(db.created[0].event, 'ops_session_capacity_warning')
})

test('aviso barrado (sem SMTP, cooldown) NÃO grava sinal de envio', async () => {
  for (const reason of ['sem_smtp', 'avisado_recentemente', 'desligado']) {
    const db = fakeDb()
    const summary = await runSessionCapacityAlertSweep({
      db,
      listRunningBots: async () => Array.from({ length: 19 }, (_, i) => String(i)),
      sendAlert: async () => ({ sent: false, reason }),
      env: {},
      logger: quietLogger,
    })
    assert.equal(summary.sent, 0)
    assert.equal(summary.reason, reason)
    assert.equal(db.created.length, 0)
  }
})

test('com folga de vaga não tenta enviar nada', async () => {
  const db = fakeDb()
  let chamou = false
  const summary = await runSessionCapacityAlertSweep({
    db,
    listRunningBots: async () => ['a', 'b', 'c'],
    sendAlert: async () => { chamou = true; return { sent: true } },
    env: {},
    logger: quietLogger,
  })
  assert.equal(chamou, false)
  assert.equal(summary.reason, 'ainda_tem_vaga')
})

test('o evento está na allowlist de analytics (senão sumiria em silêncio)', () => {
  // Leitura do source, não import: analytics.js puxa o Prisma Client e a
  // suíte é db-free de propósito.
  const src = readFileSync(new URL('../src/analytics.js', import.meta.url), 'utf8')
  assert.ok(src.includes("'ops_session_capacity_warning'"))
})

// ---- Roteamento por nó ----
import { countRunningBotsByNode } from '../src/ops/sessionCapacityAlertSweep.js'

const ENV_ALERTA = { CAPACITY_ALERT_ENABLED: 'true', MAX_SESSIONS_PER_PROCESS: '20', CAPACITY_ALERT_FREE_SLOTS: '2' }

test('por nó: pega o nó mais cheio entre os medidos', async () => {
  const r = await countRunningBotsByNode(async () => ({ n1: 5, n2: 19 }))
  assert.deepEqual(r, { running: 19, nodeId: 'n2', nodes: 2 })
})

test('por nó: nó não medido (null) nunca vira 0; nenhum medido -> null', async () => {
  assert.equal((await countRunningBotsByNode(async () => ({ n1: null, n2: null }))).running, null)
  assert.equal((await countRunningBotsByNode(async () => { throw new Error('x') })).running, null)
  assert.equal((await countRunningBotsByNode(async () => ({ n1: null, n2: 3 }))).running, 3)
})

test('sweep por nó: um nó cheio avisa mesmo com a soma folgada, e a chave do cooldown leva o nó', async () => {
  const enviados = []
  const r = await runSessionCapacityAlertSweep({
    db: fakeDb(),
    listRunningBots: async () => { throw new Error('não deveria ser usado') },
    listRunningBotsByNode: async () => ({ n1: 2, n2: 20 }),
    sendAlert: async args => { enviados.push(args); return { sent: true } },
    env: ENV_ALERTA,
    logger: quietLogger,
  })
  assert.equal(r.sent, 1)
  assert.equal(r.running, 20)
  assert.match(enviados[0].key, /servidor n2/)
  assert.match(enviados[0].vars.resumo, /servidor n2/)
  assert.doesNotMatch(enviados[0].vars.resumo, /nó\b|shard|node/i)
})

test('sweep por nó: todos com vaga -> não avisa; sem medição -> não avisa', async () => {
  const base = { db: fakeDb(), sendAlert: async () => { throw new Error('não deveria avisar') }, env: ENV_ALERTA, logger: quietLogger }
  assert.equal((await runSessionCapacityAlertSweep({ ...base, listRunningBotsByNode: async () => ({ n1: 3, n2: 4 }) })).sent, 0)
  assert.equal((await runSessionCapacityAlertSweep({ ...base, listRunningBotsByNode: async () => ({ n1: null }) })).reason, 'contagem_indisponivel')
})

test('sweep sem listRunningBotsByNode: chave do cooldown e texto idênticos ao legado', async () => {
  const enviados = []
  await runSessionCapacityAlertSweep({
    db: fakeDb(),
    listRunningBots: async () => Array.from({ length: 20 }, (_, i) => `u${i}`),
    sendAlert: async args => { enviados.push(args); return { sent: true } },
    env: ENV_ALERTA,
    logger: quietLogger,
  })
  assert.equal(enviados[0].key, 'max=20')
  assert.equal(enviados[0].vars.resumo, '20 robôs ligados de 20 que cabem')
})

// ---- MN-09: teto por nó no aviso de vagas ----

test('MN-09: avalia pela MENOR folga com o teto de cada nó, não pelo teto do .env', async () => {
  const r = await countRunningBotsByNode(async () => ({ n1: 70, n2: 9 }), async () => ({ n1: 80, n2: 10 }))
  assert.deepEqual(r, { running: 9, nodeId: 'n2', nodes: 2, max: 10 }) // folga 1 < 10
})

test('MN-09: nó sem teto publicado não entra; sem nenhum teto -> sem medição', async () => {
  const r = await countRunningBotsByNode(async () => ({ n1: 5, n2: 9 }), async () => ({ n1: null, n2: 10 }))
  assert.equal(r.nodeId, 'n2')
  const nada = await countRunningBotsByNode(async () => ({ n1: 5 }), async () => ({}))
  assert.equal(nada.running, null)
  assert.equal(nada.max, null)
})

test('MN-09: sweep alerta com o teto do nó apertado mesmo com o .env folgado', async () => {
  const enviados = []
  const r = await runSessionCapacityAlertSweep({
    db: fakeDb(),
    listRunningBotsByNode: async () => ({ n1: 10, n2: 9 }),
    getNodeCapacities: async () => ({ n1: 80, n2: 10 }),
    sendAlert: async args => { enviados.push(args); return { sent: true } },
    env: { CAPACITY_ALERT_ENABLED: 'true', MAX_SESSIONS_PER_PROCESS: '80', CAPACITY_ALERT_FREE_SLOTS: '2' },
    logger: quietLogger,
  })
  assert.equal(r.sent, 1)
  assert.match(enviados[0].vars.resumo, /9 robôs ligados de 10 que cabem \(servidor n2\)/)
})
