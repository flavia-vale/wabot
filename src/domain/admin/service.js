export function createAdminService({
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
} = {}) {
  if (!db) throw new Error('createAdminService: db é obrigatório')

  async function getOverview() {
    return getOperationalOverview()
  }

  async function listUsers({ query, adminRole }) {
    const { page, limit, skip } = getPagination(query)
    const { status, plan, risk, search } = query
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
          id: true, name: true, email: true, contactPhone: true, status: true, plan: true, accessExpiresAt: true,
          lastLoginAt: true, lastActivityAt: true, lastSupportContactAt: true, supportStatus: true, createdAt: true,
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

    const running = new Set(await listRunningBots())

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
        }, adminRole)
      }),
    }
  }

  async function listLogs({ query, adminRole }) {
    const { page, limit, skip } = getPagination(query, 30)
    const { status = 'all', platform, userId } = query
    const { from, to } = parseDateRange(query, 7)
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

    return {
      total,
      page,
      limit,
      logs: logs.map(log => ({ ...log, user: sanitizeUser(log.user, adminRole) })),
    }
  }

  return { getOverview, listUsers, listLogs }
}
