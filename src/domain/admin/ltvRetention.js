/**
 * LTV e retenção — medido, nunca estimado (2026-09-19).
 *
 * Por que existe: o plano de marketing bloqueia anúncio pago até saber quanto
 * uma cliente deixa ao longo da vida dela no produto. Até aqui esse número
 * nunca foi medido — o admin mostra LTV por cliente no drill-down, e o ROI
 * mostra receita por mês, mas ninguém somava "quanto tempo ela fica" com
 * "quanto ela paga por mês" na mesma conta.
 *
 * Três perguntas, cada uma respondida só com o que se sabe:
 *
 * - REALIZADO: quanto cada cliente pagante já deixou (soma dos pagamentos
 *   aprovados), quantos meses pagou, se renovou ao menos uma vez e se o
 *   acesso pago dela ainda vale hoje. É medição.
 * - RETENÇÃO POR COORTE: das clientes que fizeram o PRIMEIRO pagamento em
 *   cada mês, quantas ainda tinham acesso pago 1, 2, 3 e 6 meses depois. Só
 *   conta quem já teve tempo de chegar lá — coorte nova devolve `null`, não
 *   zero.
 * - PROJETADO: com o cancelamento mensal observado, quanto se espera que
 *   uma cliente deixe. Sempre rotulado como projeção, com o grau de
 *   confiança, e `null` quando a amostra não sustenta a conta.
 *
 * Invariantes (não regredir):
 *
 * - **Retenção sai da COBERTURA paga, não da contagem de pagamentos.** Quem
 *   pagou um plano de 90 dias não "cancelou" no mês seguinte por não ter
 *   pagamento novo — o acesso pago dela cobre os três meses.
 * - **Realizado e projetado nunca viram um número só.** O projetado carrega
 *   `confidence` e o motivo quando não há como afirmar.
 * - **Sem dado confiável NÃO se afirma nada:** menos de
 *   `MIN_CUSTOMERS_FOR_PROJECTION` clientes pagantes, ou zero cancelamento
 *   observado, devolvem `null` com `reason` — não zero, não infinito.
 * - **Conta de teste fica de fora** — quem chama passa `excludeUserIds`
 *   (ver `testAccounts.js`); este módulo não decide quem é teste.
 * - **Acesso liberado na mão não é receita:** "ainda é cliente" aqui
 *   significa cobertura PAGA em dia (com carência curta), não
 *   `User.accessExpiresAt`, que inclui cortesia.
 *
 * Módulo PURO: sem banco, sem rede.
 */

import { monthKeyOf, round2 } from './operatingCosts.js'

/** Um pagamento aprovado sem `expiresAt` nem `daysGranted` vale 30 dias. */
export const DEFAULT_PLAN_DAYS = 30
/** Carência depois do fim da cobertura antes de contar como cancelamento. */
export const CHURN_GRACE_DAYS = 7
/** Abaixo disto a projeção devolve `null` — amostra não sustenta a conta. */
export const MIN_CUSTOMERS_FOR_PROJECTION = 5
/** Marcos de retenção medidos por coorte, em meses após o primeiro pagamento. */
export const RETENTION_MONTHS = Object.freeze([1, 2, 3, 6])

const DAY_MS = 86_400_000

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isApproved(payment) {
  return String(payment?.status ?? '').toLowerCase() === 'approved'
}

