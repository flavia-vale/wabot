import db from '../../db.js'
import { categorizeErrorMsg, ERROR_CATEGORIES } from '../../errorTaxonomy.js'
import { listRunningBots, isSupervisorAlive, SUPERVISOR_MODE, startBot } from '../../manager.js'
import { getApiMetricsSnapshot } from '../metrics.js'
import { getSupervisorOperationalCounters } from '../../supervisor/operationalCounters.js'
import { summarizeCredentialHealth } from '../../credentialHealth.js'
import { getPublicAnalyticsQualitySnapshot } from './public.js'
import { trackAnalyticsEventSafe } from '../../analytics.js'
import { createAdminService } from '../../domain/admin/service.js'
import { readBacklogPipeline, updateBacklogIssueStatus } from '../../backlogPipeline.js'
import { TERMS_DOCUMENT_ID, getEffectiveTermsDocument, nextTermsVersion, normalizeTermsContent } from '../../legalTerms.js'
import { getDlqMaintenanceSnapshot } from '../../jobs/dlqMaintenance.js'
import { redactAdminPayload, serializeAdminAuditValue } from '../../adminRedaction.js'
import { buildErrorsByMessage, summarizeDesyncGroups } from '../../adminLogSummary.js'
import { OFFLINE_EPISODE_EVENT_TYPES, buildOfflineEpisodesByUser, summarizeEpisodes, summarizeOfflineEpisodesByUser, presentOfflineEpisodes } from '../../core/offlineEpisodes.js'
import { resolveSessionOwner, SESSION_OWNER } from '../../core/sessionOwnership.js'
import { recordWaConnectionEventSafe } from '../../waConnectionTelemetry.js'
import { buildPartnerCourtesyReason, normalizePartnerCode } from '../../ops/partnerCourtesy.js'

const ROLE_PERMISSIONS = {
  owner: ['admin:read', 'admin:write', 'billing:read', 'billing:write', 'support:read', 'support:write', 'tech:read', 'tech:write'],
  admin: ['admin:read', 'billing:read', 'support:read', 'support:write', 'tech:read', 'tech:write'],
  billing_admin: ['admin:read', 'billing:read', 'billing:write', 'support:read'],
  support: ['admin:read', 'support:read', 'support:write'],
  tech_support: ['admin:read', 'support:read', 'tech:read', 'tech:write'],
  read_only: ['admin:read', 'support:read'],
}

const PAID_PLANS = ['basic', 'pro']
const PLAN_PRICES = { trial: 0, basic: 39, pro: 69 }
const EXPORT_LIMIT = 100
const DEFAULT_BOOTSTRAP_ADMIN_EMAILS = ['flavia.vale@usp.br', 'flaviaroberta.1496@gmail.com', 'tacianeaas02@gmail.com']
const CANONICAL_OWNER_ADMIN_EMAILS = new Set(DEFAULT_BOOTSTRAP_ADMIN_EMAILS)


const CS_RISK_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000
const csRiskDetectedWindow = new Map()
const OBSERVABILITY_WINDOWS = Object.freeze([
  { key: '5m', label: '5 minutos', ms: 5 * 60 * 1000 },
  { key: '30m', label: '30 minutos', ms: 30 * 60 * 1000 },
  { key: '1h', label: '1 hora', ms: 60 * 60 * 1000 },
  { key: '6h', label: '6 horas', ms: 6 * 60 * 60 * 1000 },
  { key: '24h', label: '24 horas', ms: 24 * 60 * 60 * 1000 },
])

export function shouldTrackRiskDetected({ userId = '', strategy = 'risk_first', reasons = [], now = Date.now() } = {}) {
  const reasonKey = Array.isArray(reasons) ? reasons.slice().sort().join('|').slice(0, 120) : ''
  const key = `${String(userId)}::${String(strategy)}::${reasonKey}`
  const lastAt = csRiskDetectedWindow.get(key)
  if (lastAt && (now - lastAt) < CS_RISK_DEDUP_WINDOW_MS) return false
  csRiskDetectedWindow.set(key, now)
  if (csRiskDetectedWindow.size > 5000) {
    for (const [k, at] of csRiskDetectedWindow.entries()) {
      if ((now - at) > CS_RISK_DEDUP_WINDOW_MS) csRiskDetectedWindow.delete(k)
      if (csRiskDetectedWindow.size <= 4000) break
    }
  }
  return true
}

function normalizeAdminEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

export function isCanonicalOwnerAdminEmail(email) {
  return CANONICAL_OWNER_ADMIN_EMAILS.has(normalizeAdminEmail(email))
}

function getBootstrapAdminEmails() {
  return new Set(
    [
      ...DEFAULT_BOOTSTRAP_ADMIN_EMAILS,
      ...String(process.env.ADMIN_EMAILS ?? '').split(','),
    ]
      .map(normalizeAdminEmail)
      .filter(Boolean)
  )
}

export function isAdminEmailBootstrapEnabled() {
  const raw = String(process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP ?? '').trim().toLowerCase()
  if (!raw) return false
  return !['0', 'false', 'off', 'no', 'disabled'].includes(raw)
}

export function resolveAdminAccess(user) {
  if (!user || user.status !== 'active') {
    return { role: null, adminUserId: null, bootstrap: false }
  }

  const email = normalizeAdminEmail(user.email)
  const adminUser = user.adminUser ?? null
  const hasActiveAdminUser = adminUser?.status === 'active'

  if (hasActiveAdminUser) {
    return { role: adminUser.role, adminUserId: adminUser.id ?? null, bootstrap: false }
  }

  if (isCanonicalOwnerAdminEmail(email)) {
    return { role: 'owner', adminUserId: adminUser?.id ?? null, bootstrap: true }
  }

  const bootstrapAllowed = isAdminEmailBootstrapEnabled() && !adminUser && getBootstrapAdminEmails().has(email)
  if (bootstrapAllowed) {
    return { role: 'owner', adminUserId: null, bootstrap: true }
  }

  return { role: null, adminUserId: adminUser?.id ?? null, bootstrap: false }
}

function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

function canSeePhone(role) {
  return hasPermission(role, 'support:write')
}

function requiresStepUpMfa(permission) {
  return permission.endsWith(':write')
}

function isMfaVerified(req) {
  const configuredToken = String(process.env.ADMIN_MFA_TOKEN ?? '').trim()
  if (!configuredToken) return true
  const providedToken = String(req.headers['x-admin-mfa-token'] ?? '').trim()
  return providedToken && providedToken === configuredToken
}

function maskPhone(phone) {
  if (!phone) return null
  const value = String(phone)
  if (value.length <= 5) return '***'
  return `${value.slice(0, 3)}*****${value.slice(-2)}`
}

function serializeAuditValue(value) {
  return serializeAdminAuditValue(value)
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function getPagination(query, fallbackLimit = 25) {
  const page = Math.max(1, parseInt(query.page ?? '1') || 1)
  const limit = Math.min(EXPORT_LIMIT, Math.max(1, parseInt(query.limit ?? String(fallbackLimit)) || fallbackLimit))
  return { page, limit, skip: (page - 1) * limit }
}

function parseDateRange(query, fallbackDays = 7) {
  const fallbackFrom = addDays(new Date(), -fallbackDays)
  const from = query.from ? new Date(query.from) : fallbackFrom
  const to = query.to ? new Date(query.to) : new Date()
  return {
    from: Number.isNaN(from.getTime()) ? fallbackFrom : from,
    to: Number.isNaN(to.getTime()) ? new Date() : to,
  }
}

function getGroupCounts(groups = []) {
  return groups.reduce((acc, group) => {
    if (group.role === 'monitor') acc.monitor++
    if (group.role === 'post') acc.post++
    acc.total++
    return acc
  }, { total: 0, monitor: 0, post: 0 })
}


function getDaysRemaining(expiresAt, now = new Date()) {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
}

function getSubscriptionStatus(user, now = new Date()) {
  if (user.status === 'banned' || user.status === 'suspended') return user.status
  if (!user.accessExpiresAt) return 'active'
  if (user.accessExpiresAt < now) return 'expired'
  if (user.accessExpiresAt <= addDays(now, 7)) return 'expiring_soon'
  return 'active'
}


function parseCurrencyAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const normalized = String(value ?? '').replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.')
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : null
}

async function getCurrentPlanPrices() {
  try {
    const rows = await db.lpPlan.findMany({ where: { id: { in: ['basic', 'pro'] } } })
    const prices = { ...PLAN_PRICES }
    for (const row of rows) {
      const parsed = parseCurrencyAmount(row.price)
      if (parsed !== null && (row.id === 'basic' || row.id === 'pro')) prices[row.id] = parsed
    }
    return prices
  } catch {
    return PLAN_PRICES
  }
}

function parseManualAccessInput(body = {}) {
  const plan = body.plan === undefined || body.plan === '' ? undefined : String(body.plan)
  const daysRaw = body.days === undefined || body.days === '' ? undefined : Number(body.days)
  const expiresAtRaw = body.expiresAt === undefined || body.expiresAt === '' ? undefined : String(body.expiresAt)
  const reason = String(body.reason ?? '').trim()
  // Cortesia de parceiro influenciador: quando o admin informa o código do
  // parceiro, o motivo é gravado no formato canônico
  // `parceiro-influenciador:<codigo> — <motivo>`, para que dê para auditar
  // depois quantas cortesias de parceria estão de pé (cada uma é uma sessão
  // WhatsApp a mais em produção). Campo opcional — não muda nada quando ausente.
  const partnerCodeRaw = body.partnerCode === undefined || body.partnerCode === '' ? undefined : String(body.partnerCode)

  if (plan !== undefined && !['trial', ...PAID_PLANS].includes(plan)) {
    return { ok: false, error: 'Plano inválido. Use trial, basic ou pro.' }
  }
  if (partnerCodeRaw !== undefined && !normalizePartnerCode(partnerCodeRaw)) {
    return { ok: false, error: 'Código do parceiro inválido. Use letras, números, hífen ou underline (até 32 caracteres).' }
  }
  if (daysRaw !== undefined && (!Number.isInteger(daysRaw) || daysRaw < -365 || daysRaw > 365)) {
    return { ok: false, error: 'Dias deve ser um inteiro entre -365 e 365.' }
  }
  let expiresAt
  if (expiresAtRaw !== undefined) {
    expiresAt = new Date(expiresAtRaw)
    if (Number.isNaN(expiresAt.getTime())) return { ok: false, error: 'Data de expiração inválida.' }
  }
  if (!reason || reason.length < 5) return { ok: false, error: 'Motivo obrigatório com pelo menos 5 caracteres.' }
  if (plan === undefined && daysRaw === undefined && expiresAt === undefined) {
    return { ok: false, error: 'Informe plano, dias ou data de expiração para alterar o acesso.' }
  }

  const finalReason = partnerCodeRaw === undefined ? reason : buildPartnerCourtesyReason(partnerCodeRaw, reason)

  return { ok: true, data: { plan, days: daysRaw, expiresAt, reason: finalReason } }
}



function sanitizePlanFeatures(featuresInput, fallback = []) {
  const fromFallback = Array.isArray(fallback) ? fallback : []
  if (featuresInput === undefined) return fromFallback

  if (Array.isArray(featuresInput)) {
    return featuresInput.map(item => String(item).trim()).filter(Boolean)
  }

  const text = String(featuresInput ?? '').trim()
  if (!text) return []

  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.map(item => String(item).trim()).filter(Boolean)
  } catch {}

  return text.split('\n').map(item => item.trim()).filter(Boolean)
}

function parseStoredPlanFeatures(featuresRaw) {
  return sanitizePlanFeatures(featuresRaw, [])
}

function parseLpPlanInput(body = {}, existing = null) {
  const title = String(body.title ?? existing?.title ?? '').trim()
  const description = String(body.description ?? existing?.description ?? '').trim()
  const price = String(body.price ?? existing?.price ?? '').trim()
  const position = Number.isFinite(Number(body.position)) ? Number(body.position) : (existing?.position ?? 0)
  const existingFeatures = parseStoredPlanFeatures(existing?.features)
  const features = sanitizePlanFeatures(body.features, existingFeatures)

  if (!title || !description || !price) {
    return { ok: false, error: 'Título, descrição e valor do plano são obrigatórios.' }
  }

  if (!['trial', 'basic', 'pro'].includes(existing?.id ?? body.id)) {
    return { ok: false, error: 'Plano inválido. Use trial, basic ou pro.' }
  }

  return { ok: true, data: { title, description, price, features: JSON.stringify(features), position } }
}

function pct(part, total) {
  const denominator = Number(total || 0)
  if (!denominator) return 0
  return Math.round((Number(part || 0) / denominator) * 1000) / 10
}


function emptyOperationalLogCounts() {
  return { success: 0, skippedDedup: 0, skippedConfig: 0, timeoutTotal: 0, errorOther: 0, inFlight: 0 }
}

function classifyOperationalLogIntoCounts(counts, log) {
  if (log.status === 'queued' || log.status === 'sending') { counts.inFlight++; return }
  if (log.status === 'success') { counts.success++; return }
  const category = categorizeErrorMsg(log.errorMsg)
  if (category === ERROR_CATEGORIES.DEDUP) { counts.skippedDedup++; return }
  if (category === ERROR_CATEGORIES.CONFIG_BLOCK) { counts.skippedConfig++; return }
  if (category === ERROR_CATEGORIES.TIMEOUT) counts.timeoutTotal++
  else if (log.status === 'error') counts.errorOther++
}

function buildOperationalWindows(recentLogs, now = new Date()) {
  const nowMs = now.getTime()
  const windows = {}
  for (const window of OBSERVABILITY_WINDOWS) {
    const counts = emptyOperationalLogCounts()
    for (const log of recentLogs) {
      const sentAt = new Date(log.sentAt).getTime()
      if (Number.isFinite(sentAt) && nowMs - sentAt <= window.ms) classifyOperationalLogIntoCounts(counts, log)
    }
    windows[window.key] = {
      label: window.label,
      from: new Date(nowMs - window.ms).toISOString(),
      to: now.toISOString(),
      logs: counts,
    }
  }
  return windows
}

