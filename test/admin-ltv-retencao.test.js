import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  CHURN_GRACE_DAYS,
  DEFAULT_PLAN_DAYS,
  MIN_CUSTOMERS_FOR_PROJECTION,
  addCalendarMonths,
  buildLtvReport,
  buildRetentionCohorts,
  formatLtvReportLines,
  paymentCoverageEnd,
  projectLtv,
  summarizeCustomer,
} from '../src/domain/admin/ltvRetention.js'

/*
 * LTV e retenção (2026-09-19). O anúncio pago está bloqueado até este número
 * existir; ele precisa ser honesto por construção — realizado e projetado
 * separados, coorte nova sem número, cobertura paga em vez de contagem de
 * pagamentos.
 */

const NOW = new Date('2026-09-19T12:00:00Z')
const DAY = 86_400_000
const daysAgo = n => new Date(NOW.getTime() - n * DAY)
const pay = (userId, daysBack, extra = {}) => ({ userId, status: 'approved', amount: 69, plan: 'pro', createdAt: daysAgo(daysBack), ...extra })

// ---------------------------------------------------------------------------
// Cobertura de um pagamento
// ---------------------------------------------------------------------------

test('cobertura: expiresAt gravado ganha; sem ele vale createdAt + daysGranted; sem os dois, 30 dias', () => {
  const createdAt = new Date('2026-08-01T00:00:00Z')
  assert.equal(paymentCoverageEnd({ createdAt, expiresAt: '2026-09-15T00:00:00Z' }).toISOString(), '2026-09-15T00:00:00.000Z')
  assert.equal(paymentCoverageEnd({ createdAt, daysGranted: 90 }).toISOString(), new Date(createdAt.getTime() + 90 * DAY).toISOString())
  assert.equal(paymentCoverageEnd({ createdAt }).toISOString(), new Date(createdAt.getTime() + DEFAULT_PLAN_DAYS * DAY).toISOString())
  assert.equal(paymentCoverageEnd({}), null)
})

test('addCalendarMonths respeita o calendário (31/01 + 1 mês = 28/02)', () => {
  assert.equal(addCalendarMonths(new Date('2026-01-31T00:00:00Z'), 1).toISOString().slice(0, 10), '2026-02-28')
  assert.equal(addCalendarMonths(new Date('2026-03-15T00:00:00Z'), 6).toISOString().slice(0, 10), '2026-09-15')
})

// ---------------------------------------------------------------------------
// Uma cliente
// ---------------------------------------------------------------------------

test('summarizeCustomer: quem nunca teve pagamento aprovado não entra na conta', () => {
  assert.equal(summarizeCustomer({ user: { id: 'u' }, payments: [{ status: 'pending', amount: 69, createdAt: daysAgo(3) }], now: NOW }), null)
  assert.equal(summarizeCustomer({ user: { id: 'u' }, payments: [], now: NOW }), null)
})

test('summarizeCustomer: soma só o aprovado, conta meses distintos e diz se renovou', () => {
  const customer = summarizeCustomer({
    user: { id: 'u1', email: 'a@x.com' },
    payments: [
      pay('u1', 95, { amount: 39, plan: 'basic' }),
      pay('u1', 60),
      pay('u1', 30),
      pay('u1', 1),
      { userId: 'u1', status: 'rejected', amount: 69, createdAt: daysAgo(10) },
    ],
    now: NOW,
  })
  assert.equal(customer.paymentsCount, 4)
  assert.equal(customer.totalPaid, 39 + 69 * 3)
  assert.equal(customer.renewed, true)
  assert.equal(customer.plan, 'pro', 'o plano é o do ÚLTIMO pagamento aprovado')
  assert.equal(customer.status, 'ativa')
  assert.ok(customer.paidMonths >= 3)
})

test('summarizeCustomer: pagou uma vez, 60 dias atrás, com 30 dias de acesso → cancelada (passou a carência)', () => {
  const customer = summarizeCustomer({ user: { id: 'u2' }, payments: [pay('u2', 60)], now: NOW })
  assert.equal(customer.renewed, false)
  assert.equal(customer.status, 'cancelada')
  assert.equal(customer.lifetimeDays, DEFAULT_PLAN_DAYS)
})

