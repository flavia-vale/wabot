import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PREPAID_MONTHS,
  buildPrepaidMetadata,
  buildPrepaidOffer,
  isPrepaidEnabled,
  resolvePurchaseTerms,
} from '../src/domain/payments/prepaidOffer.js'
import { createPaymentsService } from '../src/domain/payments/service.js'

test('só existem 3 e 6 meses, com 4% e 7% de desconto (sem 12 meses)', () => {
  assert.deepEqual(PREPAID_MONTHS, [3, 6])
  assert.equal(buildPrepaidOffer({ months: 12, monthlyPrice: 69 }), null)
  assert.equal(buildPrepaidOffer({ months: 1, monthlyPrice: 69 }), null)
})

test('preços do servidor batem com a tabela combinada', () => {
  assert.equal(buildPrepaidOffer({ months: 3, monthlyPrice: 39 }).total, 112.32)
  assert.equal(buildPrepaidOffer({ months: 6, monthlyPrice: 39 }).total, 217.62)
  assert.equal(buildPrepaidOffer({ months: 3, monthlyPrice: 69 }).total, 198.72)
  assert.equal(buildPrepaidOffer({ months: 6, monthlyPrice: 69 }).total, 385.02)
  const o = buildPrepaidOffer({ months: 6, monthlyPrice: 69 })
  assert.equal(o.days, 180)
  assert.equal(o.savings, 28.98)
})

test('preço mensal inválido não gera oferta', () => {
  assert.equal(buildPrepaidOffer({ months: 3, monthlyPrice: 0 }), null)
  assert.equal(buildPrepaidOffer({ months: 3, monthlyPrice: 'x' }), null)
})

test('a flag só liga com "true" e vem desligada por padrão', () => {
  assert.equal(isPrepaidEnabled({}), false)
  assert.equal(isPrepaidEnabled({ BILLING_PREPAID_ENABLED: 'false' }), false)
  assert.equal(isPrepaidEnabled({ BILLING_PREPAID_ENABLED: '1' }), false)
  assert.equal(isPrepaidEnabled({ BILLING_PREPAID_ENABLED: 'true' }), true)
})

test('metadata do pré-pago carrega meses e total; sem oferta fica vazio', () => {
  assert.deepEqual(buildPrepaidMetadata(buildPrepaidOffer({ months: 3, monthlyPrice: 69 })), { months: 3, prepaid_total: 198.72 })
  assert.deepEqual(buildPrepaidMetadata(null), {})
})

test('pagamento que bate com o total gravado concede os meses, independente da flag', () => {
  const t = resolvePurchaseTerms({ metadataMonths: 3, metadataPrepaidTotal: 198.72, paidAmount: 198.72, monthlyPrice: 69 })
  assert.deepEqual(t, { months: 3, days: 90, amount: 198.72, prepaid: true })
})

test('valor aprovado diferente do gravado cai em 1 mês, nunca em acesso longo', () => {
  const t = resolvePurchaseTerms({ metadataMonths: 6, metadataPrepaidTotal: 385.02, paidAmount: 69, monthlyPrice: 69 })
  assert.deepEqual(t, { months: 1, days: 30, amount: 69, prepaid: false })
})

test('meses fora da tabela ou sem metadata seguem o comportamento de sempre', () => {
  for (const metadataMonths of [undefined, null, '', 1, 2, 12, 'abc']) {
    const t = resolvePurchaseTerms({ metadataMonths, metadataPrepaidTotal: 100, paidAmount: 100, monthlyPrice: 39 })
    assert.deepEqual(t, { months: 1, days: 30, amount: 39, prepaid: false })
  }
})

test('activatePaymentAccess concede 30 dias por padrão e a duração pedida quando informada', async () => {
  const now = new Date('2026-10-01T12:00:00Z')
  const created = []
  const tx = {
    user: { findUnique: async () => ({ accessExpiresAt: null }), update: async ({ data }) => data },
    payment: { findUnique: async () => null, create: async ({ data }) => { created.push(data); return data } },
  }
  const service = createPaymentsService({ db: { lpPlan: { findMany: async () => [] } }, now: () => now })

  const padrao = await service.activatePaymentAccess(tx, { userId: 'u1', plan: 'pro', mpPaymentId: 'p1', amount: 69 })
  assert.equal(padrao.expiresAt.getTime(), now.getTime() + 30 * 86400000)
  assert.equal('daysGranted' in created[0], false, 'o registro de 30 dias continua idêntico ao de sempre')

  const longo = await service.activatePaymentAccess(tx, { userId: 'u1', plan: 'pro', mpPaymentId: 'p2', amount: 198.72, days: 90 })
  assert.equal(longo.expiresAt.getTime(), now.getTime() + 90 * 86400000)
  assert.equal(created[1].daysGranted, 90)
  assert.equal(created[1].amount, 198.72)
})