function buildAdminObservabilityContract({
  checkedAt,
  metrics,
  dbOk,
  dlqOpen,
  supervisor,
  supervisorAlive,
  dlqSnapshot,
  queueCounts,
  sessionCounts,
  logCounts,
  windows,
}) {
  const sessionOwnerMismatchTotal = Number(supervisor.sessionOwnerMismatchTotal ?? 0)
  const sessionCircuitBreakerAlertTotal = Number(supervisor.sessionCircuitBreakerAlertTotal ?? 0)
  const sessionQuarantineTotal = Number(supervisor.sessionQuarantineTotal ?? 0)
  const totalRequests = Number(metrics.totalRequests ?? 0)
  const total5xx = Number(metrics.total5xx ?? 0)
  const total4xx = Number(metrics.total4xx ?? 0)
  const messageAttempts = Object.values(logCounts).reduce((sum, value) => sum + Number(value || 0), 0)
  const sendFailures = Number(logCounts.timeoutTotal || 0) + Number(logCounts.errorOther || 0)
  const inFlight = Number(logCounts.inFlight || 0) + Number(queueCounts.queued || 0) + Number(queueCounts.sending || 0)

  const alerts = []
  const pushAlert = ({ severity = 'INFO', tone = severity, title, value, runbook, signal = 'operational' }) => {
    alerts.push({ severity, tone, title, value, signal, runbook })
  }

  if (!dbOk) pushAlert({ severity: 'P1', tone: 'critical', title: 'Banco indisponível', value: 'db query failed', signal: 'database', runbook: 'Verificar SQLite/Prisma e locks antes de reiniciar serviços.' })
  if (SUPERVISOR_MODE === 'remote' && supervisorAlive === false) pushAlert({ severity: 'P1', tone: 'critical', title: 'Supervisor remoto sem heartbeat', value: 'supervisor_alive=0', signal: 'supervisor', runbook: 'Verificar PM2 bot-supervisor e Redis antes de reenviar comandos.' })
  if (total5xx > 0) pushAlert({ severity: 'P2', tone: 'risk', title: 'Erros 5xx recentes', value: total5xx, signal: 'errors', runbook: 'Abrir erros recentes, correlacionar com deploy e checar logs da API.' })
  if ((dlqOpen ?? 0) > 0) pushAlert({ severity: 'P2', tone: 'risk', title: 'Payment DLQ pendente', value: dlqOpen, signal: 'queues', runbook: 'Reprocessar webhooks pendentes após validar Mercado Pago.' })
  if ((dlqSnapshot.lastKnownDlqTotal ?? 0) > 0) pushAlert({ severity: 'P2', tone: 'risk', title: 'Send DLQ pendente', value: dlqSnapshot.lastKnownDlqTotal, signal: 'queues', runbook: 'Inspecionar DLQ por usuário antes de retry/purge.' })
  if (sessionOwnerMismatchTotal > 0) pushAlert({ severity: 'P2', tone: 'risk', title: 'Shard owner mismatch detectado', value: sessionOwnerMismatchTotal, signal: 'supervisor', runbook: 'Validar BOT_SUPERVISOR_MODE, cwd do PM2 e Redis DB canônica.' })
  if (sessionCircuitBreakerAlertTotal > 0) pushAlert({ severity: 'P2', tone: 'risk', title: 'Circuit breaker de sessão acionado', value: sessionCircuitBreakerAlertTotal, signal: 'supervisor', runbook: 'Checar loops de reconexão e possível conflito de sessão WhatsApp.' })
  if ((metrics.uptimeSeconds ?? 0) < 300) pushAlert({ severity: 'P3', tone: 'warn', title: 'Uptime baixo (reinício recente)', value: `${metrics.uptimeSeconds}s`, signal: 'saturation', runbook: 'Confirmar se houve deploy/restart esperado ou crash loop.' })
  if (!alerts.length) pushAlert({ severity: 'INFO', tone: 'good', title: 'Sem alertas críticos', value: 'OK', signal: 'operational', runbook: 'Continuar monitoramento normal.' })

  const goldenSignals = {
    latency: {
      valueMs: Number(metrics.p95RouteAvgMs ?? 0),
      avgMs: Number(metrics.avgLatencyMs ?? 0),
      status: Number(metrics.p95RouteAvgMs ?? 0) > 1500 ? 'risk' : 'ok',
      source: 'api_metrics_snapshot',
    },
    traffic: {
      totalRequests,
      messageAttempts,
      status: totalRequests > 0 ? 'ok' : 'warn',
      source: 'api_metrics_and_message_log',
    },
    errors: {
      http4xx: total4xx,
      http5xx: total5xx,
      httpErrorRatePct: pct(total4xx + total5xx, totalRequests),
      sendFailures,
      sendFailureRatePct: pct(sendFailures, messageAttempts),
      status: total5xx > 0 || pct(sendFailures, messageAttempts) >= 5 ? 'risk' : 'ok',
      source: 'api_metrics_and_message_log',
    },
    saturation: {
      inFlight,
      uptimeSeconds: Number(metrics.uptimeSeconds ?? 0),
      dlqTotal: Number(dlqSnapshot.lastKnownDlqTotal ?? 0),
      disconnectedSessions: Number(sessionCounts.disconnected ?? 0),
      totalSessions: Number(sessionCounts.total ?? 0),
      status: !dbOk ? 'critical' : inFlight > 0 || Number(dlqSnapshot.lastKnownDlqTotal ?? 0) > 0 ? 'warn' : 'ok',
      source: 'queue_session_and_process_snapshot',
    },
  }

  const dependencies = {
    database: { ok: dbOk, kind: 'sqlite/prisma', probe: 'SELECT 1' },
    api: { ok: true, uptimeSeconds: metrics.uptimeSeconds ?? 0, totalRequests },
    redis: { ok: SUPERVISOR_MODE !== 'remote' || Boolean(supervisor.redisAvailable), available: Boolean(supervisor.redisAvailable), requiredForRemoteSupervisor: SUPERVISOR_MODE === 'remote' },
    supervisor: { mode: SUPERVISOR_MODE, alive: supervisorAlive, ok: SUPERVISOR_MODE !== 'remote' || supervisorAlive === true },
  }

  const queues = {
    offerQueueItems: queueCounts,
    paymentWebhookDlq: { open: dlqOpen ?? 0 },
    sendDlq: dlqSnapshot,
  }

  const database = {
    ok: dbOk,
    provider: 'sqlite',
    operationalSignals: metrics.operationalSignals ?? {},
  }

  const privacy = {
    mode: 'admin_observability_safe_summary',
    exposesRawMessageText: false,
    exposesRawCredentialData: false,
    notes: [
      'Payload agregado para observabilidade; não incluir messageText, cookies, tokens ou secrets.',
      'Drill-downs devem preferir ids internos, hash/alias de JID e URLs redigidas.',
    ],
  }

  const goNoGo = {
    dbOk,
    has5xx: total5xx > 0,
    paymentDlqOpen: dlqOpen ?? 0,
    sendDlqTotal: dlqSnapshot.lastKnownDlqTotal ?? 0,
    uptimeSeconds: metrics.uptimeSeconds ?? 0,
    sessionOwnerMismatchTotal,
    sessionCircuitBreakerAlertTotal,
    recommended: dbOk && total5xx === 0 && (dlqOpen ?? 0) === 0 && (dlqSnapshot.lastKnownDlqTotal ?? 0) === 0 && sessionCircuitBreakerAlertTotal === 0 && (SUPERVISOR_MODE !== 'remote' || supervisorAlive === true) ? 'go' : 'no-go',
  }

  return {
    checkedAt,
    version: 2,
    goldenSignals,
    dependencies,
    alerts,
    queues,
    supervisor: {
      ...supervisor,
      mode: SUPERVISOR_MODE,
      alive: supervisorAlive,
      sessionOwnerMismatchTotal,
      sessionCircuitBreakerAlertTotal,
      sessionQuarantineTotal,
    },
    database,
    privacy,
    windows,
    goNoGo,
    api: metrics,
  }
}

async function listLpPlansSafe() {
  try {
    return await db.lpPlan.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] })
  } catch (err) {
    const message = String(err?.message ?? '')
    const knownSchemaError =
      message.includes('no such table') ||
      message.includes('does not exist in the current database') ||
      message.includes('Unknown field') ||
      message.includes('Unknown argument')

    if (knownSchemaError) return null
    throw err
  }
}

async function getTutorialContentSafe() {
  try {
    if (!db.tutorialContent || typeof db.tutorialContent.findUnique !== 'function') return null
    const tutorial = await db.tutorialContent.findUnique({ where: { id: 'dashboard_tutorial' } })
    if (!tutorial) return null
    let images = []
    try { images = JSON.parse(String(tutorial.images ?? '[]')) } catch {}
    return { ...tutorial, images: Array.isArray(images) ? images : [] }
  } catch (err) {
    const message = String(err?.message ?? '')
    const knownSchemaError =
      message.includes('no such table') ||
      message.includes('does not exist in the current database') ||
      message.includes('Unknown field') ||
      message.includes('Unknown argument')
    if (knownSchemaError) return null
    throw err
  }
}


function parseContactLogInput(body = {}) {
  const channel = String(body.channel ?? 'whatsapp').trim()
  const reason = String(body.reason ?? '').trim()
  const outcome = String(body.outcome ?? 'contacted').trim()
  const notes = body.notes === undefined ? null : String(body.notes).trim()
  const nextFollowUpRaw = body.nextFollowUpAt === undefined || body.nextFollowUpAt === '' ? undefined : String(body.nextFollowUpAt)

  if (!['whatsapp', 'email', 'phone', 'internal'].includes(channel)) {
    return { ok: false, error: 'Canal inválido. Use whatsapp, email, phone ou internal.' }
  }
  if (!reason || reason.length < 3) return { ok: false, error: 'Motivo obrigatório com pelo menos 3 caracteres.' }
  if (!['contacted', 'no_response', 'resolved', 'follow_up', 'not_applicable'].includes(outcome)) {
    return { ok: false, error: 'Resultado inválido.' }
  }

  let nextFollowUpAt = null
  if (nextFollowUpRaw !== undefined) {
    nextFollowUpAt = new Date(nextFollowUpRaw)
    if (Number.isNaN(nextFollowUpAt.getTime())) return { ok: false, error: 'Data de follow-up inválida.' }
  }

  return { ok: true, data: { channel, reason, outcome, notes: notes || null, nextFollowUpAt } }
}

function getCustomerSuccessReasons({ user, riskFlags = [], errorCount24h = 0 }) {
  const reasons = []
  if (!user.contactPhone) reasons.push('missing_phone')
  if (riskFlags.includes('paid_stale_48h')) reasons.push('paid_stale_48h')
  if (riskFlags.includes('wa_disconnected')) reasons.push('wa_disconnected')
  if (riskFlags.includes('no_success_log')) reasons.push('no_first_success')
  if (riskFlags.includes('no_credentials') || riskFlags.includes('no_monitor_group') || riskFlags.includes('no_post_group')) reasons.push('onboarding_incomplete')
  if (riskFlags.includes('expiring_soon')) reasons.push('expiring_soon')
  if (errorCount24h >= 5) reasons.push('high_errors_24h')
  return [...new Set(reasons)]
}

function getAccessStatus(user, now = new Date()) {
  if (user.status === 'banned' || user.status === 'suspended') return user.status
  if (user.accessExpiresAt && user.accessExpiresAt < now) return 'expired'
  if (user.plan === 'trial') return 'trial'
  return 'active'
}

function buildRiskFlags({ user, groups, successCount = 0, errorCount = 0, now = new Date(), running = false }) {
  const groupCounts = getGroupCounts(groups)
  const flags = []
  const expiresSoon = user.accessExpiresAt && user.accessExpiresAt > now && user.accessExpiresAt <= addDays(now, 7)
  const stale = !user.lastActivityAt || user.lastActivityAt < addDays(now, -2)

  if (!user.contactPhone) flags.push('missing_phone')
  if (user.status === 'banned' || user.status === 'suspended') flags.push(user.status)
  if (user.accessExpiresAt && user.accessExpiresAt < now) flags.push('expired')
  if (expiresSoon) flags.push('expiring_soon')
  if (PAID_PLANS.includes(user.plan) && stale) flags.push('paid_stale_48h')
  if (!running && PAID_PLANS.includes(user.plan)) flags.push('bot_not_running')
  if (!user.waSession || user.waSession.status !== 'connected') flags.push('wa_disconnected')
  if (!user._count?.credentials) flags.push('no_credentials')
  if (!groupCounts.monitor) flags.push('no_monitor_group')
  if (!groupCounts.post) flags.push('no_post_group')
  if (!successCount) flags.push('no_success_log')
  if (errorCount >= 5) flags.push('high_errors_24h')

  return flags
}



export function getSuggestedAction(contactReasons = []) {
  if (contactReasons.includes('wa_disconnected')) return 'Reconectar WhatsApp e validar sessão'
  if (contactReasons.includes('onboarding_incomplete')) return 'Concluir onboarding (credenciais e grupos)'
  if (contactReasons.includes('high_errors_24h')) return 'Investigar erros e estabilizar envios'
  if (contactReasons.includes('expiring_soon')) return 'Contatar para renovação antes do vencimento'
  if (contactReasons.includes('paid_stale_48h')) return 'Reengajar uso com acompanhamento guiado'
  if (contactReasons.includes('no_first_success')) return 'Executar primeiro envio assistido'
  if (contactReasons.includes('missing_phone')) return 'Atualizar celular para contato ativo'
  return 'Realizar contato de diagnóstico'
}

