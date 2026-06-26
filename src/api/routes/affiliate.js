import { createHash } from 'crypto'
import { COMMISSION_PAYABLE_STATUSES, applyAffiliate, approveAffiliateCommission, getAffiliateMeData, getAffiliateReferrals, getAffiliateSettings, recordAffiliateAttributionTouch, reverseAffiliateCommission, tryCreateAffiliateCommission } from '../../domain/affiliate/service.js'
import { resolveAdminAccess, writeAdminAuditLog } from './admin.js'
import db from '../../db.js'

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

    const profile = await db.affiliateProfile.findUnique({ where: { code }, select: { id: true, code: true, status: true } }).catch(() => null)
    if (!profile || profile.status !== 'approved') return { tracked: false, reason: 'affiliate_not_approved' }

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

    const existing = await db.affiliateProfile.findUnique({ where: { userId: req.user.sub } })
    if (!existing) return reply.code(404).send({ error: 'Perfil de afiliado não encontrado' })

    const updated = await db.affiliateProfile.update({
      where: { userId: req.user.sub },
      data: { pixKey, pixKeyType },
    })
    return { profile: updated }
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
          commissions: { select: { commissionAmountCents: true, status: true } },
        },
      }),
      db.affiliateProfile.count({ where }),
    ])

    const enriched = await Promise.all(profiles.map(async (profile) => {
      const totalReferrals = await db.user.count({ where: { affiliateProfileId: profile.id } })
      const totalCommissions = profile.commissions.reduce((s, c) => s + c.commissionAmountCents, 0)
      const pendingCommissions = profile.commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.commissionAmountCents, 0)
      const paidCommissions = profile.commissions.filter(c => c.status === 'paid').reduce((s, c) => s + c.commissionAmountCents, 0)
      return {
        id: profile.id,
        userId: profile.userId,
        code: profile.code,
        status: profile.status,
        pixKey: profile.pixKey,
        pixKeyType: profile.pixKeyType,
        appliedAt: profile.appliedAt,
        approvedAt: profile.approvedAt,
        rejectedAt: profile.rejectedAt,
        adminNotes: profile.adminNotes,
        commissionPercentOverride: profile.commissionPercentOverride,
        commissionRecurringPercentOverride: profile.commissionRecurringPercentOverride,
        user: profile.user,
        totalReferrals,
        totalCommissions,
        pendingCommissions,
        paidCommissions,
      }
    }))

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
    const profile = await db.affiliateProfile.findUnique({ where: { id } })
    if (!profile) return reply.code(404).send({ error: 'Perfil não encontrado' })
    if (profile.status === 'approved') return reply.code(409).send({ error: 'Afiliado já aprovado' })

    const updated = await db.affiliateProfile.update({
      where: { id },
      data: { status: 'approved', approvedAt: new Date(), rejectedAt: null, adminNotes: null },
    })
    return { profile: updated }
  })

  app.post('/admin/affiliates/:id/reject', { onRequest: [app.authenticate] }, async (req, reply) => {
    const access = await requireAdminAccess(req, reply, 'billing:write')
    if (!access) return

    const { id } = req.params
    const { adminNotes } = req.body ?? {}
    const profile = await db.affiliateProfile.findUnique({ where: { id } })
    if (!profile) return reply.code(404).send({ error: 'Perfil não encontrado' })

    const updated = await db.affiliateProfile.update({
      where: { id },
      data: { status: 'rejected', rejectedAt: new Date(), approvedAt: null, adminNotes: adminNotes || null },
    })
    return { profile: updated }
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
    const commission = await db.affiliateCommission.findUnique({ where: { id } })
    if (!commission) return reply.code(404).send({ error: 'Comissão não encontrada' })
    if (commission.status === 'paid') return reply.code(409).send({ error: 'Comissão já marcada como paga' })
    if (!COMMISSION_PAYABLE_STATUSES.includes(commission.status)) return reply.code(409).send({ error: 'Somente comissões elegíveis/aprovadas podem ser pagas' })

    const result = await db.affiliateCommission.updateMany({
      where: { id, status: { in: COMMISSION_PAYABLE_STATUSES } },
      data: { status: 'paid', paidAt: new Date(), paidByUserId: req.user.sub },
    })
    if (result.count !== 1) return reply.code(409).send({ error: 'Comissão mudou de status; recarregue a página antes de pagar' })
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

    const result = await db.affiliateCommission.updateMany({
      where: { cycleMonth: month, status: { in: COMMISSION_PAYABLE_STATUSES } },
      data: { status: 'paid', paidAt: new Date(), paidByUserId: req.user.sub },
    })
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

    const { cookieDurationHours, commissionPercent, commissionRecurringPercent, recurringCommissionEnabled, commissionHoldDays, attributionWindowDays, attributionModel } = req.body ?? {}
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
      },
      update: {
        ...(cookieDurationHours !== undefined && { cookieDurationHours }),
        ...(commissionPercent !== undefined && { commissionPercent }),
        ...(commissionRecurringPercent !== undefined && { commissionRecurringPercent }),
        ...(recurringCommissionEnabled !== undefined && { recurringCommissionEnabled }),
        ...(commissionHoldDays !== undefined && { commissionHoldDays }),
        ...(attributionWindowDays !== undefined && { attributionWindowDays }),
        ...(attributionModel !== undefined && { attributionModel }),
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
      return { profile }
    } catch (err) {
      if (err.code === 'P2025') return reply.code(404).send({ error: 'Afiliado não encontrado' })
      throw err
    }
  })
}
