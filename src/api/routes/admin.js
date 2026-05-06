import db from '../../db.js'

const ROLE_PERMISSIONS = {
  owner: ['admin:read', 'admin:write', 'billing:read', 'billing:write', 'support:read', 'support:write', 'tech:read', 'tech:write'],
  admin: ['admin:read', 'billing:read', 'support:read', 'support:write', 'tech:read', 'tech:write'],
  billing_admin: ['admin:read', 'billing:read', 'billing:write', 'support:read'],
  support: ['admin:read', 'support:read', 'support:write'],
  tech_support: ['admin:read', 'support:read', 'tech:read', 'tech:write'],
  read_only: ['admin:read', 'support:read'],
}

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

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export async function adminRoutes(app) {
  app.addHook('onRequest', app.authenticate)

  app.get('/me', async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return
    return req.admin
  })

  app.get('/overview', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'admin:read'))) return

    const now = new Date()
    const inSevenDays = addDays(now, 7)
    const twoDaysAgo = addDays(now, -2)
    const since24h = addDays(now, -1)

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
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { status: 'active' } }),
      db.user.count({ where: { contactPhone: null } }),
      db.user.count({ where: { status: 'active', plan: { in: ['basic', 'pro'] }, trialExpiresAt: { gt: now } } }),
      db.user.count({ where: { status: 'active', trialExpiresAt: { gt: now, lte: inSevenDays } } }),
      db.user.count({ where: { status: 'active', plan: { in: ['basic', 'pro'] }, OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: twoDaysAgo } }] } }),
      db.payment.count({ where: { status: 'pending' } }),
      db.payment.aggregate({ where: { status: 'approved', createdAt: { gte: addDays(now, -30) } }, _sum: { amount: true } }),
      db.messageLog.count({ where: { sentAt: { gte: since24h } } }),
      db.messageLog.count({ where: { status: 'error', sentAt: { gte: since24h } } }),
    ])

    await writeAdminAuditLog(req, { action: 'admin.overview.read', resource: 'overview' })

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
    }
  })

  app.get('/users', async (req, reply) => {
    if (!(await requireAdmin(req, reply, 'support:read'))) return

    const { page = '1', limit = '25', status, plan, risk } = req.query
    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 25))
    const now = new Date()
    const twoDaysAgo = addDays(now, -2)
    const where = {
      ...(status ? { status } : {}),
      ...(plan ? { plan } : {}),
      ...(risk === 'stale' ? { OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: twoDaysAgo } }] } : {}),
      ...(risk === 'missing_phone' ? { contactPhone: null } : {}),
      ...(risk === 'expiring_soon' ? { trialExpiresAt: { gt: now, lte: addDays(now, 7) } } : {}),
    }

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip: (pageNum - 1) * limitNum,
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
          _count: { select: { payments: true, groups: true, credentials: true, messageLogs: true } },
        },
      }),
    ])

    await writeAdminAuditLog(req, { action: 'admin.users.list', resource: 'user' })

    const canSeePhone = hasPermission(req.admin.role, 'support:write') || hasPermission(req.admin.role, 'billing:read')
    return {
      total,
      page: pageNum,
      limit: limitNum,
      users: users.map(user => ({
        ...user,
        contactPhone: canSeePhone ? user.contactPhone : maskPhone(user.contactPhone),
      })),
    }
  })
}
