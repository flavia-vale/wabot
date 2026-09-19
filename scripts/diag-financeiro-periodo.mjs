#!/usr/bin/env node
// Read-only. Reproduz o MESMO cálculo de GET /admin/finance/overview
// (src/api/routes/admin.js) fora da API, para conferir os Cards do painel
// contra uma soma independente.
//
// Uso:
//   node scripts/diag-financeiro-periodo.mjs [período]
// período: 7d | 30d | current_month | last_month | 3m | 6m (default: 30d)

import db from '../src/db.js'
import { resolveFinancePeriod } from '../src/domain/admin/financePeriod.js'
import { combineRevenueTotals, countDistinctPayingUsers, computeAverageLtv } from '../src/domain/admin/financeOverview.js'
import { CHARGE_OUTCOME_STATUSES } from '../src/domain/payments/chargeOutcome.js'

const period = process.argv[2] ?? '30d'
const range = resolveFinancePeriod(period)
const SUBSCRIPTION_PAYMENT_ID_PREFIX = 'sub_'
const oneTimePaymentWhere = {
  OR: [
    { mpPaymentId: null },
    { NOT: { mpPaymentId: { startsWith: SUBSCRIPTION_PAYMENT_ID_PREFIX } } },
  ],
}
const subscriptionChargeApprovedWhere = { status: { in: CHARGE_OUTCOME_STATUSES.aprovada } }

const [
  approvedOneTimePeriod,
  approvedOneTimeAll,
  approvedOneTimePayingUsers,
  subscriptionChargesPeriod,
  subscriptionChargesAll,
  subscriptionPayingUsers,
  manualPaymentsCount,
] = await Promise.all([
  db.payment.aggregate({ where: { status: 'approved', ...oneTimePaymentWhere, createdAt: { gte: range.start, lte: range.end } }, _sum: { amount: true }, _count: { _all: true } }),
  db.payment.aggregate({ where: { status: 'approved', ...oneTimePaymentWhere }, _sum: { amount: true }, _count: { _all: true } }),
  db.payment.groupBy({ by: ['userId'], where: { status: 'approved', ...oneTimePaymentWhere } }),
  db.subscriptionCharge.aggregate({ where: { ...subscriptionChargeApprovedWhere, attemptedAt: { gte: range.start, lte: range.end } }, _sum: { amount: true }, _count: { _all: true } }),
  db.subscriptionCharge.aggregate({ where: subscriptionChargeApprovedWhere, _sum: { amount: true }, _count: { _all: true } }),
  db.subscriptionCharge.groupBy({ by: ['userId'], where: subscriptionChargeApprovedWhere }),
  db.payment.count({ where: { status: 'approved', provider: 'manual' } }),
])

const { amount: revenuePeriod, count: countPeriod } = combineRevenueTotals({
  oneTimeAmount: approvedOneTimePeriod._sum.amount,
  oneTimeCount: approvedOneTimePeriod._count._all,
  subscriptionAmount: subscriptionChargesPeriod._sum.amount,
  subscriptionCount: subscriptionChargesPeriod._count._all,
})
const { amount: totalLtv, count: countAll } = combineRevenueTotals({
  oneTimeAmount: approvedOneTimeAll._sum.amount,
  oneTimeCount: approvedOneTimeAll._count._all,
  subscriptionAmount: subscriptionChargesAll._sum.amount,
  subscriptionCount: subscriptionChargesAll._count._all,
})
const payingUsers = countDistinctPayingUsers(
  approvedOneTimePayingUsers.map((r) => r.userId),
  subscriptionPayingUsers.map((r) => r.userId),
)

console.log(`Período: ${range.label} (${range.start.toISOString()} até ${range.end.toISOString()})`)
console.log('---')
console.log(`Receita bruta do período (Card "Receita bruta"): R$ ${revenuePeriod.toFixed(2)}`)
console.log(`  Avulso (Payment, exclui assinatura):  R$ ${(approvedOneTimePeriod._sum.amount ?? 0).toFixed(2)}  (${approvedOneTimePeriod._count._all} pagamentos)`)
console.log(`  Assinatura (SubscriptionCharge):       R$ ${(subscriptionChargesPeriod._sum.amount ?? 0).toFixed(2)}  (${subscriptionChargesPeriod._count._all} cobranças)`)
console.log(`  Total de pagamentos aprovados no período: ${countPeriod}`)
console.log('---')
console.log(`Receita total / LTV (todo o histórico): R$ ${totalLtv.toFixed(2)}  (${countAll} pagamentos)`)
console.log(`Clientes pagantes distintos: ${payingUsers}`)
console.log(`LTV médio: R$ ${computeAverageLtv(totalLtv, payingUsers).toFixed(2)}`)
console.log('---')
console.log(`Pagamentos manuais aprovados no histórico (conferência de que não sumiram): ${manualPaymentsCount}`)

process.exit(0)
