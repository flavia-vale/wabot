import { randomBytes } from 'crypto'
import defaultDb from '../../db.js'

const db = defaultDb

const DEFAULT_SETTINGS = { cookieDurationHours: 24, commissionPercent: 30, commissionRecurringPercent: 30, recurringCommissionEnabled: true, commissionHoldDays: 30, attributionWindowDays: 30, attributionModel: 'last_non_direct' }

export async function getAffiliateSettings(dbi = db) {
  const settings = await dbi.affiliateSettings.findFirst({ where: { id: 1 } })
  return settings ?? DEFAULT_SETTINGS
}

function normalizeComparable(value) {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function addDays(date, days) {
  const base = date ? new Date(date) : new Date()
  return new Date(base.getTime() + Math.max(0, Number(days) || 0) * 24 * 60 * 60 * 1000)
}

function pixMatchesReferredUser(profile, referredUser) {
  const pix = normalizeComparable(profile?.pixKey)
  if (!pix) return false
  if (profile?.pixKeyType === 'email' && pix === normalizeComparable(referredUser?.email)) return true
  if (profile?.pixKeyType === 'phone' && normalizeDigits(pix) && normalizeDigits(pix) === normalizeDigits(referredUser?.contactPhone)) return true
  return false
}

export function evaluateAffiliateCommissionRisk({ profile, referredUser }) {
  if (!profile || !referredUser) return { decision: 'block', reason: 'missing_affiliate_or_user' }
  if (profile.userId && profile.userId === referredUser.id) return { decision: 'block', reason: 'self_referral' }
  if (normalizeComparable(profile.user?.email) && normalizeComparable(profile.user?.email) === normalizeComparable(referredUser.email)) return { decision: 'block', reason: 'same_email' }
  if (normalizeDigits(profile.user?.contactPhone) && normalizeDigits(profile.user?.contactPhone) === normalizeDigits(referredUser.contactPhone)) return { decision: 'block', reason: 'same_phone' }
  if (pixMatchesReferredUser(profile, referredUser)) return { decision: 'hold', reason: `pix_matches_referred_${profile.pixKeyType}` }
  return { decision: 'allow' }
}

export async function recordAffiliateAttributionTouch({ affiliateId, affiliateCode, userId, clickId = null, visitorId = null, source = null, medium = null, campaign = null, landingPage = null, ipHash = null, uaHash = null, touchedAt = new Date(), db: dbi = db } = {}) {
  if (!affiliateId || typeof dbi.affiliateAttributionTouch?.create !== 'function') return { skipped: 'missing_affiliate_or_store' }
  const touch = await dbi.affiliateAttributionTouch.create({
    data: {
      affiliateId,
      affiliateCode: affiliateCode || null,
      userId: userId || null,
      clickId: clickId || null,
      visitorId: visitorId || null,
      source: source || null,
      medium: medium || null,
      campaign: campaign || null,
      landingPage: landingPage || null,
      ipHash: ipHash || null,
      uaHash: uaHash || null,
      touchedAt,
    },
  })
  return { created: true, touchId: touch.id }
}

export async function attachAffiliateAttributionTouchesToUser({ visitorId, userId, affiliateId = null, db: dbi = db } = {}) {
  const normalizedVisitorId = String(visitorId ?? '').trim().slice(0, 120)
  if (!normalizedVisitorId || !userId || typeof dbi.affiliateAttributionTouch?.updateMany !== 'function') return { updated: 0, skipped: 'missing_visitor_or_store' }
  const where = { visitorId: normalizedVisitorId, userId: null }
  if (affiliateId) where.affiliateId = affiliateId
  const result = await dbi.affiliateAttributionTouch.updateMany({ where, data: { userId } })
  return { updated: result.count ?? 0 }
}

async function generateUniqueCode() {
  for (let i = 0; i < 10; i++) {
    const code = randomBytes(4).toString('hex').toUpperCase()
    const exists = await db.affiliateProfile.findUnique({ where: { code } })
    if (!exists) return code
  }
  throw new Error('Não foi possível gerar código único de afiliado')
}

export async function applyAffiliate({ userId, pixKey, pixKeyType }) {
  const existing = await db.affiliateProfile.findUnique({ where: { userId } })

  if (existing) {
    if (existing.status === 'rejected') {
      return db.affiliateProfile.update({
        where: { userId },
        data: { pixKey, pixKeyType, status: 'pending', appliedAt: new Date(), rejectedAt: null, adminNotes: null },
      })
    }
    const err = new Error('Candidatura já existe')
    err.statusCode = 409
    throw err
  }

  const code = await generateUniqueCode()
  return db.affiliateProfile.create({
    data: { userId, code, pixKey, pixKeyType, status: 'pending', appliedAt: new Date() },
  })
}

export async function getAffiliateMeData({ userId }) {
  const profile = await db.affiliateProfile.findUnique({ where: { userId } })
  if (!profile) return null

  const [totalReferrals, commissions] = await Promise.all([
    db.user.count({ where: { affiliateProfileId: profile.id } }),
    db.affiliateCommission.findMany({
      where: { affiliateId: profile.id },
      orderBy: { cycleMonth: 'desc' },
    }),
  ])

  const payableStatuses = new Set(['eligible', 'approved'])
  const paidCommissions = commissions.filter(c => c.status === 'paid')
  const payableCommissions = commissions.filter(c => payableStatuses.has(c.status))
  const pendingCommissions = commissions.filter(c => ['pending', 'held'].includes(c.status))
  const reversedCommissions = commissions.filter(c => c.status === 'reversed')
  const totalEarnedCents = paidCommissions.reduce((s, c) => s + c.commissionAmountCents, 0)
  const payableCents = payableCommissions.reduce((s, c) => s + c.commissionAmountCents, 0)
  const pendingCents = pendingCommissions.reduce((s, c) => s + c.commissionAmountCents, 0)
  const reversedCents = reversedCommissions.reduce((s, c) => s + c.commissionAmountCents, 0)
  const totalSales = commissions.filter(c => c.status !== 'reversed').length

  const statusPriority = { held: 1, pending: 2, eligible: 3, approved: 4, paid: 5, reversed: 6 }
  const byMonth = {}
  for (const c of commissions) {
    if (!byMonth[c.cycleMonth]) byMonth[c.cycleMonth] = { month: c.cycleMonth, totalCents: 0, status: c.status, count: 0 }
    if (c.status !== 'reversed') byMonth[c.cycleMonth].totalCents += c.commissionAmountCents
    byMonth[c.cycleMonth].count++
    const currentPriority = statusPriority[byMonth[c.cycleMonth].status] ?? 99
    const nextPriority = statusPriority[c.status] ?? 99
    if (nextPriority < currentPriority) byMonth[c.cycleMonth].status = c.status
  }

  return {
    profile,
    stats: { totalReferrals, totalSales, totalEarnedCents, payableCents, pendingCents, reversedCents },
    months: Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month)),
  }
}

