import axios from 'axios'
import { createHmac } from 'crypto'
import db from '../../db.js'
import { trackAnalyticsEventSafe } from '../../analytics.js'

const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

function getMpAccessToken() {
  return process.env.MP_ACCESS_TOKEN
}

function sendError(reply, statusCode, code, message) {
  return reply.code(statusCode).send({ error: { code, message } })
}

const PLANS = {
  basic: { title: 'BOTinho Basic - acesso por 30 dias', price: 50,  checkoutUrl: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=7417a34c47be40fdbc4bc1decc0233e0' },
  pro:   { title: 'BOTinho Pro - acesso por 30 dias',   price: 100, checkoutUrl: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=251ba8b89a8a483a89e4e6ba336adb5c' },
}

function inferPlanFromAmount(amount) {
  for (const [key, info] of Object.entries(PLANS)) {
    if (info.price === Number(amount)) return key
  }
  return null
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
  if (missing.length > 0) {
    log.error({ missing }, 'PAGAMENTOS: variáveis de ambiente obrigatórias não configuradas em produção')
  }
}

export function normalizeWebhookPayload(payload) {
  try {
    return JSON.stringify(payload ?? {})
  } catch {
    return '{}'
  }
}

export function resolveWebhookEventId({ body, query, dataId } = {}) {
  return String(
    body?.id
    ?? body?.data?.id
    ?? query?.id
    ?? query?.['data.id']
    ?? dataId
    ?? ''
  ).trim()
}

export function summarizeWebhookEvent(payload = {}) {
  const type = String(payload?.type ?? payload?.topic ?? 'unknown')
  const action = String(payload?.action ?? 'unknown')
  const dataResourceId = String(payload?.data?.id ?? payload?.id ?? '')
  return { type, action, dataResourceId }
}

export function shouldReconcilePayment(summary = {}) {
  return summary.type === 'payment' && Boolean(summary.dataResourceId)
}

async function fetchMercadoPagoPaymentSnapshot(paymentId) {
  const accessToken = getMpAccessToken()
  if (!accessToken) return { ok: false, reason: 'missing_access_token' }

  try {
    const response = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 8000,
    })
    return {
      ok: true,
      providerStatus: response.data?.status ?? null,
      statusDetail: response.data?.status_detail ?? null,
      transactionAmount: response.data?.transaction_amount ?? null,
      payerEmail: response.data?.payer?.email ?? null,
    }
  } catch (err) {
    return {
      ok: false,
      reason: 'provider_fetch_error',
      httpStatus: err?.response?.status ?? null,
      message: String(err?.message ?? 'unknown_error').slice(0, 500),
    }
  }
}

