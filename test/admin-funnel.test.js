import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildActivationFunnel, startOfWeek, FUNNEL_STEPS } from '../src/domain/admin/funnel.js'
import { classifyLandingPage, detectAiSource, resolveSignupOrigin } from '../src/domain/admin/signupOrigin.js'

function user(id, createdAt) {
  return { id, createdAt: new Date(createdAt) }
}

test('coorte é a semana do cadastro, ancorada na segunda-feira', () => {
  // 2026-09-02 é uma quarta; a semana começa na segunda, 31/08.
  assert.equal(startOfWeek(new Date('2026-09-02T15:00:00Z')).toISOString().slice(0, 10), '2026-08-31')
  assert.equal(startOfWeek(new Date('2026-08-31T00:00:00Z')).toISOString().slice(0, 10), '2026-08-31')
  assert.equal(startOfWeek(new Date('2026-09-06T23:59:00Z')).toISOString().slice(0, 10), '2026-08-31')
  assert.equal(startOfWeek(null), null)
})

test('funil conta pessoas por etapa e mostra onde se perde mais', () => {
  const users = [user('a', '2026-08-31'), user('b', '2026-08-31'), user('c', '2026-09-01'), user('d', '2026-09-01')]
  const funil = buildActivationFunnel({
    users,
    connectedUserIds: new Set(['a', 'b']),
    firstDeliveryByUserId: new Map([['a', new Date('2026-09-01')]]),
    firstCheckoutByUserId: new Map([['a', new Date('2026-09-02')]]),
    firstPaymentByUserId: new Map([['a', new Date('2026-09-02')]]),
  })

  assert.deepEqual(funil.totals, { signups: 4, connected: 2, delivered: 1, checkout: 1, paid: 1 })
  const conectou = funil.steps.find((s) => s.key === 'connected')
  assert.equal(conectou.lostFromPrevious, 2)
  assert.equal(conectou.pctOfSignups, 50)
  // A maior perda é justamente onde a ação vale mais.
  assert.equal(funil.biggestDrop.key, 'connected')
  assert.equal(funil.biggestDrop.lost, 2)
})

test('etapa posterior implica as anteriores — nunca mostra funil crescendo', () => {
  // Quem pagou mas cujo sinal de conexão se perdeu (retenção de evento, conta
  // antiga) não pode aparecer como "pagou sem nunca ter conectado".
  const funil = buildActivationFunnel({
    users: [user('a', '2026-09-01')],
    connectedUserIds: new Set(),
    firstPaymentByUserId: new Map([['a', new Date('2026-09-02')]]),
  })
  assert.deepEqual(funil.totals, { signups: 1, connected: 1, delivered: 1, checkout: 1, paid: 1 })
  for (let i = 1; i < funil.steps.length; i += 1) {
    assert.ok(funil.steps[i].count <= funil.steps[i - 1].count, 'etapa não pode superar a anterior')
  }
})

test('sem cadastro no período não quebra nem divide por zero', () => {
  const funil = buildActivationFunnel({ users: [] })
  assert.deepEqual(funil.totals, { signups: 0, connected: 0, delivered: 0, checkout: 0, paid: 0 })
  assert.equal(funil.biggestDrop, null)
  assert.deepEqual(funil.weeks, [])
  assert.deepEqual(funil.origins, [])
  assert.equal(funil.medianDaysToPaid, null)
  for (const step of funil.steps) assert.equal(step.pctOfSignups, 0)
})

test('quebra por origem soma o total e vem ordenada pelo maior volume', () => {
  const users = [user('a', '2026-09-01'), user('b', '2026-09-01'), user('c', '2026-09-01')]
  const originByUserId = new Map([
    ['a', { bucket: 'IA (chatgpt)' }],
    ['b', { bucket: 'IA (chatgpt)' }],
    ['c', { bucket: 'Conteúdo (busca)' }],
  ])
  const funil = buildActivationFunnel({ users, originByUserId, firstPaymentByUserId: new Map([['a', new Date('2026-09-02')]]) })
  assert.equal(funil.origins[0].origin, 'IA (chatgpt)')
  assert.equal(funil.origins[0].signups, 2)
  assert.equal(funil.origins[0].pctPaid, 50)
  assert.equal(funil.origins.reduce((soma, linha) => soma + linha.signups, 0), 3)
})

