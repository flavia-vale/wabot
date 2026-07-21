import test from 'node:test'
import assert from 'node:assert/strict'
import { attachAffiliateAttributionTouchesToUser, approveAffiliateCommission, reverseAffiliateCommission, reverseAffiliateCommissionForPayment, tryCreateAffiliateCommission, reconcileAffiliateCommissions, promoteEligibleAffiliateCommissions } from '../src/domain/affiliate/service.js'

function mkDb({ payments = [], existingCommissions = [], profileStatus = 'approved', settings = null, failCreateWith = null, referredUser = null, profile = null, eligibleRows = [], paymentSnapshot = null } = {}) {
  const created = []
  const db = {
    payment: {
      findMany: async () => payments,
      findUnique: async () => paymentSnapshot,
    },
    user: {
      findUnique: async () => referredUser ?? ({ id: 'user-1', email: 'cliente@example.com', contactPhone: '+5511999990000', affiliateProfileId: 'prof-1' }),
    },
    affiliateProfile: {
      findUnique: async () => profile ?? ({ id: 'prof-1', userId: 'affiliate-user-1', status: profileStatus, pixKey: 'affiliate-pix@example.com', pixKeyType: 'email', commissionPercentOverride: null, commissionRecurringPercentOverride: null, user: { id: 'affiliate-user-1', email: 'afiliado@example.com', contactPhone: '+5511888880000' } }),
    },
    affiliateSettings: {
      findFirst: async () => settings,
    },
    affiliateCommission: {
      findFirst: async ({ where }) => existingCommissions.find(c => c.referredUserId === where.referredUserId) ?? null,
      findMany: async () => eligibleRows,
      update: async ({ where, data }) => {
        const row = eligibleRows.find(r => r.id === where.id)
        if (row) Object.assign(row, data)
        return row ?? { id: where.id, ...data }
      },
      create: async ({ data }) => {
        if (failCreateWith) throw failCreateWith
        const row = { id: `comm-${created.length + 1}`, ...data }
        created.push(row)
        return row
      },
    },
  }
  return { db, created }
}

test('tryCreateAffiliateCommission usa occurredAt para definir cycleMonth (backfill retroativo)', async () => {
  const { db, created } = mkDb()
  const result = await tryCreateAffiliateCommission({
    userId: 'user-1',
    paymentId: 'pay-1',
    saleAmountCents: 3900,
    occurredAt: new Date('2026-03-15T10:00:00.000Z'),
    db,
  })
  assert.equal(result.created, true)
  assert.equal(created[0].cycleMonth, '2026-03')
  assert.equal(created[0].commissionType, 'initial')
  assert.equal(created[0].commissionAmountCents, Math.round(3900 * 30 / 100))
})

test('tryCreateAffiliateCommission sem occurredAt usa o mês corrente', async () => {
  const { db, created } = mkDb()
  await tryCreateAffiliateCommission({ userId: 'user-1', paymentId: 'pay-1', saleAmountCents: 1000, db })
  assert.equal(created[0].cycleMonth, new Date().toISOString().slice(0, 7))
})

test('reconcileAffiliateCommissions cria comissões faltantes preservando o ciclo do pagamento', async () => {
  const { db, created } = mkDb({
    payments: [
      { id: 'pay-1', userId: 'user-1', amount: 39, createdAt: new Date('2026-04-02T00:00:00.000Z') },
      { id: 'pay-2', userId: 'user-1', amount: 69, createdAt: new Date('2026-05-02T00:00:00.000Z') },
    ],
  })
  const result = await reconcileAffiliateCommissions({ db })
  assert.deepEqual({ checked: result.checked, created: result.created, failed: result.failed }, { checked: 2, created: 2, failed: 0 })
  assert.equal(created[0].cycleMonth, '2026-04')
  assert.equal(created[1].cycleMonth, '2026-05')
  assert.equal(created[0].saleAmountCents, 3900)
  assert.equal(created[1].saleAmountCents, 6900)
})

test('reconcileAffiliateCommissions trata duplicata (P2002) como skip, não como falha', async () => {
  const dup = Object.assign(new Error('unique'), { code: 'P2002' })
  const { db } = mkDb({
    payments: [{ id: 'pay-1', userId: 'user-1', amount: 39, createdAt: new Date() }],
    failCreateWith: dup,
  })
  const result = await reconcileAffiliateCommissions({ db })
  assert.deepEqual({ created: result.created, skipped: result.skipped, failed: result.failed }, { created: 0, skipped: 1, failed: 0 })
})

