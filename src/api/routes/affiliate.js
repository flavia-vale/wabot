import { createHash } from 'crypto'
import { COMMISSION_PAYABLE_STATUSES, applyAffiliate, approveAffiliateCommission, getAffiliateMeData, getAffiliateReferrals, getAffiliateSettings, recordAffiliateAttributionTouch, reverseAffiliateCommission, tryCreateAffiliateCommission, writeCommissionLedger, createPayoutRequest, listAffiliatePayoutRequests, confirmPayoutRequest, rejectPayoutRequest } from '../../domain/affiliate/service.js'
import { computeDebtCents, computeAvailableCents } from '../../domain/affiliate/affiliateBalance.js'
import { validatePixKey } from '../../domain/affiliate/pixKeyValidation.js'
import { sendAffiliateApprovedEmail, sendAffiliateRejectedEmail, sendCommissionPaidEmail } from '../../email/affiliateEmails.js'
import { encryptCredential, decryptCredential } from '../../credentialCrypto.js'
import { createTrackGuard } from './affiliateTrackGuard.js'
import { resolveAdminAccess, writeAdminAuditLog } from './admin.js'
import db from '../../db.js'

// R2: guarda in-memory do /affiliate/track (rate-limit + dedup). Cleanup unref().
const trackGuard = createTrackGuard()
const trackCleanupTimer = setInterval(() => trackGuard.cleanup(), 5 * 60_000)
trackCleanupTimer.unref?.()

async function loadAdminUser(userId) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      status: true,
      adminUser: { select: { id: true, role: true, status: true } },
    },
  })
}

const ROLE_PERMISSIONS = {
  owner: ['admin:read', 'admin:write', 'billing:read', 'billing:write', 'support:read', 'support:write', 'tech:read', 'tech:write'],
  admin: ['admin:read', 'billing:read', 'support:read', 'support:write', 'tech:read', 'tech:write'],
  billing_admin: ['admin:read', 'billing:read', 'billing:write', 'support:read'],
  support: ['admin:read', 'support:read', 'support:write'],
  tech_support: ['admin:read', 'support:read', 'tech:read', 'tech:write'],
  read_only: ['admin:read', 'support:read'],
}


function shortHash(value) {
  if (value == null || value === '') return null
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 12)
}


function toSafeTrackingValue(value, max = 120) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text ? text.slice(0, max) : null
}

function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

async function requireAdminAccess(req, reply, permission) {
  const user = await loadAdminUser(req.user.sub)
  const access = resolveAdminAccess(user)
  if (!access.role || !hasPermission(access.role, permission)) {
    reply.code(403).send({ error: 'Acesso admin negado' })
    return null
  }
  return access
}

