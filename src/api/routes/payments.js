import axios from 'axios'
import { createHmac } from 'crypto'
import { trackAnalyticsEventSafe } from '../../analytics.js'
import { resolvePlanForPayment, DEFAULT_PLANS } from '../../domain/payments/service.js'
import { classifyPayerEmail } from '../../domain/payments/payerEmail.js'
import { classifyMpAccessTokenMode, isSandboxTokenInProduction, SANDBOX_TOKEN_USER_MESSAGE } from '../../domain/payments/accessTokenMode.js'
import {
  SUBSCRIPTION_OPEN_STATUSES,
  blocksNewSubscription,
  decidePendingSubscriptionReuse,
  decideSubscriptionAttemptCooldown,
  describeSubscriptionCooldown,
  SUBSCRIPTION_ATTEMPT_WINDOW_MS as DEFAULT_ATTEMPT_WINDOW_MS,
  SUBSCRIPTION_ATTEMPT_MAX as DEFAULT_ATTEMPT_MAX,
  SUBSCRIPTION_ATTEMPT_COOLDOWN_MS as DEFAULT_ATTEMPT_COOLDOWN_MS,
  decideAccessExtensionFromSubscription,
  decideSubscriptionCancellation,
  summarizeSubscriptionForPanel,
} from '../../domain/payments/subscriptionPolicy.js'
import { appContainer } from '../../app/container.js'
import { writeWebhookEvent } from '../../events/store.js'
import { notifyPaymentApproved } from '../../emailTriggers/events.js'
import { tryCreateAffiliateCommission, reconcileAffiliateCommissions, promoteEligibleAffiliateCommissions, reverseAffiliateCommissionForPayment, checkStuckPromotions } from '../../domain/affiliate/service.js'
export { resolvePlanForPayment }

const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const PAYMENT_RECONCILIATION_ENABLED = String(process.env.PAYMENT_RECONCILIATION_ENABLED ?? 'true').toLowerCase() === 'true'
const PAYMENT_RECONCILIATION_INTERVAL_MS = Math.max(60000, Number(process.env.PAYMENT_RECONCILIATION_INTERVAL_MS ?? 3600000))
const PAYMENT_RECONCILIATION_PENDING_MINUTES = Math.max(5, Number(process.env.PAYMENT_RECONCILIATION_PENDING_MINUTES ?? 15))
const PAYMENT_RECONCILIATION_BATCH = Math.min(200, Math.max(1, Number(process.env.PAYMENT_RECONCILIATION_BATCH ?? 50)))

// Intervalo mínimo entre tentativas de ligar a cobrança automática. Escape
// hatch: `SUBSCRIPTION_ATTEMPT_MAX=0` desliga a espera sem redeploy.
const SUBSCRIPTION_ATTEMPT_WINDOW_MS = Math.max(0, Number(process.env.SUBSCRIPTION_ATTEMPT_WINDOW_MS ?? DEFAULT_ATTEMPT_WINDOW_MS))
const SUBSCRIPTION_ATTEMPT_MAX = Math.max(0, Number(process.env.SUBSCRIPTION_ATTEMPT_MAX ?? DEFAULT_ATTEMPT_MAX))
const SUBSCRIPTION_ATTEMPT_COOLDOWN_MS = Math.max(0, Number(process.env.SUBSCRIPTION_ATTEMPT_COOLDOWN_MS ?? DEFAULT_ATTEMPT_COOLDOWN_MS))

const OFFICIAL_PUBLIC_ORIGIN = 'http://espelhagrupos.com.br'
const OFFICIAL_SECURE_PUBLIC_ORIGIN = 'https://espelhagrupos.com.br'

function isIpHost(hostname = '') {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(String(hostname || '').trim())
}