async function processPendingWebhookEvents({ limit = 50, log } = {}) {
  const pending = await db.webhookEvent.findMany({
    where: { provider: 'mercado_pago', processingStatus: 'received' },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  let processed = 0
  let failed = 0

  for (const event of pending) {
    try {
      const payload = JSON.parse(event.payload)
      const summary = summarizeWebhookEvent(payload)
      const reconciliation = shouldReconcilePayment(summary)
        ? await fetchMercadoPagoPaymentSnapshot(summary.dataResourceId)
        : { ok: false, reason: 'not_payment_event' }
      await db.webhookEvent.update({
        where: { id: event.id },
        data: {
          processingStatus: 'processed',
          processedAt: new Date(),
          processingResult: JSON.stringify({ summary, reconciliation }),
          error: null,
        },
      })
      processed++
    } catch (err) {
      await db.webhookEvent.update({
        where: { id: event.id },
        data: {
          processingStatus: 'error',
          processedAt: new Date(),
          error: String(err?.message ?? 'processing_error').slice(0, 500),
        },
      }).catch(() => {})
      failed++
      log?.error?.({ err: err?.message, eventId: event.eventId }, 'Falha ao processar webhook pendente')
    }
  }

  return { total: pending.length, processed, failed }
}

export function resolveWebhookProcessorConfig(env = process.env) {
  const enabled = String(env.BILLING_WEBHOOK_AUTOPROCESS ?? 'false').toLowerCase() === 'true'
  const intervalMsRaw = Number(env.BILLING_WEBHOOK_PROCESS_INTERVAL_MS ?? 30000)
  const batchRaw = Number(env.BILLING_WEBHOOK_PROCESS_BATCH ?? 50)
  const intervalMs = Number.isFinite(intervalMsRaw) && intervalMsRaw >= 5000 ? Math.trunc(intervalMsRaw) : 30000
  const batchSize = Number.isFinite(batchRaw) && batchRaw > 0 ? Math.min(Math.trunc(batchRaw), 200) : 50
  return { enabled, intervalMs, batchSize }
}

function startWebhookProcessor(app) {
  const cfg = resolveWebhookProcessorConfig()
  if (!cfg.enabled) return

  let running = false
  const timer = setInterval(async () => {
    if (running) return
    running = true
    try {
      const result = await processPendingWebhookEvents({ limit: cfg.batchSize, log: app.log })
      if (result.total > 0) {
        app.log.info({ result }, 'Billing webhook processor cycle completed')
      }
    } catch (err) {
      app.log.error({ err: err?.message }, 'Billing webhook processor cycle failed')
    } finally {
      running = false
    }
  }, cfg.intervalMs)

  timer.unref?.()
  app.log.info({ cfg }, 'Billing webhook processor enabled')
}

export async function paymentsRoutes(app) {
  warnMissingProductionEnv(app.log)
  startWebhookProcessor(app)

  // Retorna o link de checkout fixo do plano — sem chamada à API do MP
  app.post('/checkout', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { plan } = req.body ?? {}
    if (!PLANS[plan]) return sendError(reply, 400, 'INVALID_PLAN', 'Plano inválido. Use basic ou pro.')
    const userId = req.user.sub
    trackAnalyticsEventSafe({ userId, event: 'checkout_started', metadata: { plan } })
    return { checkout_url: PLANS[plan].checkoutUrl }
  })

  // Webhook do MP — sem autenticação JWT
  app.post('/webhook', async (req, reply) => {
    const signature = req.headers['x-signature'] ?? ''
    const requestId = req.headers['x-request-id'] ?? ''
    const dataId = req.query?.['data.id'] ?? req.body?.data?.id ?? ''

    const enforceSignature = shouldEnforceWebhookSignature()
    let signatureValid = false

    if (enforceSignature) {
      if (!MP_WEBHOOK_SECRET) {
        req.log?.error?.('MP_WEBHOOK_SECRET ausente em produção; webhook rejeitado por segurança')
        return reply.code(500).send({ error: 'Webhook sem segredo configurado' })
      }
      signatureValid = isValidMercadoPagoWebhookSignature({ signature, requestId, dataId })
      if (!signatureValid) {
        return reply.code(401).send({ error: 'Assinatura inválida ou ausente' })
      }
    } else {
      signatureValid = Boolean(MP_WEBHOOK_SECRET)
        ? isValidMercadoPagoWebhookSignature({ signature, requestId, dataId })
        : false
    }

    const eventId = resolveWebhookEventId({ body: req.body, query: req.query, dataId })

    if (!eventId) {
      return sendError(reply, 400, 'MISSING_EVENT_ID', 'Webhook sem identificador de evento')
    }

    const eventType = String(req.body?.type ?? req.body?.topic ?? '').trim() || null
    const payload = normalizeWebhookPayload(req.body)

    try {
      await db.webhookEvent.create({
        data: {
          provider: 'mercado_pago',
          eventId,
          eventType,
          signatureValid,
          requestId: String(requestId || '') || null,
          dataId: String(dataId || '') || null,
          payload,
          processingStatus: 'received',
        },
      })
    } catch (err) {
      if (String(err?.code) !== 'P2002') {
        req.log.error({ err: err.message, eventId }, 'Falha ao persistir webhook do Mercado Pago')
        return reply.code(500).send({ error: 'Falha ao registrar webhook' })
      }
    }

    // Fase 1: apenas persistência idempotente + ACK rápido.
    return { ok: true }
  })

  app.post('/webhook/process-pending', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user?.sub
    const adminUser = await db.adminUser.findUnique({ where: { userId }, select: { role: true, status: true } }).catch(() => null)
    if (!adminUser || adminUser.status !== 'active' || adminUser.role !== 'owner') {
      return reply.code(403).send({ error: 'Acesso negado' })
    }

    const requestedLimit = Number(req.body?.limit)
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.trunc(requestedLimit), 200)
      : 50

    const result = await processPendingWebhookEvents({ limit, log: req.log })
    return { ok: true, ...result }
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

  // Após pagar, o usuário informa o payment_id para ativar o acesso
  app.post('/recover', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { paymentId } = req.body ?? {}
    if (!paymentId) return sendError(reply, 400, 'MISSING_PAYMENT_ID', 'paymentId obrigatório')

    const accessToken = getMpAccessToken()
    if (!accessToken) return sendError(reply, 500, 'PAYMENT_PROVIDER_NOT_CONFIGURED', 'MP não configurado')

    const userId = req.user.sub

    // Pagamento já aplicado a esta conta
    const existing = await db.payment.findUnique({ where: { mpPaymentId: String(paymentId) } })
    if (existing?.status === 'approved') {
      if (existing.userId !== userId) {
        return sendError(reply, 409, 'PAYMENT_ALREADY_USED', 'Este pagamento já foi utilizado por outra conta')
      }
      const user = await db.user.findUnique({ where: { id: userId }, select: { plan: true, accessExpiresAt: true } })
      return { alreadyApplied: true, plan: user.plan, accessExpiresAt: user.accessExpiresAt }
    }

    const mpPayRes = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ).catch(() => null)

    if (!mpPayRes) return sendError(reply, 404, 'PAYMENT_NOT_FOUND', 'Pagamento não encontrado no Mercado Pago')

    const { status, transaction_amount } = mpPayRes.data
    if (status !== 'approved') return sendError(reply, 402, 'PAYMENT_NOT_APPROVED', `Pagamento com status: ${status}`)

    const plan = inferPlanFromAmount(transaction_amount)
    if (!plan) return sendError(reply, 400, 'CANNOT_DETERMINE_PLAN', `Valor R$${transaction_amount} não corresponde a nenhum plano`)

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
