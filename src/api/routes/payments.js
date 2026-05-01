import axios from 'axios'
import { createHmac } from 'crypto'
import db from '../../db.js'

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'
const API_URL = process.env.API_URL || 'http://localhost:3001'

const PLANS = {
  basic: { title: 'WaBot Basic', price: 50 },
  pro:   { title: 'WaBot Pro',   price: 100 },
}

export async function paymentsRoutes(app) {
  app.post('/checkout', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!MP_ACCESS_TOKEN) return reply.code(500).send({ error: 'MercadoPago não configurado no servidor' })
    const { plan } = req.body ?? {}
    if (!PLANS[plan]) return reply.code(400).send({ error: 'Plano inválido. Use basic ou pro.' })

    const userId = req.user.sub
    const planInfo = PLANS[plan]

    const mpRes = await axios.post(
      'https://api.mercadopago.com/checkout/preferences',
      {
        items: [{ title: planInfo.title, quantity: 1, unit_price: planInfo.price, currency_id: 'BRL' }],
        back_urls: {
          success: `${FRONTEND_URL}/dashboard/planos?status=success`,
          failure: `${FRONTEND_URL}/dashboard/planos?status=failure`,
          pending: `${FRONTEND_URL}/dashboard/planos?status=pending`,
        },
        auto_return: 'approved',
        notification_url: `${API_URL}/api/payments/webhook`,
        metadata: { userId, plan },
      },
      { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' } }
    ).catch(err => {
      throw new Error(err.response?.data?.message || 'Erro ao criar preferência MercadoPago')
    })

    return { checkout_url: mpRes.data.init_point }
  })

  // MP webhook — sem autenticação JWT
  app.post('/webhook', async (req, reply) => {
    if (MP_WEBHOOK_SECRET) {
      const signature = req.headers['x-signature'] ?? ''
      const requestId = req.headers['x-request-id'] ?? ''
      const dataId = req.query?.['data.id'] ?? req.body?.data?.id ?? ''
      const parts = Object.fromEntries(signature.split(',').map(p => p.split('=')))
      const { ts, v1 } = parts
      if (ts && v1) {
        const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
        const expected = createHmac('sha256', MP_WEBHOOK_SECRET).update(manifest).digest('hex')
        if (expected !== v1) return reply.code(401).send({ error: 'Assinatura inválida' })
      }
    }

    const type = req.query?.type ?? req.body?.type
    const paymentId = req.query?.['data.id'] ?? req.body?.data?.id
    if (type !== 'payment' || !paymentId) return { ok: true }

    if (!MP_ACCESS_TOKEN) return reply.code(500).send({ error: 'MP não configurado' })

    const mpPayRes = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } }
    ).catch(() => null)

    if (!mpPayRes) return { ok: true }

    const { status, metadata } = mpPayRes.data
    const { userId, plan } = metadata ?? {}
    if (!userId || !plan) return { ok: true }

    const expiresAt = status === 'approved'
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : null

    const existing = await db.payment.findUnique({ where: { mpPaymentId: String(paymentId) } })
    if (existing) {
      await db.payment.update({
        where: { id: existing.id },
        data: { status, expiresAt: expiresAt ?? existing.expiresAt },
      })
    } else {
      await db.payment.create({
        data: {
          userId,
          mpPaymentId: String(paymentId),
          plan,
          status,
          amount: PLANS[plan]?.price ?? 0,
          expiresAt,
        },
      })
    }

    if (status === 'approved') {
      await db.user.update({
        where: { id: userId },
        data: { plan, trialExpiresAt: expiresAt },
      })
    }

    return { ok: true }
  })

  app.get('/status', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { plan: true, trialExpiresAt: true, referralCode: true },
    })
    const payments = await db.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    const isActive = !user.trialExpiresAt || user.trialExpiresAt > new Date()
    return { plan: user.plan, accessExpiresAt: user.trialExpiresAt, referralCode: user.referralCode, isActive, payments }
  })
}
