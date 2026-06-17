import test from 'node:test'
import assert from 'node:assert/strict'
import { createPaymentsService, resolvePlanForPayment, DEFAULT_PLANS } from '../src/domain/payments/service.js'

function buildMockTxWithSubscription({ existing = null, createdData = null, updatedData = null } = {}) {
  const created = { ref: createdData }
  const updated = { ref: updatedData }
  const tx = {
    subscription: {
      findUnique: async () => existing,
      create: async ({ data }) => { created.ref = data; return data },
      update: async ({ data }) => { updated.ref = data; return data },
    },
    user: {
      findUnique: async () => ({ accessExpiresAt: null }),
      update: async ({ data }) => data,
    },
    payment: {
      findUnique: async () => null,
      create: async () => ({}),
    },
  }
  return { tx, created, updated }
}

test('resolvePlanForPayment uses preferred plan then amount fallback', () => {
  const plans = { basic: { price: 39 }, pro: { price: 69 } }
  assert.equal(resolvePlanForPayment({ preferredPlan: 'pro', amount: 39, plans }), 'pro')
  assert.equal(resolvePlanForPayment({ preferredPlan: 'x', amount: 39, plans }), 'basic')
  assert.equal(resolvePlanForPayment({ preferredPlan: '', amount: 999, plans }), null)
})

test('getBillingPlans returns defaults when query fails', async () => {
  const service = createPaymentsService({
    db: { lpPlan: { findMany: async () => { throw new Error('db offline') } } },
  })
  const plans = await service.getBillingPlans()
  assert.deepEqual(plans, DEFAULT_PLANS)
})

test('upsertSubscription cria nova subscription quando não existe', async () => {
  const { tx, created } = buildMockTxWithSubscription({ existing: null })
  const service = createPaymentsService({ db: { lpPlan: { findMany: async () => [] } } })
  await service.upsertSubscription(tx, {
    userId: 'u1',
    mpSubscriptionId: 'preap-1',
    plan: 'pro',
    status: 'authorized',
    nextChargeAt: new Date('2026-07-17'),
  })
  assert.equal(created.ref.userId, 'u1')
  assert.equal(created.ref.mpSubscriptionId, 'preap-1')
  assert.equal(created.ref.plan, 'pro')
  assert.equal(created.ref.status, 'authorized')
})

test('upsertSubscription atualiza existente quando mpSubscriptionId já existe', async () => {
  const existing = { id: 'sub-1', userId: 'u1', mpSubscriptionId: 'preap-1', plan: 'basic', status: 'pending' }
  const { tx, updated } = buildMockTxWithSubscription({ existing })
  const service = createPaymentsService({ db: { lpPlan: { findMany: async () => [] } } })
  await service.upsertSubscription(tx, {
    userId: 'u1',
    mpSubscriptionId: 'preap-1',
    plan: 'pro',
    status: 'authorized',
    nextChargeAt: null,
  })
  assert.equal(updated.ref.status, 'authorized')
  assert.equal(updated.ref.plan, 'pro')
})

test('upsertSubscription marca cancelledAt quando status é cancelled', async () => {
  const { tx, created } = buildMockTxWithSubscription({ existing: null })
  const fixedNow = new Date('2026-06-17T10:00:00.000Z')
  const service = createPaymentsService({ db: { lpPlan: { findMany: async () => [] } }, now: () => fixedNow })
  await service.upsertSubscription(tx, {
    userId: 'u1',
    mpSubscriptionId: 'preap-2',
    plan: 'basic',
    status: 'cancelled',
    nextChargeAt: null,
  })
  assert.deepEqual(created.ref.cancelledAt, fixedNow)
})

test('activateSubscriptionAccess concede 30 dias igual a activatePaymentAccess', async () => {
  const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
  const { tx } = buildMockTxWithSubscription()
  tx.user.findUnique = async () => ({ accessExpiresAt: future })
  let updatedUser = null
  tx.user.update = async ({ data }) => { updatedUser = data; return data }

  const service = createPaymentsService({ db: { lpPlan: { findMany: async () => [] } }, now: () => new Date('2026-01-01T00:00:00.000Z') })
  const result = await service.activateSubscriptionAccess(tx, { userId: 'u1', plan: 'pro', mpPaymentId: 'sub_ap-1', amount: 69 })
  assert.equal(result.alreadyActivated, false)
  assert.equal(updatedUser.plan, 'pro')
  assert.ok(result.expiresAt > future)
})

test('activateSubscriptionAccess é idempotente quando pagamento já aprovado', async () => {
  const existingExpiry = new Date('2026-02-01T00:00:00.000Z')
  let userUpdated = false
  let paymentTouched = false
  const tx = {
    user: {
      findUnique: async () => ({ accessExpiresAt: existingExpiry }),
      update: async () => { userUpdated = true },
    },
    payment: {
      findUnique: async () => ({ id: 'p1', status: 'approved', userId: 'u1', expiresAt: existingExpiry }),
      update: async () => { paymentTouched = true },
      create: async () => { paymentTouched = true; throw new Error('should not create') },
    },
  }
  const service = createPaymentsService({ db: { lpPlan: { findMany: async () => [] } }, now: () => new Date('2026-01-01T00:00:00.000Z') })
  const result = await service.activateSubscriptionAccess(tx, { userId: 'u1', plan: 'pro', mpPaymentId: 'sub_ap-1', amount: 69 })
  assert.equal(result.alreadyActivated, true)
  assert.deepEqual(result.expiresAt, existingExpiry)
  assert.equal(userUpdated, false)
  assert.equal(paymentTouched, false)
})

test('activatePaymentAccess extends active expiry and updates existing payment', async () => {
  const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
  let updatedUser = null
  let updatedPayment = null
  const tx = {
    user: {
      findUnique: async () => ({ accessExpiresAt: future }),
      update: async ({ data }) => { updatedUser = data },
    },
    payment: {
      findUnique: async () => ({ id: 'p1', status: 'pending', userId: 'u1' }),
      update: async ({ data }) => { updatedPayment = data },
      create: async () => { throw new Error('should not create') },
    },
  }
  const service = createPaymentsService({ db: { lpPlan: { findMany: async () => [] } }, now: () => new Date('2026-01-01T00:00:00.000Z') })
  const result = await service.activatePaymentAccess(tx, { userId: 'u1', plan: 'pro', mpPaymentId: 'mp-1', amount: 69 })
  assert.equal(result.alreadyActivated, false)
  assert.equal(updatedPayment.status, 'approved')
  assert.equal(updatedUser.plan, 'pro')
  assert.ok(result.expiresAt > future)
})