// Mesma classificação canônica usada no admin (src/api/routes/admin.js:getAccessStatus)
// — replicada aqui para manter o service db-free e sem dependência circular com as rotas.
export function resolveAccessStatus(user, now = new Date()) {
  if (user.status === 'banned' || user.status === 'suspended') return user.status
  if (user.accessExpiresAt && new Date(user.accessExpiresAt) < now) return 'expired'
  if (user.plan === 'trial') return 'trial'
  return 'active'
}

// "Maria Silva Souza" -> "Maria S." — preserva o primeiro nome e a inicial do
// segundo para a visão anônima do próprio afiliado (sem expor o nome completo).
function maskName(name) {
  if (!name) return 'Cliente'
  const parts = String(name).trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`
}

// Lista os clientes indicados por um afiliado, enriquecidos com situação de
// acesso, agregados de pagamento e comissão gerada. Os agregados são montados em
// memória a partir de dois findMany (pagamentos + comissões dos usuários da
// página) para evitar N+1 — o volume por afiliado/página é limitado por `limit`.
export async function getAffiliateReferrals({ affiliateProfileId, page = 1, limit = 25, anonymized = false, db: dbi = db, now = new Date() }) {
  const skip = (page - 1) * limit

  const [total, users] = await Promise.all([
    dbi.user.count({ where: { affiliateProfileId } }),
    dbi.user.findMany({
      where: { affiliateProfileId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true, name: true, email: true, contactPhone: true,
        status: true, plan: true, accessExpiresAt: true,
        createdAt: true, lastActivityAt: true,
      },
    }),
  ])

  const userIds = users.map(u => u.id)
  const [payments, commissions] = userIds.length
    ? await Promise.all([
      dbi.payment.findMany({
        where: { userId: { in: userIds }, status: 'approved' },
        select: { userId: true, amount: true, createdAt: true },
      }),
      dbi.affiliateCommission.findMany({
        where: { affiliateId: affiliateProfileId, referredUserId: { in: userIds } },
        select: { referredUserId: true, commissionType: true, commissionAmountCents: true },
      }),
    ])
    : [[], []]

  const payAgg = new Map()
  for (const p of payments) {
    const cur = payAgg.get(p.userId) ?? { count: 0, totalCents: 0, lastPaymentAt: null }
    cur.count += 1
    cur.totalCents += Math.round(p.amount * 100)
    if (!cur.lastPaymentAt || new Date(p.createdAt) > new Date(cur.lastPaymentAt)) cur.lastPaymentAt = p.createdAt
    payAgg.set(p.userId, cur)
  }

  const commAgg = new Map()
  for (const c of commissions) {
    const cur = commAgg.get(c.referredUserId) ?? { initialCents: 0, recurringCents: 0, totalCents: 0 }
    if (c.commissionType === 'recurring') cur.recurringCents += c.commissionAmountCents
    else cur.initialCents += c.commissionAmountCents
    cur.totalCents += c.commissionAmountCents
    commAgg.set(c.referredUserId, cur)
  }

  const referrals = users.map(u => {
    const pay = payAgg.get(u.id) ?? { count: 0, totalCents: 0, lastPaymentAt: null }
    const comm = commAgg.get(u.id) ?? { initialCents: 0, recurringCents: 0, totalCents: 0 }
    const accessStatus = resolveAccessStatus(u, now)
    const isActive = accessStatus === 'active' || accessStatus === 'trial'

    if (anonymized) {
      // Visão do próprio afiliado: sem e-mail/telefone e sem valores de
      // pagamento do cliente. Mantém nº de pagamentos e a comissão (ganho do
      // próprio afiliado) e mascara o nome.
      return {
        name: maskName(u.name),
        createdAt: u.createdAt,
        accessStatus,
        isActive,
        paymentCount: pay.count,
        commissionTotalCents: comm.totalCents,
      }
    }

    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      contactPhone: u.contactPhone,
      status: u.status,
      plan: u.plan,
      accessExpiresAt: u.accessExpiresAt,
      createdAt: u.createdAt,
      lastActivityAt: u.lastActivityAt,
      accessStatus,
      isActive,
      paymentCount: pay.count,
      totalPaidCents: pay.totalCents,
      lastPaymentAt: pay.lastPaymentAt,
      commissionInitialCents: comm.initialCents,
      commissionRecurringCents: comm.recurringCents,
      commissionTotalCents: comm.totalCents,
    }
  })

  return { referrals, total, page, limit }
}

function resolveRate(settings, profile, isRecurring) {
  if (isRecurring) {
    return profile.commissionRecurringPercentOverride ?? settings.commissionRecurringPercent
  }
  return profile.commissionPercentOverride ?? settings.commissionPercent
}

export const COMMISSION_PAYABLE_STATUSES = ['eligible', 'approved']
export const COMMISSION_APPROVABLE_STATUSES = ['held', 'eligible']
export const COMMISSION_REVERSIBLE_STATUSES = ['pending', 'eligible', 'approved', 'held']

export async function approveAffiliateCommission({ id, adminUserId, db: dbi = db } = {}) {
  if (!id) throw new Error('approveAffiliateCommission: id obrigatório')
  const now = new Date()
  const result = await dbi.affiliateCommission.updateMany({
    where: { id, status: { in: COMMISSION_APPROVABLE_STATUSES } },
    data: { status: 'approved', approvedAt: now, approvedByUserId: adminUserId ?? null },
  })
  if (result.count !== 1) return { updated: false, reason: 'not_approvable' }
  const commission = typeof dbi.affiliateCommission.findUnique === 'function'
    ? await dbi.affiliateCommission.findUnique({ where: { id } })
    : null
  return { updated: true, commission }
}

export async function reverseAffiliateCommission({ id, reason, db: dbi = db } = {}) {
  if (!id) throw new Error('reverseAffiliateCommission: id obrigatório')
  const normalizedReason = String(reason ?? '').trim().slice(0, 500)
  if (!normalizedReason) return { updated: false, reason: 'missing_reason' }
  const now = new Date()
  const result = await dbi.affiliateCommission.updateMany({
    where: { id, status: { in: COMMISSION_REVERSIBLE_STATUSES } },
    data: { status: 'reversed', reversedAt: now, reversalReason: normalizedReason },
  })
  if (result.count !== 1) return { updated: false, reason: 'not_reversible' }
  const commission = typeof dbi.affiliateCommission.findUnique === 'function'
    ? await dbi.affiliateCommission.findUnique({ where: { id } })
    : null
  return { updated: true, commission }
}

export async function reverseAffiliateCommissionForPayment({ paymentId, reason, db: dbi = db } = {}) {
  if (!paymentId) throw new Error('reverseAffiliateCommissionForPayment: paymentId obrigatório')
  const normalizedReason = String(reason ?? '').trim().slice(0, 500)
  if (!normalizedReason) return { updated: 0, reason: 'missing_reason' }
  const now = new Date()
  const result = await dbi.affiliateCommission.updateMany({
    where: { paymentId, status: { in: COMMISSION_REVERSIBLE_STATUSES } },
    data: { status: 'reversed', reversedAt: now, reversalReason: normalizedReason },
  })
  if ((result.count ?? 0) < 1) return { updated: 0, reason: 'not_reversible' }
  return { updated: result.count ?? 0 }
}

export async function tryCreateAffiliateCommission({ userId, paymentId, saleAmountCents, occurredAt, log, db: dbi = db }) {
  try {
    const user = await dbi.user.findUnique({ where: { id: userId }, select: { id: true, email: true, contactPhone: true, affiliateProfileId: true } })
    const paymentSnapshot = typeof dbi.payment?.findUnique === 'function'
      ? await dbi.payment.findUnique({ where: { id: paymentId }, select: { affiliateProfileIdAtCheckout: true } }).catch(() => null)
      : null
    const attributedAffiliateId = paymentSnapshot?.affiliateProfileIdAtCheckout ?? user?.affiliateProfileId ?? null
    if (!attributedAffiliateId) return { skipped: 'no_affiliate' }

    const profile = await dbi.affiliateProfile.findUnique({
      where: { id: attributedAffiliateId },
      include: { user: { select: { id: true, email: true, contactPhone: true } } },
    })
    if (!profile || profile.status !== 'approved') return { skipped: 'not_approved' }

    const existingCommission = await dbi.affiliateCommission.findFirst({ where: { referredUserId: userId, affiliateId: profile.id } })
    const isRecurring = !!existingCommission

    const settings = await getAffiliateSettings(dbi)
    if (isRecurring && !settings.recurringCommissionEnabled) return { skipped: 'recurring_disabled' }

    const risk = evaluateAffiliateCommissionRisk({ profile, referredUser: user })
    if (risk.decision === 'block') return { skipped: risk.reason }

    const commissionRatePct = resolveRate(settings, profile, isRecurring)
    const commissionAmountCents = Math.round(saleAmountCents * commissionRatePct / 100)
    // occurredAt permite que a reconciliação retroativa atribua a comissão ao
    // ciclo do pagamento original, não ao mês em que o backfill rodou.
    const cycleMonth = (occurredAt ? new Date(occurredAt) : new Date()).toISOString().slice(0, 7)
    const eligibleAt = addDays(occurredAt, settings.commissionHoldDays ?? DEFAULT_SETTINGS.commissionHoldDays)
    const isHeld = risk.decision === 'hold'

    const commission = await dbi.affiliateCommission.create({
      data: {
        affiliateId: profile.id,
        paymentId,
        referredUserId: userId,
        saleAmountCents,
        commissionAmountCents,
        commissionType: isRecurring ? 'recurring' : 'initial',
        commissionRatePct,
        status: isHeld ? 'held' : 'pending',
        cycleMonth,
        eligibleAt,
        ...(isHeld ? { heldAt: new Date(), holdReason: risk.reason } : {}),
      },
    })
    return { created: true, commissionId: commission.id, commissionType: commission.commissionType, status: commission.status }
  } catch (err) {
    if (err.code === 'P2002') return { skipped: 'duplicate_payment' }
    log?.error?.({ err }, 'tryCreateAffiliateCommission failed')
    throw err
  }
}

// Rede de segurança para o fire-and-forget dos webhooks de pagamento: qualquer
// comissão que deixou de ser criada (SQLITE_BUSY, restart no meio do webhook,
// ativação via caminho que pulou a criação) é recriada aqui. Idempotente por
// construção (AffiliateCommission.paymentId é @unique) — pode rodar quantas
// vezes for preciso, inclusive como backfill histórico.
export async function reconcileAffiliateCommissions({ db: dbi = db, log, batchSize = 100 } = {}) {
  const payments = await dbi.payment.findMany({
    where: {
      status: 'approved',
      affiliateCommission: null,
      // filtra perfis aprovados direto na query para que skips permanentes
      // (afiliado pendente/rejeitado) não ocupem o batch a cada ciclo
      user: { affiliateRef: { status: 'approved' } },
    },
    select: { id: true, userId: true, amount: true, createdAt: true },
    // asc preserva a classificação initial/recurring no backfill (a primeira
    // comissão do par afiliado+indicado é a 'initial')
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  })

  const result = { checked: payments.length, created: 0, skipped: 0, failed: 0 }
  for (const payment of payments) {
    try {
      const outcome = await tryCreateAffiliateCommission({
        userId: payment.userId,
        paymentId: payment.id,
        saleAmountCents: Math.round(payment.amount * 100),
        occurredAt: payment.createdAt,
        log,
        db: dbi,
      })
      if (outcome.created) {
        result.created++
        log?.info?.({ paymentId: payment.id, commissionId: outcome.commissionId }, 'affiliate_commission_reconciled')
      } else {
        result.skipped++
      }
    } catch (err) {
      result.failed++
      log?.error?.({ err: err?.message, paymentId: payment.id }, 'affiliate_commission_reconcile_failed')
    }
  }
  return result
}


export async function promoteEligibleAffiliateCommissions({ db: dbi = db, now = new Date(), batchSize = 200, log } = {}) {
  const rows = await dbi.affiliateCommission.findMany({
    where: { status: 'pending', eligibleAt: { lte: now } },
    select: { id: true },
    orderBy: { eligibleAt: 'asc' },
    take: batchSize,
  })

  const result = { checked: rows.length, promoted: 0, failed: 0 }
  for (const row of rows) {
    try {
      await dbi.affiliateCommission.update({
        where: { id: row.id },
        data: { status: 'eligible' },
      })
      result.promoted++
    } catch (err) {
      result.failed++
      log?.error?.({ err: err?.message, commissionId: row.id }, 'affiliate_commission_eligibility_failed')
    }
  }
  return result
}
