import db from '../../db.js'
import { listRunningBots } from '../../manager.js'
import { getApiMetricsSnapshot } from '../metrics.js'
import { summarizeCredentialHealth } from '../../credentialHealth.js'

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
  if (value === undefined || value === null) return null
  return JSON.stringify(value)
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

  if (plan !== undefined && !['trial', ...PAID_PLANS].includes(plan)) {
    return { ok: false, error: 'Plano inválido. Use trial, basic ou pro.' }
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

  return { ok: true, data: { plan, days: daysRaw, expiresAt, reason } }
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
  const runningUserIds = listRunningBots()

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

export async function adminRoutes(app) {
  app.addHook('onRequest', app.authenticate)

  app.get('/me', async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return
    return req.admin
  })

  app.get('/overview', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:read'))) return
    const overview = await getOperationalOverview()
    await writeAdminAuditLog(req, { action: 'admin.overview.read', resource: 'overview' })
    return overview
  })

  app.get('/users', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'support:read'))) return

    const { page, limit, skip } = getPagination(req.query)
    const { status, plan, risk, search } = req.query
    const now = new Date()
    const twoDaysAgo = addDays(now, -2)
    const where = {
      ...(status ? { status } : {}),
      ...(plan ? { plan } : {}),
      ...(search ? { email: { contains: String(search).trim() } } : {}),
      ...(risk === 'stale' ? { OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: twoDaysAgo } }] } : {}),
      ...(risk === 'missing_phone' ? { contactPhone: null } : {}),
      ...(risk === 'expiring_soon' ? { accessExpiresAt: { gt: now, lte: addDays(now, 7) } } : {}),
      ...(risk === 'missing_credentials' ? { credentials: { none: {} } } : {}),
      ...(risk === 'missing_monitor' ? { groups: { none: { role: 'monitor' } } } : {}),
      ...(risk === 'missing_post' ? { groups: { none: { role: 'post' } } } : {}),
    }

    const since24h = addDays(now, -1)
    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        select: {
          id: true,
          name: true,
          email: true,
          contactPhone: true,
          status: true,
          plan: true,
          accessExpiresAt: true,
          lastLoginAt: true,
          lastActivityAt: true,
          lastSupportContactAt: true,
          supportStatus: true,
          createdAt: true,
          waSession: { select: { status: true, phone: true, updatedAt: true } },
          groups: { select: { role: true } },
          credentials: { select: { platform: true, data: true } },
          _count: { select: { payments: true, credentials: true, messageLogs: true } },
        },
      }),
    ])
    const userIds = users.map(user => user.id)
    const [successMap, errorMap, lastMessageMap] = await Promise.all([
      getLogCountMap({ status: 'success', userIds }),
      getLogCountMap({ status: 'error', since: since24h, userIds }),
      getLogActivityMap({ userIds }),
    ])

    const running = new Set(listRunningBots())
    await writeAdminAuditLog(req, { action: 'admin.users.list', resource: 'user' })

    return {
      total,
      page,
      limit,
      users: users.map(user => {
        const groupCounts = getGroupCounts(user.groups)
        const successCount = successMap.get(user.id) ?? 0
        const errorCount24h = errorMap.get(user.id) ?? 0
        const userRunning = running.has(user.id)
        const lastMessageAt = lastMessageMap.get(user.id) ?? null
        const effectiveLastActivityAt = resolveEffectiveLastActivity(user, lastMessageAt)
        const riskUser = { ...user, lastActivityAt: effectiveLastActivityAt }
        return sanitizeUser({
          ...user,
          groups: undefined,
          groupCounts,
          accessStatus: getAccessStatus(user, now),
          botRunning: userRunning,
          lastMessageAt,
          effectiveLastActivityAt,
          successCount,
          errorCount24h,
          credentialHealth: summarizeCredentialHealth(user.credentials),
          credentials: undefined,
          riskFlags: buildRiskFlags({ user: riskUser, groups: user.groups, successCount, errorCount: errorCount24h, now, running: userRunning }),
        }, req.admin.role)
      }),
    }
  })




  app.get('/system/health', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'tech:read'))) return

    const memory = process.memoryUsage()
    const cpu = process.cpuUsage()
    const [dbOk, messageLogCount, userCount] = await Promise.all([
      db.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      db.messageLog.count().catch(() => null),
      db.user.count().catch(() => null),
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
      counts: { users: userCount, messageLogs: messageLogCount, runningBots: listRunningBots().length },
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

    const { limit = '25', reason = 'all' } = req.query
    const limitNum = Math.min(EXPORT_LIMIT, Math.max(1, parseInt(limit) || 25))
    const now = new Date()
    const since24h = addDays(now, -1)
    const running = new Set(listRunningBots())

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
          lastActivityAt: true,
          lastSupportContactAt: true,
          supportStatus: true,
          waSession: { select: { status: true, phone: true, updatedAt: true } },
          groups: { select: { role: true } },
          customerContacts: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { credentials: true, messageLogs: true } },
        },
      }),
      getLogCountMap({ status: 'success' }),
      getLogCountMap({ status: 'error', since: since24h }),
    ])

    const queue = users
      .map(user => {
        const successCount = successMap.get(user.id) ?? 0
        const errorCount24h = errorMap.get(user.id) ?? 0
        const botRunning = running.has(user.id)
        const riskFlags = buildRiskFlags({ user, groups: user.groups, successCount, errorCount: errorCount24h, now, running: botRunning })
        const contactReasons = getCustomerSuccessReasons({ user, riskFlags, errorCount24h })
        return sanitizeUser({
          ...user,
          groups: undefined,
          botRunning,
          groupCounts: getGroupCounts(user.groups),
          errorCount24h,
          riskFlags,
          contactReasons,
          lastContact: user.customerContacts?.[0] ?? null,
          customerContacts: undefined,
        }, req.admin.role)
      })
      .filter(user => user.contactReasons.length > 0)
      .filter(user => reason === 'all' || user.contactReasons.includes(reason))
      .slice(0, limitNum)

    await writeAdminAuditLog(req, { action: 'admin.success.queue.list', resource: 'customerSuccess' })

    return { total: queue.length, queue }
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
    ])

    const currentPrices = await getCurrentPlanPrices()
    const activeMrr = activeBasic * currentPrices.basic + activePro * currentPrices.pro
    const totalLtv = approvedAll._sum.amount ?? 0
    const payingUsers = approvedPayingUsers.length

    await writeAdminAuditLog(req, { action: 'admin.finance.overview.read', resource: 'finance' })

    return {
      revenue30d: approved30d._sum.amount ?? 0,
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

    const [signups, checkouts, approved, firstSuccess] = await Promise.all([
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event = 'signup_created' AND createdAt >= ${from} AND createdAt <= ${to}`,
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event = 'checkout_started' AND createdAt >= ${from} AND createdAt <= ${to}`,
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event = 'payment_approved' AND createdAt >= ${from} AND createdAt <= ${to}`,
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event = 'first_send_success' AND createdAt >= ${from} AND createdAt <= ${to}`,
    ])

    await writeAdminAuditLog(req, { action: 'admin.marketing.overview.read', resource: 'marketingOverview' })
    return {
      signups: Number(signups?.[0]?.total || 0),
      checkouts: Number(checkouts?.[0]?.total || 0),
      approvedPayments: Number(approved?.[0]?.total || 0),
      firstValueActions: Number(firstSuccess?.[0]?.total || 0),
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
        COALESCE(json_extract(metadata, '$.ref'), 'none') as campaign,
        COUNT(*) as signups
      FROM AnalyticsEvent
      WHERE event = 'signup_created'
        AND createdAt >= ${from}
        AND createdAt <= ${to}
      GROUP BY COALESCE(json_extract(metadata, '$.source'), 'unknown'), COALESCE(json_extract(metadata, '$.ref'), 'none')
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


  app.get('/marketing/data-trust', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:read'))) return
    const { from, to } = parseDateRange(req.query, 30)
    const [totalSignups, withSource, withRef, events24h] = await Promise.all([
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event = 'signup_created' AND createdAt >= ${from} AND createdAt <= ${to}`,
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event = 'signup_created' AND createdAt >= ${from} AND createdAt <= ${to} AND COALESCE(json_extract(metadata, '$.source'), '') <> ''`,
      db.$queryRaw`SELECT COUNT(*) as total FROM AnalyticsEvent WHERE event = 'signup_created' AND createdAt >= ${from} AND createdAt <= ${to} AND COALESCE(json_extract(metadata, '$.ref'), '') <> ''`,
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
    const running = listRunningBots().includes(user.id)
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

    const { page, limit, skip } = getPagination(req.query, 30)
    const { status = 'all', platform, userId } = req.query
    const { from, to } = parseDateRange(req.query, 7)
    const where = {
      sentAt: { gte: from, lte: to },
      ...(status !== 'all' ? { status } : {}),
      ...(platform ? { platform: { contains: String(platform) } } : {}),
      ...(userId ? { userId } : {}),
    }

    const [total, logs] = await Promise.all([
      db.messageLog.count({ where }),
      db.messageLog.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: limit,
        skip,
        include: { user: { select: { id: true, email: true, plan: true, contactPhone: true } } },
      }),
    ])

    await writeAdminAuditLog(req, { action: 'admin.logs.list', resource: 'messageLog' })

    return {
      total,
      page,
      limit,
      logs: logs.map(log => ({
        ...log,
        user: sanitizeUser(log.user, req.admin.role),
      })),
    }
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
    const running = new Set(listRunningBots())
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
}
