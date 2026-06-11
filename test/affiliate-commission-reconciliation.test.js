import test from 'node:test'
import assert from 'node:assert/strict'
import { tryCreateAffiliateCommission, reconcileAffiliateCommissions } from '../src/domain/affiliate/service.js'

function mkDb({ payments = [], existingCommissions = [], profileStatus = 'approved', settings = null, failCreateWith = null } = {}) {
  const created = []
  const db = {
    payment: {
      findMany: async () => payments,
    },
    user: {
      findUnique: async () => ({ affiliateProfileId: 'prof-1' }),
    },
    affiliateProfile: {
      findUnique: async () => ({ id: 'prof-1', status: profileStatus, commissionPercentOverride: null, commissionRecurringPercentOverride: null }),
    },
    affiliateSettings: {
      findFirst: async () => settings,
    },
    affiliateCommission: {
      findFirst: async ({ where }) => existingCommissions.find(c => c.referredUserId === where.referredUserId) ?? null,
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
