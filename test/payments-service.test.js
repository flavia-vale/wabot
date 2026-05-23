import test from 'node:test'
import assert from 'node:assert/strict'
import { createPaymentsService, resolvePlanForPayment, DEFAULT_PLANS } from '../src/domain/payments/service.js'

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
