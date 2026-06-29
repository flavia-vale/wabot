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
      ...(risk === 'wa_disconnected' ? { OR: [{ waSession: { is: null } }, { waSession: { is: { status: { not: 'connected' } } } }] } : {}),
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
          affiliateProfileId: true,
          affiliateRef: {
            select: {
              code: true,
              status: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
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


  function normalizePhoneForWhatsApp(phone) {
    const digits = String(phone ?? '').replace(/\D/g, '')
    if (!digits) return null
    if (digits.startsWith('55')) return digits
    if (digits.length >= 10 && digits.length <= 11) return `55${digits}`
    return digits
  }

  function buildWhatsAppContactUrl(phone, name = '') {
    const digits = normalizePhoneForWhatsApp(phone)
    if (!digits) return null
    const firstName = String(name || '').trim().split(/\s+/)[0] || 'tudo bem'
    const text = `Oi, ${firstName}! Aqui é o suporte do Espelha Grupos. Vi que seu WhatsApp desconectou da ferramenta, então seus envios podem ter parado. Quer que eu te ajude a reconectar agora?`
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
  }

  async function listWaDisconnectedUsers({ query = {}, adminRole }) {
    const { page, limit, skip } = getPagination(query, 25)
    const { plan, onlyPaid, search, minSuccess = '1', noRecentContactDays } = query
    const now = new Date()
    const since24h = addDays(now, -1)
    const minSuccessCount = Math.max(0, parseInt(minSuccess, 10) || 0)
    const onlyPaidEnabled = String(onlyPaid ?? '').trim() === '1' || String(onlyPaid ?? '').trim().toLowerCase() === 'true'
    const planFilter = plan && plan !== 'all' ? String(plan) : null
    const noRecentContactCutoff = noRecentContactDays ? addDays(now, -Math.max(1, parseInt(noRecentContactDays, 10) || 1)) : null

    const where = {
      status: 'active',
      ...(planFilter ? { plan: planFilter } : {}),
      ...(onlyPaidEnabled ? { plan: { in: ['basic', 'pro'] } } : {}),
      ...(search ? { email: { contains: String(search).trim() } } : {}),
      AND: [
        { OR: [{ waSession: { is: null } }, { waSession: { is: { status: { not: 'connected' } } } }] },
        ...(noRecentContactCutoff ? [{ OR: [{ lastSupportContactAt: null }, { lastSupportContactAt: { lt: noRecentContactCutoff } }] }] : []),
      ],
    }

    const users = await db.user.findMany({
      where,
      orderBy: [{ plan: 'desc' }, { lastActivityAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(500, Math.max(limit * 4, 100)),
      select: {
        id: true, name: true, email: true, contactPhone: true, status: true, plan: true, accessExpiresAt: true,
        lastLoginAt: true, lastActivityAt: true, lastSupportContactAt: true, supportStatus: true, createdAt: true,
        waSession: { select: { status: true, phone: true, updatedAt: true, lastHeartbeatAt: true, lastDisconnectCode: true, lifecycle: true } },
        groups: { select: { role: true } },
        credentials: { select: { platform: true, data: true } },
        _count: { select: { payments: true, credentials: true, messageLogs: true } },
      },
    })

    const userIds = users.map(user => user.id)
    const [successMap, errorMap, lastMessageMap, lastSuccessRows, runningList] = await Promise.all([
      getLogCountMap({ status: 'success', userIds }),
      getLogCountMap({ status: 'error', since: since24h, userIds }),
      getLogActivityMap({ userIds }),
      userIds.length ? db.messageLog.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, status: 'success' },
        _max: { sentAt: true },
      }) : [],
      listRunningBots(),
    ])
    const running = new Set(runningList)
    const lastSuccessMap = new Map(lastSuccessRows.map(row => [row.userId, row._max.sentAt]))

    const enriched = users
      .map(user => {
        const successCount = successMap.get(user.id) ?? 0
        if (successCount < minSuccessCount) return null
        const errorCount24h = errorMap.get(user.id) ?? 0
        const lastMessageAt = lastMessageMap.get(user.id) ?? null
        const effectiveLastActivityAt = resolveEffectiveLastActivity(user, lastMessageAt)
        const groupCounts = getGroupCounts(user.groups)
        const botRunning = running.has(user.id)
        const riskUser = { ...user, lastActivityAt: effectiveLastActivityAt }
        const riskFlags = buildRiskFlags({ user: riskUser, groups: user.groups, successCount, errorCount: errorCount24h, now, running: botRunning })
        const planWeight = user.plan === 'pro' ? 35 : user.plan === 'basic' ? 25 : 10
        const successWeight = Math.min(25, successCount * 2)
        const noContactWeight = user.lastSupportContactAt ? 0 : 15
        const configPenalty = (!groupCounts.monitor || !groupCounts.post || !user._count?.credentials) ? 10 : 0
        const priorityScore = Math.max(0, Math.min(100, planWeight + successWeight + noContactWeight + (errorCount24h >= 5 ? 10 : 0) - configPenalty))
        const priorityLabel = user.plan === 'pro' || user.plan === 'basic'
          ? 'Pagante em risco'
          : successCount > 0 ? 'Trial ativado' : 'Onboarding'
        const rawContactPhone = user.contactPhone || user.waSession?.phone || ''
        const row = sanitizeUser({
          ...user,
          groups: undefined,
          credentials: undefined,
          groupCounts,
          accessStatus: getAccessStatus(user, now),
          botRunning,
          lastMessageAt,
          lastSuccessAt: lastSuccessMap.get(user.id) ?? null,
          effectiveLastActivityAt,
          successCount,
          totalLogCount: user._count?.messageLogs ?? 0,
          errorCount24h,
          credentialHealth: summarizeCredentialHealth(user.credentials),
          riskFlags,
          priorityScore,
          priorityLabel,
          suggestedAction: 'Reconectar WhatsApp e validar sessão',
          whatsappContactUrl: null,
        }, adminRole)
        const visiblePhone = row.contactPhone || row.waSession?.phone || ''
        const canUseVisiblePhone = visiblePhone && !String(visiblePhone).includes('*')
        return { ...row, whatsappContactUrl: canUseVisiblePhone ? buildWhatsAppContactUrl(rawContactPhone, user.name) : null }
      })
      .filter(Boolean)
      .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))

    const total = enriched.length
    const paginated = enriched.slice(skip, skip + limit)
    const paidAtRisk = enriched.filter(user => ['basic', 'pro'].includes(user.plan)).length
    const estimatedMrrAtRisk = enriched.reduce((sum, user) => sum + (user.plan === 'pro' ? 69 : user.plan === 'basic' ? 39 : 0), 0)
    const noRecentSupportContact = enriched.filter(user => !user.lastSupportContactAt).length

    return {
      total,
      page,
      limit,
      summary: {
        total,
        paidAtRisk,
        estimatedMrrAtRisk,
        noRecentSupportContact,
      },
      users: paginated,
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

  return { getOverview, listUsers, listWaDisconnectedUsers, listLogs }
}
