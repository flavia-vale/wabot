import axios from 'axios'
import { createHmac } from 'crypto'
import db from '../../db.js'
import { trackAnalyticsEventSafe } from '../../analytics.js'

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

function warnMissingProductionEnv(log) {
  if (!IS_PRODUCTION) return
  const missing = []
  if (!getMpAccessToken()) missing.push('MP_ACCESS_TOKEN')
  if (!process.env.MP_WEBHOOK_SECRET) missing.push('MP_WEBHOOK_SECRET')
  if (process.env.API_URL === 'http://localhost:3001') missing.push('API_URL (ainda em valor padrão)')
  if (process.env.FRONTEND_URL === 'http://localhost:3000') missing.push('FRONTEND_URL (ainda em valor padrão)')
  if (missing.length > 0) {
    log.error({ missing }, 'PAGAMENTOS: variáveis de ambiente obrigatórias não configuradas em produção — pagamentos não funcionarão corretamente')
  }
}

export async function paymentsRoutes(app) {
  warnMissingProductionEnv(app.log)

  app.post('/checkout', { onRequest: [app.authenticate] }, async (req, reply) => {
    const validation = validateCheckoutInput(req.body)
    if (!validation.ok) return sendError(reply, validation.error.statusCode, validation.error.code, validation.error.message)
    if (!ensurePaymentProviderConfigured(reply)) return

    const { plan } = validation.data
    const userId = req.user.sub
    const planInfo = PLANS[plan]
    const accessToken = getMpAccessToken()

    trackAnalyticsEventSafe({ userId, event: 'checkout_started', metadata: { plan } })

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

    const paymentEvent = status === 'approved'
      ? 'payment_approved'
      : status === 'pending'
        ? 'payment_pending'
        : 'payment_failed'
    trackAnalyticsEventSafe({ userId, event: paymentEvent, metadata: { plan, status } })

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
            data: { plan, accessExpiresAt: expiresAt },
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
      select: { plan: true, accessExpiresAt: true, referralCode: true },
    })
    const payments = await db.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    const isActive = !user.accessExpiresAt || user.accessExpiresAt > new Date()
    return { plan: user.plan, accessExpiresAt: user.accessExpiresAt, referralCode: user.referralCode, isActive, payments }
  })

  // Recuperação manual: aplica acesso quando o webhook falhou
  app.post('/recover', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { paymentId } = req.body ?? {}
    if (!paymentId) return sendError(reply, 400, 'MISSING_PAYMENT_ID', 'paymentId obrigatório')

    const accessToken = getMpAccessToken()
    if (!accessToken) return sendError(reply, 500, 'PAYMENT_PROVIDER_NOT_CONFIGURED', 'MP não configurado')

    const userId = req.user.sub

    const existing = await db.payment.findUnique({ where: { mpPaymentId: String(paymentId) } })
    if (existing?.status === 'approved' && existing.userId === userId) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { plan: true, accessExpiresAt: true } })
      return { alreadyApplied: true, plan: user.plan, accessExpiresAt: user.accessExpiresAt }
    }

    const mpPayRes = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ).catch(() => null)

    if (!mpPayRes) return sendError(reply, 404, 'PAYMENT_NOT_FOUND', 'Pagamento não encontrado no Mercado Pago')

    const { status, metadata } = mpPayRes.data
    const { userId: mpUserId, plan } = metadata ?? {}

    if (mpUserId !== userId) return sendError(reply, 403, 'PAYMENT_NOT_YOURS', 'Este pagamento não pertence à sua conta')
    if (!PLANS[plan]) return sendError(reply, 400, 'INVALID_PLAN', 'Plano inválido no pagamento')
    if (status !== 'approved') return sendError(reply, 402, 'PAYMENT_NOT_APPROVED', `Pagamento com status: ${status}`)

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    try {
      await db.$transaction(async (tx) => {
        if (existing) {
          await tx.payment.update({ where: { id: existing.id }, data: { status: 'approved', expiresAt } })
        } else {
          await tx.payment.create({
            data: { userId, mpPaymentId: String(paymentId), plan, status: 'approved', amount: PLANS[plan].price, expiresAt },
          })
        }
        await tx.user.update({ where: { id: userId }, data: { plan, accessExpiresAt: expiresAt } })
      })
    } catch (err) {
      req.log.error({ err: err.message }, 'Recover db error')
      return reply.code(500).send({ error: 'Erro interno ao recuperar pagamento' })
    }

    trackAnalyticsEventSafe({ userId, event: 'payment_recovered', metadata: { plan, paymentId: String(paymentId) } })
    return { recovered: true, plan, accessExpiresAt: expiresAt }
  })
}
