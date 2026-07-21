import test from 'node:test'
import assert from 'node:assert/strict'
import { canRequestPayout } from '../src/domain/affiliate/payoutPolicy.js'

test('canRequestPayout: saldo ok, sem devedor, sem pedido aberto → ok:true', () => {
  const r = canRequestPayout({ availableCents: 6000, debtCents: 0, minPayoutCents: 5000, hasOpenRequest: false })
  assert.deepEqual(r, { ok: true })
})

test('canRequestPayout: saldo abaixo do mínimo → erro com o valor mínimo na mensagem', () => {
  const r = canRequestPayout({ availableCents: 1000, debtCents: 0, minPayoutCents: 5000, hasOpenRequest: false })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'below_minimum')
  assert.match(r.error, /50,00|50\.00/)
})

test('canRequestPayout: saldo devedor pendente → erro', () => {
  const r = canRequestPayout({ availableCents: 6000, debtCents: 100, minPayoutCents: 5000, hasOpenRequest: false })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'debt_pending')
  assert.match(r.error, /devedor/i)
})

test('canRequestPayout: pedido já aberto → erro', () => {
  const r = canRequestPayout({ availableCents: 6000, debtCents: 0, minPayoutCents: 5000, hasOpenRequest: true })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'open_request')
  assert.match(r.error, /aberto/i)
})

test('canRequestPayout: pedido aberto tem prioridade sobre demais bloqueios', () => {
  const r = canRequestPayout({ availableCents: 0, debtCents: 100, minPayoutCents: 5000, hasOpenRequest: true })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'open_request')
  assert.match(r.error, /aberto/i)
})
