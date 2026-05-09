import axios from 'axios'
import { createHmac } from 'crypto'
import db from '../../db.js'
import { trackAnalyticsEventSafe } from '../../analytics.js'

const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

const OFFICIAL_PUBLIC_ORIGIN = 'http://espelhagrupos.com.br'

function isIpHost(hostname = '') {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(String(hostname || '').trim())
}

function normalizePublicOrigin(value, fallback = OFFICIAL_PUBLIC_ORIGIN) {
  try {
    const parsed = new URL(String(value ?? ''))
    if (isIpHost(parsed.hostname)) return fallback
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return fallback
  }
}

function getMpAccessToken() {
  return process.env.MP_ACCESS_TOKEN
}

function getDashboardUrl() {
  return (process.env.DASHBOARD_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function getApiUrl() {
  return (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '')
}

function stripApiSuffix(url) {
  return String(url || '').replace(/\/api\/?$/i, '')
}

function isPublicHttpUrl(value) {
  try {
    const parsed = new URL(String(value ?? ''))
    const host = parsed.hostname.toLowerCase()
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !isLocalHost
  } catch {
    return false
  }
}

function forceHttpsUrl(value) {
  const parsed = new URL(String(value ?? ''))
  parsed.protocol = 'https:'
  return parsed.toString().replace(/\/$/, '')
}

function sendError(reply, statusCode, code, message) {
  return reply.code(statusCode).send({ error: { code, message } })
}

const DEFAULT_PLANS = {
  basic: { title: 'BOTinho Basic - acesso por 30 dias', price: 40 },
  pro:   { title: 'BOTinho Pro - acesso por 30 dias',   price: 70 },
}

function parseCurrencyAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const normalized = String(value ?? '').replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.')
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : null
}

async function getBillingPlans() {
  try {
    const rows = await db.lpPlan.findMany({ where: { id: { in: ['basic', 'pro'] } } })
    if (!rows.length) return DEFAULT_PLANS
    const dynamic = { ...DEFAULT_PLANS }
    for (const row of rows) {
      const fallback = DEFAULT_PLANS[row.id]
      if (!fallback) continue
      const parsedPrice = parseCurrencyAmount(row.price)
      dynamic[row.id] = {
        title: String(row.title || fallback.title),
        price: parsedPrice ?? fallback.price,
      }
    }
    return dynamic
  } catch {
    return DEFAULT_PLANS
  }
}

function inferPlanFromAmount(amount) {
  for (const [key, info] of Object.entries(DEFAULT_PLANS)) {
    if (info.price === Number(amount)) return key
  }
  return null
}

function inferPlanFromAmountWithPlans(amount, plans) {
  for (const [key, info] of Object.entries(plans || {})) {
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
  if (!process.env.DASHBOARD_URL) missing.push('DASHBOARD_URL')
  if (!process.env.API_URL) missing.push('API_URL')
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

// Activates a payment and grants 30-day access. Shared by /recover, /callback and webhook processor.
// Must be called inside a db.$transaction — tx is a Prisma transaction client.
export async function activatePaymentAccess(tx, { userId, plan, mpPaymentId, amount }) {
  const now = new Date()
  const user = await tx.user.findUnique({ where: { id: userId }, select: { accessExpiresAt: true } })
  const currentExpiry = user?.accessExpiresAt ? new Date(user.accessExpiresAt) : null
  const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now
  const expiresAt = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000)
  const existing = await tx.payment.findUnique({ where: { mpPaymentId: String(mpPaymentId) } })

  if (existing?.status === 'approved') {
    if (existing.userId === userId) {
      return { alreadyActivated: true, expiresAt: existing.expiresAt }
    }
    const err = new Error('Este pagamento já foi utilizado por outra conta')
    err.code = 'PAYMENT_ALREADY_USED'
    throw err
  }

  if (existing) {
    await tx.payment.update({ where: { id: existing.id }, data: { status: 'approved', expiresAt } })
  } else {
    await tx.payment.create({
      data: { userId, mpPaymentId: String(mpPaymentId), plan, status: 'approved', amount, expiresAt },
    })
  }
  await tx.user.update({ where: { id: userId }, data: { plan, accessExpiresAt: expiresAt } })
  return { alreadyActivated: false, expiresAt }
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
      externalReference: response.data?.external_reference ?? null,
      paymentTypeId: response.data?.payment_type_id ?? null,
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

// Creates a Mercado Pago Preference (supports PIX + card, one-time payment).
// Returns the init_point URL to redirect the user to.
async function createMercadoPagoPreference({ userId, plan }) {
  const accessToken = getMpAccessToken()
  if (!accessToken) {
    const err = new Error('MP_ACCESS_TOKEN não configurado')
    err.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED'
    throw err
  }

  const plans = await getBillingPlans()
  const planInfo = plans[plan]
  const normalizedPlan = {
    title: String(planInfo?.title ?? '').trim() || DEFAULT_PLANS[plan]?.title,
    price: Number(planInfo?.price),
  }
  if (!normalizedPlan.title || !Number.isFinite(normalizedPlan.price) || normalizedPlan.price <= 0) {
    const err = new Error('Configuração de plano inválida para checkout')
    err.code = 'INVALID_PLAN_CONFIG'
    throw err
  }
  const dashboardUrl = normalizePublicOrigin(stripApiSuffix(getDashboardUrl()))
  const apiUrl = normalizePublicOrigin(stripApiSuffix(getApiUrl()))
  if (IS_PRODUCTION && (!isPublicHttpUrl(apiUrl) || !isPublicHttpUrl(dashboardUrl))) {
    const err = new Error('API_URL/DASHBOARD_URL inválidos para produção')
    err.code = 'PAYMENT_PROVIDER_MISCONFIGURED'
    throw err
  }
  const callbackOrigin = IS_PRODUCTION ? forceHttpsUrl(dashboardUrl) : dashboardUrl
  const notificationOrigin = IS_PRODUCTION ? forceHttpsUrl(apiUrl) : apiUrl

  // Mercado Pago validates `back_urls` as user-facing return URLs.
  // In production always enforce HTTPS for return/webhook URLs.
  const callbackBase = `${callbackOrigin}/api/payments/callback`

  const preference = {
    items: [{
      title: normalizedPlan.title,
      quantity: 1,
      unit_price: normalizedPlan.price,
      currency_id: 'BRL',
    }],
    external_reference: userId,
    back_urls: {
      success: `${callbackBase}?collection_status=approved`,
      failure: `${callbackBase}?collection_status=rejected`,
      pending: `${callbackBase}?collection_status=pending`,
    },
    auto_return: 'approved',
    notification_url: `${notificationOrigin}/api/payments/webhook`,
    // Back URL shown after payment for manual navigation
    statement_descriptor: 'BOTinho',
  }
  const debugUrls = {
    dashboardUrl: callbackOrigin,
    apiUrl: notificationOrigin,
    callbackBase,
    backUrls: preference.back_urls,
    notificationUrl: preference.notification_url,
  }

  try {
    const response = await axios.post(
      'https://api.mercadopago.com/checkout/preferences',
      preference,
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 }
    )

    return response.data.init_point
  } catch (err) {
    const providerStatus = err?.response?.status
    const providerCause = err?.response?.data?.cause?.[0]?.description
      || err?.response?.data?.message
      || err?.response?.data?.error
      || err?.message
      || 'provider_error'
    const wrapped = new Error(String(providerCause))
    wrapped.code = 'CHECKOUT_PROVIDER_ERROR'
    wrapped.providerStatus = providerStatus
    wrapped.providerPayload = err?.response?.data || null
    wrapped.debugUrls = debugUrls
    throw wrapped
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
      let reconciliation = { ok: false, reason: 'not_payment_event' }
      let activation = null

      if (shouldReconcilePayment(summary)) {
        reconciliation = await fetchMercadoPagoPaymentSnapshot(summary.dataResourceId)

        // Auto-activate access when the payment is approved and has a user reference
        if (reconciliation.ok && reconciliation.providerStatus === 'approved' && reconciliation.externalReference) {
          const userId = reconciliation.externalReference
      const plans = await getBillingPlans()
      const plan = inferPlanFromAmountWithPlans(reconciliation.transactionAmount, plans)

          if (plan) {
            try {
              const result = await db.$transaction(async (tx) =>
                activatePaymentAccess(tx, {
                  userId,
                  plan,
                  mpPaymentId: String(summary.dataResourceId),
                  amount: plans[plan].price,
                })
              )
              activation = { triggered: true, ...result }
              if (!result.alreadyActivated) {
                trackAnalyticsEventSafe({ userId, event: 'payment_approved', metadata: { plan, source: 'webhook' } })
              }
            } catch (activationErr) {
              activation = { triggered: true, error: activationErr?.code ?? activationErr?.message }
              log?.warn?.({ err: activationErr?.message, userId }, 'Webhook activation failed')
            }
          } else {
            activation = { triggered: false, reason: 'unrecognized_amount', amount: reconciliation.transactionAmount }
          }
        }
      }

      await db.webhookEvent.update({
        where: { id: event.id },
        data: {
          processingStatus: 'processed',
          processedAt: new Date(),
          processingResult: JSON.stringify({ summary, reconciliation, activation }),
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

  // Creates a dynamic Mercado Pago Preference (supports PIX + credit card) and returns the checkout URL
  app.post('/checkout', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { plan } = req.body ?? {}
    const plans = await getBillingPlans()
    if (!plans[plan]) return sendError(reply, 400, 'INVALID_PLAN', 'Plano inválido. Use basic ou pro.')

    const userId = req.user.sub
    trackAnalyticsEventSafe({ userId, event: 'checkout_started', metadata: { plan } })

    try {
      const checkoutUrl = await createMercadoPagoPreference({ userId, plan })
      return { checkout_url: checkoutUrl }
    } catch (err) {
      if (err?.code === 'INVALID_PLAN_CONFIG') {
        return sendError(reply, 400, 'INVALID_PLAN_CONFIG', 'Configuração do plano inválida no Admin. Revise título e preço do plano.')
      }
      if (err?.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED') {
        return sendError(reply, 500, 'PAYMENT_PROVIDER_NOT_CONFIGURED', 'Pagamentos temporariamente indisponíveis.')
      }
      if (err?.code === 'PAYMENT_PROVIDER_MISCONFIGURED') {
        return sendError(reply, 500, 'PAYMENT_PROVIDER_MISCONFIGURED', 'Configuração de pagamento inválida no servidor. Contate o suporte.')
      }
      if (err?.code === 'CHECKOUT_PROVIDER_ERROR') {
        req.log.warn({ providerStatus: err?.providerStatus, reason: err?.message, providerPayload: err?.providerPayload, debugUrls: err?.debugUrls, plan, userId }, 'Mercado Pago rejeitou criação de preferência')
      }
      req.log.error({ err: err?.message, plan, userId }, 'Falha ao criar preferência MP')
      return sendError(reply, 502, 'CHECKOUT_CREATION_FAILED', 'Não foi possível iniciar o checkout. Tente novamente.')
    }
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

    return { ok: true }
  })

  // Callback de retorno do Mercado Pago após pagamento — ativa o acesso automaticamente
  // Não requer JWT; a identidade do usuário vem do external_reference salvo na Preference
  app.get('/callback', async (req, reply) => {
    const dashboardUrl = stripApiSuffix(getDashboardUrl())
    const { collection_id, collection_status, payment_id, status, external_reference } = req.query

    const mpPaymentId = String(payment_id ?? collection_id ?? '').trim()
    const paymentStatus = String(collection_status ?? status ?? '').trim()

    if (paymentStatus === 'pending') {
      return reply.redirect(`${dashboardUrl}/dashboard/planos?status=pending`)
    }

    if (paymentStatus !== 'approved' || !mpPaymentId) {
      return reply.redirect(`${dashboardUrl}/dashboard/planos?status=failure`)
    }

    const accessToken = getMpAccessToken()
    if (!accessToken) {
      req.log.error('MP_ACCESS_TOKEN ausente no callback de pagamento')
      return reply.redirect(`${dashboardUrl}/dashboard/planos?status=pending`)
    }

    // Verify payment with MP API — do not trust query params alone
    const snapshot = await fetchMercadoPagoPaymentSnapshot(mpPaymentId)

    if (!snapshot.ok || snapshot.providerStatus !== 'approved') {
      req.log.warn({ mpPaymentId, snapshot }, 'Callback com pagamento não aprovado na verificação MP')
      return reply.redirect(`${dashboardUrl}/dashboard/planos?status=failure`)
    }

    // external_reference from MP API is authoritative (set by us when creating the preference)
    const userId = snapshot.externalReference ?? external_reference ?? null
    if (!userId) {
      req.log.warn({ mpPaymentId }, 'Callback sem external_reference — não foi possível identificar usuário')
      return reply.redirect(`${dashboardUrl}/dashboard/planos?status=pending`)
    }

    const plans = await getBillingPlans()
    const plan = inferPlanFromAmountWithPlans(snapshot.transactionAmount, plans)
    if (!plan) {
      req.log.warn({ mpPaymentId, amount: snapshot.transactionAmount }, 'Valor do pagamento não corresponde a nenhum plano')
      return reply.redirect(`${dashboardUrl}/dashboard/planos?status=pending`)
    }

    try {
      await db.$transaction(async (tx) =>
        activatePaymentAccess(tx, { userId, plan, mpPaymentId, amount: plans[plan].price })
      )
      trackAnalyticsEventSafe({ userId, event: 'payment_approved', metadata: { plan, source: 'callback' } })
      return reply.redirect(`${dashboardUrl}/dashboard/pagamento/sucesso`)
    } catch (err) {
      if (err?.code === 'PAYMENT_ALREADY_USED') {
        return reply.redirect(`${dashboardUrl}/dashboard/planos?status=failure&reason=already_used`)
      }
      req.log.error({ err: err?.message, mpPaymentId, userId }, 'Erro ao ativar acesso no callback')
      return reply.redirect(`${dashboardUrl}/dashboard/planos?status=pending`)
    }
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

  app.get('/overview', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub
    const now = new Date()
    const [user, lastApprovedPayment] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { plan: true, accessExpiresAt: true } }),
      db.payment.findFirst({ where: { userId, status: 'approved' }, orderBy: { createdAt: 'desc' } }),
    ])

    const accessExpiresAt = user?.accessExpiresAt ?? null
    const isActive = !accessExpiresAt || accessExpiresAt > now
    const expiresInDays = accessExpiresAt ? Math.max(0, Math.ceil((new Date(accessExpiresAt) - now) / 86400000)) : null

    const actionRequired = isActive
      ? null
      : 'Seu acesso está expirado. Escolha um plano abaixo para renovar.'

    return {
      billingModel: 'Renovação manual a cada 30 dias',
      autoRenew: false,
      paymentMethod: 'PIX ou Cartão de Crédito',
      plan: user?.plan ?? 'trial',
      accessExpiresAt,
      nextChargeAt: null,
      isActive,
      expiresInDays,
      actionRequired,
      lastApprovedPayment: lastApprovedPayment
        ? {
          id: lastApprovedPayment.id,
          mpPaymentId: lastApprovedPayment.mpPaymentId,
          amount: lastApprovedPayment.amount,
          plan: lastApprovedPayment.plan,
          createdAt: lastApprovedPayment.createdAt,
          expiresAt: lastApprovedPayment.expiresAt,
        }
        : null,
    }
  })

  // Fallback manual: o usuário pode informar o payment_id caso o callback automático falhe
  app.post('/recover', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { paymentId } = req.body ?? {}
    if (!paymentId) return sendError(reply, 400, 'MISSING_PAYMENT_ID', 'paymentId obrigatório')

    const accessToken = getMpAccessToken()
    if (!accessToken) return sendError(reply, 500, 'PAYMENT_PROVIDER_NOT_CONFIGURED', 'MP não configurado')

    const userId = req.user.sub

    // Pré-verificação antes de chamar a API do MP
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

    const plans = await getBillingPlans()
    const plan = inferPlanFromAmountWithPlans(transaction_amount, plans)
    if (!plan) return sendError(reply, 400, 'CANNOT_DETERMINE_PLAN', `Valor R$${transaction_amount} não corresponde a nenhum plano`)

    try {
      const result = await db.$transaction(async (tx) =>
        activatePaymentAccess(tx, { userId, plan, mpPaymentId: String(paymentId), amount: plans[plan].price })
      )

      if (result.alreadyActivated) {
        const user = await db.user.findUnique({ where: { id: userId }, select: { plan: true, accessExpiresAt: true } })
        return { alreadyApplied: true, plan: user.plan, accessExpiresAt: user.accessExpiresAt }
      }

      trackAnalyticsEventSafe({ userId, event: 'payment_recovered', metadata: { plan, paymentId: String(paymentId) } })
      return { recovered: true, plan, accessExpiresAt: result.expiresAt }
    } catch (err) {
      if (err?.code === 'PAYMENT_ALREADY_USED') {
        return sendError(reply, 409, 'PAYMENT_ALREADY_USED', err.message)
      }
      req.log.error({ err: err.message }, 'Recover db error')
      return reply.code(500).send({ error: 'Erro interno ao recuperar pagamento' })
    }
  })
}
