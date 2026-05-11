import { createHmac } from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activatePaymentAccess,
  isValidMercadoPagoWebhookSignature,
  normalizeWebhookPayload,
  parseMercadoPagoSignature,
  resolveWebhookEventId,
  resolveWebhookProcessorConfig,
  shouldReconcilePayment,
  summarizeWebhookEvent,
  shouldEnforceWebhookSignature,
  hasStepUpMfa,
  resolvePlanForPayment,
} from '../src/api/routes/payments.js'

test('requires webhook signature when production is true even without a secret', () => {
  assert.equal(shouldEnforceWebhookSignature({ isProduction: true, secret: '' }), true)
})

test('requires webhook signature when secret is configured outside production', () => {
  assert.equal(shouldEnforceWebhookSignature({ isProduction: false, secret: 'secret' }), true)
})

test('does not require webhook signature locally without a secret', () => {
  assert.equal(shouldEnforceWebhookSignature({ isProduction: false, secret: '' }), false)
})

test('parses Mercado Pago signature header parts', () => {
  assert.deepEqual(parseMercadoPagoSignature('ts=123,v1=abc'), { ts: '123', v1: 'abc' })
})

test('validates Mercado Pago webhook signature', () => {
  const secret = 'webhook-secret'
  const dataId = '123456'
  const requestId = 'request-abc'
  const ts = '1710000000'
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex')

  assert.equal(isValidMercadoPagoWebhookSignature({ signature: `ts=${ts},v1=${v1}`, requestId, dataId, secret }), true)
  assert.equal(isValidMercadoPagoWebhookSignature({ signature: `ts=${ts},v1=invalid`, requestId, dataId, secret }), false)
})


test('hasStepUpMfa validates x-admin-mfa-token when configured', () => {
  const prev = process.env.ADMIN_MFA_TOKEN
  process.env.ADMIN_MFA_TOKEN = '123456'
  assert.equal(hasStepUpMfa({ headers: { 'x-admin-mfa-token': '123456' } }), true)
  assert.equal(hasStepUpMfa({ headers: { 'x-admin-mfa-token': '000000' } }), false)
  delete process.env.ADMIN_MFA_TOKEN
  assert.equal(hasStepUpMfa({ headers: { 'x-admin-mfa-token': '123456' } }), false)
  if (prev !== undefined) process.env.ADMIN_MFA_TOKEN = prev
})


test('resolvePlanForPayment prefers explicit plan metadata when valid', () => {
  const plans = { basic: { price: 1 }, pro: { price: 2 } }
  assert.equal(resolvePlanForPayment({ preferredPlan: 'pro', amount: 1, plans }), 'pro')
  assert.equal(resolvePlanForPayment({ preferredPlan: 'unknown', amount: 1, plans }), 'basic')
})

test('resolveWebhookEventId reads ID using priority order', () => {
  assert.equal(resolveWebhookEventId({ body: { id: 'body-id' }, query: { id: 'query-id' }, dataId: 'fallback' }), 'body-id')
  assert.equal(resolveWebhookEventId({ body: { data: { id: 'data-id' } }, query: { id: 'query-id' }, dataId: 'fallback' }), 'data-id')
  assert.equal(resolveWebhookEventId({ body: {}, query: { id: 'query-id' }, dataId: 'fallback' }), 'query-id')
  assert.equal(resolveWebhookEventId({ body: {}, query: { 'data.id': 'query-data-id' }, dataId: 'fallback' }), 'query-data-id')
  assert.equal(resolveWebhookEventId({ body: {}, query: {}, dataId: 'fallback' }), 'fallback')
  assert.equal(resolveWebhookEventId({ body: {}, query: {}, dataId: '' }), '')
})

test('normalizeWebhookPayload always returns valid JSON', () => {
  assert.equal(normalizeWebhookPayload({ id: 123 }), '{"id":"123","type":null,"action":null,"api_version":null,"date_created":null,"data":{"id":null},"live_mode":false,"user_id":null}')
  const circular = {}
  circular.self = circular
  assert.equal(normalizeWebhookPayload(circular), '{"id":null,"type":null,"action":null,"api_version":null,"date_created":null,"data":{"id":null},"live_mode":false,"user_id":null}')
})

test('summarizeWebhookEvent returns canonical summary fields', () => {
  assert.deepEqual(
    summarizeWebhookEvent({ type: 'payment', action: 'updated', data: { id: '987' } }),
    { type: 'payment', action: 'updated', dataResourceId: '987' }
  )
  assert.deepEqual(
    summarizeWebhookEvent({ topic: 'merchant_order' }),
    { type: 'merchant_order', action: 'unknown', dataResourceId: '' }
  )
})

test('resolveWebhookProcessorConfig enforces safe defaults and limits', () => {
  assert.deepEqual(resolveWebhookProcessorConfig({}), { enabled: false, intervalMs: 30000, batchSize: 50 })
  assert.deepEqual(
    resolveWebhookProcessorConfig({ BILLING_WEBHOOK_AUTOPROCESS: 'true', BILLING_WEBHOOK_PROCESS_INTERVAL_MS: '4000', BILLING_WEBHOOK_PROCESS_BATCH: '999' }),
    { enabled: true, intervalMs: 30000, batchSize: 200 }
  )
  assert.deepEqual(
    resolveWebhookProcessorConfig({ BILLING_WEBHOOK_AUTOPROCESS: 'TRUE', BILLING_WEBHOOK_PROCESS_INTERVAL_MS: '6000', BILLING_WEBHOOK_PROCESS_BATCH: '20' }),
    { enabled: true, intervalMs: 6000, batchSize: 20 }
  )
})

test('shouldReconcilePayment only for payment events with data id', () => {
  assert.equal(shouldReconcilePayment({ type: 'payment', dataResourceId: '123' }), true)
  assert.equal(shouldReconcilePayment({ type: 'payment', dataResourceId: '' }), false)
  assert.equal(shouldReconcilePayment({ type: 'merchant_order', dataResourceId: '123' }), false)
})

test('activatePaymentAccess extends from active expiry by 30 days', async () => {
  const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
  let updatedUser = null

  const tx = {
    user: {
      findUnique: async () => ({ accessExpiresAt: future }),
      update: async ({ data }) => { updatedUser = data; return data },
    },
    payment: {
      findUnique: async () => null,
      create: async () => ({}),
    },
  }

  const result = await activatePaymentAccess(tx, { userId: 'u1', plan: 'basic', mpPaymentId: 'p1', amount: 40 })
  const expectedMin = future.getTime() + (30 * 24 * 60 * 60 * 1000) - 1000
  const expectedMax = future.getTime() + (30 * 24 * 60 * 60 * 1000) + 1000

  assert.equal(result.alreadyActivated, false)
  assert.ok(updatedUser.accessExpiresAt.getTime() >= expectedMin)
  assert.ok(updatedUser.accessExpiresAt.getTime() <= expectedMax)
})
