import test from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateAffiliateCommissionRisk,
  tryCreateAffiliateCommission,
  getAffiliateMeData,
  getAffiliateReferrals,
  approveAffiliateCommission,
} from '../src/domain/affiliate/service.js'
import { encryptCredential } from '../src/credentialCrypto.js'

const baseProfile = {
  id: 'prof-1', userId: 'aff-user-1', status: 'approved',
  pixKey: 'pix@example.com', pixKeyType: 'email',
  commissionPercentOverride: null, commissionRecurringPercentOverride: null,
  user: { id: 'aff-user-1', email: 'afiliado@example.com', contactPhone: '+5511888880000' },
}
const referred = { id: 'user-1', email: 'cliente@example.com', contactPhone: '+5511999990000', affiliateProfileId: 'prof-1' }

// ---- R5: hold por mesmo dispositivo/rede ----
test('R5: mesmo ipHash entre afiliado e indicado coloca em hold', () => {
  const r = evaluateAffiliateCommissionRisk({ profile: baseProfile, referredUser: referred, affiliateSignals: { ipHash: 'ABC' }, referredSignals: { ipHash: 'ABC' } })
  assert.deepEqual(r, { decision: 'hold', reason: 'same_ip_hash' })
})

test('R5: mesmo uaHash coloca em hold', () => {
  const r = evaluateAffiliateCommissionRisk({ profile: baseProfile, referredUser: referred, affiliateSignals: { uaHash: 'UA' }, referredSignals: { uaHash: 'UA' } })
  assert.deepEqual(r, { decision: 'hold', reason: 'same_ua_hash' })
})

test('R5: sinais diferentes não disparam hold (allow)', () => {
  const r = evaluateAffiliateCommissionRisk({ profile: baseProfile, referredUser: referred, affiliateSignals: { ipHash: 'A' }, referredSignals: { ipHash: 'B' } })
  assert.equal(r.decision, 'allow')
})

// ---- R1: pixKey cifrado ainda casa no antifraude (decifra antes de comparar) ----
test('R1: pixMatch funciona mesmo com pixKey cifrado', () => {
  process.env.CREDENTIAL_ENCRYPTION_KEY = 'a'.repeat(64)
  try {
    const profile = { ...baseProfile, pixKey: encryptCredential('cliente@example.com'), pixKeyType: 'email' }
    const r = evaluateAffiliateCommissionRisk({ profile, referredUser: referred })
    assert.deepEqual(r, { decision: 'hold', reason: 'pix_matches_referred_email' })
  } finally {
    delete process.env.CREDENTIAL_ENCRYPTION_KEY
  }
})

// ---- helper de fake db para tryCreate ----
function mkDb({ existing = [], touches = {}, settings = null, profile = baseProfile, referredUser = referred } = {}) {
  const created = []
  const ledger = []
  const db = {
    user: { findUnique: async () => referredUser },
    payment: { findUnique: async () => null },
    affiliateProfile: { findUnique: async () => profile },
    affiliateSettings: { findFirst: async () => settings },
    affiliateAttributionTouch: {
      findFirst: async ({ where }) => touches[where.userId] ?? null,
    },
    affiliateCommission: {
      // respeita o filtro de status { not: 'reversed' } e NÃO filtra por afiliado (O1+O4)
      findFirst: async ({ where }) => existing.find(c =>
        c.referredUserId === where.referredUserId &&
        !(where.status?.not && c.status === where.status.not)
      ) ?? null,
      create: async ({ data }) => { const row = { id: `c-${created.length + 1}`, ...data }; created.push(row); return row },
    },
    affiliateCommissionLedger: {
      create: async ({ data }) => { ledger.push(data); return { id: `l-${ledger.length}`, ...data } },
    },
  }
  return { db, created, ledger }
}

// ---- O1: comissão anterior revertida NÃO torna a próxima 'recurring' ----
test('O1: prior revertida → próxima é initial', async () => {
  const { db, created } = mkDb({ existing: [{ referredUserId: 'user-1', affiliateId: 'prof-1', status: 'reversed' }] })
  await tryCreateAffiliateCommission({ userId: 'user-1', paymentId: 'p1', saleAmountCents: 3900, db })
  assert.equal(created[0].commissionType, 'initial')
})

// ---- O4: prior de OUTRO afiliado (não revertida) → recurring (não paga 2ª initial) ----
test('O4: prior de outro afiliado → recurring', async () => {
  const { db, created } = mkDb({ existing: [{ referredUserId: 'user-1', affiliateId: 'prof-OUTRO', status: 'paid' }] })
  await tryCreateAffiliateCommission({ userId: 'user-1', paymentId: 'p2', saleAmountCents: 3900, db })
  assert.equal(created[0].commissionType, 'recurring')
})

// ---- R3: ledger registra a criação ----
test('R3: criação de comissão grava linha no ledger', async () => {
  const { db, created, ledger } = mkDb()
  await tryCreateAffiliateCommission({ userId: 'user-1', paymentId: 'p3', saleAmountCents: 3900, db })
  assert.equal(ledger.length, 1)
  assert.equal(ledger[0].commissionId, created[0].id)
  assert.equal(ledger[0].fromStatus, null)
  assert.equal(ledger[0].toStatus, created[0].status)
  assert.equal(ledger[0].amountCents, created[0].commissionAmountCents)
  assert.equal(ledger[0].actor, 'system')
})

