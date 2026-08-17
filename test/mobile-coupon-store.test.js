import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_COUPON_LINKS } from '../dashboard/lib/mobileCouponStore.js'

// specs/012-shein-store-support (D13/T058): shein entra no catálogo de links
// de cupom com valor vazio por padrão, como as demais lojas.
test('DEFAULT_COUPON_LINKS inclui shein vazio', () => {
  assert.equal('shein' in DEFAULT_COUPON_LINKS, true)
  assert.equal(DEFAULT_COUPON_LINKS.shein, '')
})
