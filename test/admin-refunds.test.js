import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { computeNetRevenue } from '../src/domain/admin/financeOverview.js'
import { buildRoiReport } from '../src/domain/admin/roi.js'

test('reembolso integral mantém a taxa do Mercado Pago como prejuízo', () => {
  assert.equal(computeNetRevenue({ grossRevenue: 69, mpFees: 3.44, refunds: 69 }), -3.44)
})

test('ROI desconta o reembolso no mês em que o PIX saiu', () => {
  const report = buildRoiReport({
    now: new Date('2026-09-21T12:00:00Z'),
    env: { ROI_RECURRING_START_MONTH: '2026-08', ROI_CLAUDE_MONTHLY_BRL: '0', ROI_VPS_MONTHLY_BRL: '0' },
    revenueByMonth: {
      '2026-08': { gross: 69, mpFees: 3.44, refunds: 0, payments: 1, payingUsers: 1 },
      '2026-09': { gross: 0, mpFees: 0, refunds: 69, payments: 0, payingUsers: 0 },
    },
  })
  assert.equal(report.reconciliation.grossAllTime, 69)
  assert.equal(report.reconciliation.refundsAllTime, 69)
  assert.equal(report.reconciliation.netAllTime, -3.44)
  assert.equal(report.summary.netToDate, -3.44)
})

test('painel expõe ação auditada, conciliação e os dois cards de pagantes', () => {
  const route = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
  const page = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')
  assert.match(route, /app\.post\('\/payments\/:paymentId\/refund'/)
  assert.match(route, /admin\.payment\.refund\.create/)
  assert.match(page, /Marcar reembolso/)
  assert.match(page, /Conciliar com o Financeiro/)
  assert.match(page, /label="Pagantes atuais"/)
  assert.match(page, /label="Pagantes online"/)
})
