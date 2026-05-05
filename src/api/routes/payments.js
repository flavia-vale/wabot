import axios from 'axios'
import { createHmac } from 'crypto'
import db from '../../db.js'

const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'
const API_URL = process.env.API_URL || 'http://localhost:3001'

function getMpAccessToken() {
  return process.env.MP_ACCESS_TOKEN
}

function sendError(reply, statusCode, code, message) {
  return reply.code(statusCode).send({ error: { code, message } })
}

function validateCheckoutInput(body) {
  const { plan } = body ?? {}
  if (!PLANS[plan]) {
    return {
      ok: false,
      error: { statusCode: 400, code: 'INVALID_PLAN', message: 'Plano inválido. Use basic ou pro.' },
    }
  }
  return { ok: true, data: { plan } }
}

function ensurePaymentProviderConfigured(reply) {
  if (getMpAccessToken()) return true
  sendError(reply, 500, 'PAYMENT_PROVIDER_NOT_CONFIGURED', 'MercadoPago não configurado no servidor')
  return false
}


const PLANS = {
  basic: { title: 'Wabot Basic - acesso por 30 dias', price: 50 },
  pro:   { title: 'Wabot Pro - acesso por 30 dias',   price: 100 },
}

export function shouldEnforceWebhookSignature({ isProduction = IS_PRODUCTION, secret = MP_WEBHOOK_SECRET } = {}) {
  return Boolean(secret) || isProduction
}

export function parseMercadoPagoSignature(signature = '') {
  return Object.fromEntries(
    String(signature)
      .split(',')
      .map(part => part.trim().split('='))
      .filter(([key, value]) => key && value)
  )
}

export function isValidMercadoPagoWebhookSignature({ signature = '', requestId = '', dataId = '', secret = MP_WEBHOOK_SECRET } = {}) {
  if (!secret) return false
  const { ts, v1 } = parseMercadoPagoSignature(signature)
  if (!ts || !v1 || !requestId || !dataId) return false
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')
  return expected === v1
}

export async function paymentsRoutes(app) {
  app.post('/checkout', { onRequest: [app.authenticate] }, async (req, reply) => {
    const validation = validateCheckoutInput(req.body)
    if (!validation.ok) return sendError(reply, validation.error.statusCode, validation.error.code, validation.error.message)
    if (!ensurePaymentProviderConfigured(reply)) return

    const { plan } = validation.data
    const userId = req.user.sub
    const planInfo = PLANS[plan]
    const accessToken = getMpAccessToken()

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
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    ).catch(err => {
      throw new Error(err.response?.data?.message || 'Erro ao criar preferência MercadoPago')
    })

    return { checkout_url: mpRes.data.init_point }
  })

  // MP webhook — sem autenticação JWT
  app.post('/webhook', async (req, reply) => {
    const signature = req.headers['x-signature'] ?? ''
    const requestId = req.headers['x-request-id'] ?? ''
    const dataId = req.query?.['data.id'] ?? req.body?.data?.id ?? ''

    if (shouldEnforceWebhookSignature()) {
      if (!MP_WEBHOOK_SECRET) {
        req.log?.error?.('MP_WEBHOOK_SECRET ausente em produção; webhook rejeitado por segurança')
        return reply.code(500).send({ error: 'Webhook de pagamento sem segredo configurado' })
      }
      if (!isValidMercadoPagoWebhookSignature({ signature, requestId, dataId })) {
        return reply.code(401).send({ error: 'Assinatura inválida ou ausente' })
      }
    }

    const type = req.query?.type ?? req.body?.type
    const paymentId = req.query?.['data.id'] ?? req.body?.data?.id
    if (type !== 'payment' || !paymentId) return { ok: true }

    const accessToken = getMpAccessToken()
    if (!accessToken) return sendError(reply, 500, 'PAYMENT_PROVIDER_NOT_CONFIGURED', 'MP não configurado')

    const mpPayRes = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ).catch(() => null)

    if (!mpPayRes) return { ok: true }

    const { status, metadata } = mpPayRes.data
    const { userId, plan } = metadata ?? {}
    if (!userId || !plan) return { ok: true }

    const expiresAt = status === 'approved'
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : null

    try {
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
        const userExists = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
        if (userExists) {
          await db.user.update({
            where: { id: userId },
            data: { plan, trialExpiresAt: expiresAt },
          })
        }
      }
    } catch (err) {
      console.error('Webhook db error:', err.message)
      return reply.code(500).send({ error: 'Erro interno ao processar pagamento' })
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