test('reconcileAffiliateCommissions não aborta o lote quando um pagamento falha', async () => {
  let calls = 0
  const { db, created } = mkDb({
    payments: [
      { id: 'pay-1', userId: 'user-1', amount: 39, createdAt: new Date() },
      { id: 'pay-2', userId: 'user-1', amount: 39, createdAt: new Date() },
    ],
  })
  const originalCreate = db.affiliateCommission.create
  db.affiliateCommission.create = async (args) => {
    calls++
    if (calls === 1) throw new Error('SQLITE_BUSY: database is locked')
    return originalCreate(args)
  }
  const result = await reconcileAffiliateCommissions({ db })
  assert.equal(result.failed, 1)
  assert.equal(result.created, 1)
  assert.equal(created.length, 1)
})

test('comissão recorrente é classificada quando já existe comissão anterior do par afiliado+indicado', async () => {
  const { db, created } = mkDb({
    existingCommissions: [{ referredUserId: 'user-1', affiliateId: 'prof-1' }],
  })
  const result = await tryCreateAffiliateCommission({ userId: 'user-1', paymentId: 'pay-2', saleAmountCents: 3900, db })
  assert.equal(result.created, true)
  assert.equal(created[0].commissionType, 'recurring')
})


test('tryCreateAffiliateCommission define elegibilidade futura pelo hold em dias', async () => {
  const { db, created } = mkDb({ settings: { commissionPercent: 30, commissionRecurringPercent: 30, recurringCommissionEnabled: true, commissionHoldDays: 15 } })
  await tryCreateAffiliateCommission({
    userId: 'user-1',
    paymentId: 'pay-1',
    saleAmountCents: 3900,
    occurredAt: new Date('2026-06-01T00:00:00.000Z'),
    db,
  })
  assert.equal(created[0].status, 'pending')
  assert.equal(created[0].eligibleAt.toISOString(), '2026-06-16T00:00:00.000Z')
})

test('tryCreateAffiliateCommission bloqueia autoafiliação do mesmo usuário', async () => {
  const { db, created } = mkDb({
    referredUser: { id: 'affiliate-user-1', email: 'afiliado@example.com', contactPhone: '+5511888880000', affiliateProfileId: 'prof-1' },
  })
  const result = await tryCreateAffiliateCommission({ userId: 'affiliate-user-1', paymentId: 'pay-self', saleAmountCents: 3900, db })
  assert.equal(result.skipped, 'self_referral')
  assert.equal(created.length, 0)
})

test('tryCreateAffiliateCommission coloca em held quando Pix do afiliado bate com indicado', async () => {
  const { db, created } = mkDb({
    profile: { id: 'prof-1', userId: 'affiliate-user-1', status: 'approved', pixKey: 'cliente@example.com', pixKeyType: 'email', commissionPercentOverride: null, commissionRecurringPercentOverride: null, user: { id: 'affiliate-user-1', email: 'afiliado@example.com', contactPhone: '+5511888880000' } },
  })
  const result = await tryCreateAffiliateCommission({ userId: 'user-1', paymentId: 'pay-held', saleAmountCents: 3900, db })
  assert.equal(result.status, 'held')
  assert.equal(created[0].status, 'held')
  assert.equal(created[0].holdReason, 'pix_matches_referred_email')
})

test('promoteEligibleAffiliateCommissions promove pendentes vencidas para eligible', async () => {
  const eligibleRows = [{ id: 'comm-1' }, { id: 'comm-2' }]
  const { db } = mkDb({ eligibleRows })
  const result = await promoteEligibleAffiliateCommissions({ db, now: new Date('2026-07-01T00:00:00.000Z') })
  assert.deepEqual(result, { checked: 2, promoted: 2, failed: 0 })
  assert.equal(eligibleRows[0].status, 'eligible')
  assert.equal(eligibleRows[1].status, 'eligible')
})


test('tryCreateAffiliateCommission usa snapshot imutável do pagamento antes do User atual', async () => {
  const { db, created } = mkDb({
    referredUser: { id: 'user-1', email: 'cliente@example.com', contactPhone: '+5511999990000', affiliateProfileId: 'prof-current' },
    paymentSnapshot: { affiliateProfileIdAtCheckout: 'prof-snapshot' },
    profile: { id: 'prof-snapshot', userId: 'affiliate-user-2', status: 'approved', pixKey: 'snapshot@example.com', pixKeyType: 'email', commissionPercentOverride: null, commissionRecurringPercentOverride: null, user: { id: 'affiliate-user-2', email: 'snapshot-aff@example.com', contactPhone: '+5511777770000' } },
  })
  const result = await tryCreateAffiliateCommission({ userId: 'user-1', paymentId: 'pay-snapshot', saleAmountCents: 3900, db })
  assert.equal(result.created, true)
  assert.equal(created[0].affiliateId, 'prof-snapshot')
})