/** Soma `n` meses de calendário a uma data (dia preservado quando existe). */
export function addCalendarMonths(date, months) {
  const base = toDate(date)
  if (!base) return null
  const out = new Date(base.getTime())
  const day = out.getUTCDate()
  out.setUTCDate(1)
  out.setUTCMonth(out.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate()
  out.setUTCDate(Math.min(day, lastDay))
  return out
}

/**
 * Até quando um pagamento aprovado cobre o acesso.
 * Ordem: `expiresAt` gravado na ativação → `createdAt + daysGranted` →
 * `createdAt + 30 dias`. Nunca `null` para pagamento aprovado com data.
 */
export function paymentCoverageEnd(payment) {
  const expiresAt = toDate(payment?.expiresAt)
  if (expiresAt) return expiresAt
  const createdAt = toDate(payment?.createdAt)
  if (!createdAt) return null
  const days = Number(payment?.daysGranted)
  const granted = Number.isFinite(days) && days > 0 ? days : DEFAULT_PLAN_DAYS
  return new Date(createdAt.getTime() + granted * DAY_MS)
}

/**
 * Resume UMA cliente a partir dos pagamentos dela.
 * Devolve `null` quando não há pagamento aprovado — quem nunca pagou não
 * entra em conta de LTV.
 */
export function summarizeCustomer({ user, payments = [], now = new Date() } = {}) {
  const approved = payments
    .filter(isApproved)
    .map(payment => ({ ...payment, createdAt: toDate(payment.createdAt) }))
    .filter(payment => payment.createdAt)
    .sort((a, b) => a.createdAt - b.createdAt)
  if (!approved.length) return null

  const nowDate = toDate(now) ?? new Date()
  const firstPaidAt = approved[0].createdAt
  const lastPaidAt = approved[approved.length - 1].createdAt
  const coverageEnd = approved
    .map(paymentCoverageEnd)
    .filter(Boolean)
    .reduce((max, date) => (max && max > date ? max : date), null)
  const paidMonths = new Set(approved.map(payment => monthKeyOf(payment.createdAt))).size
  const totalPaid = round2(approved.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0))
  const graceEnd = coverageEnd ? new Date(coverageEnd.getTime() + CHURN_GRACE_DAYS * DAY_MS) : null

  let status = 'ativa'
  if (coverageEnd && coverageEnd < nowDate) status = graceEnd && graceEnd >= nowDate ? 'em_carencia' : 'cancelada'

  return {
    userId: user?.id ?? approved[0].userId ?? null,
    email: user?.email ?? null,
    plan: approved[approved.length - 1].plan ?? user?.plan ?? null,
    firstPaidAt,
    lastPaidAt,
    coverageEnd,
    paymentsCount: approved.length,
    paidMonths,
    totalPaid,
    renewed: approved.length >= 2,
    status,
    lifetimeDays: coverageEnd ? Math.max(0, Math.round((coverageEnd - firstPaidAt) / DAY_MS)) : null,
    cohort: monthKeyOf(firstPaidAt),
  }
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : round2((sorted[mid - 1] + sorted[mid]) / 2)
}

/**
 * Retenção por coorte de PRIMEIRO pagamento.
 * "Retida no mês k" = a cobertura paga alcança `firstPaidAt + k meses`.
 * Só entra na taxa quem já teve tempo de chegar ao marco (`measurable`);
 * coorte sem ninguém mensurável devolve `null` naquele marco.
 */
export function buildRetentionCohorts(customers = [], { now = new Date(), months = RETENTION_MONTHS } = {}) {
  const nowDate = toDate(now) ?? new Date()
  const byCohort = new Map()
  for (const customer of customers) {
    if (!customer?.cohort) continue
    if (!byCohort.has(customer.cohort)) byCohort.set(customer.cohort, [])
    byCohort.get(customer.cohort).push(customer)
  }

  return [...byCohort.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([cohort, members]) => {
      const retention = {}
      for (const k of months) {
        let measurable = 0
        let retained = 0
        for (const member of members) {
          const marker = addCalendarMonths(member.firstPaidAt, k)
          if (!marker || marker > nowDate) continue
          measurable += 1
          if (member.coverageEnd && member.coverageEnd >= marker) retained += 1
        }
        retention[`m${k}`] = measurable ? { measurable, retained, rate: round2(retained / measurable) } : null
      }
      return {
        cohort,
        customers: members.length,
        revenue: round2(members.reduce((sum, member) => sum + member.totalPaid, 0)),
        retention,
      }
    })
}

/**
 * Projeção honesta: cancelamento mensal observado = clientes canceladas /
 * meses pagos somados (cliente-mês). Vida esperada = 1 / cancelamento.
 * LTV projetado = receita por cliente-mês × vida esperada.
 */
