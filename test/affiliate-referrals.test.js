import test from 'node:test'
import assert from 'node:assert/strict'
import { getAffiliateReferrals, resolveAccessStatus } from '../src/domain/affiliate/service.js'

const NOW = new Date('2026-06-15T12:00:00.000Z')

function buildDb({ users, payments = [], commissions = [] }) {
  const calls = {}
  return {
    calls,
    user: {
      count: async ({ where }) => { calls.count = where; return users.length },
      findMany: async args => { calls.userFindMany = args; return users },
    },
    payment: {
      findMany: async args => { calls.paymentFindMany = args; return payments },
    },
    affiliateCommission: {
      findMany: async args => { calls.commissionFindMany = args; return commissions },
    },
  }
}

test('resolveAccessStatus classifica situação canônica do cliente', () => {
  assert.equal(resolveAccessStatus({ status: 'banned', plan: 'pro' }, NOW), 'banned')
  assert.equal(resolveAccessStatus({ status: 'suspended', plan: 'pro' }, NOW), 'suspended')
  assert.equal(resolveAccessStatus({ status: 'active', plan: 'pro', accessExpiresAt: '2026-06-01T00:00:00.000Z' }, NOW), 'expired')
  assert.equal(resolveAccessStatus({ status: 'active', plan: 'trial', accessExpiresAt: null }, NOW), 'trial')
  assert.equal(resolveAccessStatus({ status: 'active', plan: 'pro', accessExpiresAt: null }, NOW), 'active')
})

test('getAffiliateReferrals agrega pagamentos e comissões por cliente', async () => {
  const users = [
    { id: 'u1', name: 'Maria Silva Souza', email: 'maria@ex.com', contactPhone: '5511999', status: 'active', plan: 'pro', accessExpiresAt: '2026-12-01T00:00:00.000Z', createdAt: new Date('2026-05-01'), lastActivityAt: null },
    { id: 'u2', name: 'João', email: 'joao@ex.com', contactPhone: null, status: 'active', plan: 'trial', accessExpiresAt: null, createdAt: new Date('2026-06-10'), lastActivityAt: null },
  ]
  const payments = [
    { userId: 'u1', amount: 49.9, createdAt: new Date('2026-05-10') },
    { userId: 'u1', amount: 49.9, createdAt: new Date('2026-06-10') },
  ]
  const commissions = [
    { referredUserId: 'u1', commissionType: 'initial', commissionAmountCents: 1497 },
    { referredUserId: 'u1', commissionType: 'recurring', commissionAmountCents: 1497 },
  ]
  const db = buildDb({ users, payments, commissions })

  const result = await getAffiliateReferrals({ affiliateProfileId: 'aff-1', page: 1, limit: 25, db, now: NOW })

  assert.equal(result.total, 2)
  assert.equal(result.referrals.length, 2)

  const u1 = result.referrals.find(r => r.userId === 'u1')
  assert.equal(u1.email, 'maria@ex.com')
  assert.equal(u1.accessStatus, 'active')
  assert.equal(u1.isActive, true)
  assert.equal(u1.paymentCount, 2)
  assert.equal(u1.totalPaidCents, 9980)
  assert.deepEqual(new Date(u1.lastPaymentAt), new Date('2026-06-10'))
  assert.equal(u1.commissionInitialCents, 1497)
  assert.equal(u1.commissionRecurringCents, 1497)
  assert.equal(u1.commissionTotalCents, 2994)

  const u2 = result.referrals.find(r => r.userId === 'u2')
  assert.equal(u2.accessStatus, 'trial')
  assert.equal(u2.isActive, true)
  assert.equal(u2.paymentCount, 0)
  assert.equal(u2.totalPaidCents, 0)
  assert.equal(u2.lastPaymentAt, null)
  assert.equal(u2.commissionTotalCents, 0)

  // comissões filtradas pelo afiliado correto
  assert.equal(db.calls.commissionFindMany.where.affiliateId, 'aff-1')
  assert.deepEqual(db.calls.paymentFindMany.where.status, 'approved')
})

test('getAffiliateReferrals anonimizado mascara nome e oculta dados do cliente', async () => {
  const users = [
    { id: 'u1', name: 'Maria Silva Souza', email: 'maria@ex.com', contactPhone: '5511999', status: 'active', plan: 'pro', accessExpiresAt: null, createdAt: new Date('2026-05-01'), lastActivityAt: null },
  ]
  const payments = [{ userId: 'u1', amount: 49.9, createdAt: new Date('2026-05-10') }]
  const commissions = [{ referredUserId: 'u1', commissionType: 'initial', commissionAmountCents: 1497 }]
  const db = buildDb({ users, payments, commissions })

  const result = await getAffiliateReferrals({ affiliateProfileId: 'aff-1', anonymized: true, db, now: NOW })

  const r = result.referrals[0]
  assert.equal(r.name, 'Maria S.')
  assert.equal(r.isActive, true)
  assert.equal(r.paymentCount, 1)
  assert.equal(r.commissionTotalCents, 1497)
  // dados sensíveis NÃO devem aparecer na visão do afiliado
  assert.equal(r.email, undefined)
  assert.equal(r.contactPhone, undefined)
  assert.equal(r.userId, undefined)
  assert.equal(r.totalPaidCents, undefined)
})

test('getAffiliateReferrals não consulta pagamentos quando não há indicados', async () => {
  const db = buildDb({ users: [] })
  const result = await getAffiliateReferrals({ affiliateProfileId: 'aff-vazio', db, now: NOW })
  assert.deepEqual(result.referrals, [])
  assert.equal(result.total, 0)
  assert.equal(db.calls.paymentFindMany, undefined)
  assert.equal(db.calls.commissionFindMany, undefined)
})
