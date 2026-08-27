import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildCustomerHistory,
  buildCustomerTimeline,
  buildFinanceiroBlock,
  summarizeDisconnects,
  summarizeErrorsByCategory,
  summarizeSendsByDay,
  summarizeTrial,
} from '../src/domain/admin/customerHistory.js'

const NOW = new Date('2026-08-27T12:00:00.000Z')
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000)

const baseUser = {
  id: 'u1',
  name: 'Cliente Teste',
  email: 'cliente@exemplo.com',
  plan: 'pro',
  status: 'active',
  createdAt: daysAgo(60),
  accessExpiresAt: daysAgo(-20),
  sendCount: 4321,
}

test('trial: reconstrói início, fim e conversão sem tabela própria', () => {
  const emTrial = summarizeTrial({
    user: { ...baseUser, plan: 'trial', accessExpiresAt: daysAgo(-3) },
    payments: [],
    now: NOW,
  })
  assert.equal(emTrial.converted, false)
  assert.equal(emTrial.expired, false)
  assert.equal(emTrial.daysRemaining, 3)
  assert.equal(emTrial.startedAt, daysAgo(60).toISOString())

  const convertido = summarizeTrial({
    user: baseUser,
    payments: [
      { status: 'approved', amount: 69, plan: 'pro', createdAt: daysAgo(50) },
      { status: 'approved', amount: 69, plan: 'pro', createdAt: daysAgo(20) },
      { status: 'rejected', amount: 69, plan: 'pro', createdAt: daysAgo(55) },
    ],
    now: NOW,
  })
  assert.equal(convertido.converted, true)
  assert.equal(convertido.convertedToPlan, 'pro')
  assert.equal(convertido.daysToConvert, 10, 'conta do cadastro até o PRIMEIRO pagamento aprovado')
})

test('trial: depois de assinar, accessExpiresAt não vira mais "fim do teste"', () => {
  // accessExpiresAt de quem já paga é a validade do PLANO, não do teste —
  // reaproveitá-lo como fim de trial mentiria na linha do tempo.
  const resumo = summarizeTrial({ user: baseUser, payments: [{ status: 'approved', amount: 69, plan: 'pro', createdAt: daysAgo(50) }], now: NOW })
  assert.equal(resumo.endsAt, null)
})

test('financeiro: assinatura ativa ganha da mais recente cancelada', () => {
  const bloco = buildFinanceiroBlock({
    user: baseUser,
    payments: [{ status: 'approved', amount: 69, plan: 'pro', createdAt: daysAgo(20) }],
    subscriptions: [
      { id: 's2', plan: 'basic', status: 'cancelled', createdAt: daysAgo(5), cancelledAt: daysAgo(4) },
      { id: 's1', plan: 'pro', status: 'authorized', createdAt: daysAgo(50), nextChargeAt: daysAgo(-10) },
    ],
    now: NOW,
  })
  assert.equal(bloco.subscription.status, 'authorized')
  assert.equal(bloco.subscription.planLabel, 'Pro')
  assert.equal(bloco.ltv, 69)
  assert.equal(bloco.paidCount, 1)
  assert.equal(bloco.subscriptions.length, 2)
})

test('quedas: agrupa por janela, por código e por dia', () => {
  const resumo = summarizeDisconnects([
    { type: 'disconnect', code: '500', occurredAt: daysAgo(0.2) },
    { type: 'disconnect', code: '500', occurredAt: daysAgo(0.3) },
    { type: 'disconnect', code: '428', occurredAt: daysAgo(3) },
    { type: 'disconnect', code: '500', occurredAt: daysAgo(20) },
    { type: 'connect', code: null, occurredAt: daysAgo(0.1) },
  ], NOW)

  assert.equal(resumo.last24h, 2)
  assert.equal(resumo.last7d, 3)
  assert.equal(resumo.last30d, 4)
  assert.equal(resumo.topCodes[0].code, '500')
  assert.equal(resumo.topCodes[0].count, 3)
})

test('erros: categoria vira texto de gente, não prefixo de errorMsg', () => {
  const linhas = summarizeErrorsByCategory([
    { status: 'error', errorMsg: 'timeout:send:123@g.us' },
    { status: 'error', errorMsg: 'timeout:incoming' },
    { status: 'error', errorMsg: 'error:worker_restart' },
    { status: 'success', errorMsg: null },
    { status: 'skipped', errorMsg: 'skip:dedup_recent_link' },
  ])
  const timeout = linhas.find(row => row.category === 'timeout')
  assert.equal(timeout.count, 2)
  assert.equal(timeout.label, 'Demorou demais e desistiu')
  assert.ok(!linhas.some(row => row.category === 'dedup'), 'skipped não é erro')
  assert.ok(linhas.every(row => !/^(skip|timeout|error):/.test(row.label)), 'nenhum jargão de errorMsg na tela')
})

