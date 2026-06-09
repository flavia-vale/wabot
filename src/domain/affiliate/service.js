import { randomBytes } from 'crypto'
import db from '../../db.js'

const DEFAULT_SETTINGS = { cookieDurationHours: 24, commissionPercent: 30, commissionRecurringPercent: 30, recurringCommissionEnabled: true }

export async function getAffiliateSettings() {
  const settings = await db.affiliateSettings.findFirst({ where: { id: 1 } })
  return settings ?? DEFAULT_SETTINGS
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

  const totalEarnedCents = commissions.reduce((s, c) => s + c.commissionAmountCents, 0)
  const totalSales = commissions.length

  const byMonth = {}
  for (const c of commissions) {
    if (!byMonth[c.cycleMonth]) byMonth[c.cycleMonth] = { month: c.cycleMonth, totalCents: 0, status: 'paid', count: 0 }
    byMonth[c.cycleMonth].totalCents += c.commissionAmountCents
    byMonth[c.cycleMonth].count++
    if (c.status === 'pending') byMonth[c.cycleMonth].status = 'pending'
  }

  return {
    profile,
    stats: { totalReferrals, totalSales, totalEarnedCents },
    months: Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month)),
  }
}

function resolveRate(settings, profile, isRecurring) {
  if (isRecurring) {
    return profile.commissionRecurringPercentOverride ?? settings.commissionRecurringPercent
  }
  return profile.commissionPercentOverride ?? settings.commissionPercent
}

export async function tryCreateAffiliateCommission({ userId, paymentId, saleAmountCents, log }) {
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { affiliateProfileId: true } })
    if (!user?.affiliateProfileId) return { skipped: 'no_affiliate' }

    const profile = await db.affiliateProfile.findUnique({ where: { id: user.affiliateProfileId } })
    if (!profile || profile.status !== 'approved') return { skipped: 'not_approved' }

    const existingCommission = await db.affiliateCommission.findFirst({ where: { referredUserId: userId } })
    const isRecurring = !!existingCommission

    const settings = await getAffiliateSettings()
    if (isRecurring && !settings.recurringCommissionEnabled) return { skipped: 'recurring_disabled' }

    const commissionRatePct = resolveRate(settings, profile, isRecurring)
    const commissionAmountCents = Math.round(saleAmountCents * commissionRatePct / 100)
    const cycleMonth = new Date().toISOString().slice(0, 7)

    const commission = await db.affiliateCommission.create({
      data: {
        affiliateId: profile.id,
        paymentId,
        referredUserId: userId,
        saleAmountCents,
        commissionAmountCents,
        commissionType: isRecurring ? 'recurring' : 'initial',
        commissionRatePct,
        status: 'pending',
        cycleMonth,
      },
    })
    return { created: true, commissionId: commission.id, commissionType: commission.commissionType }
  } catch (err) {
    if (err.code === 'P2002') return { skipped: 'duplicate_payment' }
    log?.error?.({ err }, 'tryCreateAffiliateCommission failed')
    throw err
  }
}