test('cliente sem origem registrada não some da conta', () => {
  const funil = buildActivationFunnel({ users: [user('a', '2026-09-01')] })
  assert.equal(funil.origins.length, 1)
  assert.equal(funil.origins[0].origin, 'Sem registro')
})

test('tempo até pagar e até a primeira oferta sai em mediana', () => {
  const users = [user('a', '2026-09-01'), user('b', '2026-09-01'), user('c', '2026-09-01')]
  const funil = buildActivationFunnel({
    users,
    firstPaymentByUserId: new Map([
      ['a', new Date('2026-09-02')],
      ['b', new Date('2026-09-05')],
      ['c', new Date('2026-09-11')],
    ]),
  })
  assert.equal(funil.medianDaysToPaid, 4)
})

test('origem: o carimbo de IA vence a classificação da página', () => {
  assert.equal(detectAiSource('/blog/x-utm_source-chatgpt.com'), 'chatgpt')
  assert.equal(detectAiSource('/blog/x?utm_source=perplexity.ai'), 'perplexity')
  assert.equal(detectAiSource('/blog/x'), null)
  assert.equal(resolveSignupOrigin({ landing_page: '/blog/x-utm_source-chatgpt.com' }).bucket, 'IA (chatgpt)')
})

test('origem: página de conteúdo é sinal forte de busca; home é ambíguo', () => {
  assert.equal(classifyLandingPage('/blog/como-ser-afiliado'), 'CONTEÚDO (blog)')
  assert.equal(classifyLandingPage('/alternativas/achadinhos-bot'), 'CONTEÚDO (comparativo)')
  assert.equal(classifyLandingPage('/bot-achadinhos-whatsapp'), 'CONTEÚDO (página de busca)')
  assert.equal(resolveSignupOrigin({ landing_page: '/alternativas/x' }).bucket, 'Conteúdo (busca)')
  assert.equal(resolveSignupOrigin({ landing_page: '/' }).bucket, 'Direto / ambíguo')
  assert.equal(resolveSignupOrigin({ landing_page: '/r/abc123' }).bucket, 'Indicação')
})

// --- Guardas estruturais ---

const serviceSource = readFileSync(new URL('../src/domain/admin/service.js', import.meta.url), 'utf8')
const funnelSource = readFileSync(new URL('../src/domain/admin/funnel.js', import.meta.url), 'utf8')

test('"enviou" é só envio com sucesso — senão conta quem nunca publicou nada', () => {
  const trecho = serviceSource.slice(serviceSource.indexOf('getActivationFunnel'))
  assert.ok(/messageLog\.groupBy/.test(trecho), 'MessageLog precisa entrar agregado, não linha a linha')
  assert.ok(/status: 'success'/.test(trecho), 'sem o filtro de sucesso o funil mente')
})

test('as tabelas grandes entram agregadas (nada de uma consulta por cliente)', () => {
  const trecho = serviceSource.slice(serviceSource.indexOf('getActivationFunnel'))
  assert.ok(!/for \(const \w+ of ids\)/.test(trecho), 'nada de laço por cliente consultando o banco')
  assert.ok((trecho.match(/groupBy/g) || []).length >= 4)
})

test('o módulo do funil é puro (não importa banco)', () => {
  assert.ok(!/from '.*db\.js'/.test(funnelSource))
  assert.equal(FUNNEL_STEPS.length, 5)
})

// --- POR QUE parou ---

import { STALL_REASONS, classifyStallReason, describeStallReason } from '../src/domain/admin/funnel.js'

const CONFIGURADA = {
  paired: true, hasCredential: true, hasSourceGroup: true, hasDestGroup: true,
  attempted: true, delivered: true, checkout: true, paid: false,
}

test('quem pagou não tem motivo de parada', () => {
  assert.equal(classifyStallReason({ ...CONFIGURADA, paid: true }), null)
  // nem mesmo quem pagou sem sinal de conexão registrado
  assert.equal(classifyStallReason({ paid: true }), null)
})

test('o motivo é o PRIMEIRO obstáculo, não a última etapa concluída', () => {
  // sem loja E sem grupo: a conversa é sobre a loja, não sobre o grupo
  assert.equal(classifyStallReason({ paired: true }), 'no_credential')
  assert.equal(classifyStallReason({}), 'never_paired')
  assert.equal(classifyStallReason({ paired: true, hasCredential: true }), 'no_source_group')
  assert.equal(classifyStallReason({ paired: true, hasCredential: true, hasSourceGroup: true }), 'no_dest_group')
})