export function projectLtv(customers = []) {
  const paying = customers.length
  if (paying < MIN_CUSTOMERS_FOR_PROJECTION) {
    return { monthlyChurn: null, arpuPerPaidMonth: null, expectedLifetimeMonths: null, projectedLtv: null, confidence: 'insuficiente', reason: `menos de ${MIN_CUSTOMERS_FOR_PROJECTION} clientes pagantes` }
  }
  const customerMonths = customers.reduce((sum, customer) => sum + customer.paidMonths, 0)
  const cancelled = customers.filter(customer => customer.status === 'cancelada').length
  const revenue = customers.reduce((sum, customer) => sum + customer.totalPaid, 0)
  const arpuPerPaidMonth = customerMonths ? round2(revenue / customerMonths) : null
  if (!cancelled) {
    return { monthlyChurn: 0, arpuPerPaidMonth, expectedLifetimeMonths: null, projectedLtv: null, confidence: 'insuficiente', reason: 'nenhum cancelamento observado ainda — não dá para estimar a vida média' }
  }
  const monthlyChurn = round2(cancelled / customerMonths)
  const expectedLifetimeMonths = monthlyChurn > 0 ? round2(1 / monthlyChurn) : null
  const projectedLtv = expectedLifetimeMonths != null && arpuPerPaidMonth != null ? round2(arpuPerPaidMonth * expectedLifetimeMonths) : null
  const confidence = paying >= 20 && cancelled >= 3 ? 'media' : 'baixa'
  return { monthlyChurn, arpuPerPaidMonth, expectedLifetimeMonths, projectedLtv, confidence, reason: null, sample: { paying, cancelled, customerMonths } }
}

/**
 * Relatório completo. `users` e `payments` já vêm SEM as contas de teste
 * (quem chama aplica `excludeUserIds`); aqui é só conta.
 */
export function buildLtvReport({ users = [], payments = [], now = new Date(), excludeUserIds = [] } = {}) {
  const excluded = new Set(excludeUserIds)
  const usersById = new Map(users.map(user => [user.id, user]))
  const paymentsByUser = new Map()
  for (const payment of payments) {
    if (!payment?.userId || excluded.has(payment.userId)) continue
    if (!paymentsByUser.has(payment.userId)) paymentsByUser.set(payment.userId, [])
    paymentsByUser.get(payment.userId).push(payment)
  }

  const customers = [...paymentsByUser.entries()]
    .map(([userId, list]) => summarizeCustomer({ user: usersById.get(userId) ?? { id: userId }, payments: list, now }))
    .filter(Boolean)
    .sort((a, b) => a.firstPaidAt - b.firstPaidAt)

  const revenue = round2(customers.reduce((sum, customer) => sum + customer.totalPaid, 0))
  const totals = {
    payingCustomers: customers.length,
    revenue,
    avgLtvRealized: customers.length ? round2(revenue / customers.length) : null,
    medianLtvRealized: median(customers.map(customer => customer.totalPaid)),
    avgPaidMonths: customers.length ? round2(customers.reduce((sum, customer) => sum + customer.paidMonths, 0) / customers.length) : null,
    renewedShare: customers.length ? round2(customers.filter(customer => customer.renewed).length / customers.length) : null,
    activeNow: customers.filter(customer => customer.status === 'ativa').length,
    inGrace: customers.filter(customer => customer.status === 'em_carencia').length,
    cancelled: customers.filter(customer => customer.status === 'cancelada').length,
  }

  const byPlan = {}
  for (const customer of customers) {
    const key = customer.plan ?? 'desconhecido'
    byPlan[key] ??= { customers: 0, revenue: 0, avgLtv: null, renewedShare: null, renewed: 0 }
    byPlan[key].customers += 1
    byPlan[key].revenue = round2(byPlan[key].revenue + customer.totalPaid)
    if (customer.renewed) byPlan[key].renewed += 1
  }
  for (const entry of Object.values(byPlan)) {
    entry.avgLtv = round2(entry.revenue / entry.customers)
    entry.renewedShare = round2(entry.renewed / entry.customers)
  }

  return {
    generatedAt: toDate(now) ?? new Date(),
    customers,
    totals,
    byPlan,
    cohorts: buildRetentionCohorts(customers, { now }),
    projection: projectLtv(customers),
  }
}

