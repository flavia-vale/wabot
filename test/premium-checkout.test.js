import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createPaymentsService, DEFAULT_PLANS, resolvePlanForPayment } from '../src/domain/payments/service.js'
import { hasPaidActiveAccess, decideCheckoutOffer } from '../src/domain/payments/checkoutOffer.js'
import { buildFeatureGateError, FEATURE_CODES, PLAN_IDS } from '../src/billing/plans.js'
import { buildCheckoutItem } from '../src/domain/payments/checkoutPayer.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('Premium é plano pago válido de R$ 99', async () => {
  assert.equal(DEFAULT_PLANS.premium.price, 99)
  assert.match(DEFAULT_PLANS.premium.title, /Premium/)
  const service = createPaymentsService({ db: { lpPlan: { findMany: async () => [] } } })
  const plans = await service.getBillingPlans()
  assert.equal(plans.premium.price, 99)
  assert.equal(plans.pro.price, 69)
  assert.equal(resolvePlanForPayment({ preferredPlan: 'premium', amount: 99, plans }), 'premium')
  assert.equal(resolvePlanForPayment({ preferredPlan: '', amount: 99, plans }), 'premium')
})

test('Premium sem linha no banco mantém o preço padrão mesmo com Basic/Pro vindo do banco', async () => {
  const service = createPaymentsService({ db: { lpPlan: { findMany: async () => [{ id: 'basic', title: 'Basic', price: 'R$ 39' }] } } })
  const plans = await service.getBillingPlans()
  assert.equal(plans.premium.price, 99)
})

test('pagamento aprovado de Premium vira plan=premium com 30 dias de acesso', async () => {
  const captured = { user: null }
  const tx = {
    user: { findUnique: async () => ({ accessExpiresAt: null }), update: async ({ data }) => { captured.user = data } },
    payment: { findUnique: async () => null, create: async () => ({}) },
  }
  const now = new Date('2026-10-01T00:00:00.000Z')
  const service = createPaymentsService({ db: { lpPlan: { findMany: async () => [] } }, now: () => now })
  const result = await service.activatePaymentAccess(tx, { userId: 'u1', plan: 'premium', mpPaymentId: 'mp-9', amount: 99 })
  assert.equal(captured.user.plan, 'premium')
  assert.equal(result.expiresAt.toISOString(), '2026-10-31T00:00:00.000Z')
})

test('Premium com período pago ativo pode ter cobrança automática, como o Pro', () => {
  const future = new Date(Date.now() + 5 * 86400000)
  assert.equal(hasPaidActiveAccess({ plan: 'premium', accessExpiresAt: future }), true)
  assert.equal(decideCheckoutOffer({ plan: 'premium', isActive: true, autoRenew: false, accessExpiresAt: future }).showAutoRenew, true)
})

test('item do checkout leva o plano Premium e o preço 99', () => {
  const item = buildCheckoutItem({ plan: 'premium', title: 'Premium', price: 99 })
  assert.equal(item.id, 'espelha-grupos-premium')
  assert.equal(item.unit_price, 99)
})

test('as rotas de checkout e assinatura aceitam premium (mensagem de plano inválido cita os três)', () => {
  const rota = read('src/api/routes/payments.js')
  assert.doesNotMatch(rota, /Use basic ou pro\./)
  assert.equal((rota.match(/Use basic, pro ou premium\./g) ?? []).length, 2)
})

test('gate do multicanal aponta para a compra do Premium em /painel/plano', () => {
  const gate = buildFeatureGateError(FEATURE_CODES.MULTI_NETWORK)
  assert.equal(gate.requiredPlan, PLAN_IDS.PREMIUM)
  assert.equal(gate.upgradePath, '/painel/plano')
  assert.match(gate.error, /tela Plano/)
  assert.match(gate.error, /Premium/)
  assert.match(gate.error, /Telegram/)
  assert.doesNotMatch(gate.error, /seu plano n[ãa]o permite|estará disponível/i)
})

test('financeiro do admin conta Premium no MRR e na lista de pagantes', () => {
  const admin = read('src/api/routes/admin.js')
  const mrr = read('src/domain/admin/mrr.js')
  assert.match(admin, /premium: 99/)
  // A conta mora num helper só (visão geral e ROI chamam o mesmo).
  assert.match(admin, /loadCanonicalMrr/)
  assert.match(mrr, /MRR_PLANS = \['basic', 'pro', 'premium'\]/)
  assert.match(mrr, /activePremium \* p\('premium'\)/)
  assert.match(mrr, /paidActiveUsers: activeBasic \+ activePro \+ activePremium/)
})

test('tela de plano do painel mostra o Premium, R$ 99 e o que ele libera, sem jargão', () => {
  const page = read('dashboard/app/painel/plano/page.js')
  assert.match(page, /premium: 'Premium'/)
  assert.match(page, /PREMIUM_PLAN_CARD/)
  assert.match(page, /R\$99/)
  assert.match(page, /Telegram/)
  assert.match(page, /Stories do Instagram/)
  assert.match(page, /handleCheckout\(plan\.id\)/)
  assert.match(page, /handleSubscribe\(plan\.id\)/)
  assert.doesNotMatch(page, /preapproval|gateway|token/i)
})

test('página pública de preços NÃO foi alterada: Premium não aparece nos planos públicos', () => {
  const content = read('dashboard/lib/marketing-content.js')
  assert.doesNotMatch(content, /id: 'premium'/)
})
