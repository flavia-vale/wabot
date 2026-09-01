import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateManualPaymentExpiry, parseManualPaymentInput } from '../src/domain/payments/manualPayment.js'

test('valida e normaliza um pagamento por fora', () => {
  const result = parseManualPaymentInput({
    userId: 'user-1', plan: 'PRO', days: '30', amount: 'R$ 55,20', paymentMethod: 'pix', note: 'Desconto de renovação',
  })
  assert.deepEqual(result, {
    ok: true,
    data: { userId: 'user-1', plan: 'pro', days: 30, amount: 55.2, paymentMethod: 'pix', note: 'Desconto de renovação' },
  })
})

test('recusa dados que criariam um lançamento financeiro inválido', () => {
  assert.equal(parseManualPaymentInput({ plan: 'pro', days: 30, amount: 55.2, paymentMethod: 'pix' }).ok, false)
  assert.equal(parseManualPaymentInput({ userId: 'u1', plan: 'trial', days: 30, amount: 0, paymentMethod: 'pix' }).ok, false)
  assert.equal(parseManualPaymentInput({ userId: 'u1', plan: 'pro', days: 0, amount: 55.2, paymentMethod: 'pix' }).ok, false)
  assert.equal(parseManualPaymentInput({ userId: 'u1', plan: 'pro', days: 30, amount: -1, paymentMethod: 'pix' }).ok, false)
  assert.equal(parseManualPaymentInput({ userId: 'u1', plan: 'pro', days: 30, amount: 55.2, paymentMethod: 'bitcoin' }).ok, false)
})

test('soma dias ao vencimento ativo', () => {
  const expiry = calculateManualPaymentExpiry({
    currentExpiry: new Date('2026-09-20T12:00:00.000Z'), days: 30, now: new Date('2026-09-01T12:00:00.000Z'),
  })
  assert.equal(expiry.toISOString(), '2026-10-20T12:00:00.000Z')
})

test('conta dias a partir de agora para acesso vencido', () => {
  const expiry = calculateManualPaymentExpiry({
    currentExpiry: new Date('2026-08-20T12:00:00.000Z'), days: 30, now: new Date('2026-09-01T12:00:00.000Z'),
  })
  assert.equal(expiry.toISOString(), '2026-10-01T12:00:00.000Z')
})
