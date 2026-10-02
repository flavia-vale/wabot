import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { createProbeTracker, buildProbeAlertVars, PROBE_THRESHOLD, PROBE_WINDOW_MS, PROBE_ALERT_SLUG } from '../src/domain/admin/adminProbePolicy.js'
import { getTemplateDefinition } from '../src/email/registry.js'

/*
 * Q10 da auditoria do painel: em 26/09 uma conta trial fez 80 chamadas por
 * curl a /api/admin/* em 6 minutos. Tudo 403, tudo auditado, ninguém avisado.
 * Agora: a partir do teto de negativas por conta na janela, a resposta vira
 * 429 e a dona recebe um e-mail interno (uma vez por conta a cada 24 h).
 */

const T0 = new Date('2026-10-02T01:45:00Z')
const emMs = (ms) => new Date(T0.getTime() + ms)

test('abaixo do teto é só 403; na 20ª negativa em 10 min vira rajada e avisa uma vez', () => {
  const tracker = createProbeTracker()
  let r
  for (let i = 1; i < PROBE_THRESHOLD; i++) {
    r = tracker.recordDenial({ key: 'conta-a', now: emMs(i * 1000) })
    assert.equal(r.burst, false, `negativa ${i} não pode ser rajada`)
  }
  r = tracker.recordDenial({ key: 'conta-a', now: emMs(PROBE_THRESHOLD * 1000) })
  assert.equal(r.burst, true)
  assert.equal(r.justCrossed, true, 'a chamada que atinge o teto é a que avisa')
  r = tracker.recordDenial({ key: 'conta-a', now: emMs((PROBE_THRESHOLD + 1) * 1000) })
  assert.equal(r.burst, true)
  assert.equal(r.justCrossed, false, 'as seguintes só tomam 429, sem avisar de novo')
})

test('a janela esvazia: depois de 10 minutos a conta volta ao 403 normal', () => {
  const tracker = createProbeTracker()
  for (let i = 0; i < PROBE_THRESHOLD; i++) tracker.recordDenial({ key: 'conta-a', now: emMs(i * 1000) })
  const depois = tracker.recordDenial({ key: 'conta-a', now: emMs(PROBE_WINDOW_MS + PROBE_THRESHOLD * 1000 + 1) })
  assert.equal(depois.burst, false)
  assert.equal(depois.count, 1)
})

test('contas diferentes não somam; o rastreador tem teto de contas (RAM limitada)', () => {
  const tracker = createProbeTracker({ maxTracked: 3 })
  for (const k of ['a', 'b', 'c']) tracker.recordDenial({ key: k, now: T0 })
  assert.equal(tracker.recordDenial({ key: 'b', now: T0 }).count, 2)
  tracker.recordDenial({ key: 'd', now: T0 })
  assert.equal(tracker.size, 3, 'a conta mais parada sai para a nova entrar')
  assert.equal(tracker.recordDenial({ key: '', now: T0 }).burst, false, 'sem chave não conta nada')
})

test('o e-mail interno existe, é de audiência admin e tem as variáveis que o texto usa', () => {
  const def = getTemplateDefinition(PROBE_ALERT_SLUG)
  assert.ok(def, 'template admin_sondagem_admin não está no registry')
  assert.equal(def.audience, 'admin')
  assert.equal(def.group, 'interno')
  const nomes = def.variables.map(v => v.name)
  for (const v of ['resumo', 'conta', 'ip', 'link_clientes']) assert.ok(nomes.includes(v), `falta variável ${v}`)
  for (const v of nomes) assert.ok(def.body.includes(`{{${v}}}`) || def.subject.includes(`{{${v}}}`), `variável ${v} declarada e não usada`)
  assert.ok(!/DLQ|payload|endpoint/i.test(def.body), 'texto leigo')
})

test('as variáveis do aviso dizem quem, quantas e levam para a conta', () => {
  const vars = buildProbeAlertVars({ email: 'x@y.z', count: 20, ip: '2804::1', dashboardUrl: 'https://e.com' })
  assert.match(vars.resumo, /x@y\.z tentou 20 vezes .* em 10 minutos/)
  assert.equal(vars.link_clientes, 'https://e.com/admin/clientes?search=x%40y.z')
  assert.equal(buildProbeAlertVars({ userId: 'u1', count: 3 }).conta, 'u1')
})

test('requireAdmin: negativa conta no rastreador, rajada vira 429 e dispara o aviso', () => {
  const fonte = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
  const inicio = fonte.indexOf('async function requireAdmin(')
  const corpo = fonte.slice(inicio, fonte.indexOf('\n}\n', inicio))
  assert.match(corpo, /adminProbeTracker\.recordDenial\(\{ key: req\.user\?\.sub \|\| req\.ip \}\)/)
  assert.match(corpo, /if \(probe\.justCrossed\) \{[\s\S]*sendAdminAlert\(\{[\s\S]*slug: PROBE_ALERT_SLUG/)
  assert.match(corpo, /if \(probe\.burst\) \{\s*reply\.code\(429\)/)
  const posAudit = corpo.indexOf("action: 'admin.access_denied'")
  const posProbe = corpo.indexOf('adminProbeTracker.recordDenial')
  assert.ok(posAudit < posProbe, 'a auditoria da negativa continua sendo gravada antes de qualquer resposta')
})