test('uso: envios viram série diária de 30 dias', () => {
  const serie = summarizeSendsByDay([
    { status: 'success', sentAt: daysAgo(0), dedupHits: 2 },
    { status: 'success', sentAt: daysAgo(0), dedupHits: 0 },
    { status: 'error', sentAt: daysAgo(1), dedupHits: 0 },
    { status: 'success', sentAt: daysAgo(90), dedupHits: 5 },
  ], { days: 30, now: NOW })

  assert.equal(serie.length, 30)
  const hoje = serie.at(-1)
  assert.equal(hoje.success, 2)
  assert.equal(hoje.dedupBlocked, 2)
  assert.ok(!serie.some(dia => dia.date === daysAgo(90).toISOString().slice(0, 10)), 'fora da janela não entra')
})

test('linha do tempo: só marcos — envio isolado nunca vira linha', () => {
  const historico = buildCustomerHistory({
    user: baseUser,
    payments: [{ id: 'p1', status: 'approved', amount: 69, plan: 'pro', createdAt: daysAgo(20) }],
    subscriptions: [{ id: 's1', plan: 'pro', status: 'authorized', createdAt: daysAgo(20) }],
    connectionEvents: [
      { type: 'disconnect', code: '500', occurredAt: daysAgo(2) },
      { type: 'disconnect', code: '500', occurredAt: daysAgo(2) },
    ],
    contactLogs: [{ createdAt: daysAgo(1), channel: 'whatsapp', reason: 'wa_disconnected', outcome: 'contacted' }],
    logs: [
      { status: 'success', errorMsg: null, dedupHits: 0, sentAt: daysAgo(1) },
      { status: 'success', errorMsg: null, dedupHits: 0, sentAt: daysAgo(1) },
      { status: 'error', errorMsg: 'timeout:incoming', dedupHits: 0, sentAt: daysAgo(1) },
    ],
    groupCounts: { total: 5, monitor: 2, post: 3 },
    automations: { total: 4, enabled: 3 },
    now: NOW,
  })

  const tipos = historico.timeline.map(evento => evento.kind)
  assert.ok(tipos.includes('cadastro'))
  assert.ok(tipos.includes('financeiro'))
  assert.ok(tipos.includes('tecnico'))
  assert.ok(tipos.includes('suporte'))

  const envios = historico.timeline.filter(evento => evento.kind === 'uso')
  assert.equal(envios.length, 1, 'três envios no mesmo dia = UMA linha agregada')
  assert.equal(envios[0].title, '2 ofertas enviadas')
  assert.equal(envios[0].aggregate, true)

  const quedas = historico.timeline.filter(evento => evento.title.startsWith('WhatsApp caiu'))
  assert.equal(quedas.length, 1)
  assert.equal(quedas[0].title, 'WhatsApp caiu 2 vezes')

  const datas = historico.timeline.map(evento => new Date(evento.at).getTime())
  assert.deepEqual(datas, [...datas].sort((a, b) => b - a), 'mais recente primeiro')
})

test('cabeçalho tem exatamente 6 números — mais que isso vira parede', () => {
  const historico = buildCustomerHistory({ user: baseUser, now: NOW })
  assert.equal(Object.keys(historico.headline).length, 6)
  assert.deepEqual(Object.keys(historico).sort(), ['cadastro', 'financeiro', 'headline', 'id', 'tecnico', 'timeline', 'uso'])
})

test('limite da linha do tempo é respeitado', () => {
  const logs = Array.from({ length: 30 }, (_, i) => ({ status: 'success', errorMsg: null, dedupHits: 0, sentAt: daysAgo(i) }))
  const timeline = buildCustomerTimeline({
    user: baseUser,
    financeiro: buildFinanceiroBlock({ user: baseUser, now: NOW }),
    sendsByDay: summarizeSendsByDay(logs, { days: 30, now: NOW }),
    now: NOW,
    limit: 5,
  })
  assert.equal(timeline.length, 5)
})

test('cliente sem nada não quebra e não inventa evento', () => {
  const historico = buildCustomerHistory({ user: { id: 'u2', email: 'novo@exemplo.com', createdAt: daysAgo(1), plan: 'trial', status: 'active' }, now: NOW })
  assert.equal(historico.financeiro.ltv, 0)
  assert.equal(historico.financeiro.subscription, null)
  assert.equal(historico.tecnico.disconnects.last30d, 0)
  assert.equal(historico.timeline.length, 1)
  assert.equal(historico.timeline[0].kind, 'cadastro')
})

test('dia só com erro não vira "0 ofertas enviadas"', () => {
  const timeline = buildCustomerTimeline({
    user: baseUser,
    financeiro: buildFinanceiroBlock({ user: baseUser, now: NOW }),
    sendsByDay: summarizeSendsByDay([
      { status: 'error', sentAt: daysAgo(1), dedupHits: 0 },
      { status: 'error', sentAt: daysAgo(1), dedupHits: 0 },
    ], { days: 30, now: NOW }),
    now: NOW,
  })
  const dia = timeline.find(evento => evento.kind === 'uso')
  assert.equal(dia.title, 'Nenhuma oferta saiu')
  assert.equal(dia.detail, '2 com erro')
})