test('summarizeCustomer: cobertura vencida há menos que a carência fica "em_carencia", não cancelada', () => {
  const customer = summarizeCustomer({ user: { id: 'u3' }, payments: [pay('u3', DEFAULT_PLAN_DAYS + CHURN_GRACE_DAYS - 2)], now: NOW })
  assert.equal(customer.status, 'em_carencia')
})

// ---------------------------------------------------------------------------
// Coortes
// ---------------------------------------------------------------------------

test('retenção sai da COBERTURA paga: plano de 90 dias com um pagamento só fica retido em 1 e 2 meses', () => {
  const trimestral = summarizeCustomer({ user: { id: 'u4' }, payments: [pay('u4', 100, { daysGranted: 90 })], now: NOW })
  // 20 dias de acesso, de propósito: 30 dias e "1 mês de calendário" caem no
  // MESMO dia e a fronteira viraria empate — o que se quer medir é quem parou.
  const mensalQueParou = summarizeCustomer({ user: { id: 'u5' }, payments: [pay('u5', 100, { daysGranted: 20 })], now: NOW })
  const [cohort] = buildRetentionCohorts([trimestral, mensalQueParou], { now: NOW })
  assert.equal(cohort.customers, 2)
  assert.deepEqual(cohort.retention.m1, { measurable: 2, retained: 1, rate: 0.5 })
  assert.deepEqual(cohort.retention.m2, { measurable: 2, retained: 1, rate: 0.5 })
  assert.equal(cohort.retention.m3.retained, 0, 'aos 3 meses os 90 dias já acabaram')
})

test('coorte nova demais devolve null no marco que ainda não chegou — nunca zero', () => {
  const recente = summarizeCustomer({ user: { id: 'u6' }, payments: [pay('u6', 10)], now: NOW })
  const [cohort] = buildRetentionCohorts([recente], { now: NOW })
  assert.equal(cohort.retention.m1, null)
  assert.equal(cohort.retention.m6, null)
})

test('as coortes saem em ordem cronológica, com receita da coorte', () => {
  const a = summarizeCustomer({ user: { id: 'a' }, payments: [pay('a', 200)], now: NOW })
  const b = summarizeCustomer({ user: { id: 'b' }, payments: [pay('b', 20, { amount: 39 })], now: NOW })
  const cohorts = buildRetentionCohorts([b, a], { now: NOW })
  assert.ok(cohorts[0].cohort < cohorts[1].cohort)
  assert.equal(cohorts[1].revenue, 39)
})

// ---------------------------------------------------------------------------
// Projeção
// ---------------------------------------------------------------------------

test('projeção: com menos clientes que o mínimo NÃO afirma nada', () => {
  const few = Array.from({ length: MIN_CUSTOMERS_FOR_PROJECTION - 1 }, (_, i) => summarizeCustomer({ user: { id: `u${i}` }, payments: [pay(`u${i}`, 100)], now: NOW }))
  const projection = projectLtv(few)
  assert.equal(projection.projectedLtv, null)
  assert.equal(projection.confidence, 'insuficiente')
  assert.match(projection.reason, /clientes pagantes/)
})

test('projeção: sem cancelamento observado não inventa vida infinita', () => {
  const active = Array.from({ length: 6 }, (_, i) => summarizeCustomer({ user: { id: `u${i}` }, payments: [pay(`u${i}`, 5)], now: NOW }))
  const projection = projectLtv(active)
  assert.equal(projection.monthlyChurn, 0)
  assert.equal(projection.expectedLifetimeMonths, null)
  assert.equal(projection.projectedLtv, null)
  assert.match(projection.reason, /nenhum cancelamento/)
})

