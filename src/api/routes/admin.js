import db from '../../db.js'
import { listRunningBots } from '../../manager.js'

const ROLE_PERMISSIONS = {
  owner: ['admin:read', 'admin:write', 'billing:read', 'billing:write', 'support:read', 'support:write', 'tech:read', 'tech:write'],
  admin: ['admin:read', 'billing:read', 'support:read', 'support:write', 'tech:read', 'tech:write'],
  billing_admin: ['admin:read', 'billing:read', 'billing:write', 'support:read'],
  support: ['admin:read', 'support:read', 'support:write'],
  tech_support: ['admin:read', 'support:read', 'tech:read', 'tech:write'],
  read_only: ['admin:read', 'support:read'],
}

const PAID_PLANS = ['basic', 'pro']
const EXPORT_LIMIT = 100

function getBootstrapAdminEmails() {
  return new Set(
    String(process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean)
  )
}

function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

function canSeePhone(role) {
  return hasPermission(role, 'support:write') || hasPermission(role, 'billing:read')
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

function getAccessStatus(user, now = new Date()) {
  if (user.status === 'banned' || user.status === 'suspended') return user.status
  if (user.trialExpiresAt && user.trialExpiresAt < now) return 'expired'
  if (user.plan === 'trial') return 'trial'
  return 'active'
}

function buildRiskFlags({ user, groups, successCount = 0, errorCount = 0, now = new Date(), running = false }) {
  const groupCounts = getGroupCounts(groups)
  const flags = []
  const expiresSoon = user.trialExpiresAt && user.trialExpiresAt > now && user.trialExpiresAt <= addDays(now, 7)
  const stale = !user.lastActivityAt || user.lastActivityAt < addDays(now, -2)

  if (!user.contactPhone) flags.push('missing_phone')
  if (user.status === 'banned' || user.status === 'suspended') flags.push(user.status)
  if (user.trialExpiresAt && user.trialExpiresAt < now) flags.push('expired')
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

async function getLogCountMap({ status, since }) {
  const rows = await db.messageLog.groupBy({
    by: ['userId'],
    where: { ...(status ? { status } : {}), ...(since ? { sentAt: { gte: since } } : {}) },
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

  const bootstrapEmails = getBootstrapAdminEmails()
  const bootstrapAllowed = bootstrapEmails.has(user?.email?.toLowerCase())
  const role = user?.adminUser?.status === 'active'
    ? user.adminUser.role
    : bootstrapAllowed
      ? 'owner'
      : null

  if (!user || user.status !== 'active' || !role || !hasPermission(role, permission)) {
    await writeAdminAuditLog(req, {
      action: 'admin.access_denied',
      resource: 'admin',
      reason: `Permissão exigida: ${permission}`,
      status: 'denied',
    })
    reply.code(403).send({ error: 'Acesso admin negado' })
    return false
  }

  req.admin = {
    role,
    permissions: ROLE_PERMISSIONS[role],
    adminUserId: user.adminUser?.id ?? null,
    bootstrap: !user.adminUser && bootstrapAllowed,
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
    db.user.count({ where: { status: 'active', plan: { in: PAID_PLANS }, trialExpiresAt: { gt: now } } }),
    db.user.count({ where: { status: 'active', trialExpiresAt: { gt: now, lte: inSevenDays } } }),
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
      ...(risk === 'expiring_soon' ? { trialExpiresAt: { gt: now, lte: addDays(now, 7) } } : {}),
      ...(risk === 'missing_credentials' ? { credentials: { none: {} } } : {}),
      ...(risk === 'missing_monitor' ? { groups: { none: { role: 'monitor' } } } : {}),
      ...(risk === 'missing_post' ? { groups: { none: { role: 'post' } } } : {}),
    }

    const since24h = addDays(now, -1)
    const [total, users, successMap, errorMap] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        select: {
          id: true,
          email: true,
          contactPhone: true,
          status: true,
          plan: true,
          trialExpiresAt: true,
          lastLoginAt: true,
          lastActivityAt: true,
          lastSupportContactAt: true,
          supportStatus: true,
          createdAt: true,
          waSession: { select: { status: true, phone: true, updatedAt: true } },
          groups: { select: { role: true } },
          _count: { select: { payments: true, credentials: true, messageLogs: true } },
        },
      }),
      getLogCountMap({ status: 'success' }),
      getLogCountMap({ status: 'error', since: since24h }),
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
        return sanitizeUser({
          ...user,
          groups: undefined,
          groupCounts,
          accessStatus: getAccessStatus(user, now),
          botRunning: userRunning,
          successCount,
          errorCount24h,
          riskFlags: buildRiskFlags({ user, groups: user.groups, successCount, errorCount: errorCount24h, now, running: userRunning }),
        }, req.admin.role)
      }),
    }
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
        trialExpiresAt: true,
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
        credentials: { select: { id: true, platform: true } },
        botConfig: true,
        scheduled: { orderBy: { scheduledAt: 'desc' }, take: 10 },
        payments: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })

    if (!user) return reply.code(404).send({ error: 'Cliente não encontrado' })

    const [successCount, errorCount24h, logStats, recentLogs, ltv] = await Promise.all([
      db.messageLog.count({ where: { userId: user.id, status: 'success' } }),
      db.messageLog.count({ where: { userId: user.id, status: 'error', sentAt: { gte: since24h } } }),
      db.messageLog.groupBy({ by: ['status'], where: { userId: user.id, sentAt: { gte: addDays(now, -7) } }, _count: { _all: true } }),
      db.messageLog.findMany({ where: { userId: user.id }, orderBy: { sentAt: 'desc' }, take: 20 }),
      db.payment.aggregate({ where: { userId: user.id, status: 'approved' }, _sum: { amount: true } }),
    ])
    const running = listRunningBots().includes(user.id)

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
      logStats7d: Object.fromEntries(logStats.map(row => [row.status, row._count._all])),
      recentLogs,
      successCount,
      errorCount24h,
      riskFlags: buildRiskFlags({ user, groups: user.groups, successCount, errorCount: errorCount24h, now, running }),
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
      ...(platform ? { platform } : {}),
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
              trialExpiresAt: true,
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