test('approveAffiliateCommission aprova hold/elegível de forma atômica', async () => {
  const rows = [{ id: 'comm-1', status: 'held', referredUserId: 'user-1' }]
  const db = {
    affiliateCommission: {
      updateMany: async ({ where, data }) => {
        const row = rows.find(r => r.id === where.id && where.status.in.includes(r.status))
        if (!row) return { count: 0 }
        Object.assign(row, data)
        return { count: 1 }
      },
      findUnique: async ({ where }) => rows.find(r => r.id === where.id) ?? null,
    },
  }

  const result = await approveAffiliateCommission({ id: 'comm-1', adminUserId: 'admin-1', db })
  assert.equal(result.updated, true)
  assert.equal(rows[0].status, 'approved')
  assert.equal(rows[0].approvedByUserId, 'admin-1')
  assert.ok(rows[0].approvedAt instanceof Date)
})

test('reverseAffiliateCommission exige motivo e não reverte comissão paga', async () => {
  const rows = [{ id: 'paid-1', status: 'paid' }, { id: 'eligible-1', status: 'eligible' }]
  const db = {
    affiliateCommission: {
      updateMany: async ({ where, data }) => {
        const row = rows.find(r => r.id === where.id && where.status.in.includes(r.status))
        if (!row) return { count: 0 }
        Object.assign(row, data)
        return { count: 1 }
      },
      findUnique: async ({ where }) => rows.find(r => r.id === where.id) ?? null,
    },
  }

  assert.deepEqual(await reverseAffiliateCommission({ id: 'eligible-1', reason: '', db }), { updated: false, reason: 'missing_reason' })
  assert.deepEqual(await reverseAffiliateCommission({ id: 'paid-1', reason: 'chargeback', db }), { updated: false, reason: 'not_reversible' })

  const result = await reverseAffiliateCommission({ id: 'eligible-1', reason: 'chargeback confirmado', db })
  assert.equal(result.updated, true)
  assert.equal(rows[1].status, 'reversed')
  assert.equal(rows[1].reversalReason, 'chargeback confirmado')
  assert.ok(rows[1].reversedAt instanceof Date)
})


test('attachAffiliateAttributionTouchesToUser associa touches anônimos ao usuário no cadastro', async () => {
  const calls = []
  const db = {
    affiliateAttributionTouch: {
      updateMany: async (args) => {
        calls.push(args)
        return { count: 2 }
      },
    },
  }

  const result = await attachAffiliateAttributionTouchesToUser({ visitorId: ' visitor-1 ', userId: 'user-1', affiliateId: 'prof-1', db })
  assert.deepEqual(result, { updated: 2 })
  assert.deepEqual(calls[0].where, { visitorId: 'visitor-1', userId: null, affiliateId: 'prof-1' })
  assert.deepEqual(calls[0].data, { userId: 'user-1' })
})

test('reverseAffiliateCommissionForPayment reverte apenas comissões reversíveis do pagamento', async () => {
  const calls = []
  const db = {
    affiliateCommission: {
      // US1 (009-affiliate-improvements-r1): reverseAffiliateCommissionForPayment
      // agora captura as comissões afetadas ANTES do updateMany (para gravar o
      // ledger com o status de origem) e atualiza por id — precisa de
      // findMany no fake db, e o updateMany passa a ser por-comissão.
      findMany: async ({ where }) => where.paymentId === 'pay-1'
        ? [{ id: 'c1', affiliateId: 'prof-1', status: 'eligible', commissionAmountCents: 1000 }]
        : [],
      updateMany: async (args) => {
        calls.push(args)
        return { count: 1 }
      },
    },
  }

  assert.deepEqual(await reverseAffiliateCommissionForPayment({ paymentId: 'pay-1', reason: '', db }), { updated: 0, reason: 'missing_reason' })
  const result = await reverseAffiliateCommissionForPayment({ paymentId: 'pay-1', reason: 'payment_refunded', db })
  assert.deepEqual(result, { updated: 1 })
  assert.equal(calls[0].where.id, 'c1')
  assert.deepEqual(calls[0].where.status.in, ['pending', 'eligible', 'approved', 'held'])
  assert.equal(calls[0].data.status, 'reversed')
  assert.equal(calls[0].data.reversalReason, 'payment_refunded')
  assert.ok(calls[0].data.reversedAt instanceof Date)
})