export async function affiliateRoutes(app) {
  app.get('/affiliate/config', async (_req, _reply) => {
    const settings = await getAffiliateSettings()
    return {
      cookieDurationHours: settings.cookieDurationHours,
      commissionPercent: settings.commissionPercent,
      commissionRecurringPercent: settings.commissionRecurringPercent,
      recurringCommissionEnabled: settings.recurringCommissionEnabled,
      commissionHoldDays: settings.commissionHoldDays,
      attributionWindowDays: settings.attributionWindowDays,
      attributionModel: settings.attributionModel,
    }
  })


  app.post('/affiliate/track', async (req, reply) => {
    const { affiliateCode, visitorId, source, medium, campaign, landingPage } = req.body ?? {}
    const code = typeof affiliateCode === 'string' ? affiliateCode.trim().toUpperCase().slice(0, 64) : ''
    const normalizedVisitorId = typeof visitorId === 'string' ? visitorId.trim().slice(0, 120) : ''
    if (!code || !normalizedVisitorId) return reply.code(400).send({ error: 'affiliateCode e visitorId são obrigatórios' })

    // Rate-limit ANTES do lookup no banco, para o flood não tocar o SQLite.
    if (trackGuard.rateLimited(req.ip)) return reply.code(429).send({ tracked: false, reason: 'rate_limited' })

    const profile = await db.affiliateProfile.findUnique({ where: { code }, select: { id: true, code: true, status: true } }).catch(() => null)
    if (!profile || profile.status !== 'approved') return { tracked: false, reason: 'affiliate_not_approved' }

    // Dedup: um mesmo (visitor, afiliado) não grava N touches em poucos minutos.
    if (trackGuard.isDuplicate(normalizedVisitorId, profile.id)) return { tracked: true, deduped: true }

    await recordAffiliateAttributionTouch({
      affiliateId: profile.id,
      affiliateCode: profile.code,
      visitorId: normalizedVisitorId,
      source: toSafeTrackingValue(source) || 'affiliate_link',
      medium: toSafeTrackingValue(medium),
      campaign: toSafeTrackingValue(campaign),
      landingPage: toSafeTrackingValue(landingPage, 500),
      ipHash: shortHash(req.ip),
      uaHash: shortHash(req.headers?.['user-agent']),
      db,
    })
    return { tracked: true }
  })

  app.post('/affiliate/apply', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { pixKey, pixKeyType } = req.body ?? {}
    if (!pixKey || !pixKeyType) return reply.code(400).send({ error: 'pixKey e pixKeyType são obrigatórios' })
    const validTypes = ['cpf', 'email', 'phone', 'random']
    if (!validTypes.includes(pixKeyType)) return reply.code(400).send({ error: 'pixKeyType inválido' })

    try {
      const profile = await applyAffiliate({ userId: req.user.sub, pixKey, pixKeyType })
      return { profile }
    } catch (err) {
      if (err.statusCode === 409) return reply.code(409).send({ error: err.message })
      if (err.statusCode === 400) return reply.code(400).send({ error: err.message })
      throw err
    }
  })

  app.get('/affiliate/me', { onRequest: [app.authenticate] }, async (req, reply) => {
    const data = await getAffiliateMeData({ userId: req.user.sub })
    if (!data) return { profile: null }
    return data
  })

  app.put('/affiliate/me', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { pixKey, pixKeyType } = req.body ?? {}
    if (!pixKey || !pixKeyType) return reply.code(400).send({ error: 'pixKey e pixKeyType são obrigatórios' })
    const validTypes = ['cpf', 'email', 'phone', 'random']
    if (!validTypes.includes(pixKeyType)) return reply.code(400).send({ error: 'pixKeyType inválido' })

    // US3 (009-affiliate-improvements-r1): valida o FORMATO da chave PIX
    // ANTES de encryptCredential (FR-021).
    const validation = validatePixKey({ pixKey, pixKeyType })
    if (!validation.ok) return reply.code(400).send({ error: validation.error })

    const existing = await db.affiliateProfile.findUnique({ where: { userId: req.user.sub } })
    if (!existing) return reply.code(404).send({ error: 'Perfil de afiliado não encontrado' })

    const updated = await db.affiliateProfile.update({
      where: { userId: req.user.sub },
      data: { pixKey: encryptCredential(pixKey), pixKeyType },
    })
    return { profile: { ...updated, pixKey: decryptCredential(updated.pixKey) } }
  })

  // Visão anônima do próprio afiliado: quem se cadastrou com o código dele,
  // sem expor contato nem valores de pagamento do cliente.
  app.get('/affiliate/me/referrals', { onRequest: [app.authenticate] }, async (req, reply) => {
    const profile = await db.affiliateProfile.findUnique({ where: { userId: req.user.sub } })
    if (!profile || profile.status !== 'approved') return { referrals: [], total: 0, page: 1, limit: 25 }

    const page = Math.max(1, parseInt(req.query?.page ?? '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit ?? '25') || 25))
    return getAffiliateReferrals({ affiliateProfileId: profile.id, page, limit, anonymized: true })
  })

  // US2 (009-affiliate-improvements-r1): saque self-service com valor mínimo.
  app.post('/affiliate/payout-requests', { onRequest: [app.authenticate] }, async (req, reply) => {
    const result = await createPayoutRequest({ userId: req.user.sub, db })
    if (!result.created) {
      if (result.reason === 'not_approved' || result.reason === 'disabled') return reply.code(403).send({ error: 'Solicitação de saque não disponível para este afiliado' })
      if (result.reason === 'below_minimum') return reply.code(400).send({ error: result.error })
      if (result.reason === 'open_request' || result.reason === 'debt_pending') return reply.code(409).send({ error: result.error })
      return reply.code(400).send({ error: result.error ?? 'Não foi possível solicitar o saque' })
    }
    return { payoutRequest: result.payoutRequest }
  })

  app.get('/affiliate/payout-requests', { onRequest: [app.authenticate] }, async (req, reply) => {
    const profile = await db.affiliateProfile.findUnique({ where: { userId: req.user.sub } })
    if (!profile) return { requests: [], available: { availableCents: 0, debtCents: 0, minPayoutCents: 5000, canRequest: false } }

    const settings = await getAffiliateSettings()
    const [requests, commissionRows, debtLedgerRows, openRequest] = await Promise.all([
      listAffiliatePayoutRequests({ affiliateId: profile.id, db }),
      db.affiliateCommission.groupBy({ by: ['status'], where: { affiliateId: profile.id, status: { in: COMMISSION_PAYABLE_STATUSES } }, _sum: { commissionAmountCents: true } }),
      db.affiliateCommissionLedger.groupBy({ by: ['toStatus'], where: { affiliateId: profile.id, toStatus: { in: ['debt', 'debt_settled'] } }, _sum: { amountCents: true } }),
      db.affiliatePayoutRequest.findFirst({ where: { affiliateId: profile.id, status: 'requested' } }),
    ])
    const availableCents = computeAvailableCents({ commissionRows: commissionRows.map(g => ({ status: g.status, commissionAmountCents: g._sum?.commissionAmountCents ?? 0 })) })
    const debtCents = computeDebtCents({ ledgerRows: debtLedgerRows.map(g => ({ toStatus: g.toStatus, amountCents: g._sum?.amountCents ?? 0 })) })
    const minPayoutCents = settings.minPayoutCents ?? 5000
    const canRequest = profile.status === 'approved' && settings.payoutRequestsEnabled !== false && !openRequest && debtCents === 0 && availableCents >= minPayoutCents

    return {
      requests: requests.map(r => ({ id: r.id, amountCents: r.amountCents, status: r.status, requestedAt: r.requestedAt, resolvedAt: r.resolvedAt, rejectionReason: r.rejectionReason })),
      available: { availableCents, debtCents, minPayoutCents, canRequest },
    }
  })

  app.get('/admin/affiliates/payout-requests', { onRequest: [app.authenticate] }, async (req, reply) => {
    const access = await requireAdminAccess(req, reply, 'billing:read')
    if (!access) return

    const status = req.query?.status && req.query.status !== 'all' ? req.query.status : 'requested'
    const where = status ? { status } : {}
    const [requests, total] = await Promise.all([
      db.affiliatePayoutRequest.findMany({
        where,
        orderBy: { requestedAt: 'asc' },
        include: { affiliate: { select: { id: true, code: true } } },
      }),
      db.affiliatePayoutRequest.count({ where }),
    ])

    const affiliateIds = requests.map(r => r.affiliateId)
    const debtLedgerRows = affiliateIds.length
      ? await db.affiliateCommissionLedger.groupBy({ by: ['affiliateId', 'toStatus'], where: { affiliateId: { in: affiliateIds }, toStatus: { in: ['debt', 'debt_settled'] } }, _sum: { amountCents: true } })
      : []
    const debtByAffiliate = new Map()
    for (const g of debtLedgerRows) {
      const rows = debtByAffiliate.get(g.affiliateId) ?? []
      rows.push({ toStatus: g.toStatus, amountCents: g._sum?.amountCents ?? 0 })
      debtByAffiliate.set(g.affiliateId, rows)
    }

    return {
      requests: requests.map(r => ({
        id: r.id,
        affiliateId: r.affiliateId,
        affiliateCode: r.affiliate?.code ?? null,
        amountCents: r.amountCents,
        status: r.status,
        requestedAt: r.requestedAt,
        debtCents: computeDebtCents({ ledgerRows: debtByAffiliate.get(r.affiliateId) ?? [] }),
      })),
      total,
    }
  })

  app.post('/admin/affiliates/payout-requests/:id/confirm', { onRequest: [app.authenticate] }, async (req, reply) => {
    const access = await requireAdminAccess(req, reply, 'billing:write')
    if (!access) return

    const { id } = req.params
    const before = await db.affiliatePayoutRequest.findUnique({ where: { id } })
    if (!before) return reply.code(404).send({ error: 'Solicitação de saque não encontrada' })

    const result = await confirmPayoutRequest({ id, adminUserId: req.user.sub, db })
    if (!result.updated) return reply.code(409).send({ error: 'Solicitação já foi resolvida; recarregue a página' })

    // US5 (009-affiliate-improvements-r1, T038): notificação fire-and-forget
    // de comissão paga também no confirm de saque self-service (T016/US2).
    db.affiliateProfile.findUnique({ where: { id: before.affiliateId }, include: { user: { select: { email: true } } } })
      .then(profile => sendCommissionPaidEmail({ to: profile?.user?.email, amountCents: result.payoutRequest?.amountCents }))
      .catch(() => {})

    await writeAdminAuditLog(req, {
      action: 'admin.affiliate.payout.confirm',
      resource: 'affiliatePayoutRequest',
      resourceId: id,
      before: { status: before.status, amountCents: before.amountCents },
      after: { status: 'paid', resolvedByUserId: req.user.sub },
    })
    return { payoutRequest: result.payoutRequest }
  })

  app.post('/admin/affiliates/payout-requests/:id/reject', { onRequest: [app.authenticate] }, async (req, reply) => {
    const access = await requireAdminAccess(req, reply, 'billing:write')
    if (!access) return

    const { id } = req.params
    const { reason } = req.body ?? {}
    const before = await db.affiliatePayoutRequest.findUnique({ where: { id } })
    if (!before) return reply.code(404).send({ error: 'Solicitação de saque não encontrada' })

    const result = await rejectPayoutRequest({ id, adminUserId: req.user.sub, reason, db })
    if (result.reason === 'missing_reason') return reply.code(400).send({ error: 'Motivo da recusa é obrigatório' })
    if (!result.updated) return reply.code(409).send({ error: 'Solicitação já foi resolvida; recarregue a página' })

    await writeAdminAuditLog(req, {
      action: 'admin.affiliate.payout.reject',
      resource: 'affiliatePayoutRequest',
      resourceId: id,
      before: { status: before.status, amountCents: before.amountCents },
      after: { status: 'rejected', rejectionReason: String(reason ?? '').trim().slice(0, 500), resolvedByUserId: req.user.sub },
    })
    return { payoutRequest: result.payoutRequest }
  })

  app.get('/admin/affiliates', { onRequest: [app.authenticate] }, async (req, reply) => {
    const access = await requireAdminAccess(req, reply, 'billing:read')
    if (!access) return

    const { status, page: rawPage, limit: rawLimit } = req.query ?? {}
    const page = Math.max(1, parseInt(rawPage ?? '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(rawLimit ?? '25') || 25))
    const skip = (page - 1) * limit

    const where = status && status !== 'all' ? { status } : {}

    const [profiles, total] = await Promise.all([
      db.affiliateProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { appliedAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      db.affiliateProfile.count({ where }),
    ])

    // O5: evita N+1. Em vez de 1 count por perfil + carregar TODAS as comissões
    // de cada um, agrega indicados e somas de comissão da PÁGINA em 2 queries.
    const profileIds = profiles.map(p => p.id)
    const [referralCounts, commissionSums, debtLedgerRows] = profileIds.length
      ? await Promise.all([
        db.user.groupBy({ by: ['affiliateProfileId'], where: { affiliateProfileId: { in: profileIds } }, _count: true }),
        db.affiliateCommission.groupBy({ by: ['affiliateId', 'status'], where: { affiliateId: { in: profileIds } }, _sum: { commissionAmountCents: true } }),
        // US1: saldo devedor por afiliado, derivado do ledger (nunca coluna mutável).
        db.affiliateCommissionLedger.groupBy({ by: ['affiliateId', 'toStatus'], where: { affiliateId: { in: profileIds }, toStatus: { in: ['debt', 'debt_settled'] } }, _sum: { amountCents: true } }),
      ])
      : [[], [], []]

    const referralCountMap = new Map(referralCounts.map(r => [r.affiliateProfileId, typeof r._count === 'number' ? r._count : (r._count?._all ?? 0)]))
    const sumMap = new Map()
    for (const g of commissionSums) {
      const cur = sumMap.get(g.affiliateId) ?? { total: 0, pending: 0, paid: 0 }
      const s = g._sum?.commissionAmountCents ?? 0
      cur.total += s
      if (g.status === 'pending') cur.pending += s
      if (g.status === 'paid') cur.paid += s
      sumMap.set(g.affiliateId, cur)
    }
    const debtRowsByAffiliate = new Map()
    for (const g of debtLedgerRows) {
      const rows = debtRowsByAffiliate.get(g.affiliateId) ?? []
      rows.push({ toStatus: g.toStatus, amountCents: g._sum?.amountCents ?? 0 })
      debtRowsByAffiliate.set(g.affiliateId, rows)
    }

    const enriched = profiles.map((profile) => {
      const sums = sumMap.get(profile.id) ?? { total: 0, pending: 0, paid: 0 }
      return {
        id: profile.id,
        userId: profile.userId,
        code: profile.code,
        status: profile.status,
        pixKey: decryptCredential(profile.pixKey),
        pixKeyType: profile.pixKeyType,
        appliedAt: profile.appliedAt,
        approvedAt: profile.approvedAt,
        rejectedAt: profile.rejectedAt,
        adminNotes: profile.adminNotes,
        commissionPercentOverride: profile.commissionPercentOverride,
        commissionRecurringPercentOverride: profile.commissionRecurringPercentOverride,
        user: profile.user,
        totalReferrals: referralCountMap.get(profile.id) ?? 0,
        totalCommissions: sums.total,
        pendingCommissions: sums.pending,
        paidCommissions: sums.paid,
        debtCents: computeDebtCents({ ledgerRows: debtRowsByAffiliate.get(profile.id) ?? [] }),
      }
    })

    return { profiles: enriched, total, page, limit }
  })

  // Drill-down: lista os clientes indicados por um afiliado, com situação de
  // acesso, agregados de pagamento e comissão gerada por cliente.
  app.get('/admin/affiliates/:id/referrals', { onRequest: [app.authenticate] }, async (req, reply) => {
    const access = await requireAdminAccess(req, reply, 'billing:read')
    if (!access) return

    const { id } = req.params
    const profile = await db.affiliateProfile.findUnique({
      where: { id },
      select: { id: true, code: true, status: true, user: { select: { id: true, name: true, email: true } } },
    })
    if (!profile) return reply.code(404).send({ error: 'Afiliado não encontrado' })

    const page = Math.max(1, parseInt(req.query?.page ?? '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit ?? '25') || 25))
    const result = await getAffiliateReferrals({ affiliateProfileId: id, page, limit })
    return { profile, ...result }
  })

  app.post('/admin/affiliates/:id/approve', { onRequest: [app.authenticate] }, async (req, reply) => {
    const access = await requireAdminAccess(req, reply, 'billing:write')
    if (!access) return

    const { id } = req.params
    const profile = await db.affiliateProfile.findUnique({ where: { id }, include: { user: { select: { email: true } } } })
    if (!profile) return reply.code(404).send({ error: 'Perfil não encontrado' })
    if (profile.status === 'approved') return reply.code(409).send({ error: 'Afiliado já aprovado' })

    const updated = await db.affiliateProfile.update({
      where: { id },
      data: { status: 'approved', approvedAt: new Date(), rejectedAt: null, adminNotes: null },
    })
    // US5 (009-affiliate-improvements-r1): notificação fire-and-forget,
    // best-effort e no-op sem SMTP (nunca derruba a aprovação).
    sendAffiliateApprovedEmail({ to: profile.user?.email }).catch(() => {})
    return { profile: { ...updated, pixKey: decryptCredential(updated.pixKey) } }
  })

  app.post('/admin/affiliates/:id/reject', { onRequest: [app.authenticate] }, async (req, reply) => {
    const access = await requireAdminAccess(req, reply, 'billing:write')
    if (!access) return

    const { id } = req.params
    const { adminNotes } = req.body ?? {}
    const profile = await db.affiliateProfile.findUnique({ where: { id }, include: { user: { select: { email: true } } } })
    if (!profile) return reply.code(404).send({ error: 'Perfil não encontrado' })

    const updated = await db.affiliateProfile.update({
      where: { id },
      data: { status: 'rejected', rejectedAt: new Date(), approvedAt: null, adminNotes: adminNotes || null },
    })
    // US5: notificação fire-and-forget, best-effort e no-op sem SMTP.
    sendAffiliateRejectedEmail({ to: profile.user?.email, adminNotes: adminNotes || null }).catch(() => {})
    return { profile: { ...updated, pixKey: decryptCredential(updated.pixKey) } }
  })

  app.get('/admin/affiliates/commissions', { onRequest: [app.authenticate] }, async (req, reply) => {
    const access = await requireAdminAccess(req, reply, 'billing:read')
    if (!access) return

    const { month, status, affiliateId, page: rawPage, limit: rawLimit } = req.query ?? {}
    const page = Math.max(1, parseInt(rawPage ?? '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(rawLimit ?? '50') || 50))
    const skip = (page - 1) * limit

    const where = {}
    if (month) where.cycleMonth = month
    if (status && status !== 'all') where.status = status
    if (affiliateId) where.affiliateId = affiliateId

    const [commissions, total] = await Promise.all([
      db.affiliateCommission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          affiliate: {
            include: { user: { select: { name: true, email: true } } },
          },
          referredUser: { select: { name: true, email: true, status: true, plan: true, accessExpiresAt: true } },
          payment: { select: { plan: true, amount: true } },
        },
      }),
      db.affiliateCommission.count({ where }),
    ])

    return { commissions, total, page, limit }
  })

  app.post('/admin/affiliates/commissions/:id/approve', { onRequest: [app.authenticate] }, async (req, reply) => {
    const access = await requireAdminAccess(req, reply, 'billing:write')
    if (!access) return

    const { id } = req.params
    const before = await db.affiliateCommission.findUnique({ where: { id } })
    if (!before) return reply.code(404).send({ error: 'Comissão não encontrada' })

    const result = await approveAffiliateCommission({ id, adminUserId: req.user.sub, db })
    if (!result.updated) return reply.code(409).send({ error: 'Somente comissões em hold/elegíveis podem ser aprovadas manualmente' })

    await writeAdminAuditLog(req, {
      action: 'admin.affiliate.commission.approve',
      resource: 'affiliateCommission',
      resourceId: id,
      targetUserId: before.referredUserId,
      before: { status: before.status, commissionAmountCents: before.commissionAmountCents, cycleMonth: before.cycleMonth },
      after: { status: 'approved', approvedByUserId: req.user.sub },
    })
    return { commission: result.commission }
  })

  app.post('/admin/affiliates/commissions/:id/reverse', { onRequest: [app.authenticate] }, async (req, reply) => {
    const access = await requireAdminAccess(req, reply, 'billing:write')
    if (!access) return

    const { id } = req.params
    const { reason } = req.body ?? {}
    const before = await db.affiliateCommission.findUnique({ where: { id } })
    if (!before) return reply.code(404).send({ error: 'Comissão não encontrada' })

    const result = await reverseAffiliateCommission({ id, reason, db })
    if (result.reason === 'missing_reason') return reply.code(400).send({ error: 'Motivo da reversão é obrigatório' })
    if (!result.updated) return reply.code(409).send({ error: 'Comissão paga não pode ser revertida automaticamente; faça estorno financeiro manual' })

    await writeAdminAuditLog(req, {
      action: 'admin.affiliate.commission.reverse',
      resource: 'affiliateCommission',
      resourceId: id,
      targetUserId: before.referredUserId,
      before: { status: before.status, commissionAmountCents: before.commissionAmountCents, cycleMonth: before.cycleMonth },
      after: { status: 'reversed', reversalReason: String(reason ?? '').trim().slice(0, 500) },
    })
    return { commission: result.commission }
  })

  app.post('/admin/affiliates/commissions/:id/mark-paid', { onRequest: [app.authenticate] }, async (req, reply) => {
    const access = await requireAdminAccess(req, reply, 'billing:write')
    if (!access) return

    const { id } = req.params
    const commission = await db.affiliateCommission.findUnique({ where: { id }, include: { affiliate: { select: { status: true, user: { select: { email: true } } } } } })
    if (!commission) return reply.code(404).send({ error: 'Comissão não encontrada' })
    if (commission.status === 'paid') return reply.code(409).send({ error: 'Comissão já marcada como paga' })
    if (!COMMISSION_PAYABLE_STATUSES.includes(commission.status)) return reply.code(409).send({ error: 'Somente comissões elegíveis/aprovadas podem ser pagas' })
    // O2: afiliado suspenso/rejeitado não recebe o backlog acumulado.
    if (commission.affiliate?.status !== 'approved') return reply.code(409).send({ error: 'Afiliado não está aprovado; não é possível pagar a comissão' })

    const now = new Date()
    const result = await db.affiliateCommission.updateMany({
      where: { id, status: { in: COMMISSION_PAYABLE_STATUSES } },
      data: { status: 'paid', paidAt: now, paidByUserId: req.user.sub },
    })
    if (result.count !== 1) return reply.code(409).send({ error: 'Comissão mudou de status; recarregue a página antes de pagar' })
    await writeCommissionLedger({ commissionId: id, affiliateId: commission.affiliateId, fromStatus: commission.status, toStatus: 'paid', amountCents: commission.commissionAmountCents, reason: 'mark_paid', actor: req.user.sub, at: now, db })
    // US5: notificação fire-and-forget, best-effort e no-op sem SMTP.
    sendCommissionPaidEmail({ to: commission.affiliate?.user?.email, amountCents: commission.commissionAmountCents }).catch(() => {})
    const updated = await db.affiliateCommission.findUnique({ where: { id } })
    await writeAdminAuditLog(req, {
      action: 'admin.affiliate.commission.mark_paid',
      resource: 'affiliateCommission',
      resourceId: id,
      targetUserId: commission.referredUserId,
      before: { status: commission.status, commissionAmountCents: commission.commissionAmountCents, cycleMonth: commission.cycleMonth },
      after: { status: 'paid', paidByUserId: req.user.sub },
    })
    return { commission: updated }
  })

  app.post('/admin/affiliates/cycle/:month/mark-all-paid', { onRequest: [app.authenticate] }, async (req, reply) => {
    const access = await requireAdminAccess(req, reply, 'billing:write')
    if (!access) return

    const { month } = req.params
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return reply.code(400).send({ error: 'Formato de mês inválido (use YYYY-MM)' })

    // O2: só paga comissões cujo afiliado está aprovado. updateMany não filtra
    // por relação, então selecionamos os ids elegíveis primeiro (findMany suporta
    // filtro de relação) e pagamos por id.
    const eligible = await db.affiliateCommission.findMany({
      where: { cycleMonth: month, status: { in: COMMISSION_PAYABLE_STATUSES }, affiliate: { status: 'approved' } },
      select: { id: true, affiliateId: true, status: true, commissionAmountCents: true, affiliate: { select: { user: { select: { email: true } } } } },
    })
    const ids = eligible.map(c => c.id)
    const now = new Date()
    const result = ids.length
      ? await db.affiliateCommission.updateMany({
        where: { id: { in: ids }, status: { in: COMMISSION_PAYABLE_STATUSES } },
        data: { status: 'paid', paidAt: now, paidByUserId: req.user.sub },
      })
      : { count: 0 }
    for (const c of eligible) {
      await writeCommissionLedger({ commissionId: c.id, affiliateId: c.affiliateId, fromStatus: c.status, toStatus: 'paid', amountCents: c.commissionAmountCents, reason: 'cycle_mark_all_paid', actor: req.user.sub, at: now, db })
    }
    // US5: um e-mail por afiliado com o total pago no ciclo (fire-and-forget,
    // best-effort), em vez de um por comissão — evita spam quando o afiliado
    // tem várias comissões elegíveis no mesmo mês.
    const totalByAffiliateEmail = new Map()
    for (const c of eligible) {
      const email = c.affiliate?.user?.email
      if (!email) continue
      totalByAffiliateEmail.set(email, (totalByAffiliateEmail.get(email) ?? 0) + (c.commissionAmountCents ?? 0))
    }
    for (const [email, amountCents] of totalByAffiliateEmail) {
      sendCommissionPaidEmail({ to: email, amountCents }).catch(() => {})
    }
    await writeAdminAuditLog(req, {
      action: 'admin.affiliate.cycle.mark_all_paid',
      resource: 'affiliateCommission',
      resourceId: month,
      after: { updated: result.count, paidByUserId: req.user.sub },
    })
    return { updated: result.count, month }
  })

  app.get('/admin/affiliates/settings', { onRequest: [app.authenticate] }, async (req, reply) => {
    const access = await requireAdminAccess(req, reply, 'billing:read')
    if (!access) return

    const settings = await getAffiliateSettings()
    return settings
  })

  app.put('/admin/affiliates/settings', { onRequest: [app.authenticate] }, async (req, reply) => {
    const access = await requireAdminAccess(req, reply, 'billing:write')
    if (!access) return

    const { cookieDurationHours, commissionPercent, commissionRecurringPercent, recurringCommissionEnabled, commissionHoldDays, attributionWindowDays, attributionModel, minPayoutCents, orphanTouchWindowDays, orphanTouchMode, payoutRequestsEnabled } = req.body ?? {}
    if (cookieDurationHours !== undefined && (typeof cookieDurationHours !== 'number' || cookieDurationHours < 1)) {
      return reply.code(400).send({ error: 'cookieDurationHours deve ser um número maior que 0' })
    }
    if (commissionPercent !== undefined && (typeof commissionPercent !== 'number' || commissionPercent < 0 || commissionPercent > 100)) {
      return reply.code(400).send({ error: 'commissionPercent deve ser um número entre 0 e 100' })
    }
    if (commissionRecurringPercent !== undefined && (typeof commissionRecurringPercent !== 'number' || commissionRecurringPercent < 0 || commissionRecurringPercent > 100)) {
      return reply.code(400).send({ error: 'commissionRecurringPercent deve ser um número entre 0 e 100' })
    }
    if (recurringCommissionEnabled !== undefined && typeof recurringCommissionEnabled !== 'boolean') {
      return reply.code(400).send({ error: 'recurringCommissionEnabled deve ser um booleano' })
    }
    if (commissionHoldDays !== undefined && (typeof commissionHoldDays !== 'number' || commissionHoldDays < 0 || commissionHoldDays > 365)) {
      return reply.code(400).send({ error: 'commissionHoldDays deve ser um número entre 0 e 365' })
    }
    if (attributionWindowDays !== undefined && (typeof attributionWindowDays !== 'number' || attributionWindowDays < 1 || attributionWindowDays > 365)) {
      return reply.code(400).send({ error: 'attributionWindowDays deve ser um número entre 1 e 365' })
    }
    if (attributionModel !== undefined && !['last_non_direct'].includes(attributionModel)) {
      return reply.code(400).send({ error: 'attributionModel inválido' })
    }
    if (minPayoutCents !== undefined && (!Number.isInteger(minPayoutCents) || minPayoutCents < 0)) {
      return reply.code(400).send({ error: 'minPayoutCents deve ser um inteiro maior ou igual a 0' })
    }
    if (orphanTouchWindowDays !== undefined && (!Number.isInteger(orphanTouchWindowDays) || orphanTouchWindowDays < 1 || orphanTouchWindowDays > 365)) {
      return reply.code(400).send({ error: 'orphanTouchWindowDays deve ser um inteiro entre 1 e 365' })
    }
    if (orphanTouchMode !== undefined && !['off', 'window', 'hold', 'both'].includes(orphanTouchMode)) {
      return reply.code(400).send({ error: 'orphanTouchMode deve ser off, window, hold ou both' })
    }
    if (payoutRequestsEnabled !== undefined && typeof payoutRequestsEnabled !== 'boolean') {
      return reply.code(400).send({ error: 'payoutRequestsEnabled deve ser um booleano' })
    }

    const updated = await db.affiliateSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        cookieDurationHours: cookieDurationHours ?? 24,
        commissionPercent: commissionPercent ?? 30,
        commissionRecurringPercent: commissionRecurringPercent ?? 30,
        recurringCommissionEnabled: recurringCommissionEnabled ?? true,
        commissionHoldDays: commissionHoldDays ?? 30,
        attributionWindowDays: attributionWindowDays ?? 30,
        attributionModel: attributionModel ?? 'last_non_direct',
        minPayoutCents: minPayoutCents ?? 5000,
        orphanTouchWindowDays: orphanTouchWindowDays ?? 7,
        orphanTouchMode: orphanTouchMode ?? 'both',
        payoutRequestsEnabled: payoutRequestsEnabled ?? true,
      },
      update: {
        ...(cookieDurationHours !== undefined && { cookieDurationHours }),
        ...(commissionPercent !== undefined && { commissionPercent }),
        ...(commissionRecurringPercent !== undefined && { commissionRecurringPercent }),
        ...(recurringCommissionEnabled !== undefined && { recurringCommissionEnabled }),
        ...(commissionHoldDays !== undefined && { commissionHoldDays }),
        ...(attributionWindowDays !== undefined && { attributionWindowDays }),
        ...(attributionModel !== undefined && { attributionModel }),
        ...(minPayoutCents !== undefined && { minPayoutCents }),
        ...(orphanTouchWindowDays !== undefined && { orphanTouchWindowDays }),
        ...(orphanTouchMode !== undefined && { orphanTouchMode }),
        ...(payoutRequestsEnabled !== undefined && { payoutRequestsEnabled }),
      },
    })
    return updated
  })

  app.put('/admin/affiliates/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const access = await requireAdminAccess(req, reply, 'billing:write')
    if (!access) return

    const { id } = req.params
    const { commissionPercentOverride, commissionRecurringPercentOverride } = req.body ?? {}

    if (commissionPercentOverride !== undefined && commissionPercentOverride !== null) {
      const n = Number(commissionPercentOverride)
      if (!Number.isInteger(n) || n < 0 || n > 100) return reply.code(400).send({ error: 'commissionPercentOverride deve ser inteiro entre 0 e 100' })
    }
    if (commissionRecurringPercentOverride !== undefined && commissionRecurringPercentOverride !== null) {
      const n = Number(commissionRecurringPercentOverride)
      if (!Number.isInteger(n) || n < 0 || n > 100) return reply.code(400).send({ error: 'commissionRecurringPercentOverride deve ser inteiro entre 0 e 100' })
    }

    try {
      const data = {}
      if (commissionPercentOverride !== undefined) data.commissionPercentOverride = commissionPercentOverride === null ? null : Number(commissionPercentOverride)
      if (commissionRecurringPercentOverride !== undefined) data.commissionRecurringPercentOverride = commissionRecurringPercentOverride === null ? null : Number(commissionRecurringPercentOverride)

      const profile = await db.affiliateProfile.update({ where: { id }, data })
      return { profile: { ...profile, pixKey: decryptCredential(profile.pixKey) } }
    } catch (err) {
      if (err.code === 'P2025') return reply.code(404).send({ error: 'Afiliado não encontrado' })
      throw err
    }
  })
}