function normalizePublicOrigin(value, { fallback = OFFICIAL_PUBLIC_ORIGIN, allowIpHost = false } = {}) {
  try {
    const parsed = new URL(String(value ?? ''))
    if (!allowIpHost && isIpHost(parsed.hostname)) return fallback
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

function getCheckoutPublicOrigins() {
  if (IS_PRODUCTION) {
    // Mercado Pago requires HTTPS for callback/webhook URLs in production.
    // Keep internal app protocol independent from the externally exposed origin.
    return { dashboardUrl: OFFICIAL_SECURE_PUBLIC_ORIGIN, apiUrl: OFFICIAL_SECURE_PUBLIC_ORIGIN }
  }

  const rawDashboardUrl = stripApiSuffix(getDashboardUrl())
  const rawApiUrl = stripApiSuffix(getApiUrl())
  const publicOriginFallback = 'http://localhost:3006'

  const dashboardUrl = normalizePublicOrigin(rawDashboardUrl, {
    fallback: publicOriginFallback,
    allowIpHost: !IS_PRODUCTION,
  })
  const apiUrl = normalizePublicOrigin(rawApiUrl, {
    fallback: publicOriginFallback,
    allowIpHost: !IS_PRODUCTION,
  })

  return { dashboardUrl, apiUrl }
}

function sendError(reply, statusCode, code, message) {
  return reply.code(statusCode).send({ error: { code, message } })
}

const { db } = appContainer
const paymentsService = appContainer.services.payments
const { getBillingPlans } = paymentsService

export function shouldHandleSubscriptionPreapproval(summary = {}) {
  return summary.type === 'subscription_preapproval' && Boolean(summary.dataResourceId)
}

export function shouldHandleSubscriptionAuthorizedPayment(summary = {}) {
  return summary.type === 'subscription_authorized_payment' && Boolean(summary.dataResourceId)
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


export function hasStepUpMfa(req) {
  const configuredToken = String(process.env.ADMIN_MFA_TOKEN ?? '').trim()
  if (!configuredToken) return false
  const providedToken = String(req.headers['x-admin-mfa-token'] ?? '').trim()
  return providedToken && providedToken === configuredToken
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
  // Token de sandbox em produção faz TODO cartão real ser recusado, com a mesma
  // tela de uma recusa do banco. Avisa no boot para o motivo não ficar
  // invisível até alguém abrir o `.env` no VPS.
  if (isSandboxTokenInProduction({ token: getMpAccessToken(), isProduction: IS_PRODUCTION })) {
    log.error({ mpTokenMode: 'test' }, 'PAGAMENTOS: MP_ACCESS_TOKEN é de TESTE em produção — nenhum cartão real será aceito')
  }
}

function toSafeString(value, max = 120) {
  const text = String(value ?? '').trim()
  if (!text) return null
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function normalizeWebhookPayload(payload) {
  try {
    const safe = {
      id: toSafeString(payload?.id),
      type: toSafeString(payload?.type ?? payload?.topic),
      action: toSafeString(payload?.action),
      api_version: toSafeString(payload?.api_version),
      date_created: toSafeString(payload?.date_created),
      data: {
        id: toSafeString(payload?.data?.id),
      },
      live_mode: payload?.live_mode === true,
      user_id: typeof payload?.user_id === 'number' ? payload.user_id : null,
    }
    return JSON.stringify(safe)
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


export function isReversiblePaymentStatus(status) {
  return ['refunded', 'charged_back', 'cancelled'].includes(String(status ?? '').toLowerCase())
}

// Activates a payment and grants 30-day access. Shared by /recover, /callback and webhook processor.
// Must be called inside a db.$transaction — tx is a Prisma transaction client.
export async function activatePaymentAccess(tx, { userId, plan, mpPaymentId, amount }) {
  return paymentsService.activatePaymentAccess(tx, { userId, plan, mpPaymentId, amount })
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
      preferredPlan: response.data?.metadata?.plan ?? null,
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

async function fetchMercadoPagoSubscriptionSnapshot(preapprovalId) {
  const accessToken = getMpAccessToken()
  if (!accessToken) return { ok: false, reason: 'missing_access_token' }

  try {
    const response = await axios.get(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 8000,
    })
    return {
      ok: true,
      status: response.data?.status ?? null,
      externalReference: response.data?.external_reference ?? null,
      payerEmail: response.data?.payer_email ?? null,
      // Usado para REAPROVEITAR o checkout ainda em aberto em vez de criar
      // outro idêntico (o que dispara o antifraude do MP — ver
      // `decidePendingSubscriptionReuse`).
      initPoint: response.data?.init_point ?? null,
      nextChargeAt: response.data?.next_payment_date ?? response.data?.auto_recurring?.next_payment_date ?? null,
      transactionAmount: response.data?.auto_recurring?.transaction_amount ?? null,
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

async function fetchMercadoPagoAuthorizedPaymentSnapshot(authorizedPaymentId) {
  const accessToken = getMpAccessToken()
  if (!accessToken) return { ok: false, reason: 'missing_access_token' }

  try {
    const response = await axios.get(`https://api.mercadopago.com/authorized_payments/${authorizedPaymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 8000,
    })
    return {
      ok: true,
      status: response.data?.status ?? null,
      preapprovalId: response.data?.preapproval_id ?? null,
      transactionAmount: response.data?.transaction_amount ?? response.data?.payment?.transaction_amount ?? null,
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

/**
 * Cancela a assinatura no Mercado Pago. `provider_not_found` é tratado como
 * sucesso pelo chamador: se o preapproval não existe mais lá, manter a linha
 * como ativa aqui só faria a cliente ver "renovação ligada" para uma cobrança
 * que nunca vai acontecer.
 */
async function cancelMercadoPagoSubscription(preapprovalId) {
  const accessToken = getMpAccessToken()
  if (!accessToken) return { ok: false, reason: 'missing_access_token' }

  try {
    await axios.put(
      `https://api.mercadopago.com/preapproval/${preapprovalId}`,
      { status: 'cancelled' },
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 8000 }
    )
    return { ok: true }
  } catch (err) {
    const httpStatus = err?.response?.status ?? null
    if (httpStatus === 404) return { ok: false, reason: 'provider_not_found', httpStatus }
    return {
      ok: false,
      reason: 'provider_error',
      httpStatus,
      message: String(err?.response?.data?.message ?? err?.message ?? 'unknown_error').slice(0, 500),
    }
  }
}

async function createMercadoPagoSubscription({ userId, plan, payerEmail }) {
  if (!payerEmail) {
    const err = new Error('payer_email obrigatório para criar assinatura')
    err.code = 'MISSING_PAYER_EMAIL'
    throw err
  }

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
    const err = new Error('Configuração de plano inválida para assinatura')
    err.code = 'INVALID_PLAN_CONFIG'
    throw err
  }

  // Token de teste em produção recusa TODO cartão real com a mesma tela de
  // "pagamento recusado" de uma recusa do banco. Falhar aqui com motivo próprio
  // evita procurar defeito no cartão da cliente.
  if (isSandboxTokenInProduction({ token: accessToken, isProduction: IS_PRODUCTION })) {
    const err = new Error('MP_ACCESS_TOKEN de sandbox em produção')
    err.code = 'PAYMENT_PROVIDER_SANDBOX_TOKEN'
    throw err
  }

  const { dashboardUrl, apiUrl } = getCheckoutPublicOrigins()

  try {
    const response = await axios.post(
      'https://api.mercadopago.com/preapproval',
      {
        reason: normalizedPlan.title,
        external_reference: userId,
        payer_email: payerEmail,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: normalizedPlan.price,
          currency_id: 'BRL',
        },
        back_url: `${dashboardUrl}/painel/pagamento/sucesso`,
        // Sem isso os avisos da assinatura dependem só do que estiver marcado no
        // painel do MP — e o checkout avulso já manda o dele. Perder o aviso de
        // renovação é a cliente pagar e ficar sem robô.
        notification_url: `${apiUrl}/api/payments/webhook`,
        status: 'pending',
      },
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 }
    )

    return {
      initPoint: response.data.init_point,
      mpSubscriptionId: response.data.id,
    }
  } catch (err) {
    const providerCause = err?.response?.data?.cause?.[0]?.description
      || err?.response?.data?.message
      || err?.response?.data?.error
      || err?.message
      || 'provider_error'
    const wrapped = new Error(String(providerCause))
    wrapped.code = 'SUBSCRIPTION_PROVIDER_ERROR'
    wrapped.providerStatus = err?.response?.status
    wrapped.providerPayload = err?.response?.data || null
    throw wrapped
  }
}

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
  const { dashboardUrl, apiUrl } = getCheckoutPublicOrigins()
  if (IS_PRODUCTION && (!isPublicHttpUrl(apiUrl) || !isPublicHttpUrl(dashboardUrl))) {
    const err = new Error('API_URL/DASHBOARD_URL inválidos para produção')
    err.code = 'PAYMENT_PROVIDER_MISCONFIGURED'
    throw err
  }
  // Keep protocol from configured origins. Some deployments intentionally run
  // behind HTTP-only reverse proxies and forcing HTTPS here breaks MP redirects.
  const callbackOrigin = dashboardUrl
  const notificationOrigin = apiUrl

  // Mercado Pago validates `back_urls` as user-facing return URLs.
  const callbackBase = `${callbackOrigin}/api/payments/callback`

  const preference = {
    items: [{
      title: normalizedPlan.title,
      quantity: 1,
      unit_price: normalizedPlan.price,
      currency_id: 'BRL',
    }],
    external_reference: userId,
    metadata: { plan },
    back_urls: {
      success: `${callbackBase}?collection_status=approved`,
      failure: `${callbackBase}?collection_status=rejected`,
      pending: `${callbackBase}?collection_status=pending`,
    },
    auto_return: 'approved',
    notification_url: `${notificationOrigin}/api/payments/webhook`,
    // Back URL shown after payment for manual navigation
    statement_descriptor: 'Espelha Grupos',
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

async function markWebhookDlq({ eventId, requestId, payload, error }) {
  await db.paymentWebhookDlq.upsert({
    where: { provider_eventId: { provider: 'mercado_pago', eventId: String(eventId) } },
    update: { error: String(error).slice(0, 500), payload, requestId: requestId || null, retryCount: { increment: 1 }, lastRetryAt: new Date() },
    create: { provider: 'mercado_pago', eventId: String(eventId), requestId: requestId || null, payload, error: String(error).slice(0, 500), retryCount: 0 },
  })
}

async function invalidatePaymentCache(userId, log) {
  log?.info?.({ userId }, 'payment_cache_invalidation_requested')
}

async function runPaymentReconciliation({ log } = {}) {
  const cutoff = new Date(Date.now() - PAYMENT_RECONCILIATION_PENDING_MINUTES * 60 * 1000)
  const pending = await db.payment.findMany({
    where: { status: 'pending', createdAt: { lte: cutoff }, mpPaymentId: { not: null } },
    take: PAYMENT_RECONCILIATION_BATCH,
    orderBy: { createdAt: 'asc' },
  })
  let fixed = 0
  for (const payment of pending) {
    const snapshot = await fetchMercadoPagoPaymentSnapshot(payment.mpPaymentId)
    if (!snapshot.ok) continue
    if (snapshot.providerStatus !== 'approved' || !snapshot.externalReference) {
      await db.payment.update({ where: { id: payment.id }, data: { lastSyncedAt: new Date() } }).catch(() => {})
      continue
    }
    const plans = await getBillingPlans()
    const plan = resolvePlanForPayment({ preferredPlan: snapshot.preferredPlan, amount: snapshot.transactionAmount, plans })
    if (!plan) continue
    await db.$transaction(async (tx) => {
      await activatePaymentAccess(tx, { userId: snapshot.externalReference, plan, mpPaymentId: String(payment.mpPaymentId), amount: plans[plan].price })
      await tx.payment.updateMany({ where: { mpPaymentId: String(payment.mpPaymentId) }, data: { gatewayEventId: payment.gatewayEventId ?? null, lastSyncedAt: new Date() } })
    })
    await invalidatePaymentCache(snapshot.externalReference, log)
    fixed++
  }
  return { checked: pending.length, fixed }
}

/**
 * Reconciliação da assinatura recorrente — rede de segurança do "renova sozinho".
 *
 * A renovação do acesso depende do aviso `subscription_authorized_payment` do
 * Mercado Pago. Se esse aviso se perder (rede, deploy no meio, fila em erro), a
 * cobrança acontece e o acesso corta assim mesmo: a cliente paga e fica sem
 * robô, que é o pior desfecho possível deste projeto. Esta passada consulta o
 * próprio MP e conserta as duas pontas:
 *
 *  - status e próxima cobrança da assinatura (inclusive cancelamento feito
 *    pela cliente direto no app do Mercado Pago, que de outro jeito só
 *    apareceria aqui quando a cobrança falhasse);
 *  - acesso vencendo antes da próxima cobrança de uma assinatura que está
 *    cobrando — nesse caso o período já pago vai até lá, então o acesso é
 *    estendido até a data que o MP informa.
 *
 * Só ESTENDE acesso, nunca encurta (`decideAccessExtensionFromSubscription`).
 * Roda no mesmo tick da reconciliação de pagamento — sem processo PM2 novo.
 */
async function runSubscriptionReconciliation({ log } = {}) {
  const subscriptions = await db.subscription.findMany({
    where: { status: { in: SUBSCRIPTION_OPEN_STATUSES } },
    take: PAYMENT_RECONCILIATION_BATCH,
    orderBy: { updatedAt: 'asc' },
  })

  let synced = 0
  let extended = 0

  for (const subscription of subscriptions) {
    if (!subscription.mpSubscriptionId) continue

    const snapshot = await fetchMercadoPagoSubscriptionSnapshot(subscription.mpSubscriptionId)
    if (!snapshot.ok || !snapshot.status) continue

    try {
      await db.$transaction(async (tx) =>
        paymentsService.upsertSubscription(tx, {
          userId: subscription.userId,
          mpSubscriptionId: subscription.mpSubscriptionId,
          plan: subscription.plan,
          status: snapshot.status,
          nextChargeAt: snapshot.nextChargeAt ?? null,
        })
      )
      synced++
    } catch (err) {
      log?.warn?.({ err: err?.message, userId: subscription.userId }, 'subscription_reconciliation_upsert_failed')
      continue
    }

    const user = await db.user.findUnique({
      where: { id: subscription.userId },
      select: { accessExpiresAt: true },
    }).catch(() => null)
    if (!user) continue

    const decision = decideAccessExtensionFromSubscription({
      status: snapshot.status,
      nextChargeAt: snapshot.nextChargeAt,
      accessExpiresAt: user.accessExpiresAt,
    })
    if (!decision.extend) continue

    try {
      await db.user.update({
        where: { id: subscription.userId },
        data: { plan: subscription.plan, accessExpiresAt: decision.until },
      })
      await invalidatePaymentCache(subscription.userId, log)
      trackAnalyticsEventSafe({
        userId: subscription.userId,
        event: 'subscription_access_extended',
        metadata: { plan: subscription.plan, reason: decision.reason },
      })
      log?.warn?.({ userId: subscription.userId, until: decision.until, reason: decision.reason }, 'subscription_access_extended: acesso estava vencendo antes da próxima cobrança')
      extended++
    } catch (err) {
      log?.error?.({ err: err?.message, userId: subscription.userId }, 'subscription_reconciliation_extend_failed')
    }
  }

  return { checked: subscriptions.length, synced, extended }
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

        if (reconciliation.ok && isReversiblePaymentStatus(reconciliation.providerStatus)) {
          const payment = await db.payment.findUnique({
            where: { mpPaymentId: String(summary.dataResourceId) },
            select: { id: true, userId: true },
          }).catch(() => null)

          if (payment) {
            await db.payment.update({
              where: { id: payment.id },
              data: { status: String(reconciliation.providerStatus), lastSyncedAt: new Date() },
            })
            const reversal = await reverseAffiliateCommissionForPayment({
              paymentId: payment.id,
              reason: `payment_${reconciliation.providerStatus}`,
              db,
            })
            activation = { triggered: false, reason: 'payment_reversed', status: reconciliation.providerStatus, reversed: reversal.updated }
            if (reversal.updated > 0) {
              trackAnalyticsEventSafe({ userId: payment.userId, event: 'affiliate_commission_reversed', metadata: { source: 'webhook', status: reconciliation.providerStatus, count: reversal.updated } })
            }
          } else {
            activation = { triggered: false, reason: 'payment_not_found_for_reversal', status: reconciliation.providerStatus }
          }
        } else if (reconciliation.ok && reconciliation.providerStatus === 'approved' && reconciliation.externalReference) {
          const userId = reconciliation.externalReference
          const plans = await getBillingPlans()
          const plan = resolvePlanForPayment({ preferredPlan: reconciliation.preferredPlan, amount: reconciliation.transactionAmount, plans })

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
                // Recibo por e-mail. Best-effort: nunca segura nem derruba o webhook.
                notifyPaymentApproved({ db, userId, plan, amount: plans[plan].price, accessExpiresAt: result?.expiresAt, logger: log }).catch(() => {})
                const payment = await db.payment.findUnique({ where: { mpPaymentId: String(summary.dataResourceId) }, select: { id: true, amount: true } }).catch(() => null)
                if (payment) {
                  tryCreateAffiliateCommission({
                    userId,
                    paymentId: payment.id,
                    saleAmountCents: Math.round(payment.amount * 100),
                    log,
                  }).catch(err => log?.error?.({ err }, 'affiliate commission error'))
                } else {
                  log?.warn?.({ mpPaymentId: String(summary.dataResourceId), userId }, 'affiliate_commission_skipped: payment not found after activation')
                }
              }
            } catch (activationErr) {
              activation = { triggered: true, error: activationErr?.code ?? activationErr?.message }
              log?.warn?.({ err: activationErr?.message, userId }, 'Webhook activation failed')
            }
          } else {
            activation = { triggered: false, reason: 'unrecognized_amount', amount: reconciliation.transactionAmount }
          }
        }
      } else if (shouldHandleSubscriptionPreapproval(summary)) {
        const snapshot = await fetchMercadoPagoSubscriptionSnapshot(summary.dataResourceId)
        reconciliation = { ok: snapshot.ok, status: snapshot.status, transactionAmount: snapshot.transactionAmount }

        if (snapshot.ok) {
          const plans = await getBillingPlans()
          const plan = resolvePlanForPayment({ amount: snapshot.transactionAmount, plans })

          if (snapshot.externalReference) {
            try {
              await db.$transaction(async (tx) =>
                paymentsService.upsertSubscription(tx, {
                  userId: String(snapshot.externalReference),
                  mpSubscriptionId: String(summary.dataResourceId),
                  plan: plan ?? 'basic',
                  status: snapshot.status,
                  nextChargeAt: snapshot.nextChargeAt ?? null,
                })
              )
              activation = { triggered: false, reason: 'subscription_upserted', status: snapshot.status }
            } catch (upsertErr) {
              activation = { triggered: false, error: upsertErr?.message }
              log?.warn?.({ err: upsertErr?.message, mpSubscriptionId: summary.dataResourceId }, 'Falha ao upsert subscription no webhook')
            }
          } else {
            activation = { triggered: false, reason: 'missing_external_reference' }
            log?.warn?.({ mpSubscriptionId: summary.dataResourceId }, 'subscription_preapproval sem external_reference — ignorado')
          }
        }
      } else if (shouldHandleSubscriptionAuthorizedPayment(summary)) {
        const authorizedSnapshot = await fetchMercadoPagoAuthorizedPaymentSnapshot(summary.dataResourceId)
        reconciliation = { ok: authorizedSnapshot.ok, status: authorizedSnapshot.status, transactionAmount: authorizedSnapshot.transactionAmount }

        if (authorizedSnapshot.ok && (authorizedSnapshot.status === 'approved' || authorizedSnapshot.status === 'processed') && authorizedSnapshot.preapprovalId) {
          const subscription = await paymentsService.findSubscriptionByMpId(String(authorizedSnapshot.preapprovalId))

          if (subscription?.userId) {
            const plans = await getBillingPlans()
            const plan = resolvePlanForPayment({ preferredPlan: subscription.plan, amount: authorizedSnapshot.transactionAmount, plans }) ?? subscription.plan
            const subscriptionMpPaymentId = `sub_${String(summary.dataResourceId)}`

            try {
              const result = await db.$transaction(async (tx) => {
                const activationResult = await paymentsService.activateSubscriptionAccess(tx, {
                  userId: subscription.userId,
                  plan,
                  mpPaymentId: subscriptionMpPaymentId,
                  amount: authorizedSnapshot.transactionAmount ?? plans[plan]?.price ?? 0,
                })
                return activationResult
              })
              activation = { triggered: true, ...result }

              if (!result.alreadyActivated) {
                trackAnalyticsEventSafe({ userId: subscription.userId, event: 'subscription_payment_approved', metadata: { plan, mpSubscriptionId: authorizedSnapshot.preapprovalId, source: 'webhook' } })
                const payment = await db.payment.findUnique({ where: { mpPaymentId: subscriptionMpPaymentId }, select: { id: true, amount: true } }).catch(() => null)
                if (payment) {
                  tryCreateAffiliateCommission({
                    userId: subscription.userId,
                    paymentId: payment.id,
                    saleAmountCents: Math.round(payment.amount * 100),
                    log,
                  }).catch(err => log?.error?.({ err }, 'affiliate commission error on subscription'))
                }
              }
            } catch (activationErr) {
              activation = { triggered: true, error: activationErr?.code ?? activationErr?.message }
              log?.warn?.({ err: activationErr?.message, userId: subscription.userId }, 'Subscription webhook activation failed')
            }
          } else {
            activation = { triggered: false, reason: 'subscription_not_found', preapprovalId: authorizedSnapshot.preapprovalId }
            log?.warn?.({ preapprovalId: authorizedSnapshot.preapprovalId }, 'authorized_payment sem subscription encontrada — ignorado')
          }
        }
      }

      await db.webhookEvent.update({
        where: { id: event.id },
        data: {
          processingStatus: 'processed',
          processedAt: new Date(),
          processingResult: JSON.stringify({ summary, activation: { triggered: Boolean(activation?.triggered), alreadyActivated: Boolean(activation?.alreadyActivated), error: activation?.error ?? null }, reconciliation: { status: reconciliation?.status ?? null, amount: reconciliation?.transactionAmount ?? null } }),
          error: null,
        },
      })
      processed++
    } catch (err) {
      await markWebhookDlq({ eventId: event.eventId, requestId: event.requestId, payload: event.payload, error: err?.message ?? 'processing_error' }).catch(() => {})
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

  if (PAYMENT_RECONCILIATION_ENABLED) {
    const reconciliationTimer = setInterval(async () => {
      try {
        const result = await runPaymentReconciliation({ log: app.log })
        if (result.checked > 0) app.log.info({ result }, 'payment_reconciliation_cycle_completed')
      } catch (err) {
        app.log.error({ err: err?.message }, 'payment_reconciliation_cycle_failed')
      }
      // Rede de segurança das comissões de afiliado: a criação no webhook é
      // fire-and-forget e pode falhar (SQLITE_BUSY, restart) sem retry; este
      // passo recria comissões faltantes de pagamentos já aprovados.
      try {
        const result = await runSubscriptionReconciliation({ log: app.log })
        if (result.checked > 0) app.log.info({ result }, 'subscription_reconciliation_cycle_completed')
      } catch (err) {
        app.log.error({ err: err?.message }, 'subscription_reconciliation_cycle_failed')
      }
      try {
        const result = await reconcileAffiliateCommissions({ log: app.log })
        if (result.created > 0 || result.failed > 0) {
          app.log.info({ result }, 'affiliate_commission_reconciliation_cycle_completed')
        }
      } catch (err) {
        app.log.error({ err: err?.message }, 'affiliate_commission_reconciliation_cycle_failed')
      }
      try {
        const result = await promoteEligibleAffiliateCommissions({ log: app.log })
        if (result.promoted > 0 || result.failed > 0) {
          app.log.info({ result }, 'affiliate_commission_eligibility_cycle_completed')
        }
      } catch (err) {
        app.log.error({ err: err?.message }, 'affiliate_commission_eligibility_cycle_failed')
      }
      // US6 (009-affiliate-improvements-r1): alarme se a promoção pending→eligible
      // parou de avançar (reaproveita este mesmo tick — sem novo timer/processo).
      try {
        await checkStuckPromotions({ log: app.log })
      } catch (err) {
        app.log.error({ err: err?.message }, 'affiliate_promotion_stuck_check_failed')
      }
    }, PAYMENT_RECONCILIATION_INTERVAL_MS)
    reconciliationTimer.unref?.()
    app.log.info({ intervalMs: PAYMENT_RECONCILIATION_INTERVAL_MS, pendingMinutes: PAYMENT_RECONCILIATION_PENDING_MINUTES }, 'Payment reconciliation worker enabled')
  }
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

  app.post('/create-subscription', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    try {
      const { plan } = req.body ?? {}
      const plans = await getBillingPlans()
      if (!plans[plan]) return sendError(reply, 400, 'INVALID_PLAN', 'Plano inválido. Use basic ou pro.')

      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } })
      const payerEmail = user?.email ?? null

      // RCA do 502: o MP recusa `payer_email` inválido/fictício/fallback no
      // `/preapproval` (às vezes com 500 cru). Pega os casos localmente óbvios
      // ANTES da chamada e devolve erro claro + `needsEmailUpdate` para o painel
      // oferecer a troca de e-mail em vez de um 502 opaco.
      const emailIssue = classifyPayerEmail(payerEmail)
      if (emailIssue) {
        trackAnalyticsEventSafe({ userId, event: 'subscription_email_blocked', metadata: { plan, reason: emailIssue.reason } })
        return reply.code(400).send({
          code: 'SUBSCRIPTION_EMAIL_REQUIRED',
          needsEmailUpdate: true,
          error: { code: 'SUBSCRIPTION_EMAIL_REQUIRED', message: emailIssue.message },
        })
      }

      // Duas assinaturas valendo ao mesmo tempo = a mesma pessoa cobrada duas
      // vezes por mês. `pending` de propósito NÃO bloqueia (é checkout aberto e
      // abandonado; barrar por causa dele travaria a conta para sempre).
      const activeSubscription = await db.subscription.findFirst({
        where: { userId, status: 'authorized' },
        orderBy: { createdAt: 'desc' },
      })
      if (blocksNewSubscription(activeSubscription)) {
        return reply.code(409).send({
          code: 'SUBSCRIPTION_ALREADY_ACTIVE',
          error: {
            code: 'SUBSCRIPTION_ALREADY_ACTIVE',
            message: 'Sua renovação automática já está ligada. Para trocar de plano, cancele a atual e assine de novo.',
          },
        })
      }

      // Antes de criar outro checkout: se já existe um em aberto para o MESMO
      // plano, mande a pessoa de volta para ELE. Criar um preapproval novo com
      // parâmetros idênticos a cada tentativa é o que o antifraude do MP lê como
      // cobrança duplicada e recusa ("Seu pagamento foi recusado"). Ver
      // `decidePendingSubscriptionReuse`.
      const pendingSubscription = await db.subscription.findFirst({
        where: { userId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
      }).catch(() => null)

      const reuseDecision = decidePendingSubscriptionReuse({ subscription: pendingSubscription, plan })
      if (reuseDecision.reuse) {
        const snapshot = await fetchMercadoPagoSubscriptionSnapshot(pendingSubscription.mpSubscriptionId)
        // Só reaproveita o que o MP confirma que continua em aberto. Falha de
        // rede, checkout já concluído ou apagado no MP caem no caminho normal —
        // checkout em aberto nunca pode deixar a conta sem conseguir assinar.
        if (snapshot.ok && String(snapshot.status ?? '').toLowerCase() === 'pending' && snapshot.initPoint) {
          trackAnalyticsEventSafe({ userId, event: 'subscription_checkout_reused', metadata: { plan } })
          req.log.info({ userId, plan }, 'Checkout de assinatura reaproveitado em vez de criar outro igual')
          return { init_point: snapshot.initPoint }
        }
      }

      // Nada para reaproveitar não significa "pode criar outro igual". Quando os
      // checkouts anteriores já foram encerrados e nenhum virou assinatura, mais
      // um preapproval idêntico só piora a leitura do antifraude do MP. A espera
      // é limitada e o pagamento avulso segue aberto — ver
      // `decideSubscriptionAttemptCooldown`.
      const recentSubscriptions = await db.subscription.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }).catch(() => null)

      const cooldown = decideSubscriptionAttemptCooldown({
        recentSubscriptions,
        plan,
        windowMs: SUBSCRIPTION_ATTEMPT_WINDOW_MS,
        maxAttempts: SUBSCRIPTION_ATTEMPT_MAX,
        cooldownMs: SUBSCRIPTION_ATTEMPT_COOLDOWN_MS,
      })
      if (cooldown.wait) {
        req.log.warn({ userId, plan, attempts: cooldown.attempts, retryAt: cooldown.retryAt }, 'Tentativas seguidas de assinar — nova cobrança adiada para não alimentar a recusa do Mercado Pago')
        trackAnalyticsEventSafe({ userId, event: 'subscription_attempt_throttled', metadata: { plan, attempts: cooldown.attempts } })
        return reply.code(429).send({
          code: 'SUBSCRIPTION_TOO_MANY_ATTEMPTS',
          retryAt: cooldown.retryAt,
          error: {
            code: 'SUBSCRIPTION_TOO_MANY_ATTEMPTS',
            message: describeSubscriptionCooldown(cooldown.retryAt),
          },
        })
      }

      // Emitido só quando um checkout NOVO nasce de fato. Antes ele saía logo
      // após as validações, então contava junto o clique que foi devolvido ao
      // checkout em aberto (`subscription_checkout_reused`) e o que foi adiado
      // (`subscription_attempt_throttled`) — os três caminhos viravam um número
      // só, e era impossível ver quantas clientes estavam batendo em cada um.
      trackAnalyticsEventSafe({ userId, event: 'subscription_started', metadata: { plan } })

      const { initPoint, mpSubscriptionId } = await createMercadoPagoSubscription({ userId, plan, payerEmail })
      await db.subscription.upsert({
        where: { mpSubscriptionId },
        update: { plan, status: 'pending', updatedAt: new Date() },
        create: { userId, mpSubscriptionId, plan, status: 'pending' },
      })
      return { init_point: initPoint }
    } catch (err) {
      const plan = req.body?.plan
      if (err?.code === 'INVALID_PLAN_CONFIG') {
        return sendError(reply, 400, 'INVALID_PLAN_CONFIG', 'Configuração do plano inválida no Admin. Revise título e preço do plano.')
      }
      if (err?.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED') {
        return sendError(reply, 500, 'PAYMENT_PROVIDER_NOT_CONFIGURED', 'Pagamentos temporariamente indisponíveis.')
      }
      if (err?.code === 'PAYMENT_PROVIDER_SANDBOX_TOKEN') {
        req.log.error({ userId, plan }, 'MP_ACCESS_TOKEN de sandbox em produção — nenhum cartão real seria aceito')
        trackAnalyticsEventSafe({ userId, event: 'subscription_provider_rejected', metadata: { plan, providerStatus: null, reason: 'sandbox_token' } })
        return sendError(reply, 500, 'PAYMENT_PROVIDER_MISCONFIGURED', SANDBOX_TOKEN_USER_MESSAGE)
      }
      if (err?.code === 'MISSING_PAYER_EMAIL') {
        return reply.code(400).send({
          code: 'SUBSCRIPTION_EMAIL_REQUIRED',
          needsEmailUpdate: true,
          error: { code: 'SUBSCRIPTION_EMAIL_REQUIRED', message: 'Sua conta precisa de um e-mail válido para assinar com renovação automática.' },
        })
      }
      if (err?.code === 'SUBSCRIPTION_PROVIDER_ERROR') {
        // O MP recusou a criação do preapproval. Loga o motivo REAL (status +
        // payload) — antes ia como 502 opaco e o motivo ficava invisível.
        // O `payer_email` é a única variável do usuário aqui, então oferecemos
        // a troca de e-mail (422, não 502: não é falha nossa de gateway).
        req.log.error({ providerStatus: err?.providerStatus, providerPayload: err?.providerPayload, reason: err?.message, plan, userId }, 'Mercado Pago recusou criação de assinatura')
        trackAnalyticsEventSafe({ userId, event: 'subscription_provider_rejected', metadata: { plan, providerStatus: err?.providerStatus ?? null } })
        return reply.code(422).send({
          code: 'SUBSCRIPTION_EMAIL_REJECTED',
          needsEmailUpdate: true,
          error: {
            code: 'SUBSCRIPTION_EMAIL_REJECTED',
            message: 'O Mercado Pago não aceitou o e-mail da sua conta para a assinatura recorrente. Confira se é um e-mail válido e já cadastrado no Mercado Pago — você pode atualizá-lo abaixo e tentar de novo. Se preferir, use o pagamento avulso.',
          },
        })
      }
      req.log.error({ err: err?.message, code: err?.code, plan, userId }, 'Falha ao criar assinatura MP')
      return sendError(reply, 502, 'SUBSCRIPTION_CREATION_FAILED', 'Não foi possível iniciar a assinatura. Tente novamente.')
    }
  })

  /**
   * Desligar a renovação automática. Idempotente: sem assinatura ativa devolve
   * 200 com `cancelled:false` em vez de erro (mesmo padrão de
   * `DELETE /credentials/:platform`) — a pessoa clicou para não ser mais
   * cobrada, e é isso que ela já tem.
   *
   * O acesso JÁ PAGO continua até `accessExpiresAt`. Cortar na hora seria
   * cobrar o mês e não entregar.
   */
  app.post('/subscription/cancel', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub

    const subscription = await db.subscription.findFirst({
      where: { userId, status: { in: SUBSCRIPTION_OPEN_STATUSES } },
      orderBy: { createdAt: 'desc' },
    })

    const decision = decideSubscriptionCancellation(subscription)
    if (!decision.ok) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { accessExpiresAt: true } }).catch(() => null)
      return {
        cancelled: false,
        reason: decision.reason,
        accessExpiresAt: user?.accessExpiresAt ?? null,
        message: 'Você não tem renovação automática ligada. Nada será cobrado.',
      }
    }

    const providerResult = await cancelMercadoPagoSubscription(subscription.mpSubscriptionId)
    // `provider_not_found`: já não existe no Mercado Pago — cancelar aqui é o
    // que deixa os dois lados iguais. Qualquer outra falha NÃO marca como
    // cancelada: dizer "cancelei" e continuar cobrando é o pior desfecho.
    if (!providerResult.ok && providerResult.reason !== 'provider_not_found') {
      req.log.error({ reason: providerResult.reason, httpStatus: providerResult.httpStatus, message: providerResult.message, userId }, 'Falha ao cancelar assinatura no Mercado Pago')
      return sendError(reply, 502, 'SUBSCRIPTION_CANCEL_FAILED', 'Não conseguimos desligar a renovação automática agora. Tente de novo em alguns minutos ou fale com o suporte — nada foi alterado.')
    }

    const now = new Date()
    await db.subscription.update({
      where: { id: subscription.id },
      data: { status: 'cancelled', cancelledAt: now, updatedAt: now },
    })

    const user = await db.user.findUnique({ where: { id: userId }, select: { accessExpiresAt: true } }).catch(() => null)
    trackAnalyticsEventSafe({
      userId,
      event: 'subscription_cancelled',
      metadata: { plan: subscription.plan, providerMissing: providerResult.reason === 'provider_not_found' },
    })

    return {
      cancelled: true,
      accessExpiresAt: user?.accessExpiresAt ?? null,
      message: 'Renovação automática desligada. Seu acesso continua até o fim do período já pago.',
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

    const requestCorrelationId = String(requestId || req.id || '')
    req.log.info({ requestId: requestCorrelationId, eventId, eventType }, 'payment_webhook_received')
    try {
      await writeWebhookEvent({
        provider: 'mercado_pago',
        eventId,
        eventType,
        signatureValid,
        requestId: requestCorrelationId || null,
        dataId: String(dataId || '') || null,
        payload,
        processingStatus: 'received',
      }, { db })
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
      return reply.redirect(`${dashboardUrl}/painel/plano?status=pending`)
    }

    if (paymentStatus !== 'approved' || !mpPaymentId) {
      return reply.redirect(`${dashboardUrl}/painel/plano?status=failure`)
    }

    const accessToken = getMpAccessToken()
    if (!accessToken) {
      req.log.error('MP_ACCESS_TOKEN ausente no callback de pagamento')
      return reply.redirect(`${dashboardUrl}/painel/plano?status=pending`)
    }

    // Verify payment with MP API — do not trust query params alone
    const snapshot = await fetchMercadoPagoPaymentSnapshot(mpPaymentId)

    if (!snapshot.ok || snapshot.providerStatus !== 'approved') {
      req.log.warn({ mpPaymentId, snapshot }, 'Callback com pagamento não aprovado na verificação MP')
      return reply.redirect(`${dashboardUrl}/painel/plano?status=failure`)
    }

    // external_reference from MP API is authoritative (set by us when creating the preference)
    const userId = snapshot.externalReference ?? external_reference ?? null
    if (!userId) {
      req.log.warn({ mpPaymentId }, 'Callback sem external_reference — não foi possível identificar usuário')
      return reply.redirect(`${dashboardUrl}/painel/plano?status=pending`)
    }

    const plans = await getBillingPlans()
    const plan = resolvePlanForPayment({ preferredPlan: snapshot.preferredPlan, amount: snapshot.transactionAmount, plans })
    if (!plan) {
      req.log.warn({ mpPaymentId, amount: snapshot.transactionAmount }, 'Valor do pagamento não corresponde a nenhum plano')
      return reply.redirect(`${dashboardUrl}/painel/plano?status=pending`)
    }

    try {
      const result = await db.$transaction(async (tx) =>
        activatePaymentAccess(tx, { userId, plan, mpPaymentId, amount: plans[plan].price })
      )
      trackAnalyticsEventSafe({ userId, event: 'payment_approved', metadata: { plan, source: 'callback' } })
      if (!result.alreadyActivated) {
        notifyPaymentApproved({ db, userId, plan, amount: plans[plan].price, accessExpiresAt: result?.expiresAt, logger: req.log }).catch(() => {})
        const payment = await db.payment.findUnique({ where: { mpPaymentId: String(mpPaymentId) }, select: { id: true, amount: true } }).catch(() => null)
        if (payment) {
          tryCreateAffiliateCommission({
            userId,
            paymentId: payment.id,
            saleAmountCents: Math.round(payment.amount * 100),
            log: req.log,
          }).catch(err => req.log?.error?.({ err }, 'affiliate commission error'))
        } else {
          req.log?.warn?.({ mpPaymentId: String(mpPaymentId), userId }, 'affiliate_commission_skipped: payment not found after activation')
        }
      }
      return reply.redirect(`${dashboardUrl}/painel/pagamento/sucesso`)
    } catch (err) {
      if (err?.code === 'PAYMENT_ALREADY_USED') {
        return reply.redirect(`${dashboardUrl}/painel/plano?status=failure&reason=already_used`)
      }
      req.log.error({ err: err?.message, mpPaymentId, userId }, 'Erro ao ativar acesso no callback')
      return reply.redirect(`${dashboardUrl}/painel/plano?status=pending`)
    }
  })

  app.post('/webhook/process-pending', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user?.sub
    const adminUser = await db.adminUser.findUnique({ where: { userId }, select: { role: true, status: true } }).catch(() => null)
    if (!adminUser || adminUser.status !== 'active' || adminUser.role !== 'owner') {
      return reply.code(403).send({ error: 'Acesso negado' })
    }
    if (!hasStepUpMfa(req)) {
      req.log.warn({ userId }, 'Step-up MFA obrigatório em webhook/process-pending')
      return reply.code(401).send({ error: 'MFA obrigatória para reprocessamento financeiro' })
    }

    const requestedLimit = Number(req.body?.limit)
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.trunc(requestedLimit), 200)
      : 50

    const result = await processPendingWebhookEvents({ limit, log: req.log })
    return { ok: true, ...result }
  })

  app.get('/health', { onRequest: [app.authenticate] }, async (req) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [pending, dlqOpen] = await Promise.all([
      db.payment.count({ where: { status: 'pending', createdAt: { gte: since } } }),
      db.paymentWebhookDlq.count({ where: { resolvedAt: null } }),
    ])
    return { ok: dlqOpen === 0, provider: 'mercado_pago', pendingLast24h: pending, dlqOpen, checkedAt: new Date().toISOString() }
  })

  // Probe real de conectividade/credencial do Mercado Pago (owner-only, somente
  // leitura). Diferente de /health (que só conta linhas no banco), aqui fazemos
  // uma chamada autenticada barata a GET /users/me para confirmar que o
  // MP_ACCESS_TOKEN está configurado, válido e que o MP está respondendo —
  // exatamente o "validar Mercado Pago" do runbook de reprocessamento da DLQ.
  app.get('/mp-status', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user?.sub
    const adminUser = await db.adminUser.findUnique({ where: { userId }, select: { role: true, status: true } }).catch(() => null)
    if (!adminUser || adminUser.status !== 'active' || adminUser.role !== 'owner') {
      return { tokenConfigured: false, reachable: false, error: 'forbidden', checkedAt: new Date().toISOString() }
    }
    const accessToken = getMpAccessToken()
    if (!accessToken) {
      return { tokenConfigured: false, reachable: false, checkedAt: new Date().toISOString() }
    }
    try {
      const response = await axios.get('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 8000,
      })
      return {
        tokenConfigured: true,
        reachable: true,
        status: response.status,
        accountId: response.data?.id ? String(response.data.id) : null,
        liveMode: response.data?.site_id ? Boolean(accessToken.startsWith('APP_USR-')) : null,
        checkedAt: new Date().toISOString(),
      }
    } catch (err) {
      const status = err?.response?.status ?? null
      const tokenInvalid = status === 401 || status === 403
      return {
        tokenConfigured: true,
        reachable: false,
        tokenInvalid,
        status,
        error: String(err?.response?.data?.message ?? err?.message ?? 'mp_unreachable').slice(0, 200),
        checkedAt: new Date().toISOString(),
      }
    }
  })

  app.post('/dlq/reprocess', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user?.sub
    const adminUser = await db.adminUser.findUnique({ where: { userId }, select: { role: true, status: true } }).catch(() => null)
    if (!adminUser || adminUser.status !== 'active' || adminUser.role !== 'owner') return reply.code(403).send({ error: 'Acesso negado' })
    const items = await db.paymentWebhookDlq.findMany({ where: { resolvedAt: null }, take: 20, orderBy: { createdAt: 'asc' } })
    let resolved = 0
    for (const item of items) {
      try {
        await db.webhookEvent.upsert({ where: { provider_eventId: { provider: 'mercado_pago', eventId: item.eventId } }, update: { processingStatus: 'received', error: null }, create: { provider: 'mercado_pago', eventId: item.eventId, payload: item.payload, processingStatus: 'received', signatureValid: true } })
        await db.paymentWebhookDlq.update({ where: { id: item.id }, data: { resolvedAt: new Date(), lastRetryAt: new Date(), retryCount: { increment: 1 } } })
        resolved++
      } catch {}
    }
    return { ok: true, picked: items.length, resolved }
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
    const [user, lastApprovedPayment, activeSubscription] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { plan: true, accessExpiresAt: true } }),
      db.payment.findFirst({ where: { userId, status: 'approved' }, orderBy: { createdAt: 'desc' } }),
      db.subscription.findFirst({
        where: { userId, status: { in: SUBSCRIPTION_OPEN_STATUSES } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      }),
    ])

    const accessExpiresAt = user?.accessExpiresAt ?? null
    const isActive = !accessExpiresAt || accessExpiresAt > now
    const expiresInDays = accessExpiresAt ? Math.max(0, Math.ceil((new Date(accessExpiresAt) - now) / 86400000)) : null

    const actionRequired = isActive
      ? null
      : 'Seu acesso está expirado. Escolha um plano abaixo para renovar.'

    // `activeSubscription` pode vir `pending` (checkout aberto e não concluído):
    // isso NÃO é renovação automática ligada, e dizer que é faria a cliente
    // achar que está coberta sem estar. Quem decide é o resumo puro.
    const subscription = summarizeSubscriptionForPanel(activeSubscription)
    const autoRenew = subscription.autoRenew
    const billingModel = autoRenew
      ? 'Assinatura recorrente mensal'
      : 'Renovação manual a cada 30 dias'
    const nextChargeAt = autoRenew ? (activeSubscription?.nextChargeAt ?? null) : null

    return {
      billingModel,
      autoRenew,
      paymentMethod: 'PIX ou Cartão de Crédito',
      plan: user?.plan ?? 'trial',
      accessExpiresAt,
      nextChargeAt,
      subscription,
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

    const { status, transaction_amount, external_reference: mpExternalReference } = mpPayRes.data
    if (status !== 'approved') return sendError(reply, 402, 'PAYMENT_NOT_APPROVED', `Pagamento com status: ${status}`)

    // P-1: o external_reference é definido por nós (=userId) na criação da
    // Preference e é autoritativo. Se o pagamento pertence a outra conta,
    // recusa antes de registrar/ativar — impede reivindicar pagamento alheio
    // ainda não persistido em Payment (a trava por mpPaymentId só cobre os já
    // registrados).
    const mpUserRef = String(mpExternalReference ?? '').trim()
    if (mpUserRef && mpUserRef !== String(userId)) {
      return sendError(reply, 403, 'PAYMENT_NOT_OWNED', 'Este pagamento pertence a outra conta.')
    }

    const plans = await getBillingPlans()
    const plan = resolvePlanForPayment({ amount: transaction_amount, plans })
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
      const recoveredPayment = await db.payment.findUnique({ where: { mpPaymentId: String(paymentId) }, select: { id: true, amount: true } }).catch(() => null)
      if (recoveredPayment) {
        tryCreateAffiliateCommission({
          userId,
          paymentId: recoveredPayment.id,
          saleAmountCents: Math.round(recoveredPayment.amount * 100),
          log: req.log,
        }).catch(err => req.log?.error?.({ err }, 'affiliate commission error'))
      } else {
        req.log?.warn?.({ mpPaymentId: String(paymentId), userId }, 'affiliate_commission_skipped: payment not found after activation')
      }
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
