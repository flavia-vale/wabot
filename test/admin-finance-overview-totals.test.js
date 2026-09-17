import test from 'node:test'
import assert from 'node:assert/strict'
import {
  combineRevenueTotals,
  countDistinctPayingUsers,
  computeAverageLtv,
  computeMercadoPagoFees,
  computeNetRevenue,
} from '../src/domain/admin/financeOverview.js'

/*
 * A dona do produto desconfiou que os Cards do Financeiro não somavam
 * corretamente. Achado real: GET /finance/overview somava só `Payment`
 * (pagamento avulso). Cobrança de assinatura recuperada pela reconciliação
 * horária (quando o webhook `subscription_authorized_payment` se perde)
 * NUNCA grava `Payment` — só `SubscriptionCharge` — e ficava fora da conta.
 * Estes testes travam que as duas fontes somam sem perder e sem duplicar.
 */

test('soma avulso + assinatura sem perder nenhuma das duas fontes', () => {
  const result = combineRevenueTotals({
    oneTimeAmount: 690, oneTimeCount: 10,
    subscriptionAmount: 345, subscriptionCount: 5,
  })
  assert.equal(result.amount, 1035)
  assert.equal(result.count, 15)
})

test('fonte ausente ou nula não derruba a soma (reconciliação nunca rodou ainda, por exemplo)', () => {
  const result = combineRevenueTotals({ oneTimeAmount: 690, oneTimeCount: 10 })
  assert.equal(result.amount, 690)
  assert.equal(result.count, 10)

  const zero = combineRevenueTotals()
  assert.equal(zero.amount, 0)
  assert.equal(zero.count, 0)
})

test('arredonda para centavos (evita erro de ponto flutuante tipo 0.1 + 0.2)', () => {
  const result = combineRevenueTotals({ oneTimeAmount: 69.1, subscriptionAmount: 0.2 })
  assert.equal(result.amount, 69.3)
})

test('cliente pagante conta UMA vez mesmo pagando pelos dois caminhos (avulso e assinatura)', () => {
  const total = countDistinctPayingUsers(['u1', 'u2', 'u3'], ['u2', 'u4'])
  assert.equal(total, 4) // u1, u2, u3, u4 — u2 não duplica
})

test('LTV médio é 0 sem clientes pagantes, nunca divisão por zero', () => {
  assert.equal(computeAverageLtv(1000, 0), 0)
  assert.equal(computeAverageLtv(1000, 4), 250)
})

test('taxa do Mercado Pago cobre a base combinada (avulso via MP + toda assinatura)', () => {
  // Caso real do AGENTS.md: R$69 -> R$65,56 líquido com 4,99%.
  const fee = computeMercadoPagoFees({ baseAmount: 69, baseCount: 1, feePercent: 4.99, feeFixedCents: 0 })
  assert.equal(fee, 3.44) // 69 * 0.0499 = 3.4431 -> arredonda 3.44
})

test('taxa fixa por transação soma junto do percentual', () => {
  const fee = computeMercadoPagoFees({ baseAmount: 100, baseCount: 2, feePercent: 0, feeFixedCents: 50 })
  assert.equal(fee, 1) // 2 transações x R$0,50 = R$1,00
})

test('receita líquida = bruta - comissões - taxas MP', () => {
  const net = computeNetRevenue({ grossRevenue: 1000, affiliateCommissions: 100, mpFees: 50 })
  assert.equal(net, 850)
})

test('receita líquida nunca quebra com campos ausentes', () => {
  assert.equal(computeNetRevenue(), 0)
  assert.equal(computeNetRevenue({ grossRevenue: 100 }), 100)
})