test('separa "tentou e nada saiu" de "nunca usou" — são conversas opostas', () => {
  const base = { paired: true, hasCredential: true, hasSourceGroup: true, hasDestGroup: true }
  assert.equal(classifyStallReason({ ...base, attempted: true, delivered: false }), 'tried_nothing_sent')
  assert.equal(classifyStallReason({ ...base, attempted: false, delivered: false }), 'configured_never_sent')
})

test('quem viu oferta sair e não pagou é separado de quem travou no pagamento', () => {
  assert.equal(classifyStallReason({ ...CONFIGURADA, checkout: false }), 'sent_no_checkout')
  assert.equal(classifyStallReason(CONFIGURADA), 'checkout_no_payment')
})

test('todo motivo tem texto e diz o que fazer', () => {
  for (const reason of STALL_REASONS) {
    assert.ok(reason.label.length > 0, `${reason.key} sem rótulo`)
    assert.ok(reason.hint.length > 0, `${reason.key} sem orientação`)
    // linguagem leiga: nada de nome de tabela/campo na tela
    assert.ok(
      !/MessageLog|AnalyticsEvent|skip:|status=|userId|credential\b/i.test(`${reason.label} ${reason.hint}`),
      `jargão vazando em ${reason.key}`
    )
  }
  assert.equal(describeStallReason('never_paired').key, 'never_paired')
  assert.equal(describeStallReason('inexistente'), null)
})

test('o funil devolve os motivos ordenados, com quem contatar e sem inventar gente', () => {
  const users = [
    { id: 'a', createdAt: new Date('2026-09-01'), name: 'Ana', email: 'ana@x.com' },
    { id: 'b', createdAt: new Date('2026-09-01'), name: 'Bia', email: 'bia@x.com' },
    { id: 'c', createdAt: new Date('2026-09-01'), name: 'Cida', email: 'cida@x.com' },
    { id: 'd', createdAt: new Date('2026-09-01'), name: 'Duda', email: 'duda@x.com' },
  ]
  const funil = buildActivationFunnel({
    users,
    connectedUserIds: new Set(['a', 'b', 'c']),
    credentialUserIds: new Set(['a', 'b']),
    sourceGroupUserIds: new Set(['a', 'b']),
    destGroupUserIds: new Set(['a', 'b']),
    attemptedUserIds: new Set(['a', 'b']),
    firstPaymentByUserId: new Map([['a', new Date('2026-09-02')]]),
  })

  assert.equal(funil.unpaidCount, 3)
  assert.equal(funil.stalls.reduce((soma, m) => soma + m.count, 0), 3, 'todo mundo que não pagou aparece uma vez')
  const chaves = funil.stalls.map((m) => m.key)
  assert.deepEqual(chaves.sort(), ['never_paired', 'no_credential', 'tried_nothing_sent'])
  const semLoja = funil.stalls.find((m) => m.key === 'no_credential')
  assert.deepEqual(semLoja.people.map((p) => p.email), ['cida@x.com'])
  // quem pagou nunca entra na lista de contato
  assert.ok(!JSON.stringify(funil.stalls).includes('ana@x.com'))
})

test('a lista de contato é curta e diz quantas ficaram de fora', () => {
  const users = Array.from({ length: 12 }, (_, i) => ({
    id: `u${i}`, createdAt: new Date('2026-09-01'), name: `P${i}`, email: `p${i}@x.com`,
  }))
  const funil = buildActivationFunnel({ users, peoplePerReason: 3 })
  const motivo = funil.stalls[0]
  assert.equal(motivo.key, 'never_paired')
  assert.equal(motivo.count, 12)
  assert.equal(motivo.people.length, 3)
})

test('o script de diagnóstico usa a MESMA classificação da tela', () => {
  const diag = readFileSync(new URL('../scripts/diag-funil-ativacao.mjs', import.meta.url), 'utf8')
  assert.ok(diag.includes("from '../src/domain/admin/funnel.js'"), 'o script precisa importar a regra compartilhada')
  assert.ok(!/rotulo = 'nunca tentou parear/.test(diag), 'não voltar a duplicar os rótulos no script')
})
