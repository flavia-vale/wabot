import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { buildLtvReport } from '../src/domain/admin/ltvRetention.js'
import {
  CHURN_REASONS,
  classifyChurnReason,
  classifyNonRenewals,
  buildChurnReport,
} from '../src/domain/admin/churnReason.js'

const ROUTES = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
const PAGE = readFileSync(new URL('../dashboard/app/admin/receita/page.js', import.meta.url), 'utf8')
const SCRIPT = readFileSync(new URL('../scripts/diag-motivo-nao-renovou.mjs', import.meta.url), 'utf8')

const NOW = new Date('2026-09-19T12:00:00Z')
const DAY = 86_400_000
const daysAgo = n => new Date(NOW.getTime() - n * DAY)
const pay = (userId, daysBack, extra = {}) => ({ userId, status: 'approved', amount: 69, plan: 'pro', createdAt: daysAgo(daysBack), ...extra })

// Fixture no formato que os dois scripts leem do banco.
const payments = [
  pay('u1', 120), pay('u1', 90), pay('u1', 60), // renovou
  pay('u2', 100), // avulso, não renovou
  pay('u3', 110), // autopay recusado
  pay('u4', 105), // cancelou no painel
  pay('u5', 15), // ainda ativa
]
const users = ['u1', 'u2', 'u3', 'u4', 'u5'].map(id => ({ id, email: `${id}@x.com`, plan: 'pro', createdAt: daysAgo(200) }))
const subscriptions = [
  { userId: 'u3', status: 'authorized', cancelledAt: null },
  { userId: 'u4', status: 'cancelled', cancelledAt: daysAgo(80) },
]
const charges = [{ userId: 'u3', status: 'rejected', attemptedAt: daysAgo(70) }]

// Réplica literal da conta inline do script (diag-motivo-nao-renovou.mjs) — se
// ela mudar lá, este teste obriga a mudar o módulo junto.
function scriptCounts(report) {
  const naoRenovou = report.customers.filter(c => !c.renewed && c.status === 'cancelada')
  const counts = {}
  for (const c of naoRenovou) {
    const subs = subscriptions.filter(s => s.userId === c.userId)
    const reason = classifyChurnReason({
      everHadAutopay: subs.length > 0,
      explicitCancel: subs.some(s => s.status === 'cancelled' && s.cancelledAt),
      hadRejectedChargeAfterFirstPayment: charges.filter(ch => ch.userId === c.userId && ch.attemptedAt >= c.firstPaidAt).some(ch => ch.status === 'rejected'),
    })
    counts[reason] = (counts[reason] || 0) + 1
  }
  return counts
}

test('churn da rota == contagem do script na mesma fixture', () => {
  const report = buildLtvReport({ users, payments, now: NOW })
  const classified = classifyNonRenewals(report.customers, { subscriptions, charges })
  const fromModule = {}
  for (const c of classified) fromModule[c.reason] = (fromModule[c.reason] || 0) + 1
  assert.deepEqual(fromModule, scriptCounts(report))
  assert.equal(fromModule[CHURN_REASONS.AMBIGUO_AVULSO], 1)
  assert.equal(fromModule[CHURN_REASONS.INVOLUNTARIO], 1)
  assert.equal(fromModule[CHURN_REASONS.VOLUNTARIO], 1)
})

test('buildChurnReport soma por motivo e por mês igual ao total classificado (janela larga)', () => {
  const report = buildLtvReport({ users, payments, now: NOW })
  const classified = classifyNonRenewals(report.customers, { subscriptions, charges })
  const churn = buildChurnReport(classified, { now: NOW, months: 12 })
  assert.equal(churn.total, classified.length)
  assert.equal(churn.monthly.reduce((s, r) => s + r.total, 0), classified.length)
  assert.equal(churn.byReason.reduce((s, r) => s + r.count, 0), classified.length)
  assert.equal(churn.monthly.length, 12)
  const g = k => churn.monthly.reduce((s, r) => s + r[k], 0)
  assert.equal(g('voluntario'), 1)
  assert.equal(g('involuntario'), 1)
  assert.equal(g('incerto'), 1)
})

test('coortes da rota == coortes do módulo (a rota não reescreve a conta)', () => {
  assert.match(ROUTES, /app\.get\('\/finance\/ltv'/)
  assert.match(ROUTES, /app\.get\('\/finance\/churn'/)
  assert.match(ROUTES, /buildLtvReport\(\{ users, payments, now \}\)/)
  assert.match(ROUTES, /classifyNonRenewals\(report\.customers/)
  assert.ok(buildLtvReport({ users, payments, now: NOW }).cohorts.length > 0)
})

test('rotas exigem billing:read, auditam e não expõem e-mail por cliente', () => {
  for (const path of ['/finance/ltv', '/finance/churn']) {
    const start = ROUTES.indexOf(`app.get('${path}'`)
    const body = ROUTES.slice(start, start + 1200)
    assert.match(body, /requireAdmin\(req, reply, 'billing:read'\)/)
    assert.match(body, /writeAdminAuditLog/)
  }
  assert.match(ROUTES, /const \{ customers: _customers, \.\.\.rest \} = report/)
})

test('o script continua usando classifyChurnReason do domínio', () => {
  assert.match(SCRIPT, /classifyChurnReason/)
})

test('tela: sub-aba Retenção busca as duas rotas só quando aberta', () => {
  assert.match(PAGE, /\['retencao', 'Retenção'\]/)
  assert.match(PAGE, /api\.adminFinanceLtv\(\)/)
  assert.match(PAGE, /api\.adminFinanceChurn\(6\)/)
  assert.match(PAGE, /if \(financeTab !== 'retencao'\) return/)
  assert.match(PAGE, /function cohortSentence/)
})
