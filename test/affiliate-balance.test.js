import test from 'node:test'
import assert from 'node:assert/strict'
import { computeDebtCents, computeAvailableCents } from '../src/domain/affiliate/affiliateBalance.js'

test('computeDebtCents: dívida simples (um lançamento debt)', () => {
  const debt = computeDebtCents({ ledgerRows: [{ toStatus: 'debt', amountCents: -3000 }] })
  assert.equal(debt, 3000)
})

test('computeDebtCents: dívida parcialmente amortizada (debt_settled)', () => {
  const debt = computeDebtCents({ ledgerRows: [
    { toStatus: 'debt', amountCents: -3000 },
    { toStatus: 'debt_settled', amountCents: 1000 },
  ] })
  assert.equal(debt, 2000)
})

test('computeDebtCents: piso em 0 quando amortização excede a dívida', () => {
  const debt = computeDebtCents({ ledgerRows: [
    { toStatus: 'debt', amountCents: -1000 },
    { toStatus: 'debt_settled', amountCents: 5000 },
  ] })
  assert.equal(debt, 0)
})

test('computeDebtCents: sem lançamentos de dívida → 0', () => {
  assert.equal(computeDebtCents({ ledgerRows: [] }), 0)
  assert.equal(computeDebtCents({ ledgerRows: [{ toStatus: 'paid', amountCents: 500 }] }), 0)
})

test('computeAvailableCents: soma apenas comissões eligible/approved', () => {
  const available = computeAvailableCents({ commissionRows: [
    { status: 'eligible', commissionAmountCents: 1000 },
    { status: 'approved', commissionAmountCents: 500 },
    { status: 'pending', commissionAmountCents: 999 },
    { status: 'paid', commissionAmountCents: 999 },
    { status: 'reversed', commissionAmountCents: 999 },
    { status: 'held', commissionAmountCents: 999 },
  ] })
  assert.equal(available, 1500)
})

test('computeAvailableCents: sem comissões → 0', () => {
  assert.equal(computeAvailableCents({ commissionRows: [] }), 0)
})