// ---- R5 ponta-a-ponta: touch do afiliado e do indicado com mesmo ipHash → held ----
test('R5 e2e: tryCreate coloca em held quando touches compartilham ipHash', async () => {
  const { db, created } = mkDb({ touches: { 'aff-user-1': { ipHash: 'SAME' }, 'user-1': { ipHash: 'SAME' } } })
  const r = await tryCreateAffiliateCommission({ userId: 'user-1', paymentId: 'p4', saleAmountCents: 3900, db })
  assert.equal(r.status, 'held')
  assert.equal(created[0].holdReason, 'same_ip_hash')
})

// ---- R3 approve grava ledger com fromStatus correto ----
test('R3: aprovação grava ledger held→approved', async () => {
  const rows = [{ id: 'c1', status: 'held', affiliateId: 'prof-1', commissionAmountCents: 1170 }]
  const ledger = []
  const db = {
    affiliateCommission: {
      findUnique: async ({ where }) => rows.find(r => r.id === where.id) ?? null,
      updateMany: async ({ where, data }) => { const row = rows.find(r => r.id === where.id && where.status.in.includes(r.status)); if (!row) return { count: 0 }; Object.assign(row, data); return { count: 1 } },
    },
    affiliateCommissionLedger: { create: async ({ data }) => { ledger.push(data); return data } },
  }
  const res = await approveAffiliateCommission({ id: 'c1', adminUserId: 'admin-9', db })
  assert.equal(res.updated, true)
  assert.equal(ledger.length, 1)
  assert.equal(ledger[0].fromStatus, 'held')
  assert.equal(ledger[0].toStatus, 'approved')
  assert.equal(ledger[0].actor, 'admin-9')
})

// ---- O6: getAffiliateMeData agrega via groupBy ----
test('O6: getAffiliateMeData soma por status a partir do groupBy', async () => {
  const db = {
    affiliateProfile: { findUnique: async () => ({ id: 'prof-1', userId: 'aff-user-1', pixKey: 'pix@example.com', pixKeyType: 'email' }) },
    user: { count: async () => 7 },
    affiliateCommission: {
      groupBy: async () => ([
        { cycleMonth: '2026-06', status: 'paid', _sum: { commissionAmountCents: 1000 }, _count: 2 },
        { cycleMonth: '2026-06', status: 'pending', _sum: { commissionAmountCents: 500 }, _count: 1 },
        { cycleMonth: '2026-05', status: 'reversed', _sum: { commissionAmountCents: 300 }, _count: 1 },
        { cycleMonth: '2026-05', status: 'eligible', _sum: { commissionAmountCents: 700 }, _count: 1 },
      ]),
    },
  }
  const data = await getAffiliateMeData({ userId: 'aff-user-1', db })
  assert.deepEqual(data.stats, { totalReferrals: 7, totalSales: 4, totalEarnedCents: 1000, payableCents: 700, pendingCents: 500, reversedCents: 300, debtCents: 0 })
  assert.equal(data.months[0].month, '2026-06')
  assert.equal(data.months[0].totalCents, 1500)
  assert.equal(data.months[0].status, 'pending')
  assert.equal(data.months[1].month, '2026-05')
  assert.equal(data.months[1].totalCents, 700) // reversed não soma
  assert.equal(data.months[1].status, 'eligible')
})

test('getAffiliateReferrals retorna múltiplos indicados com detalhes financeiros anonimizados', async () => {
  const users = [
    { id: 'u1', name: 'Marlene Jahn', email: 'marlene@example.com', contactPhone: null, status: 'active', plan: 'pro', accessExpiresAt: new Date('2026-08-01T00:00:00Z'), createdAt: new Date('2026-06-01T00:00:00Z'), lastActivityAt: null },
    { id: 'u2', name: 'Ana Silva', email: 'ana@example.com', contactPhone: null, status: 'active', plan: 'trial', accessExpiresAt: new Date('2026-07-01T00:00:00Z'), createdAt: new Date('2026-06-02T00:00:00Z'), lastActivityAt: null },
  ]
  const db = {
    user: {
      count: async ({ where }) => where.affiliateProfileId === 'prof-1' ? 2 : 0,
      findMany: async ({ where }) => where.affiliateProfileId === 'prof-1' ? users : [],
    },
    payment: { findMany: async () => [
      { userId: 'u1', amount: 39, createdAt: new Date('2026-06-10T00:00:00Z') },
      { userId: 'u1', amount: 39, createdAt: new Date('2026-06-20T00:00:00Z') },
    ] },
    affiliateCommission: { findMany: async () => [
      { referredUserId: 'u1', commissionType: 'initial', commissionAmountCents: 1170, status: 'pending', eligibleAt: new Date('2026-07-10T00:00:00Z'), paidAt: null },
      { referredUserId: 'u1', commissionType: 'recurring', commissionAmountCents: 1170, status: 'paid', eligibleAt: new Date('2026-07-20T00:00:00Z'), paidAt: new Date('2026-07-25T00:00:00Z') },
    ] },
  }

  const result = await getAffiliateReferrals({ affiliateProfileId: 'prof-1', anonymized: true, db, now: new Date('2026-06-29T00:00:00Z') })
  assert.equal(result.total, 2)
  assert.equal(result.referrals.length, 2)
  assert.equal(result.referrals[0].name, 'Marlene J.')
  assert.equal(result.referrals[0].paymentCount, 2)
  assert.equal(result.referrals[0].commissionInitialCents, 1170)
  assert.equal(result.referrals[0].commissionRecurringCents, 1170)
  assert.equal(result.referrals[0].commissionPendingCents, 1170)
  assert.equal(result.referrals[0].commissionPaidCents, 1170)
  assert.deepEqual(result.referrals[0].commissionStatuses, { pending: 1, paid: 1 })
})