const money = value => (value == null ? '—' : `R$ ${Number(value).toFixed(2).replace('.', ',')}`)
const pct = value => (value == null ? '—' : `${Math.round(value * 100)}%`)
const dateBr = value => (value ? new Date(value).toISOString().slice(0, 10) : '—')

/**
 * Texto do relatório, em linguagem leiga. Realizado e projetado ficam em
 * blocos separados e rotulados — a leitura mais perigosa é somar os dois.
 */
export function formatLtvReportLines(report) {
  const { totals, byPlan, cohorts, projection } = report
  const lines = []
  lines.push('REALIZADO (o que já entrou de cada cliente pagante — medição, não estimativa)')
  lines.push(`  clientes pagantes: ${totals.payingCustomers}`)
  lines.push(`  receita aprovada somada: ${money(totals.revenue)}`)
  lines.push(`  valor médio deixado por cliente: ${money(totals.avgLtvRealized)} (mediana ${money(totals.medianLtvRealized)})`)
  lines.push(`  meses pagos por cliente, em média: ${totals.avgPaidMonths ?? '—'}`)
  lines.push(`  renovaram ao menos uma vez: ${pct(totals.renewedShare)}`)
  lines.push(`  com acesso pago em dia hoje: ${totals.activeNow} | na carência de ${CHURN_GRACE_DAYS} dias: ${totals.inGrace} | deixaram vencer: ${totals.cancelled}`)
  lines.push('')
  lines.push('POR PLANO (realizado)')
  const plans = Object.entries(byPlan)
  if (!plans.length) lines.push('  (nenhum pagamento aprovado no período)')
  for (const [plan, entry] of plans) {
    lines.push(`  ${plan.padEnd(10)} clientes ${String(entry.customers).padStart(3)} | receita ${money(entry.revenue)} | média por cliente ${money(entry.avgLtv)} | renovaram ${pct(entry.renewedShare)}`)
  }
  lines.push('')
  lines.push('RETENÇÃO POR MÊS DO PRIMEIRO PAGAMENTO (ainda tinha acesso pago N meses depois; "—" = coorte nova demais para medir)')
  if (!cohorts.length) lines.push('  (nenhuma coorte)')
  for (const cohort of cohorts) {
    const marks = RETENTION_MONTHS.map(k => {
      const cell = cohort.retention[`m${k}`]
      return `${k}m ${cell ? `${pct(cell.rate)} (${cell.retained}/${cell.measurable})` : '—'}`
    }).join(' | ')
    lines.push(`  ${cohort.cohort}  ${String(cohort.customers).padStart(3)} clientes  ${money(cohort.revenue).padStart(12)}  ${marks}`)
  }
  lines.push('')
  lines.push('PROJETADO (estimativa a partir do cancelamento observado — NÃO somar com o realizado)')
  if (projection.projectedLtv == null) {
    lines.push(`  sem projeção: ${projection.reason}`)
    if (projection.arpuPerPaidMonth != null) lines.push(`  receita por cliente-mês observada: ${money(projection.arpuPerPaidMonth)}`)
  } else {
    lines.push(`  cancelamento mensal observado: ${pct(projection.monthlyChurn)} (${projection.sample.cancelled} de ${projection.sample.customerMonths} cliente-mês)`)
    lines.push(`  vida esperada de uma cliente: ${projection.expectedLifetimeMonths} meses`)
    lines.push(`  receita por cliente-mês: ${money(projection.arpuPerPaidMonth)}`)
    lines.push(`  valor esperado por cliente ao longo da vida: ${money(projection.projectedLtv)} — confiança ${projection.confidence}`)
  }
  lines.push('')
  lines.push(`Gerado em ${dateBr(report.generatedAt)}. Contas de teste ficam fora das somas (FINANCE_TEST_ACCOUNT_EMAILS).`)
  return lines
}
