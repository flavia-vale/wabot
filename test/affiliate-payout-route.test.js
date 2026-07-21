import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import { affiliateRoutes } from '../src/api/routes/affiliate.js'

// 009-affiliate-improvements-r1 (US2): saque self-service com valor mínimo.
// Rotas usam o db singleton diretamente (não injetável via plugin opts), então
// os testes rodam contra o sqlite de teste (npm test: pretest faz `prisma db
// push --force-reset`), como já é convenção em groups-route-image-mode.test.js.

let counter = 0

async function buildApp() {
  const n = ++counter
  const suffix = `${n}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const affiliateUserId = `aff-user-${suffix}`
  const adminUserId = `admin-user-${suffix}`
  const referredUserId = `referred-user-${suffix}`

  await db.user.create({ data: { id: affiliateUserId, name: 'Afiliado Teste', email: `aff-${suffix}@test.local`, passwordHash: 'x', plan: 'pro' } })
  await db.user.create({ data: { id: adminUserId, name: 'Admin Teste', email: `admin-${suffix}@test.local`, passwordHash: 'x', plan: 'pro', status: 'active' } })
  await db.adminUser.create({ data: { userId: adminUserId, role: 'owner', status: 'active' } })
  await db.user.create({ data: { id: referredUserId, name: 'Indicado Teste', email: `referred-${suffix}@test.local`, passwordHash: 'x', plan: 'pro' } })

  const profile = await db.affiliateProfile.create({
    data: { userId: affiliateUserId, code: `CODE${suffix.slice(0, 8).toUpperCase()}`, status: 'approved', pixKey: 'pix@example.com', pixKeyType: 'email' },
  })

  const payment = await db.payment.create({
    data: { userId: referredUserId, amount: 39, plan: 'pro', status: 'approved', mpPaymentId: `pp-${suffix}` },
  })

  const app = Fastify({ logger: false })
  let currentUserId = affiliateUserId
  app.decorate('authenticate', async (req) => { req.user = { sub: currentUserId } })
  app.addHook('onClose', async () => {
    await db.affiliateCommissionLedger.deleteMany({ where: { affiliateId: profile.id } })
    await db.affiliatePayoutRequest.deleteMany({ where: { affiliateId: profile.id } })
    await db.affiliateCommission.deleteMany({ where: { affiliateId: profile.id } })
    await db.payment.deleteMany({ where: { userId: referredUserId } })
    await db.affiliateProfile.deleteMany({ where: { id: profile.id } })
    await db.adminUser.deleteMany({ where: { userId: adminUserId } })
    await db.user.deleteMany({ where: { id: { in: [affiliateUserId, adminUserId, referredUserId] } } })
  })
  await app.register(affiliateRoutes)

  return {
    app,
    profile,
    payment,
    asAffiliate: () => { currentUserId = affiliateUserId },
    asAdmin: () => { currentUserId = adminUserId },
  }
}

async function createEligibleCommission({ profile, payment, amountCents = 6000, status = 'eligible' }) {
  // paymentId é @unique em AffiliateCommission — cada comissão de teste
  // precisa do seu próprio Payment (clona o pagamento base do afiliado).
  const ownPayment = await db.payment.create({
    data: { userId: payment.userId, amount: payment.amount, plan: payment.plan, status: payment.status, mpPaymentId: `${payment.mpPaymentId}-${Math.random().toString(16).slice(2)}` },
  })
  return db.affiliateCommission.create({
    data: {
      affiliateId: profile.id,
      paymentId: ownPayment.id,
      referredUserId: payment.userId,
      saleAmountCents: 3900,
      commissionAmountCents: amountCents,
      status,
      cycleMonth: new Date().toISOString().slice(0, 7),
    },
  })
}

test('POST /affiliate/payout-requests: saldo suficiente cria solicitação', async () => {
  const { app, profile, payment, asAffiliate } = await buildApp()
  asAffiliate()
  await createEligibleCommission({ profile, payment, amountCents: 6000 })

  const res = await app.inject({ method: 'POST', url: '/affiliate/payout-requests' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.payoutRequest.amountCents, 6000)
  assert.equal(body.payoutRequest.status, 'requested')
  await app.close()
})

test('POST /affiliate/payout-requests: saldo abaixo do mínimo → 400', async () => {
  const { app, profile, payment, asAffiliate } = await buildApp()
  asAffiliate()
  await createEligibleCommission({ profile, payment, amountCents: 1000 })

  const res = await app.inject({ method: 'POST', url: '/affiliate/payout-requests' })
  assert.equal(res.statusCode, 400)
  await app.close()
})

test('POST /affiliate/payout-requests: saldo devedor pendente → 409', async () => {
  const { app, profile, payment, asAffiliate } = await buildApp()
  asAffiliate()
  await createEligibleCommission({ profile, payment, amountCents: 6000 })
  const paidCommission = await createEligibleCommission({ profile, payment, amountCents: 3000, status: 'paid' })
  await db.affiliateCommissionLedger.create({ data: { commissionId: paidCommission.id, affiliateId: profile.id, toStatus: 'debt', amountCents: -3000, reason: 'reversal_after_paid' } })

  const res = await app.inject({ method: 'POST', url: '/affiliate/payout-requests' })
  assert.equal(res.statusCode, 409)
  await app.close()
})

test('POST /affiliate/payout-requests: pedido duplicado (já em aberto) → 409', async () => {
  const { app, profile, payment, asAffiliate } = await buildApp()
  asAffiliate()
  await createEligibleCommission({ profile, payment, amountCents: 6000 })

  const first = await app.inject({ method: 'POST', url: '/affiliate/payout-requests' })
  assert.equal(first.statusCode, 200)
  const second = await app.inject({ method: 'POST', url: '/affiliate/payout-requests' })
  assert.equal(second.statusCode, 409)
  await app.close()
})

test('admin confirm: marca comissões como paid e grava auditoria', async () => {
  const { app, profile, payment, asAffiliate, asAdmin } = await buildApp()
  asAffiliate()
  await createEligibleCommission({ profile, payment, amountCents: 6000 })
  const created = await app.inject({ method: 'POST', url: '/affiliate/payout-requests' })
  const { payoutRequest } = JSON.parse(created.body)

  asAdmin()
  const res = await app.inject({ method: 'POST', url: `/admin/affiliates/payout-requests/${payoutRequest.id}/confirm` })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.payoutRequest.status, 'paid')

  const commissions = await db.affiliateCommission.findMany({ where: { affiliateId: profile.id } })
  assert.ok(commissions.every(c => c.status === 'paid'))

  const audit = await db.adminAuditLog.findFirst({ where: { action: 'admin.affiliate.payout.confirm', resourceId: payoutRequest.id } })
  assert.ok(audit, 'esperava AdminAuditLog para confirm')
  await app.close()
})

test('admin reject: exige motivo e mantém saldo disponível', async () => {
  const { app, profile, payment, asAffiliate, asAdmin } = await buildApp()
  asAffiliate()
  await createEligibleCommission({ profile, payment, amountCents: 6000 })
  const created = await app.inject({ method: 'POST', url: '/affiliate/payout-requests' })
  const { payoutRequest } = JSON.parse(created.body)

  asAdmin()
  const missingReason = await app.inject({ method: 'POST', url: `/admin/affiliates/payout-requests/${payoutRequest.id}/reject`, payload: {} })
  assert.equal(missingReason.statusCode, 400)

  const res = await app.inject({ method: 'POST', url: `/admin/affiliates/payout-requests/${payoutRequest.id}/reject`, payload: { reason: 'Chave PIX inválida' } })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.payoutRequest.status, 'rejected')
  assert.equal(body.payoutRequest.rejectionReason, 'Chave PIX inválida')

  const commissions = await db.affiliateCommission.findMany({ where: { affiliateId: profile.id } })
  assert.ok(commissions.every(c => c.status === 'eligible'), 'comissões permanecem disponíveis após recusa')
  await app.close()
})