export function computePriorityScore({ riskFlags = [], errorCount24h = 0, accessExpiresAt = null, lastSupportContactAt = null, financialWeight = 0 }) {
  let score = 0
  score += Math.min(60, (riskFlags || []).length * 10)
  if (errorCount24h >= 5) score += 10
  if (accessExpiresAt) {
    const daysToExpire = Math.ceil((new Date(accessExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    if (daysToExpire <= 3) score += 20
    else if (daysToExpire <= 7) score += 10
  }
  if (!lastSupportContactAt) score += 10
  score += Math.min(20, Number(financialWeight || 0))
  return Math.max(0, Math.min(100, score))
}


export function scoreFinancialWeight(user) {
  const planWeight = user.plan === 'pro' ? 20 : user.plan === 'basic' ? 12 : 4
  const paymentsWeight = Number(user?._count?.payments || 0) > 0 ? 10 : 0
  return planWeight + paymentsWeight
}

export function selectContactExperimentVariant(userId = '', strategy = 'risk_first') {
  const seed = String(userId || '')
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash) + seed.charCodeAt(i)
  const bucket = Math.abs(hash) % 2
  if (strategy === 'value_first') return bucket === 0 ? 'value_copy_a' : 'value_copy_b'
  return bucket === 0 ? 'risk_copy_a' : 'risk_copy_b'
}
function sanitizeUser(user, role) {
  return {
    ...user,
    contactPhone: canSeePhone(role) ? user.contactPhone : maskPhone(user.contactPhone),
    waSession: user.waSession
      ? { ...user.waSession, phone: canSeePhone(role) ? user.waSession.phone : maskPhone(user.waSession.phone) }
      : null,
  }
}


async function getLogActivityMap({ userIds = null }) {
  if (Array.isArray(userIds) && userIds.length === 0) return new Map()
  const rows = await db.messageLog.groupBy({
    by: ['userId'],
    where: {
      ...(Array.isArray(userIds) ? { userId: { in: userIds } } : {}),
    },
    _max: { sentAt: true },
  })
  return new Map(rows.map(row => [row.userId, row._max.sentAt]))
}

function resolveEffectiveLastActivity(user, lastMessageAt = null) {
  if (!lastMessageAt) return user.lastActivityAt ?? null
  if (!user.lastActivityAt) return lastMessageAt
  return user.lastActivityAt > lastMessageAt ? user.lastActivityAt : lastMessageAt
}

async function getLogCountMap({ status, since, userIds = null }) {
  if (Array.isArray(userIds) && userIds.length === 0) return new Map()
  const rows = await db.messageLog.groupBy({
    by: ['userId'],
    where: {
      ...(status ? { status } : {}),
      ...(since ? { sentAt: { gte: since } } : {}),
      ...(Array.isArray(userIds) ? { userId: { in: userIds } } : {}),
    },
    _count: { _all: true },
  })
  return new Map(rows.map(row => [row.userId, row._count._all]))
}

export async function writeAdminAuditLog(req, data) {
  return db.adminAuditLog.create({
    data: {
      adminUserId: req.admin?.adminUserId ?? null,
      actorUserId: req.user?.sub ?? null,
      targetUserId: data.targetUserId ?? null,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId ?? null,
      before: serializeAuditValue(data.before),
      after: serializeAuditValue(data.after),
      reason: data.reason ?? null,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'] ?? null,
      status: data.status ?? 'success',
    },
  }).catch(err => {
    req.log?.error?.({ err: err.message, action: data.action }, 'Falha ao gravar audit log admin')
  })
}

async function requireAdmin(req, reply, permission = 'admin:read') {
  const user = await db.user.findUnique({
    where: { id: req.user.sub },
    select: {
      id: true,
      email: true,
      status: true,
      adminUser: { select: { id: true, role: true, status: true } },
    },
  })

  const adminAccess = resolveAdminAccess(user)
  const role = adminAccess.role

  if (!role || !hasPermission(role, permission)) {
    await writeAdminAuditLog(req, {
      action: 'admin.access_denied',
      resource: 'admin',
      reason: `Permissão exigida: ${permission}`,
      status: 'denied',
    })
    reply.code(403).send({ error: 'Acesso admin negado' })
    return false
  }
  if (requiresStepUpMfa(permission) && !isMfaVerified(req)) {
    await writeAdminAuditLog(req, {
      action: 'admin.mfa_required',
      resource: 'admin',
      reason: `MFA obrigatória para permissão: ${permission}`,
      status: 'denied',
    })
    reply.code(401).send({ error: 'MFA obrigatória para esta operação administrativa' })
    return false
  }

  req.admin = {
    email: user.email,
    role,
    permissions: ROLE_PERMISSIONS[role],
    adminUserId: adminAccess.adminUserId,
    bootstrap: adminAccess.bootstrap,
  }
  return true
}

async function getOperationalOverview(now = new Date()) {
  const inSevenDays = addDays(now, 7)
  const twoDaysAgo = addDays(now, -2)
  const since24h = addDays(now, -1)
  const runningUserIds = await listRunningBots()

  const [
    totalUsers,
    activeUsers,
    usersWithoutPhone,
    paidActiveUsers,
    expiringInSevenDays,
    staleOperationalUsers,
    pendingPayments,
    approvedPayments30d,
    messages24h,
    errors24h,
    connectedSessions,
    disconnectedSessions,
    missingCredentials,
    usersWithMonitorGroup,
    usersWithPostGroup,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { status: 'active' } }),
    db.user.count({ where: { contactPhone: null } }),
    db.user.count({ where: { status: 'active', plan: { in: PAID_PLANS }, accessExpiresAt: { gt: now } } }),
    db.user.count({ where: { status: 'active', accessExpiresAt: { gt: now, lte: inSevenDays } } }),
    db.user.count({ where: { status: 'active', plan: { in: PAID_PLANS }, OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: twoDaysAgo } }] } }),
    db.payment.count({ where: { status: 'pending' } }),
    db.payment.aggregate({ where: { status: 'approved', createdAt: { gte: addDays(now, -30) } }, _sum: { amount: true } }),
    db.messageLog.count({ where: { sentAt: { gte: since24h } } }),
    db.messageLog.count({ where: { status: 'error', sentAt: { gte: since24h } } }),
    db.waSession.count({ where: { status: 'connected' } }),
    db.waSession.count({ where: { status: { not: 'connected' } } }),
    db.user.count({ where: { credentials: { none: {} } } }),
    db.user.count({ where: { groups: { some: { role: 'monitor' } } } }),
    db.user.count({ where: { groups: { some: { role: 'post' } } } }),
  ])

  const usersMissingMonitorGroup = Math.max(totalUsers - usersWithMonitorGroup, 0)
  const usersMissingPostGroup = Math.max(totalUsers - usersWithPostGroup, 0)

  return {
    totalUsers,
    activeUsers,
    usersWithoutPhone,
    paidActiveUsers,
    expiringInSevenDays,
    staleOperationalUsers,
    pendingPayments,
    revenue30d: approvedPayments30d._sum.amount ?? 0,
    messages24h,
    errors24h,
    successRate24h: messages24h ? Math.round(((messages24h - errors24h) / messages24h) * 10000) / 100 : null,
    connectedSessions,
    disconnectedSessions,
    botRunningUsers: runningUserIds.length,
    missingCredentials,
    usersMissingMonitorGroup,
    usersMissingPostGroup,
  }
}

function countRowsByUserAndType(rows = []) {
  const out = new Map()
  for (const row of rows) {
    const userMap = out.get(row.userId) || {}
    userMap[row.type] = (userMap[row.type] || 0) + Number(row._count?._all ?? 0)
    out.set(row.userId, userMap)
  }
  return out
}

function safeIsoDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}


function isSessionOnline(session, now = new Date()) {
  if (!session) return false
  if (session.status === 'connected') return true
  const heartbeatAt = session.lastHeartbeatAt ? new Date(session.lastHeartbeatAt).getTime() : 0
  const heartbeatFresh = heartbeatAt && now.getTime() - heartbeatAt <= 2 * 60_000
  return session.status === 'connecting' && heartbeatFresh && ['connecting', 'reconnecting'].includes(session.lifecycle)
}

// Cenários da frota para os PRIMEIROS cards do admin (Fase 1B do plano de
// recepção, RCA 2026-08-26). Cada número responde uma pergunta operacional
// diferente e leva para a aba online já filtrada:
//   semReceber     — conectado e sem receber (o "verde mentiroso")
//   caindoDemais   — quedas acima do normal em 24h
//   clienteAgiu    — precisou re-parear: é o número que mede a promessa
//   fonteQuebrada  — auto-refresh não resolveu a dessincronização
//   offlineMs24h   — tempo total da frota fora do ar
// Custo bounded: três groupBy e uma varredura de 48h dos eventos de conexão
// (a mesma janela que a listagem já usa).
const FLEET_DROPS_ALERT_24H = Math.max(1, Number(process.env.ADMIN_DROPS_ALERT_24H || 20))
const FLEET_RECEPTION_BLIND_WINDOW_MS = Math.max(10 * 60_000, Number(process.env.ADMIN_RECEPTION_BLIND_WINDOW_MS || 60 * 60_000))

async function buildFleetScenarios(now = new Date()) {
  const since24h = addDays(now, -1)
  const since7d = addDays(now, -7)
  const blindSince = new Date(now.getTime() - FLEET_RECEPTION_BLIND_WINDOW_MS)

  const [dropRows, manualRows, blindRows, desyncRows, offlineEvents, sessions, runningIds] = await Promise.all([
    db.waConnectionEvent.groupBy({
      by: ['userId'],
      where: { type: { in: ['disconnect', 'disconnect_terminal'] }, occurredAt: { gte: since24h, lte: now } },
      _count: { _all: true },
    }).catch(() => []),
    db.waConnectionEvent.findMany({
      where: { type: { in: ['manual_reconnect_requested', 'manual_pairing_requested'] }, occurredAt: { gte: since24h, lte: now } },
      select: { userId: true },
      distinct: ['userId'],
    }).catch(() => []),
    db.analyticsEvent.findMany({
      where: { event: 'ops_wa_reception_blind', createdAt: { gte: blindSince, lte: now } },
      select: { userId: true },
      distinct: ['userId'],
    }).catch(() => []),
    db.analyticsEvent.findMany({
      where: { event: 'ops_wa_group_desync_unresolved', createdAt: { gte: since7d, lte: now } },
      select: { userId: true },
      distinct: ['userId'],
    }).catch(() => []),
    db.waConnectionEvent.findMany({
      where: { type: { in: OFFLINE_EPISODE_EVENT_TYPES }, occurredAt: { gte: addDays(now, -2), lte: now } },
      orderBy: { occurredAt: 'asc' },
      select: { userId: true, type: true, code: true, metadata: true, occurredAt: true },
    }).catch(() => []),
    db.waSession.findMany({
      where: { user: { status: 'active' } },
      select: { userId: true, status: true, lifecycle: true, lastDisconnectCode: true, lastHeartbeatAt: true },
    }).catch(() => []),
    listRunningBots().then(ids => new Set(ids)).catch(() => null),
  ])

  // Quem resolve cada desconexão. O balde que interessa aqui é `ninguem`:
  // sessão caída, sem robô no ar e sem heartbeat — ninguém está tentando, e
  // era o caso que passava despercebido (13 robôs no ar para 67 caídas).
  const lastEventByUser = new Map()
  for (const event of offlineEvents) {
    const previous = lastEventByUser.get(event.userId)
    if (!previous || new Date(event.occurredAt).getTime() >= new Date(previous.occurredAt).getTime()) {
      lastEventByUser.set(event.userId, event)
    }
  }
  const paradas = new Set()
  const precisamDaCliente = new Set()
  for (const session of sessions) {
    const ownership = resolveSessionOwner({
      status: session.status,
      lifecycle: session.lifecycle,
      lastDisconnectCode: session.lastDisconnectCode,
      lastEventType: lastEventByUser.get(session.userId)?.type ?? null,
      workerRunning: runningIds ? runningIds.has(session.userId) : null,
      lastHeartbeatAt: session.lastHeartbeatAt,
      now: now.getTime(),
    })
    if (ownership.owner === SESSION_OWNER.NOBODY) paradas.add(session.userId)
    else if (ownership.owner === SESSION_OWNER.CLIENT) precisamDaCliente.add(session.userId)
  }

  const metricsByUser = summarizeOfflineEpisodesByUser(offlineEvents, { since: since24h, now })
  let offlineMs24h = 0
  let manualOfflineMs24h = 0
  for (const metrics of metricsByUser.values()) {
    offlineMs24h += Number(metrics.automaticOfflineMs || 0) + Number(metrics.manualOfflineMs || 0) + Number(metrics.ongoingOfflineMs || 0)
    manualOfflineMs24h += Number(metrics.manualOfflineMs || 0)
  }

  const byScenario = {
    parado: paradas,
    qr: precisamDaCliente,
    blind: new Set(blindRows.map(row => row.userId).filter(Boolean)),
    quedas: new Set(dropRows.filter(row => Number(row._count?._all ?? 0) >= FLEET_DROPS_ALERT_24H).map(row => row.userId).filter(Boolean)),
    manual: new Set(manualRows.map(row => row.userId).filter(Boolean)),
    desync: new Set(desyncRows.map(row => row.userId).filter(Boolean)),
  }

  return {
    byScenario,
    paradasSemNinguem: paradas.size,
    precisamDeQr: precisamDaCliente.size,
    semReceber: blindRows.filter(row => row.userId).length,
    caindoDemais: dropRows.filter(row => Number(row._count?._all ?? 0) >= FLEET_DROPS_ALERT_24H).length,
    clienteAgiu: manualRows.filter(row => row.userId).length,
    fonteQuebrada: desyncRows.filter(row => row.userId).length,
    offlineMs24h,
    manualOfflineMs24h,
    dropsAlertThreshold: FLEET_DROPS_ALERT_24H,
    blindWindowMs: FLEET_RECEPTION_BLIND_WINDOW_MS,
  }
}

async function buildAdminOnlineOverview({ query = {}, adminRole = 'support' } = {}) {
  const now = new Date()
  const since24h = addDays(now, -1)
  const limit = Math.min(Math.max(Number(query.limit ?? 80), 1), 200)
  const search = String(query.search ?? '').trim()
  const plan = String(query.plan ?? 'all').trim().toLowerCase()
  const waStatus = String(query.waStatus ?? 'all').trim().toLowerCase()
  const activity = String(query.activity ?? 'all').trim().toLowerCase()
  const minErrors = Math.max(0, Number(query.minErrors ?? 0) || 0)
  const running = new Set(await listRunningBots())

  const where = {
    status: 'active',
    ...(plan !== 'all' && ['trial', 'basic', 'pro'].includes(plan) ? { plan } : {}),
    ...(search ? { OR: [{ email: { contains: search } }, { name: { contains: search } }] } : {}),
  }

  const [users, allActiveSessions] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ lastActivityAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        contactPhone: true,
        status: true,
        plan: true,
        lastActivityAt: true,
        createdAt: true,
        waSession: {
          select: {
            status: true,
            lifecycle: true,
            phone: true,
            ownerInstance: true,
            lastHeartbeatAt: true,
            lastDisconnectCode: true,
            updatedAt: true,
          },
        },
      },
    }),
    db.waSession.findMany({
      where: { user: { status: 'active' } },
      select: { status: true, lifecycle: true, lastHeartbeatAt: true },
    }).catch(() => []),
  ])
  const userIds = users.map(user => user.id)
  const [eventCounts24hRows, offlineEvents24h, successMap24h, errorMap24h, lastMessageMap] = await Promise.all([
    userIds.length ? db.waConnectionEvent.groupBy({
      by: ['userId', 'type'],
      where: { userId: { in: userIds }, occurredAt: { gte: since24h } },
      _count: { _all: true },
    }).catch(() => []) : [],
    // Busca com FOLGA (48h) e recorta em 24h no cálculo: um episódio que
    // começou antes da janela precisa achar o par para não sumir da conta
    // (defeito 2 do RCA 2026-08-26).
    userIds.length ? db.waConnectionEvent.findMany({
      where: { userId: { in: userIds }, occurredAt: { gte: addDays(now, -2), lte: now }, type: { in: OFFLINE_EPISODE_EVENT_TYPES } },
      orderBy: { occurredAt: 'asc' },
      select: { userId: true, type: true, code: true, metadata: true, occurredAt: true },
    }).catch(() => []) : [],
    getLogCountMap({ status: 'success', since: since24h, userIds }),
    getLogCountMap({ status: 'error', since: since24h, userIds }),
    getLogActivityMap({ userIds }),
  ])

  // Último evento de conexão por usuário — é o que separa "o robô está
  // tentando" de "precisa da cliente" e de "ninguém está tentando".
  const lastEventByUser = new Map()
  for (const event of offlineEvents24h) {
    const previous = lastEventByUser.get(event.userId)
    if (!previous || new Date(event.occurredAt).getTime() >= new Date(previous.occurredAt).getTime()) {
      lastEventByUser.set(event.userId, event)
    }
  }

  const scenarios = await buildFleetScenarios(now).catch(() => null)
  const scenarioFilter = String(query.cenario || '').trim()
  const scenarioUserIds = scenarios?.byScenario?.[scenarioFilter] ?? null
  const eventCounts24h = countRowsByUserAndType(eventCounts24hRows)
  const offlineMetrics24h = summarizeOfflineEpisodesByUser(offlineEvents24h, { since: since24h, now })
  const rows = users.map(user => {
    const session = user.waSession
    const counts = eventCounts24h.get(user.id) || {}
    const disconnects24h = Number(counts.disconnect || 0) + Number(counts.disconnect_terminal || 0)
    const reconnectAttempts24h = Number(counts.reconnect_attempt || 0)
    const reconnectSuccess24h = Number(counts.reconnect_success || 0)
    const lastMessageAt = lastMessageMap.get(user.id) ?? null
    const effectiveLastActivityAt = resolveEffectiveLastActivity(user, lastMessageAt)
    const online = isSessionOnline(session, now)
    const ownership = resolveSessionOwner({
      status: session?.status ?? 'disconnected',
      lifecycle: session?.lifecycle ?? null,
      lastDisconnectCode: session?.lastDisconnectCode ?? null,
      lastEventType: lastEventByUser.get(user.id)?.type ?? null,
      workerRunning: running.has(user.id),
      lastHeartbeatAt: session?.lastHeartbeatAt ?? null,
      now: now.getTime(),
    })
    const successCount24h = successMap24h.get(user.id) ?? 0
    const errorCount24h = errorMap24h.get(user.id) ?? 0
    const offline24h = offlineMetrics24h.get(user.id) || {}
    return sanitizeUser({
      id: user.id,
      name: user.name,
      email: user.email,
      contactPhone: user.contactPhone,
      status: user.status,
      plan: user.plan,
      lastActivityAt: user.lastActivityAt,
      createdAt: user.createdAt,
      effectiveLastActivityAt,
      lastMessageAt,
      botRunning: running.has(user.id),
      online,
      recentErrors: errorCount24h,
      successCount24h,
      errorCount24h,
      disconnects24h,
      reconnectAttempts24h,
      reconnectSuccess24h,
      sessionOwner: ownership.owner,
      sessionOwnerReason: ownership.reason,
      canAdminRetry: ownership.canAdminRetry,
      manualReconnects24h: Number(offline24h.manualReconnects || 0),
      manualRecoveries24h: Number(offline24h.manualRecoveries || 0),
      manualOfflineMs24h: Number(offline24h.manualOfflineMs || 0),
      automaticRecoveries24h: Number(offline24h.automaticRecoveries || 0),
      automaticOfflineMs24h: Number(offline24h.automaticOfflineMs || 0),
      ongoingOfflineMs24h: Number(offline24h.ongoingOfflineMs || 0),
      waSession: session,
    }, adminRole)
  }).filter(row => {
    if (scenarioUserIds && !scenarioUserIds.has(row.id)) return false
    const sessionStatus = row.waSession?.status || 'none'
    const isAlert = row.waSession && sessionStatus !== 'connected'
    if (waStatus === 'alerts' && !isAlert) return false
    if (['connected', 'connecting', 'disconnected'].includes(waStatus) && sessionStatus !== waStatus) return false
    if (waStatus === 'without_session' && row.waSession) return false
    if (minErrors > 0 && Number(row.errorCount24h || 0) < minErrors) return false
    if (activity === 'with_sends_24h' && (Number(row.successCount24h || 0) + Number(row.errorCount24h || 0)) <= 0) return false
    if (activity === 'without_activity_24h') {
      const lastAt = row.effectiveLastActivityAt ? new Date(row.effectiveLastActivityAt).getTime() : 0
      if (lastAt && now.getTime() - lastAt <= 24 * 60 * 60_000) return false
    }
    return true
  })

  const totalSessions = allActiveSessions.length
  const onlineUsers = allActiveSessions.filter(session => isSessionOnline(session, now)).length
  const connectingUsers = allActiveSessions.filter(session => session.status === 'connecting').length
  const disconnectedAlerts = allActiveSessions.filter(session => session.status !== 'connected' && session.status !== 'connecting').length
  const stabilityPct = totalSessions ? Math.round((onlineUsers / totalSessions) * 1000) / 10 : 100
  const { byScenario: _byScenario, ...scenarioCounts } = scenarios ?? {}

  return {
    checkedAt: now.toISOString(),
    summary: {
      scenarios: scenarios ? scenarioCounts : null,
      onlineUsers,
      totalSessions,
      stabilityPct,
      disconnectedAlerts,
      connectingUsers,
      activeUsersLoaded: rows.length,
      filters: { search, plan, waStatus, activity, minErrors, cenario: scenarioFilter || 'all' },
    },
    users: rows.sort((a, b) => {
      const priorityA = (a.waSession?.status === 'disconnected' ? 3 : a.waSession?.status === 'connecting' ? 2 : a.recentErrors ? 1 : 0)
      const priorityB = (b.waSession?.status === 'disconnected' ? 3 : b.waSession?.status === 'connecting' ? 2 : b.recentErrors ? 1 : 0)
      return priorityB - priorityA || String(b.effectiveLastActivityAt || '').localeCompare(String(a.effectiveLastActivityAt || ''))
    }),
  }
}