test('projeção: cancelamento mensal = canceladas / cliente-mês; LTV = receita por cliente-mês × vida esperada', () => {
  // 4 clientes ativas com 2 meses pagos cada (8 cliente-mês, R$ 552) e
  // 2 canceladas com 1 mês cada (2 cliente-mês, R$ 138): 10 cliente-mês,
  // 2 cancelamentos → 20%/mês → vida de 5 meses; R$ 69/cliente-mês → R$ 345.
  const customers = [
    ...Array.from({ length: 4 }, (_, i) => summarizeCustomer({ user: { id: `a${i}` }, payments: [pay(`a${i}`, 40), pay(`a${i}`, 5)], now: NOW })),
    ...Array.from({ length: 2 }, (_, i) => summarizeCustomer({ user: { id: `c${i}` }, payments: [pay(`c${i}`, 90)], now: NOW })),
  ]
  const projection = projectLtv(customers)
  assert.equal(projection.monthlyChurn, 0.2)
  assert.equal(projection.expectedLifetimeMonths, 5)
  assert.equal(projection.arpuPerPaidMonth, 69)
  assert.equal(projection.projectedLtv, 345)
  assert.equal(projection.confidence, 'baixa', 'amostra pequena nunca vira confiança média')
})

// ---------------------------------------------------------------------------
// Relatório inteiro
// ---------------------------------------------------------------------------

test('buildLtvReport: exclui as contas de teste, agrega por plano e separa realizado de projetado', () => {
  const users = [
    { id: 'u1', email: 'a@x.com' },
    { id: 'u2', email: 'b@x.com' },
    { id: 'teste', email: 'tacianeaas02@gmail.com' },
  ]
  const payments = [pay('u1', 40), pay('u1', 5), pay('u2', 90, { amount: 39, plan: 'basic' }), pay('teste', 3, { amount: 999 })]
  const report = buildLtvReport({ users, payments, now: NOW, excludeUserIds: ['teste'] })

  assert.equal(report.totals.payingCustomers, 2)
  assert.equal(report.totals.revenue, 69 * 2 + 39)
  assert.ok(!report.customers.some(customer => customer.userId === 'teste'), 'conta de teste entrou na soma')
  assert.equal(report.byPlan.pro.customers, 1)
  assert.equal(report.byPlan.basic.avgLtv, 39)
  assert.equal(report.totals.activeNow, 1)
  assert.equal(report.totals.cancelled, 1)
  assert.equal(report.totals.renewedShare, 0.5)
  assert.equal(report.projection.projectedLtv, null, 'duas clientes não sustentam projeção')

  const lines = formatLtvReportLines(report).join('\n')
  assert.match(lines, /REALIZADO/)
  assert.match(lines, /PROJETADO/)
  assert.match(lines, /NÃO somar com o realizado/)
  assert.match(lines, /R\$ 177,00/)
  assert.doesNotMatch(lines, /churn|payback|runway/i, 'jargão no relatório')
})

test('formatLtvReportLines: coorte sem marco medível imprime "—", nunca 0%', () => {
  const users = [{ id: 'u1', email: 'a@x.com' }]
  const report = buildLtvReport({ users, payments: [pay('u1', 3)], now: NOW })
  const lines = formatLtvReportLines(report).join('\n')
  assert.match(lines, /1m —/)
  assert.doesNotMatch(lines, /1m 0%/)
})

// ---------------------------------------------------------------------------
// O script é só leitura e tira a conta de teste
// ---------------------------------------------------------------------------

test('scripts/diag-ltv-retencao.mjs é read-only e usa a MESMA regra de conta de teste do Financeiro', () => {
  const source = readFileSync(new URL('../scripts/diag-ltv-retencao.mjs', import.meta.url), 'utf8')
  assert.match(source, /loadTestAccountUserIds/)
  assert.match(source, /excludeUserIdsWhere/)
  assert.match(source, /buildLtvReport/)
  for (const forbidden of ['.create(', '.update(', '.delete(', '.upsert(', 'sendTemplateEmail', '$executeRaw']) {
    assert.ok(!source.includes(forbidden), `script de diagnóstico não pode escrever: ${forbidden}`)
  }
  assert.match(source, /console\.error\('Falha ao montar o relatório/, 'erro de consulta precisa ser impresso, nunca engolido')
})
