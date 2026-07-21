import test from 'node:test'
import assert from 'node:assert/strict'
import {
  reverseAffiliateCommissionForPayment,
  getAffiliateMeData,
} from '../src/domain/affiliate/service.js'

// ---- fake db helper (US1: estorno de comissão paga vira dívida) ----
function mkDb({ commissions = [], ledger = [] } = {}) {
  const rows = commissions.map(c => ({ ...c }))
  const ledgerRows = [...ledger]
  const db = {
    affiliateCommission: {
      findMany: async ({ where }) => rows.filter(r =>
        r.paymentId === where.paymentId && where.status.in.includes(r.status)
      ),
      updateMany: async ({ where, data }) => {
        const row = rows.find(r => r.id === where.id && (where.status === r.status || where.status?.in?.includes(r.status)))
        if (!row) return { count: 0 }
        Object.assign(row, data)
        return { count: 1 }
      },
    },
    affiliateCommissionLedger: {
      create: async ({ data }) => { const row = { id: `l-${ledgerRows.length + 1}`, ...data }; ledgerRows.push(row); return row },
      findFirst: async ({ where }) => ledgerRows.find(l => l.commissionId === where.commissionId && l.toStatus === where.toStatus) ?? null,
    },
  }
  return { db, rows, ledgerRows }
}

test('US1: estorno de comissão paid cria lançamento de dívida (não reverte o pagamento)', async () => {
  const { db, rows, ledgerRows } = mkDb({
    commissions: [{ id: 'c1', paymentId: 'p1', affiliateId: 'aff-1', status: 'paid', commissionAmountCents: 3000 }],
  })
  const result = await reverseAffiliateCommissionForPayment({ paymentId: 'p1', reason: 'chargeback', db })
  assert.equal(result.updated, 1)
  assert.equal(rows[0].status, 'reversed')
  assert.equal(ledgerRows.length, 1)
  assert.equal(ledgerRows[0].toStatus, 'debt')
  assert.equal(ledgerRows[0].amountCents, -3000)
  assert.equal(ledgerRows[0].reason, 'reversal_after_paid')
})

test('US1: reprocessar o mesmo estorno de comissão paid não duplica a dívida', async () => {
  const { db, ledgerRows } = mkDb({
    commissions: [{ id: 'c1', paymentId: 'p1', affiliateId: 'aff-1', status: 'paid', commissionAmountCents: 3000 }],
  })
  await reverseAffiliateCommissionForPayment({ paymentId: 'p1', reason: 'chargeback', db })
  // segunda chamada: comissão já está 'reversed' (não mais 'paid'), então o
  // findMany do fake db não a devolve mais — simula reentrada do webhook após
  // o primeiro processamento já ter concluído.
  const secondResult = await reverseAffiliateCommissionForPayment({ paymentId: 'p1', reason: 'chargeback', db })
  assert.equal(secondResult.updated, 0)
  assert.equal(ledgerRows.filter(l => l.toStatus === 'debt').length, 1)
})

test('US1: reversão de comissão pending/eligible/approved/held preserva comportamento atual (sem debt)', async () => {
  for (const status of ['pending', 'eligible', 'approved', 'held']) {
    const { db, rows, ledgerRows } = mkDb({
      commissions: [{ id: 'c1', paymentId: 'p1', affiliateId: 'aff-1', status, commissionAmountCents: 1000 }],
    })
    const result = await reverseAffiliateCommissionForPayment({ paymentId: 'p1', reason: 'refund', db })
    assert.equal(result.updated, 1, `status=${status}`)
    assert.equal(rows[0].status, 'reversed', `status=${status}`)
    assert.equal(ledgerRows.length, 1, `status=${status}`)
    assert.equal(ledgerRows[0].toStatus, 'reversed', `status=${status}`)
    assert.equal(ledgerRows[0].amountCents, 1000, `status=${status}`)
  }
})

test('US1: getAffiliateMeData expõe debtCents derivado do ledger', async () => {
  const db = {
    affiliateProfile: { findUnique: async () => ({ id: 'prof-1', userId: 'u1', pixKey: 'pix@example.com', pixKeyType: 'email' }) },
    user: { count: async () => 0 },
    affiliateCommission: { groupBy: async () => [] },
    affiliateCommissionLedger: {
      groupBy: async () => [
        { toStatus: 'debt', _sum: { amountCents: -3000 } },
        { toStatus: 'debt_settled', _sum: { amountCents: 1000 } },
      ],
    },
  }
  const data = await getAffiliateMeData({ userId: 'u1', db })
  assert.equal(data.stats.debtCents, 2000)
})