async function buildAdminOnlineUserDetail({ userId, adminRole = 'support' }) {
  const now = new Date()
  const since24h = addDays(now, -1)
  const since7d = addDays(now, -7)
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      contactPhone: true,
      status: true,
      plan: true,
      lastActivityAt: true,
      createdAt: true,
      waSession: {
        select: {
          status: true,
          lifecycle: true,
          phone: true,
          ownerInstance: true,
          lastHeartbeatAt: true,
          lastDisconnectCode: true,
          updatedAt: true,
        },
      },
    },
  })
  if (!user) return null

  const [events24h, events7d, offlineEvents7d, recentEvents, logs, desyncEvents] = await Promise.all([
    db.waConnectionEvent.groupBy({
      by: ['type'],
      where: { userId, occurredAt: { gte: since24h, lte: now } },
      _count: { _all: true },
    }).catch(() => []),
    db.waConnectionEvent.groupBy({
      by: ['type'],
      where: { userId, occurredAt: { gte: since7d, lte: now } },
      _count: { _all: true },
    }).catch(() => []),
    db.waConnectionEvent.findMany({
      where: { userId, occurredAt: { gte: since7d, lte: now }, type: { in: OFFLINE_EPISODE_EVENT_TYPES } },
      orderBy: { occurredAt: 'asc' },
      select: { userId: true, type: true, code: true, metadata: true, occurredAt: true },
    }).catch(() => []),
    db.waConnectionEvent.findMany({
      where: { userId, occurredAt: { gte: since7d, lte: now } },
      orderBy: { occurredAt: 'desc' },
      take: 40,
      select: { id: true, type: true, code: true, lifecycle: true, ownerInstance: true, metadata: true, occurredAt: true },
    }).catch(() => []),
    db.messageLog.findMany({
      where: { userId, sentAt: { gte: since7d, lte: now } },
      orderBy: { sentAt: 'desc' },
      take: 300,
      select: { id: true, status: true, errorMsg: true, platform: true, sentAt: true },
    }),
    db.analyticsEvent.findMany({
      where: { userId, event: { in: ['ops_wa_group_desync_autoheal', 'ops_wa_group_desync_unresolved'] }, createdAt: { gte: since7d, lte: now } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { event: true, metadata: true, createdAt: true },
    }).catch(() => []),
  ])

  const countByType = (rows) => Object.fromEntries(rows.map(row => [row.type, Number(row._count?._all ?? 0)]))
  const counts24h = countByType(events24h)
  const counts7d = countByType(events7d)
  const disconnects24h = Number(counts24h.disconnect || 0) + Number(counts24h.disconnect_terminal || 0)
  const disconnects7d = Number(counts7d.disconnect || 0) + Number(counts7d.disconnect_terminal || 0)
  // Os episódios são montados UMA vez sobre a série inteira; as janelas só
  // recortam o tempo. Filtrar os eventos antes de parear era o defeito 2.
  const offlineEpisodes = buildOfflineEpisodesByUser(offlineEvents7d, { now }).get(userId) || []
  const offlineMetrics24h = summarizeEpisodes(offlineEpisodes, { since: since24h, now })
  const offlineMetrics7d = summarizeEpisodes(offlineEpisodes, { since: since7d, now })

  return {
    checkedAt: now.toISOString(),
    user: sanitizeUser(user, adminRole),
    session: user.waSession,
    online: isSessionOnline(user.waSession, now),
    connectionMetrics: {
      disconnects24h,
      disconnects7d,
      reconnectAttempts24h: Number(counts24h.reconnect_attempt || 0),
      reconnectAttempts7d: Number(counts7d.reconnect_attempt || 0),
      reconnectSuccess24h: Number(counts24h.reconnect_success || 0),
      reconnectSuccess7d: Number(counts7d.reconnect_success || 0),
      manualReconnects24h: Number(offlineMetrics24h.manualReconnects || 0),
      manualReconnects7d: Number(offlineMetrics7d.manualReconnects || 0),
      automaticRecoveries24h: Number(offlineMetrics24h.automaticRecoveries || 0),
      automaticRecoveries7d: Number(offlineMetrics7d.automaticRecoveries || 0),
      automaticOfflineMs24h: Number(offlineMetrics24h.automaticOfflineMs || 0),
      automaticOfflineMs7d: Number(offlineMetrics7d.automaticOfflineMs || 0),
      longestAutomaticOfflineMs24h: Number(offlineMetrics24h.longestAutomaticOfflineMs || 0),
      longestAutomaticOfflineMs7d: Number(offlineMetrics7d.longestAutomaticOfflineMs || 0),
      ongoingOfflineMs24h: Number(offlineMetrics24h.ongoingOfflineMs || 0),
      ongoingOfflineMs7d: Number(offlineMetrics7d.ongoingOfflineMs || 0),
      manualRecoveries24h: Number(offlineMetrics24h.manualRecoveries || 0),
      manualRecoveries7d: Number(offlineMetrics7d.manualRecoveries || 0),
      manualOfflineMs24h: Number(offlineMetrics24h.manualOfflineMs || 0),
      manualOfflineMs7d: Number(offlineMetrics7d.manualOfflineMs || 0),
      longestManualOfflineMs7d: Number(offlineMetrics7d.longestManualOfflineMs || 0),
      terminalEpisodes7d: Number(offlineMetrics7d.terminalEpisodes || 0),
    },
    offlineEpisodes: presentOfflineEpisodes(offlineEpisodes, { limit: 50 }),
    errorsByType: buildErrorsByMessage(logs, { limit: 20 }),
    desyncGroups: summarizeDesyncGroups(desyncEvents, { limit: 10 }),
    recentEvents: recentEvents.map(event => {
      let metadata = {}
      try { metadata = JSON.parse(event.metadata || '{}') } catch {}
      return { ...event, metadata, occurredAt: safeIsoDate(event.occurredAt) }
    }),
  }
}

// listRunningBots pode falhar (supervisor fora do ar); nesse caso devolvemos
// `null` = "não sei", e a política trata como indeterminado em vez de assumir
// que não há robô e oferecer um clique que atropelaria uma reconexão em curso.
async function isRunningSafe(userId) {
  try {
    const ids = await listRunningBots()
    return new Set(ids).has(userId)
  } catch {
    return null
  }
}

