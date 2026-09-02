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
