import { createHmac } from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidMercadoPagoWebhookSignature,
  parseMercadoPagoSignature,
  shouldEnforceWebhookSignature,
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