export async function adminRoutes(app) {
  const adminService = createAdminService({
    db,
    listRunningBots,
    getOperationalOverview,
    getPagination,
    addDays,
    getLogCountMap,
    getLogActivityMap,
    getGroupCounts,
    getAccessStatus,
    resolveEffectiveLastActivity,
    summarizeCredentialHealth,
    buildRiskFlags,
    sanitizeUser,
    parseDateRange,
  })
  app.addHook('onRequest', app.authenticate)

  app.get('/me', async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return
    return req.admin
  })


  app.get('/pipeline', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'tech:read'))) return
    const pipeline = await readBacklogPipeline()
    await writeAdminAuditLog(req, { action: 'admin.pipeline.read', resource: 'backlogPipeline', after: { total: pipeline.total } })
    return pipeline
  })

  app.patch('/pipeline/issues/:issueId/status', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'tech:write'))) return
    const issueId = String(req.params.issueId ?? '').trim()
    const status = String(req.body?.status ?? '').trim()

    try {
      const pipeline = await updateBacklogIssueStatus({ issueId, status })
      await writeAdminAuditLog(req, { action: 'admin.pipeline.status.update', resource: 'backlogPipeline', resourceId: issueId, after: { status } })
      return pipeline
    } catch (err) {
      const code = err?.code || 'PIPELINE_UPDATE_FAILED'
      const statusCode = ['ISSUE_NOT_FOUND', 'STATUS_LINE_NOT_FOUND', 'ISSUE_BLOCK_CORRUPTED'].includes(code) ? 404 : 400
      return reply.code(statusCode).send({ error: err.message, code })
    }
  })

  app.get('/overview', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:read'))) return
    const overview = await adminService.getOverview()
    await writeAdminAuditLog(req, { action: 'admin.overview.read', resource: 'overview' })
    return overview
  })

  app.get('/users', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'support:read'))) return
    const result = await adminService.listUsers({ query: req.query ?? {}, adminRole: req.admin.role })
    await writeAdminAuditLog(req, { action: 'admin.users.list', resource: 'user' })
    return result
  })

  app.get('/users/wa-disconnected', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'support:read'))) return
    const result = await adminService.listWaDisconnectedUsers({ query: req.query ?? {}, adminRole: req.admin.role })
    await writeAdminAuditLog(req, {
      action: 'admin.users.wa_disconnected.list',
      resource: 'user',
      after: { total: result.total, paidAtRisk: result.summary?.paidAtRisk ?? 0 },
    })
    return result
  })

  app.get('/online', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'support:read'))) return
    const result = await buildAdminOnlineOverview({ query: req.query ?? {}, adminRole: req.admin.role })
    await writeAdminAuditLog(req, {
      action: 'admin.online.read',
      resource: 'waConnectionEvent',
      after: { totalSessions: result.summary.totalSessions, disconnectedAlerts: result.summary.disconnectedAlerts },
    })
    return result
  })

  // Botão "Tentar reconectar" da aba online. Sobe o robô da cliente sem que
  // ela precise fazer nada — só serve quando a credencial ainda existe.
  //
  // Duas travas de propósito:
  //   1. Só age quando `canAdminRetry` é true. Em 401/auth_reset o robô até
  //      sobe, mas o que ele gera é um QR que SÓ a cliente pode ler no celular
  //      dela — deixar o botão "funcionar" ali prometeria o que não entrega.
  //   2. Grava evento PRÓPRIO (`admin_reconnect_requested`), nunca
  //      `manual_reconnect_requested`. Se o nosso clique contasse como ação da
  //      cliente, o card "Cliente teve que agir" — que mede a promessa do
  //      produto — viraria mentira.
  app.post('/online/:userId/reconnect', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'tech:write'))) return
    const userId = String(req.params.userId || '')
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, plan: true, accessExpiresAt: true },
    }).catch(() => null)
    if (!user) return reply.code(404).send({ error: 'Cliente não encontrado' })
    if (user.status !== 'active') return reply.code(409).send({ error: 'A conta não está ativa' })

    const [session, running, lastEvent] = await Promise.all([
      db.waSession.findUnique({ where: { userId }, select: { status: true, lifecycle: true, lastDisconnectCode: true, lastHeartbeatAt: true } }).catch(() => null),
      isRunningSafe(userId),
      db.waConnectionEvent.findFirst({ where: { userId }, orderBy: { occurredAt: 'desc' }, select: { type: true } }).catch(() => null),
    ])

    const ownership = resolveSessionOwner({
      status: session?.status ?? 'disconnected',
      lifecycle: session?.lifecycle ?? null,
      lastDisconnectCode: session?.lastDisconnectCode ?? null,
      lastEventType: lastEvent?.type ?? null,
      workerRunning: running,
      lastHeartbeatAt: session?.lastHeartbeatAt ?? null,
    })
    if (!ownership.canAdminRetry) {
      return reply.code(409).send({ error: 'Reconectar daqui não resolve este caso', motivo: ownership.reason, owner: ownership.owner })
    }

    recordWaConnectionEventSafe({
      userId,
      type: 'admin_reconnect_requested',
      lifecycle: session?.lifecycle ?? null,
      metadata: { source: 'admin', owner: ownership.owner, adminId: req.admin?.id ?? null },
    })

    try {
      await startBot(userId)
    } catch (err) {
      await writeAdminAuditLog(req, { action: 'admin.online.reconnect_failed', resource: 'waSession', targetUserId: userId, after: { error: String(err?.message ?? err) } })
      return reply.code(502).send({ error: 'Não consegui subir o robô agora', detalhe: String(err?.message ?? err) })
    }

    await writeAdminAuditLog(req, {
      action: 'admin.online.reconnect',
      resource: 'waSession',
      targetUserId: userId,
      after: { owner: ownership.owner, previousStatus: session?.status ?? null },
    })
    return { ok: true, owner: ownership.owner, message: 'Robô iniciado — acompanhe o status nos próximos minutos' }
  })

  app.get('/online/:userId', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'support:read'))) return
    const result = await buildAdminOnlineUserDetail({ userId: req.params.userId, adminRole: req.admin.role })
    if (!result) return reply.code(404).send({ error: 'Cliente não encontrado' })
    await writeAdminAuditLog(req, {
      action: 'admin.online.user_detail',
      resource: 'waConnectionEvent',
      targetUserId: req.params.userId,
      after: { disconnects24h: result.connectionMetrics.disconnects24h, reconnectAttempts24h: result.connectionMetrics.reconnectAttempts24h },
    })
    return result
  })


  app.get('/system/health', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'tech:read'))) return

    const memory = process.memoryUsage()
    const cpu = process.cpuUsage()
    const [dbOk, messageLogCount, userCount, runningBotsList] = await Promise.all([
      db.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      db.messageLog.count().catch(() => null),
      db.user.count().catch(() => null),
      Promise.resolve(listRunningBots()).catch(() => []),
    ])
    const metrics = getApiMetricsSnapshot()
    const status = dbOk && metrics.total5xx === 0 ? 'ok' : dbOk ? 'degraded' : 'critical'

    await writeAdminAuditLog(req, { action: 'admin.system.health.read', resource: 'systemHealth' })

    return {
      status,
      dbOk,
      nodeEnv: process.env.NODE_ENV || 'development',
      pid: process.pid,
      uptimeSeconds: metrics.uptimeSeconds,
      memory: {
        rssMb: Math.round(memory.rss / 1024 / 1024),
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
      },
      cpu,
      counts: { users: userCount, messageLogs: messageLogCount, runningBots: (runningBotsList ?? []).length },
      api: {
        totalRequests: metrics.totalRequests,
        total4xx: metrics.total4xx,
        total5xx: metrics.total5xx,
        avgLatencyMs: metrics.avgLatencyMs,
        p95RouteAvgMs: metrics.p95RouteAvgMs,
      },
    }
  })

  app.get('/system/metrics', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'tech:read'))) return
    const metrics = getApiMetricsSnapshot()
    await writeAdminAuditLog(req, { action: 'admin.system.metrics.read', resource: 'apiMetrics' })
    return metrics
  })

  // Contrato estruturado de observabilidade para /admin/observabilidade.
  // Mantém compatibilidade com os campos legados (`alerts`, `goNoGo`, `api`,
  // `supervisor`) e adiciona a forma canônica da Fase 1: Golden Signals,
  // dependências, filas, banco e privacidade.
  app.get('/system/observability', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'tech:read'))) return
    const metrics = getApiMetricsSnapshot()
    const now = new Date()
    const since24h = addDays(now, -1)
    const checkedAt = now.toISOString()
    const dlqSnapshot = getDlqMaintenanceSnapshot()

    const [dlqOpen, dbOk, supervisor, supervisorAlive, queueStatusRows, sessionStatusRows, recentLogs] = await Promise.all([
      db.paymentWebhookDlq.count({ where: { resolvedAt: null } }).catch(() => null),
      db.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      getSupervisorOperationalCounters(),
      isSupervisorAlive(),
      db.offerQueueItem.groupBy({ by: ['status'], _count: { _all: true } }).catch(() => []),
      db.waSession.groupBy({ by: ['status'], _count: { _all: true } }).catch(() => []),
      db.messageLog.findMany({
        where: { sentAt: { gte: since24h, lte: now } },
        select: { status: true, errorMsg: true, sentAt: true },
      }).catch(() => []),
    ])

    const queueCounts = { pending: 0, queued: 0, sending: 0, sent: 0, cancelled: 0, error: 0, failed: 0, total: 0 }
    for (const row of queueStatusRows) {
      const key = String(row.status || 'unknown')
      const count = Number(row._count?._all ?? 0)
      queueCounts[key] = (queueCounts[key] || 0) + count
      queueCounts.total += count
    }

    const sessionCounts = { total: 0, connected: 0, disconnected: 0, other: 0 }
    for (const row of sessionStatusRows) {
      const key = String(row.status || 'unknown')
      const count = Number(row._count?._all ?? 0)
      sessionCounts.total += count
      if (key === 'connected') sessionCounts.connected += count
      else if (key === 'disconnected') sessionCounts.disconnected += count
      else sessionCounts.other += count
    }

    const windows = buildOperationalWindows(recentLogs, now)
    const logCounts = windows['24h']?.logs ?? emptyOperationalLogCounts()

    const contract = buildAdminObservabilityContract({
      checkedAt,
      metrics,
      dbOk,
      dlqOpen,
      supervisor,
      supervisorAlive,
      dlqSnapshot,
      queueCounts,
      sessionCounts,
      logCounts,
      windows,
    })

    await writeAdminAuditLog(req, { action: 'admin.system.observability.read', resource: 'systemObservability', after: { version: contract.version, alertCount: contract.alerts.length } })
    return contract
  })

  app.get('/success/overview', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'support:read'))) return

    const now = new Date()
    const since24h = addDays(now, -1)
    const sinceToday = new Date(now)
    sinceToday.setHours(0, 0, 0, 0)

    const [
      contactsToday,
      followUpsDue,
      missingPhone,
      paidStale48h,
      onboardingIncomplete,
      expiringSoon,
      errors24h,
    ] = await Promise.all([
      db.customerContactLog.count({ where: { createdAt: { gte: sinceToday } } }),
      db.customerContactLog.count({ where: { outcome: 'follow_up', nextFollowUpAt: { lte: now } } }),
      db.user.count({ where: { status: 'active', contactPhone: null } }),
      db.user.count({ where: { status: 'active', plan: { in: PAID_PLANS }, OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: addDays(now, -2) } }] } }),
      db.user.count({ where: { status: 'active', OR: [{ credentials: { none: {} } }, { groups: { none: { role: 'monitor' } } }, { groups: { none: { role: 'post' } } }] } }),
      db.user.count({ where: { status: 'active', accessExpiresAt: { gt: now, lte: addDays(now, 7) } } }),
      db.messageLog.groupBy({ by: ['userId'], where: { status: 'error', sentAt: { gte: since24h } }, _count: { _all: true } }),
    ])

    await writeAdminAuditLog(req, { action: 'admin.success.overview.read', resource: 'customerSuccess' })

    return {
      contactsToday,
      followUpsDue,
      missingPhone,
      paidStale48h,
      onboardingIncomplete,
      expiringSoon,
      highErrorUsers24h: errors24h.filter(row => row._count._all >= 5).length,
    }
  })

  app.get('/success/queue', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'support:read'))) return

    const { limit = '25', reason = 'all', strategy = 'risk_first' } = req.query
    const limitNum = Math.min(EXPORT_LIMIT, Math.max(1, parseInt(limit) || 25))
    const now = new Date()
    const since24h = addDays(now, -1)
    const running = new Set(await listRunningBots())

    const [users, successMap, errorMap] = await Promise.all([
      db.user.findMany({
        where: { status: 'active' },
        orderBy: [{ lastSupportContactAt: 'asc' }, { lastActivityAt: 'asc' }],
        take: EXPORT_LIMIT,
        select: {
          id: true,
          email: true,
          contactPhone: true,
          status: true,
          plan: true,
          accessExpiresAt: true,
          createdAt: true,
          lastActivityAt: true,
          lastSupportContactAt: true,
          supportStatus: true,
          waSession: { select: { status: true, phone: true, updatedAt: true } },
          groups: { select: { role: true } },
          customerContacts: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { credentials: true, messageLogs: true, payments: true } },
        },
      }),
      getLogCountMap({ status: 'success' }),
      getLogCountMap({ status: 'error', since: since24h }),
    ])
    const lastMessageMap = await getLogActivityMap({ userIds: users.map(user => user.id) })

    const queue = users
      .map(user => {
        const successCount = successMap.get(user.id) ?? 0
        const errorCount24h = errorMap.get(user.id) ?? 0
        const botRunning = running.has(user.id)
        const riskFlags = buildRiskFlags({ user, groups: user.groups, successCount, errorCount: errorCount24h, now, running: botRunning })
        const contactReasons = getCustomerSuccessReasons({ user, riskFlags, errorCount24h })
        const lastContact = user.customerContacts?.[0] ?? null
        const financialWeight = scoreFinancialWeight(user)
        const priorityScore = computePriorityScore({
          riskFlags,
          errorCount24h,
          accessExpiresAt: user.accessExpiresAt,
          lastSupportContactAt: user.lastSupportContactAt,
          financialWeight,
        })
        if (shouldTrackRiskDetected({ userId: user.id, strategy, reasons: contactReasons })) {
          trackAnalyticsEventSafe({ userId: user.id, event: 'cs_risk_detected', metadata: { strategy, reasons: contactReasons.join('|').slice(0, 80) } })
        }
        return sanitizeUser({
          ...user,
          groups: undefined,
          botRunning,
          groupCounts: getGroupCounts(user.groups),
          errorCount24h,
          riskFlags,
          contactReasons,
          lastContact,
          lastMessageAt: lastMessageMap.get(user.id) ?? null,
          suggestedAction: getSuggestedAction(contactReasons),
          priorityScore,
          financialWeight,
          strategy,
          experimentVariant: selectContactExperimentVariant(user.id, strategy),
          riskAgeHours: user.lastActivityAt ? Math.max(0, Math.round((Date.now() - new Date(user.lastActivityAt).getTime()) / (60 * 60 * 1000))) : null,
          customerContacts: undefined,
        }, req.admin.role)
      })
      .filter(user => user.contactReasons.length > 0)
      .filter(user => reason === 'all' || user.contactReasons.includes(reason))
      .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))
      .slice(0, limitNum)

    await writeAdminAuditLog(req, { action: 'admin.success.queue.list', resource: 'customerSuccess' })

    return { total: queue.length, queue }
  })

  app.get('/success/metrics', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'support:read'))) return

    const now = new Date()
    const from = req.query?.from ? new Date(req.query.from) : addDays(now, -7)
    const to = req.query?.to ? new Date(req.query.to) : now
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return reply.code(400).send({ error: 'Período inválido para métricas de CS.' })
    }

    const sinceQueue = addDays(now, -2)
    const [
      atRiskDetected,
      followUpsDue,
      queueAgingRows,
      contacts,
      offerShown,
      offerAccepted,
      retained7d,
      retained30d,
    ] = await Promise.all([
      db.user.count({ where: { status: 'active', OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: sinceQueue } }] } }),
      db.customerContactLog.count({ where: { outcome: 'follow_up', nextFollowUpAt: { lte: now } } }),
      db.user.findMany({ where: { status: 'active', lastSupportContactAt: { not: null } }, select: { lastSupportContactAt: true }, take: EXPORT_LIMIT }),
      db.customerContactLog.groupBy({
        by: ['outcome'],
        where: { createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      db.analyticsEvent.count({ where: { event: 'cs_offer_shown', createdAt: { gte: from, lte: to } } }).catch(() => 0),
      db.analyticsEvent.count({ where: { event: 'cs_offer_accepted', createdAt: { gte: from, lte: to } } }).catch(() => 0),
      db.analyticsEvent.count({ where: { event: 'cs_retained_7d', createdAt: { gte: from, lte: to } } }).catch(() => 0),
      db.analyticsEvent.count({ where: { event: 'cs_retained_30d', createdAt: { gte: from, lte: to } } }).catch(() => 0),
    ])

    const contactsTotal = contacts.reduce((sum, row) => sum + (row?._count?._all || 0), 0)
    const connected = contacts
      .filter(row => ['contacted', 'resolved', 'follow_up'].includes(String(row.outcome)))
      .reduce((sum, row) => sum + (row?._count?._all || 0), 0)

    const queueAgesHours = queueAgingRows
      .map(row => row.lastSupportContactAt ? Math.max(0, (Date.now() - new Date(row.lastSupportContactAt).getTime()) / (1000 * 60 * 60)) : null)
      .filter(v => Number.isFinite(v))
      .sort((a, b) => a - b)
    const p95Idx = queueAgesHours.length ? Math.min(queueAgesHours.length - 1, Math.ceil(queueAgesHours.length * 0.95) - 1) : 0

    await writeAdminAuditLog(req, { action: 'admin.success.metrics.read', resource: 'customerSuccess' })

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      funnel: {
        atRiskDetected,
        queuedForContact: atRiskDetected,
        firstContactAttempted: contactsTotal,
        contactConnected: connected,
        saveOfferShown: offerShown,
        saveOfferAccepted: offerAccepted,
        retained7d,
        retained30d,
      },
      sla: {
        followUpsDue,
        queueAgingP95Hours: queueAgesHours.length ? Math.round(queueAgesHours[p95Idx]) : 0,
        queueAgingAvgHours: queueAgesHours.length ? Math.round(queueAgesHours.reduce((a, b) => a + b, 0) / queueAgesHours.length) : 0,
      },
    }
  })

  app.post('/users/:id/contact-log', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'support:write'))) return

    const validation = parseContactLogInput(req.body)
    if (!validation.ok) return reply.code(400).send({ error: validation.error })

    const user = await db.user.findUnique({ where: { id: req.params.id }, select: { id: true, email: true, supportStatus: true, lastSupportContactAt: true } })
    if (!user) return reply.code(404).send({ error: 'Cliente não encontrado' })

    const data = validation.data
    const contact = await db.customerContactLog.create({
      data: {
        userId: user.id,
        adminUserId: req.admin?.adminUserId ?? null,
        actorUserId: req.user?.sub ?? null,
        channel: data.channel,
        reason: data.reason,
        outcome: data.outcome,
        notes: data.notes,
        nextFollowUpAt: data.nextFollowUpAt,
      },
    })

    const after = await db.user.update({
      where: { id: user.id },
      data: { lastSupportContactAt: new Date(), supportStatus: data.outcome },
      select: { id: true, email: true, supportStatus: true, lastSupportContactAt: true },
    })

    trackAnalyticsEventSafe({ userId: user.id, event: 'cs_contact_attempted', metadata: { channel: data.channel, outcome: data.outcome } })
    if (['contacted', 'resolved', 'follow_up'].includes(data.outcome)) {
      trackAnalyticsEventSafe({ userId: user.id, event: 'cs_contact_connected', metadata: { channel: data.channel, outcome: data.outcome } })
    }
    if (data.outcome === 'follow_up') {
      trackAnalyticsEventSafe({ userId: user.id, event: 'cs_offer_shown', metadata: { channel: data.channel } })
    }
    if (data.outcome === 'resolved') {
      trackAnalyticsEventSafe({ userId: user.id, event: 'cs_offer_accepted', metadata: { channel: data.channel } })
    }

    await writeAdminAuditLog(req, {
      action: 'admin.customer.contact.create',
      resource: 'customerContactLog',
      resourceId: contact.id,
      targetUserId: user.id,
      before: user,
      after: { user: after, contact },
      reason: data.reason,
    })

    return { ok: true, contact, user: after }
  })

  app.get('/finance/overview', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'billing:read'))) return

    const now = new Date()
    const since30d = addDays(now, -30)
    const [
      approved30d,
      approvedAll,
      approvedPayingUsers,
      pendingPayments,
      failedPayments,
      activeBasic,
      activePro,
      trialsActive,
      expiring7d,
      expiring30d,
      overduePaid,
      commissionsAccrued30d,
      commissionsPayable,
      commissionsPaid30d,
    ] = await Promise.all([
      db.payment.aggregate({ where: { status: 'approved', createdAt: { gte: since30d } }, _sum: { amount: true }, _count: { _all: true } }),
      db.payment.aggregate({ where: { status: 'approved' }, _sum: { amount: true }, _count: { _all: true } }),
      db.payment.groupBy({ by: ['userId'], where: { status: 'approved' }, _sum: { amount: true } }),
      db.payment.count({ where: { status: 'pending' } }),
      db.payment.count({ where: { status: { notIn: ['approved', 'pending'] } } }),
      db.user.count({ where: { status: 'active', plan: 'basic', accessExpiresAt: { gt: now } } }),
      db.user.count({ where: { status: 'active', plan: 'pro', accessExpiresAt: { gt: now } } }),
      db.user.count({ where: { status: 'active', plan: 'trial', OR: [{ accessExpiresAt: null }, { accessExpiresAt: { gt: now } }] } }),
      db.user.count({ where: { status: 'active', accessExpiresAt: { gt: now, lte: addDays(now, 7) } } }),
      db.user.count({ where: { status: 'active', accessExpiresAt: { gt: now, lte: addDays(now, 30) } } }),
      db.user.count({ where: { status: 'active', plan: { in: PAID_PLANS }, accessExpiresAt: { lt: now } } }),
      // Comissões de afiliados a descontar da receita bruta dos últimos 30d
      // (casadas com revenue30d: cada pagamento aprovado gera uma comissão).
      // Exclui rejeitadas/revertidas — essas não custam caixa.
      db.affiliateCommission.aggregate({ where: { createdAt: { gte: since30d }, status: { notIn: ['rejected', 'reversed'] } }, _sum: { commissionAmountCents: true }, _count: { _all: true } }),
      // Passivo em aberto (todo o histórico): comissões devidas ainda não pagas.
      db.affiliateCommission.aggregate({ where: { status: { in: ['pending', 'eligible', 'approved', 'held'] } }, _sum: { commissionAmountCents: true }, _count: { _all: true } }),
      // Comissões efetivamente pagas nos últimos 30d (saída de caixa real).
      db.affiliateCommission.aggregate({ where: { status: 'paid', paidAt: { gte: since30d } }, _sum: { commissionAmountCents: true }, _count: { _all: true } }),
    ])

    const currentPrices = await getCurrentPlanPrices()
    const activeMrr = activeBasic * currentPrices.basic + activePro * currentPrices.pro
    const totalLtv = approvedAll._sum.amount ?? 0
    const payingUsers = approvedPayingUsers.length

    // Payment.amount está em reais (Float); comissões em centavos (Int) → /100.
    const revenue30d = approved30d._sum.amount ?? 0
    const affiliateCommissions30d = (commissionsAccrued30d._sum.commissionAmountCents ?? 0) / 100
    const affiliateCommissionsPayable = (commissionsPayable._sum.commissionAmountCents ?? 0) / 100
    const affiliateCommissionsPaid30d = (commissionsPaid30d._sum.commissionAmountCents ?? 0) / 100

    // Taxa do gateway Mercado Pago retida ANTES de cairmos o dinheiro (ex.: R$69
    // → R$65,56 = 4,99%). Percentual configurável (MP_FEE_PERCENT) + taxa fixa
    // opcional por transação aprovada (MP_FEE_FIXED_CENTS). Estimativa: o valor
    // exato varia por método/prazo, mas 4,99% reproduz o caso observado.
    const mpFeePercent = Number.parseFloat(process.env.MP_FEE_PERCENT ?? '4.99') || 0
    const mpFeeFixedCents = Number.parseInt(process.env.MP_FEE_FIXED_CENTS ?? '0', 10) || 0
    const mpFees30d = Math.round((revenue30d * (mpFeePercent / 100) + (approved30d._count._all * mpFeeFixedCents) / 100) * 100) / 100
    const netRevenue30d = Math.round((revenue30d - affiliateCommissions30d - mpFees30d) * 100) / 100

    await writeAdminAuditLog(req, { action: 'admin.finance.overview.read', resource: 'finance' })

    return {
      revenue30d,
      approvedPayments30d: approved30d._count._all,
      totalRevenue: totalLtv,
      approvedPaymentsAll: approvedAll._count._all,
      pendingPayments,
      failedPayments,
      activeMrr,
      activeBasic,
      activePro,
      paidActiveUsers: activeBasic + activePro,
      trialsActive,
      expiring7d,
      expiring30d,
      overduePaid,
      payingUsers,
      avgLtv: payingUsers ? Math.round((totalLtv / payingUsers) * 100) / 100 : 0,
      // Abatimento de afiliados (specs: cascata bruto → comissões → líquido).
      affiliateCommissions30d,
      affiliateCommissions30dCount: commissionsAccrued30d._count._all,
      affiliateCommissionsPayable,
      affiliateCommissionsPayableCount: commissionsPayable._count._all,
      affiliateCommissionsPaid30d,
      affiliateCommissionsPaid30dCount: commissionsPaid30d._count._all,
      // Taxas do Mercado Pago (gateway) descontadas do líquido.
      mpFeePercent,
      mpFeeFixedCents,
      mpFees30d,
      netRevenue30d,
    }
  })

  app.get('/payments', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'billing:read'))) return

    const { page, limit, skip } = getPagination(req.query, 30)
    const { status = 'all', plan, userId } = req.query
    const { from, to } = parseDateRange(req.query, 30)
    const where = {
      createdAt: { gte: from, lte: to },
      ...(status !== 'all' ? { status } : {}),
      ...(plan ? { plan } : {}),
      ...(userId ? { userId } : {}),
    }

    const [total, amount, payments] = await Promise.all([
      db.payment.count({ where }),
      db.payment.aggregate({ where, _sum: { amount: true } }),
      db.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        include: { user: { select: { id: true, email: true, contactPhone: true, plan: true, accessExpiresAt: true, status: true } } },
      }),
    ])

    await writeAdminAuditLog(req, { action: 'admin.payments.list', resource: 'payment' })

    return {
      total,
      page,
      limit,
      amount: amount._sum.amount ?? 0,
      payments: payments.map(payment => ({ ...payment, user: sanitizeUser(payment.user, req.admin.role) })),
    }
  })


  app.get('/marketing/overview', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:read'))) return
    const { from, to } = parseDateRange(req.query, 30)

    const [signups, checkouts, approved, firstSuccess, affiliateReferrals] = await Promise.all([
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event = 'signup_created' AND createdAt >= ${from} AND createdAt <= ${to}`,
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event = 'checkout_started' AND createdAt >= ${from} AND createdAt <= ${to}`,
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event = 'payment_approved' AND createdAt >= ${from} AND createdAt <= ${to}`,
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event = 'first_send_success' AND createdAt >= ${from} AND createdAt <= ${to}`,
      db.user.count({ where: { affiliateProfileId: { not: null }, createdAt: { gte: from, lte: to } } }),
    ])

    await writeAdminAuditLog(req, { action: 'admin.marketing.overview.read', resource: 'marketingOverview' })
    return {
      signups: Number(signups?.[0]?.total || 0),
      checkouts: Number(checkouts?.[0]?.total || 0),
      approvedPayments: Number(approved?.[0]?.total || 0),
      firstValueActions: Number(firstSuccess?.[0]?.total || 0),
      affiliateReferrals: Number(affiliateReferrals || 0),
      from,
      to,
    }
  })

  app.get('/marketing/funnel', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:read'))) return
    const { from, to } = parseDateRange(req.query, 30)

    const [sessions, signups, firstValue, approvals] = await Promise.all([
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event = 'login_completed' AND createdAt >= ${from} AND createdAt <= ${to}`,
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event = 'signup_created' AND createdAt >= ${from} AND createdAt <= ${to}`,
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event = 'first_send_success' AND createdAt >= ${from} AND createdAt <= ${to}`,
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event = 'payment_approved' AND createdAt >= ${from} AND createdAt <= ${to}`,
    ])

    await writeAdminAuditLog(req, { action: 'admin.marketing.funnel.read', resource: 'marketingFunnel' })
    return {
      sessions: Number(sessions?.[0]?.total || 0),
      signups: Number(signups?.[0]?.total || 0),
      firstValueActions: Number(firstValue?.[0]?.total || 0),
      approvedPayments: Number(approvals?.[0]?.total || 0),
      from,
      to,
    }
  })

  app.get('/marketing/campaigns', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:read'))) return
    const { from, to } = parseDateRange(req.query, 30)

    const rows = await db.$queryRaw`
      SELECT
        COALESCE(json_extract(metadata, '$.source'), 'unknown') as source,
        COALESCE(json_extract(metadata, '$.utm_campaign'), json_extract(metadata, '$.aff_code'), json_extract(metadata, '$.ref'), 'none') as campaign,
        COUNT(*) as signups
      FROM AnalyticsEvent
      WHERE event = 'signup_created'
        AND createdAt >= ${from}
        AND createdAt <= ${to}
      GROUP BY COALESCE(json_extract(metadata, '$.source'), 'unknown'), COALESCE(json_extract(metadata, '$.utm_campaign'), json_extract(metadata, '$.aff_code'), json_extract(metadata, '$.ref'), 'none')
      ORDER BY signups DESC
      LIMIT 50
    `

    await writeAdminAuditLog(req, { action: 'admin.marketing.campaigns.read', resource: 'marketingCampaigns' })
    return {
      campaigns: rows.map(row => ({
        source: String(row.source || 'unknown'),
        campaign: String(row.campaign || 'none'),
        signups: Number(row.signups || 0),
      })),
      from,
      to,
    }
  })


  // US2 (specs/010-seo-lead-capture, FR-007): contagem de cadastros por página de entrada
  // (landing first-touch), sem PII sensível — só landing/contagem. Lê a metadata gravada em
  // src/api/routes/auth.js (landing_page), sem migration/tabela nova.
  app.get('/marketing/signups-by-landing', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:read'))) return
    const { from, to } = parseDateRange(req.query, 30)

    const rows = await db.$queryRaw`
      SELECT
        COALESCE(NULLIF(json_extract(metadata, '$.landing_page'), ''), 'unknown') as landingPage,
        COUNT(*) as signups
      FROM AnalyticsEvent
      WHERE event = 'signup_created'
        AND createdAt >= ${from}
        AND createdAt <= ${to}
      GROUP BY COALESCE(NULLIF(json_extract(metadata, '$.landing_page'), ''), 'unknown')
      ORDER BY signups DESC
      LIMIT 50
    `

    await writeAdminAuditLog(req, { action: 'admin.marketing.signupsByLanding.read', resource: 'marketingSignupsByLanding' })
    return {
      signupsByLanding: rows.map(row => ({
        landingPage: String(row.landingPage || 'unknown'),
        signups: Number(row.signups || 0),
      })),
      from,
      to,
    }
  })

  app.get('/marketing/prompts', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:read'))) return
    const { from, to } = parseDateRange(req.query, 30)

    const [eventRows, signupRows] = await Promise.all([
      db.$queryRaw`
        SELECT
          COALESCE(json_extract(metadata, '$.prompt_id'), json_extract(metadata, '$.offer_id'), json_extract(metadata, '$.conversion_prompt_id'), 'unknown') as promptId,
          COALESCE(json_extract(metadata, '$.variant'), json_extract(metadata, '$.conversion_prompt_variant'), 'default') as variant,
          COUNT(*) as totalEvents,
          SUM(CASE WHEN event IN ('conversion_prompt_viewed','lead_magnet_viewed') THEN 1 ELSE 0 END) as views,
          SUM(CASE WHEN event = 'conversion_prompt_dismissed' THEN 1 ELSE 0 END) as dismissals,
          SUM(CASE WHEN event IN ('conversion_prompt_cta_clicked','lead_magnet_submitted','lead_magnet_pdf_clicked','lead_magnet_online_clicked') THEN 1 ELSE 0 END) as ctaClicks,
          SUM(CASE WHEN event = 'lead_magnet_form_focused' THEN 1 ELSE 0 END) as formFocuses
        FROM AnalyticsEvent
        WHERE event IN ('conversion_prompt_viewed','conversion_prompt_dismissed','conversion_prompt_cta_clicked','lead_magnet_viewed','lead_magnet_form_focused','lead_magnet_submitted','lead_magnet_pdf_clicked','lead_magnet_online_clicked')
          AND createdAt >= ${from}
          AND createdAt <= ${to}
        GROUP BY promptId, variant
        ORDER BY views DESC, ctaClicks DESC
        LIMIT 50
      `,
      db.$queryRaw`
        SELECT
          COALESCE(json_extract(metadata, '$.conversion_prompt_id'), 'unknown') as promptId,
          COALESCE(json_extract(metadata, '$.conversion_prompt_variant'), 'default') as variant,
          COUNT(*) as signups
        FROM AnalyticsEvent
        WHERE event = 'signup_created'
          AND COALESCE(json_extract(metadata, '$.conversion_prompt_id'), '') <> ''
          AND createdAt >= ${from}
          AND createdAt <= ${to}
        GROUP BY promptId, variant
      `,
    ])

    const signupMap = new Map(signupRows.map(row => [`${row.promptId || 'unknown'}::${row.variant || 'default'}`, Number(row.signups || 0)]))
    const prompts = eventRows.map(row => {
      const promptId = String(row.promptId || 'unknown')
      const variant = String(row.variant || 'default')
      const views = Number(row.views || 0)
      const dismissals = Number(row.dismissals || 0)
      const ctaClicks = Number(row.ctaClicks || 0)
      const signups = signupMap.get(`${promptId}::${variant}`) || 0
      return {
        promptId,
        variant,
        totalEvents: Number(row.totalEvents || 0),
        views,
        dismissals,
        ctaClicks,
        formFocuses: Number(row.formFocuses || 0),
        signups,
        dismissRate: views ? Math.round((dismissals / views) * 1000) / 10 : 0,
        ctaRate: views ? Math.round((ctaClicks / views) * 1000) / 10 : 0,
        signupRate: views ? Math.round((signups / views) * 1000) / 10 : 0,
      }
    })

    await writeAdminAuditLog(req, { action: 'admin.marketing.prompts.read', resource: 'marketingPrompts' })
    return { prompts, from, to }
  })


  app.get('/marketing/data-trust', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:read'))) return
    const { from, to } = parseDateRange(req.query, 30)
    const [totalSignups, withSource, withRef, events24h] = await Promise.all([
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event = 'signup_created' AND createdAt >= ${from} AND createdAt <= ${to}`,
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event = 'signup_created' AND createdAt >= ${from} AND createdAt <= ${to} AND COALESCE(json_extract(metadata, '$.source'), '') <> ''`,
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event = 'signup_created' AND createdAt >= ${from} AND createdAt <= ${to} AND COALESCE(json_extract(metadata, '$.utm_campaign'), json_extract(metadata, '$.aff_code'), json_extract(metadata, '$.ref'), '') <> ''`,
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE createdAt >= ${new Date(Date.now()-24*60*60*1000)} AND createdAt <= ${new Date()}`,
    ])
    const total = Number(totalSignups?.[0]?.total || 0)
    const sourceCoverage = total ? Math.round((Number(withSource?.[0]?.total || 0) / total) * 1000) / 10 : 0
    const campaignCoverage = total ? Math.round((Number(withRef?.[0]?.total || 0) / total) * 1000) / 10 : 0
    const confidence = sourceCoverage >= 80 && campaignCoverage >= 70 ? 'high' : sourceCoverage >= 60 ? 'medium' : 'low'
    await writeAdminAuditLog(req, { action: 'admin.marketing.data_trust.read', resource: 'marketingDataTrust' })
    return { totalSignups: total, sourceCoverage, campaignCoverage, confidence, freshnessMinutes: 5, events24h: Number(events24h?.[0]?.total || 0), from, to }
  })

  app.get('/marketing/cohorts', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:read'))) return
    const { from, to } = parseDateRange(req.query, 90)
    const rows = await db.$queryRaw`
      SELECT strftime('%Y-%W', createdAt) as cohortWeek,
        COUNT(*) as signups,
        SUM(CASE WHEN event = 'first_send_success' THEN 1 ELSE 0 END) as activated,
        SUM(CASE WHEN event = 'payment_approved' THEN 1 ELSE 0 END) as paid
      FROM AnalyticsEvent
      WHERE createdAt >= ${from} AND createdAt <= ${to}
        AND event IN ('signup_created','first_send_success','payment_approved')
      GROUP BY strftime('%Y-%W', createdAt)
      ORDER BY cohortWeek DESC
      LIMIT 24
    `
    await writeAdminAuditLog(req, { action: 'admin.marketing.cohorts.read', resource: 'marketingCohorts' })
    return { cohorts: rows.map(r => ({ cohortWeek: String(r.cohortWeek||''), signups: Number(r.signups||0), activated: Number(r.activated||0), paid: Number(r.paid||0) })), from, to }
  })

  app.get('/marketing/alerts', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:read'))) return
    const { from, to } = parseDateRange(req.query, 30)
    const [pending, successRate] = await Promise.all([
      db.payment.count({ where: { status: 'pending' } }),
      db.$queryRaw`SELECT COUNT(*) as total, SUM(CASE WHEN event='first_send_success' THEN 1 ELSE 0 END) as success FROM AnalyticsEvent WHERE createdAt >= ${from} AND createdAt <= ${to} AND event IN ('signup_created','first_send_success')`,
    ])
    const total = Number(successRate?.[0]?.total || 0)
    const success = Number(successRate?.[0]?.success || 0)
    const rate = total ? Math.round((success / total) * 1000) / 10 : 0
    const alerts = []
    if (pending > 5) alerts.push({ tone: 'risk', title: 'Pendências de pagamento elevadas', value: pending })
    if (rate < 50) alerts.push({ tone: 'risk', title: 'Ativação baixa no período', value: `${rate}%` })
    if (!alerts.length) alerts.push({ tone: 'good', title: 'Sem alertas críticos', value: 'OK' })
    await writeAdminAuditLog(req, { action: 'admin.marketing.alerts.read', resource: 'marketingAlerts' })
    return { alerts, from, to }
  })

  app.get('/marketing/comparison-quality', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:read'))) return
    const { from, to } = parseDateRange(req.query, 30)
    const [viewsRows, scrollRows, ctaRows] = await Promise.all([
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event='comparison_page_view' AND createdAt >= ${from} AND createdAt <= ${to}`,
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event='comparison_scroll_50' AND createdAt >= ${from} AND createdAt <= ${to}`,
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event='comparison_cta_click' AND createdAt >= ${from} AND createdAt <= ${to}`,
    ])
    const views = Number(viewsRows?.[0]?.total || 0)
    const scroll50 = Number(scrollRows?.[0]?.total || 0)
    const ctaClicks = Number(ctaRows?.[0]?.total || 0)
    const [acceptedRows, invalidRows, blockedRows] = await Promise.all([
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event='public_analytics_accepted' AND createdAt >= ${from} AND createdAt <= ${to}`,
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event='public_analytics_invalid_event' AND createdAt >= ${from} AND createdAt <= ${to}`,
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event='public_analytics_blocked_429' AND createdAt >= ${from} AND createdAt <= ${to}`,
    ])
    const publicQuality = {
      accepted: Number(acceptedRows?.[0]?.total || 0),
      invalidEvent: Number(invalidRows?.[0]?.total || 0),
      blocked429: Number(blockedRows?.[0]?.total || 0),
    }
    await writeAdminAuditLog(req, { action: 'admin.marketing.comparison_quality.read', resource: 'comparisonQuality' })
    return {
      views,
      scroll50,
      ctaClicks,
      scrollRate: views ? Math.round((scroll50 / views) * 1000) / 10 : 0,
      ctaRate: views ? Math.round((ctaClicks / views) * 1000) / 10 : 0,
      ingestion: publicQuality,
      from,
      to,
    }
  })

  app.get('/billing/webhooks', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'billing:read'))) return

    const { page, limit, skip } = getPagination(req.query, 30)
    const { status = 'all', provider = 'mercado_pago' } = req.query
    const { from, to } = parseDateRange(req.query, 7)
    const where = {
      createdAt: { gte: from, lte: to },
      ...(status !== 'all' ? { processingStatus: status } : {}),
      ...(provider ? { provider: String(provider) } : {}),
    }

    const [total, rows] = await Promise.all([
      db.webhookEvent.count({ where }),
      db.webhookEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip }),
    ])

    await writeAdminAuditLog(req, { action: 'admin.billing.webhooks.list', resource: 'webhookEvent' })

    return {
      total,
      page,
      limit,
      webhooks: rows.map((row) => ({
        id: row.id,
        provider: row.provider,
        eventId: row.eventId,
        eventType: row.eventType,
        processingStatus: row.processingStatus,
        signatureValid: row.signatureValid,
        createdAt: row.createdAt,
        processedAt: row.processedAt,
        processingResult: row.processingResult,
        error: row.error,
      })),
    }
  })

  app.get('/subscriptions', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'billing:read'))) return

    const { page, limit, skip } = getPagination(req.query, 30)
    const { plan, status = 'all', search } = req.query
    const now = new Date()
    const where = {
      ...(plan ? { plan } : {}),
      ...(search ? { email: { contains: String(search).trim() } } : {}),
      ...(status === 'active' ? { status: 'active', OR: [{ accessExpiresAt: null }, { accessExpiresAt: { gt: now } }] } : {}),
      ...(status === 'expired' ? { accessExpiresAt: { lt: now } } : {}),
      ...(status === 'expiring_soon' ? { accessExpiresAt: { gt: now, lte: addDays(now, 7) } } : {}),
    }

    const [total, users, ltvRows] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { accessExpiresAt: 'asc' },
        take: limit,
        skip,
        select: {
          id: true,
          email: true,
          contactPhone: true,
          status: true,
          plan: true,
          accessExpiresAt: true,
          createdAt: true,
          lastActivityAt: true,
          supportStatus: true,
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      db.payment.groupBy({ by: ['userId'], where: { status: 'approved' }, _sum: { amount: true } }),
    ])
    const ltvMap = new Map(ltvRows.map(row => [row.userId, row._sum.amount ?? 0]))

    await writeAdminAuditLog(req, { action: 'admin.subscriptions.list', resource: 'subscription' })

    return {
      total,
      page,
      limit,
      subscriptions: users.map(user => sanitizeUser({
        ...user,
        subscriptionStatus: getSubscriptionStatus(user, now),
        daysRemaining: getDaysRemaining(user.accessExpiresAt, now),
        ltv: ltvMap.get(user.id) ?? 0,
        lastPayment: user.payments?.[0] ?? null,
      }, req.admin.role)),
    }
  })

  app.post('/users/:id/access', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'billing:write'))) return

    const validation = parseManualAccessInput(req.body)
    if (!validation.ok) return reply.code(400).send({ error: validation.error })

    const before = await db.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, plan: true, accessExpiresAt: true, status: true, supportStatus: true },
    })
    if (!before) return reply.code(404).send({ error: 'Cliente não encontrado' })

    const { plan, days, expiresAt, reason } = validation.data
    const data = {}
    if (plan !== undefined) data.plan = plan
    if (expiresAt !== undefined) data.accessExpiresAt = expiresAt
    if (days !== undefined) {
      const base = before.accessExpiresAt && before.accessExpiresAt > new Date() ? before.accessExpiresAt : new Date()
      data.accessExpiresAt = addDays(base, days)
    }

    const after = await db.user.update({
      where: { id: before.id },
      data,
      select: { id: true, email: true, plan: true, accessExpiresAt: true, status: true, supportStatus: true },
    })

    await writeAdminAuditLog(req, {
      action: 'admin.user.access.update',
      resource: 'user',
      resourceId: before.id,
      targetUserId: before.id,
      before,
      after,
      reason,
    })

    return { ok: true, user: after }
  })

  app.get('/users/:id', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'support:read'))) return

    const now = new Date()
    const since24h = addDays(now, -1)
    const user = await db.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        contactPhone: true,
        contactPhoneVerifiedAt: true,
        contactPhoneOptInAt: true,
        status: true,
        plan: true,
        accessExpiresAt: true,
        sendCount: true,
        referralCode: true,
        referredBy: true,
        lastLoginAt: true,
        lastActivityAt: true,
        lastSupportContactAt: true,
        supportStatus: true,
        createdAt: true,
        waSession: { select: { status: true, phone: true, updatedAt: true } },
        groups: { orderBy: { name: 'asc' }, select: { id: true, name: true, role: true, waJid: true, imageMode: true } },
        credentials: { select: { id: true, platform: true, data: true } },
        botConfig: true,
        scheduled: { orderBy: { scheduledAt: 'desc' }, take: 10 },
        payments: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })

    if (!user) return reply.code(404).send({ error: 'Cliente não encontrado' })

    const [successCount, errorCount24h, logStats, platformStats, recentLogs, lastMessage, ltv] = await Promise.all([
      db.messageLog.count({ where: { userId: user.id, status: 'success' } }),
      db.messageLog.count({ where: { userId: user.id, status: 'error', sentAt: { gte: since24h } } }),
      db.messageLog.groupBy({ by: ['status'], where: { userId: user.id, sentAt: { gte: addDays(now, -7) } }, _count: { _all: true } }),
      db.messageLog.groupBy({ by: ['platform', 'status'], where: { userId: user.id, sentAt: { gte: addDays(now, -7) } }, _count: { _all: true } }),
      db.messageLog.findMany({ where: { userId: user.id }, orderBy: { sentAt: 'desc' }, take: 20 }),
      db.messageLog.findFirst({ where: { userId: user.id }, orderBy: { sentAt: 'desc' }, select: { sentAt: true } }),
      db.payment.aggregate({ where: { userId: user.id, status: 'approved' }, _sum: { amount: true } }),
    ])
    const running = (await listRunningBots()).includes(user.id)
    const lastMessageAt = lastMessage?.sentAt ?? null
    const effectiveLastActivityAt = resolveEffectiveLastActivity(user, lastMessageAt)
    const riskUser = { ...user, lastActivityAt: effectiveLastActivityAt }

    await writeAdminAuditLog(req, { action: 'admin.users.detail', resource: 'user', resourceId: user.id, targetUserId: user.id })

    return sanitizeUser({
      ...user,
      groups: user.groups.map(group => ({
        ...group,
        waJid: canSeePhone(req.admin.role) ? group.waJid : maskPhone(group.waJid),
      })),
      ltv: ltv._sum.amount ?? 0,
      accessStatus: getAccessStatus(user, now),
      botRunning: running,
      groupCounts: getGroupCounts(user.groups),
      lastMessageAt,
      effectiveLastActivityAt,
      logStats7d: Object.fromEntries(logStats.map(row => [row.status, row._count._all])),
      platformStats7d: platformStats.map(row => ({ platform: row.platform, status: row.status, count: row._count._all })),
      credentialHealth: summarizeCredentialHealth(user.credentials),
      credentials: user.credentials.map(credential => ({ id: credential.id, platform: credential.platform })),
      recentLogs,
      successCount,
      errorCount24h,
      riskFlags: buildRiskFlags({ user: riskUser, groups: user.groups, successCount, errorCount: errorCount24h, now, running }),
    }, req.admin.role)
  })

  app.get('/logs', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'support:read'))) return
    const result = await adminService.listLogs({ query: req.query ?? {}, adminRole: req.admin.role })
    await writeAdminAuditLog(req, { action: 'admin.logs.list', resource: 'messageLog' })
    return result
  })

  // Métricas operacionais cross-user para o painel admin.
  // Igual ao /api/logs/summary mas sem filtrar por userId (e expondo top
  // destinos com mais timeouts para investigação rápida).
  app.get('/logs/summary', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'support:read'))) return
    const rawPeriod = String(req.query?.period || '7d').toLowerCase()
    const periodMsByKey = {
      '5m': 5 * 60_000,
      '30m': 30 * 60_000,
      '1h': 60 * 60_000,
      '6h': 6 * 60 * 60_000,
      '24h': 24 * 60 * 60_000,
      '7d': 7 * 24 * 60 * 60_000,
      '30d': 30 * 24 * 60 * 60_000,
    }
    const period = rawPeriod === 'today' || periodMsByKey[rawPeriod] ? rawPeriod : '7d'
    const now = new Date()
    const to = now
    let from
    if (period === 'today') {
      from = new Date(now); from.setHours(0, 0, 0, 0)
    } else {
      from = new Date(now.getTime() - periodMsByKey[period])
    }

    const logs = await db.messageLog.findMany({
      where: { sentAt: { gte: from, lte: to } },
      select: { userId: true, status: true, errorMsg: true, destGroup: true, sentAt: true },
    })
    const topErrorsLimit = Math.max(1, Math.min(200, parseInt(req.query?.topErrors ?? '50') || 50))

    const counts = {
      success: 0,
      skippedDedup: 0,
      skippedConfig: 0,
      timeoutTotal: 0,
      errorOther: 0,
      inFlight: 0,
    }
    const timeoutByDest = new Map()
    const errorsByUser = new Map()

    for (const log of logs) {
      if (log.status === 'queued' || log.status === 'sending') { counts.inFlight++; continue }
      if (log.status === 'success') { counts.success++; continue }
      const category = categorizeErrorMsg(log.errorMsg)
      if (category === ERROR_CATEGORIES.DEDUP) { counts.skippedDedup++; continue }
      if (category === ERROR_CATEGORIES.CONFIG_BLOCK) { counts.skippedConfig++; continue }
      if (category === ERROR_CATEGORIES.TIMEOUT) {
        counts.timeoutTotal++
        if (log.destGroup && log.destGroup !== 'skipped') {
          timeoutByDest.set(log.destGroup, (timeoutByDest.get(log.destGroup) || 0) + 1)
        }
      } else if (log.status === 'error') {
        counts.errorOther++
      }
      if (log.status === 'error') {
        errorsByUser.set(log.userId, (errorsByUser.get(log.userId) || 0) + 1)
      }
    }

    const topTimeoutDests = Array.from(timeoutByDest.entries())
      .map(([destJid, count]) => ({ destJid: redactAdminPayload({ destJid }).destJid, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
    const topErrorUsers = Array.from(errorsByUser.entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    await writeAdminAuditLog(req, { action: 'admin.logs.summary.read', resource: 'messageLog' })
    return {
      period,
      range: { from: from.toISOString(), to: to.toISOString() },
      counts,
      topTimeoutDests,
      topErrorUsers,
      errorsByMessage: buildErrorsByMessage(logs, { limit: topErrorsLimit }),
      windows: buildOperationalWindows(logs, now),
    }
  })



  app.get('/legal/terms', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:read'))) return
    const terms = await getEffectiveTermsDocument(db)
    await writeAdminAuditLog(req, { action: 'admin.legalTerms.view', resource: 'legalDocument', resourceId: TERMS_DOCUMENT_ID })
    return { terms }
  })

  app.put('/legal/terms', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:write'))) return
    if (!db.legalDocument || typeof db.legalDocument.upsert !== 'function') {
      reply.code(503).send({ error: 'Termos editáveis indisponíveis no momento. Rode prisma generate/migrate no servidor.' })
      return
    }

    const body = req.body ?? {}
    const title = String(body.title ?? '').trim().slice(0, 180)
    const summary = String(body.summary ?? '').trim().slice(0, 1000)
    const content = normalizeTermsContent(body.content ?? {})
    if (!title || !summary) {
      reply.code(400).send({ error: 'Título e resumo dos termos são obrigatórios.' })
      return
    }
    if (!content.sections.length) {
      reply.code(400).send({ error: 'Inclua pelo menos uma seção nos termos.' })
      return
    }

    const existing = await getEffectiveTermsDocument(db)
    const version = nextTermsVersion()
    const saved = await db.legalDocument.upsert({
      where: { id: TERMS_DOCUMENT_ID },
      create: {
        id: TERMS_DOCUMENT_ID,
        title,
        summary,
        contentJson: JSON.stringify(content),
        version,
        updatedByUserId: req.user?.sub ?? null,
      },
      update: {
        title,
        summary,
        contentJson: JSON.stringify(content),
        version,
        updatedByUserId: req.user?.sub ?? null,
      },
    })
    const terms = await getEffectiveTermsDocument(db)

    await writeAdminAuditLog(req, {
      action: 'admin.legalTerms.update',
      resource: 'legalDocument',
      resourceId: saved.id,
      before: { version: existing.version, title: existing.title },
      after: { version: terms.version, title: terms.title },
    })

    return { terms }
  })

  app.get('/lp-content', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:read'))) return

    const [plans, faqItems, tutorial] = await Promise.all([
      listLpPlansSafe(),
      db.faqItem.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      getTutorialContentSafe(),
    ])

    await writeAdminAuditLog(req, { action: 'admin.lpContent.view', resource: 'landingPageContent' })

    return { plans: (plans ?? []).map(plan => ({ ...plan, features: parseStoredPlanFeatures(plan.features) })), faq: { items: faqItems }, tutorial }
  })

  app.put('/lp-content/tutorial', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:write'))) return
    if (!db.tutorialContent || typeof db.tutorialContent.upsert !== 'function') {
      reply.code(503).send({ error: 'Tutorial indisponível no momento. Rode prisma generate/migrate no servidor.' })
      return
    }

    const body = req.body ?? {}
    const title = String(body.title ?? '').trim()
    const bodyText = String(body.body ?? '').trim()
    const images = (Array.isArray(body.images) ? body.images : []).slice(0, 20).map((item, index) => ({
      id: String(item?.id || `img-${index + 1}`),
      label: String(item?.label || `PRINT ${index + 1}`),
      url: String(item?.url || '').trim(),
      note: String(item?.note || '').trim(),
    }))

    if (!title || !bodyText) {
      reply.code(400).send({ error: 'Título e conteúdo do tutorial são obrigatórios.' })
      return
    }

    const existing = await getTutorialContentSafe()
    const tutorial = await db.tutorialContent.upsert({
      where: { id: 'dashboard_tutorial' },
      create: { id: 'dashboard_tutorial', title, body: bodyText, images: JSON.stringify(images) },
      update: { title, body: bodyText, images: JSON.stringify(images) },
    })

    await writeAdminAuditLog(req, {
      action: 'admin.tutorial.update',
      resource: 'tutorialContent',
      resourceId: tutorial.id,
      before: existing ? JSON.stringify(existing) : undefined,
      after: JSON.stringify(tutorial),
    })

    return { tutorial: { ...tutorial, images } }
  })


  app.put('/lp-content/plans/:id', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:write'))) return

    const plansAvailable = await listLpPlansSafe()
    if (plansAvailable === null) {
      reply.code(503).send({ error: 'Planos da LP indisponíveis. Aplique as migrations pendentes e tente novamente.' })
      return
    }

    const existing = await db.lpPlan.findUnique({ where: { id: req.params.id } })
    if (!existing) {
      reply.code(404).send({ error: 'Plano da LP não encontrado.' })
      return
    }

    const parsed = parseLpPlanInput(req.body, existing)
    if (!parsed.ok) {
      reply.code(400).send({ error: parsed.error })
      return
    }

    const plan = await db.lpPlan.update({
      where: { id: existing.id },
      data: parsed.data,
    })

    await writeAdminAuditLog(req, {
      action: 'admin.lpPlan.update',
      resource: 'lpPlan',
      resourceId: plan.id,
      before: JSON.stringify(existing),
      after: JSON.stringify(plan),
    })

    return { plan: { ...plan, features: parseStoredPlanFeatures(plan.features) } }
  })

  app.get('/faq', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:read'))) return

    const items = await db.faqItem.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    })

    await writeAdminAuditLog(req, { action: 'admin.faq.list', resource: 'faqItem' })

    return { items }
  })

  app.post('/faq', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:write'))) return

    const body = req.body ?? {}
    const question = String(body.question ?? '').trim()
    const answer = String(body.answer ?? '').trim()
    const position = Number.isFinite(Number(body.position)) ? Number(body.position) : 0
    const isActive = body.isActive === undefined ? true : Boolean(body.isActive)

    if (!question || !answer) {
      reply.code(400).send({ error: 'Pergunta e resposta são obrigatórias.' })
      return
    }

    const item = await db.faqItem.create({
      data: { question, answer, position, isActive },
    })

    await writeAdminAuditLog(req, {
      action: 'admin.faq.create',
      resource: 'faqItem',
      resourceId: item.id,
      after: JSON.stringify(item),
    })

    reply.code(201).send({ item })
  })

  app.put('/faq/:id', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:write'))) return

    const existing = await db.faqItem.findUnique({ where: { id: req.params.id } })
    if (!existing) {
      reply.code(404).send({ error: 'FAQ não encontrado.' })
      return
    }

    const body = req.body ?? {}
    const question = String(body.question ?? '').trim()
    const answer = String(body.answer ?? '').trim()
    const position = Number.isFinite(Number(body.position)) ? Number(body.position) : existing.position
    const isActive = body.isActive === undefined ? existing.isActive : Boolean(body.isActive)

    if (!question || !answer) {
      reply.code(400).send({ error: 'Pergunta e resposta são obrigatórias.' })
      return
    }

    const item = await db.faqItem.update({
      where: { id: existing.id },
      data: { question, answer, position, isActive },
    })

    await writeAdminAuditLog(req, {
      action: 'admin.faq.update',
      resource: 'faqItem',
      resourceId: item.id,
      before: JSON.stringify(existing),
      after: JSON.stringify(item),
    })

    return { item }
  })

  app.delete('/faq/:id', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:write'))) return

    const existing = await db.faqItem.findUnique({ where: { id: req.params.id } })
    if (!existing) {
      reply.code(404).send({ error: 'FAQ não encontrado.' })
      return
    }

    await db.faqItem.delete({ where: { id: existing.id } })

    await writeAdminAuditLog(req, {
      action: 'admin.faq.delete',
      resource: 'faqItem',
      resourceId: existing.id,
      before: JSON.stringify(existing),
    })

    return { ok: true }
  })

  
  app.get('/session-telemetry', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'tech:read'))) return
    const limit = Math.min(Math.max(Number(req.query?.limit ?? 100), 1), 300)
    const events = await db.adminAuditLog.findMany({
      where: { action: 'session.telemetry', resource: 'wa_session' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, actorUserId: true, createdAt: true, after: true, actorUser: { select: { email: true, name: true } } },
    })
    const parsed = events.map((item) => {
      let payload = {}
      try { payload = item.after ? JSON.parse(item.after) : {} } catch {}
      return { id: item.id, createdAt: item.createdAt, userId: item.actorUserId, user: item.actorUser, ...payload }
    })
    const summary = parsed.reduce((acc, item) => {
      const key = `${item.stage || 'unknown'}:${item.event || 'unknown'}`
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
    await writeAdminAuditLog(req, { action: 'admin.session.telemetry.read', resource: 'waSessionTelemetry' })
    return { total: parsed.length, summary, events: parsed }
  })

app.get('/sessions', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'support:read'))) return

    const { page, limit, skip } = getPagination(req.query, 30)
    const { status = 'all' } = req.query
    const running = new Set(await listRunningBots())
    const where = status !== 'all' ? { status } : {}

    const [total, sessions] = await Promise.all([
      db.waSession.count({ where }),
      db.waSession.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              contactPhone: true,
              status: true,
              plan: true,
              accessExpiresAt: true,
              lastActivityAt: true,
              supportStatus: true,
            },
          },
        },
      }),
    ])

    await writeAdminAuditLog(req, { action: 'admin.sessions.list', resource: 'waSession' })

    return {
      total,
      page,
      limit,
      sessions: sessions.map(session => ({
        id: session.id,
        status: session.status,
        phone: canSeePhone(req.admin.role) ? session.phone : maskPhone(session.phone),
        updatedAt: session.updatedAt,
        botRunning: running.has(session.userId),
        user: sanitizeUser(session.user, req.admin.role),
      })),
    }
  })

  // ---- DLQ do pipeline de envio (BullMQ) ----
  //
  // Disponível apenas quando o worker do usuário está em backend bullmq
  // (REDIS_URL configurada). Em backend memory a DLQ é sempre vazia.
  // Auditoria registra todas as ações destrutivas (retry/discard/purge).

  // Valida o :userId das rotas de DLQ antes de derivar nomes de fila Redis
  // (`wabot-send-${userId}-dlq`) a partir dele. Mesmo sendo rota admin, o
  // valor não pode ser usado cru: rejeita vazio/malformado (400) e confirma
  // que o usuário existe (404), evitando construir chaves Redis arbitrárias.
  async function resolveDlqUserId(req, reply) {
    const userId = String(req.params.userId ?? '').trim()
    if (!userId || userId.length > 128 || /[\s:]/.test(userId)) {
      reply.code(400).send({ error: 'userId inválido' })
      return null
    }
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) {
      reply.code(404).send({ error: 'Usuário não encontrado' })
      return null
    }
    return userId
  }

  app.get('/send-dlq/:userId', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:read'))) return
    const userId = await resolveDlqUserId(req, reply)
    if (!userId) return
    const { listDlq } = await import('../../jobs/sendDlq.js')
    const limit = Math.min(500, Math.max(1, Number(req.query?.limit) || 100))
    try {
      const result = await listDlq({ redisUrl: process.env.REDIS_URL, userId, limit })
      await writeAdminAuditLog(req, { action: 'admin.sendDlq.list', resource: 'sendDlq', resourceId: userId, after: { total: result.total } })
      return result
    } catch (err) {
      return reply.code(503).send({ error: err.message })
    }
  })

  app.post('/send-dlq/:userId/retry/:jobId', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:write'))) return
    const userId = await resolveDlqUserId(req, reply)
    if (!userId) return
    const { retryDlqJob } = await import('../../jobs/sendDlq.js')
    const jobId = String(req.params.jobId)
    try {
      const result = await retryDlqJob({ redisUrl: process.env.REDIS_URL, userId, dlqJobId: jobId })
      await writeAdminAuditLog(req, { action: 'admin.sendDlq.retry', resource: 'sendDlq', resourceId: `${userId}:${jobId}`, after: result })
      return result
    } catch (err) {
      return reply.code(503).send({ error: err.message })
    }
  })

  app.delete('/send-dlq/:userId/job/:jobId', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:write'))) return
    const userId = await resolveDlqUserId(req, reply)
    if (!userId) return
    const { discardDlqJob } = await import('../../jobs/sendDlq.js')
    const jobId = String(req.params.jobId)
    try {
      const result = await discardDlqJob({ redisUrl: process.env.REDIS_URL, userId, dlqJobId: jobId })
      await writeAdminAuditLog(req, { action: 'admin.sendDlq.discard', resource: 'sendDlq', resourceId: `${userId}:${jobId}`, after: result })
      return result
    } catch (err) {
      return reply.code(503).send({ error: err.message })
    }
  })

  app.post('/send-dlq/:userId/purge', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:write'))) return
    const userId = await resolveDlqUserId(req, reply)
    if (!userId) return
    const { purgeDlq } = await import('../../jobs/sendDlq.js')
    try {
      const result = await purgeDlq({ redisUrl: process.env.REDIS_URL, userId })
      await writeAdminAuditLog(req, { action: 'admin.sendDlq.purge', resource: 'sendDlq', resourceId: userId, after: { removed: result.removed } })
      return result
    } catch (err) {
      return reply.code(503).send({ error: err.message })
    }
  })

  // Liga/desliga os apps PM2 de staging para economizar RAM enquanto não está
  // em teste (staging e prod dividem o VPS). Ver src/ops/stagingPower.js.
  app.get('/staging-power', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'tech:read'))) return
    const { getStagingStatus } = await import('../../ops/stagingPower.js')
    try {
      return await getStagingStatus()
    } catch (err) {
      return reply.code(503).send({ error: `Falha ao consultar staging: ${err.message}` })
    }
  })

  app.post('/staging-power', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'tech:write'))) return
    const action = String(req.body?.action ?? '').toLowerCase()
    if (action !== 'on' && action !== 'off') {
      return reply.code(400).send({ error: "Campo 'action' deve ser 'on' ou 'off'" })
    }
    const { setStagingPower } = await import('../../ops/stagingPower.js')
    try {
      const result = await setStagingPower(action)
      await writeAdminAuditLog(req, { action: `admin.staging.${action}`, resource: 'stagingPower', resourceId: 'staging', after: result })
      return result
    } catch (err) {
      return reply.code(503).send({ error: `Falha ao ${action === 'on' ? 'ligar' : 'desligar'} staging: ${err.message}` })
    }
  })

  // Configuração de limite de automações por usuário
  app.get('/automation-quota', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'support:read'))) return
    const { page = 1, limit = 20, search = '' } = req.query
    const p = Math.max(1, Number(page))
    const l = Math.min(100, Math.max(1, Number(limit)))
    const offset = (p - 1) * l

    const searchLower = String(search).toLowerCase().trim()
    const where = searchLower ? {
      OR: [
        // SQLite faz comparação ASCII case-insensitive por padrão. O atributo
        // `mode` não existe no connector SQLite do Prisma e fazia a busca do
        // painel falhar em runtime assim que o admin digitava qualquer texto.
        { email: { contains: searchLower } },
        { name: { contains: searchLower } },
      ]
    } : {}

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: { id: true, email: true, name: true, maxAutomations: true },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: l,
      }),
      db.user.count({ where }),
    ])

    // Duas agregações para a página inteira evitam 2 queries por cliente.
    // Com 100 linhas, a implementação anterior fazia 202 consultas por load.
    const userIds = users.map((user) => user.id)
    const [activeCounts, totalCounts] = userIds.length ? await Promise.all([
      db.offerAutomation.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, enabled: true },
        _count: { _all: true },
      }),
      db.offerAutomation.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
    ]) : [[], []]
    const activeByUser = new Map(activeCounts.map((row) => [row.userId, row._count._all]))
    const totalByUser = new Map(totalCounts.map((row) => [row.userId, row._count._all]))
    const usersWithCount = users.map((u) => ({
      ...u,
      activeAutomations: activeByUser.get(u.id) ?? 0,
      totalAutomations: totalByUser.get(u.id) ?? 0,
    }))

    await writeAdminAuditLog(req, { action: 'admin.automation_quota.list', resource: 'user', after: { total, page: p, limit: l } })
    return { users: usersWithCount, total, page: p, limit: l }
  })

  app.patch('/automation-quota/:userId', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'support:write'))) return
    const { maxAutomations } = req.body ?? {}
    const userId = String(req.params.userId).trim()

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, maxAutomations: true } })
    if (!user) return reply.code(404).send({ error: 'Usuário não encontrado' })

    const newLimit = Number(maxAutomations)
    if (!Number.isInteger(newLimit) || newLimit < 1 || newLimit > 200) {
      return reply.code(400).send({ error: 'Limite de automações deve ser um número inteiro entre 1 e 200' })
    }
    const oldLimit = user.maxAutomations

    const updated = await db.user.update({
      where: { id: userId },
      data: { maxAutomations: newLimit },
      select: { id: true, email: true, maxAutomations: true },
    })

    const activeCount = await db.offerAutomation.count({ where: { userId, enabled: true } })
    await writeAdminAuditLog(req, {
      action: 'admin.automation_quota.update',
      resource: 'user',
      resourceId: userId,
      targetUserId: userId,
      before: { maxAutomations: oldLimit },
      after: { maxAutomations: newLimit, activeAutomations: activeCount },
    })

    return { ...updated, activeAutomations: activeCount }
  })
}
