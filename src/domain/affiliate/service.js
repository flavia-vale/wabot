import { randomBytes } from 'crypto'
import defaultDb from '../../db.js'

const db = defaultDb

const DEFAULT_SETTINGS = { cookieDurationHours: 24, commissionPercent: 30, commissionRecurringPercent: 30, recurringCommissionEnabled: true }

export async function getAffiliateSettings(dbi = db) {
  const settings = await dbi.affiliateSettings.findFirst({ where: { id: 1 } })
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

export async function tryCreateAffiliateCommission({ userId, paymentId, saleAmountCents, occurredAt, log, db: dbi = db }) {
  try {
    const user = await dbi.user.findUnique({ where: { id: userId }, select: { affiliateProfileId: true } })
    if (!user?.affiliateProfileId) return { skipped: 'no_affiliate' }

    const profile = await dbi.affiliateProfile.findUnique({ where: { id: user.affiliateProfileId } })
    if (!profile || profile.status !== 'approved') return { skipped: 'not_approved' }

    const existingCommission = await dbi.affiliateCommission.findFirst({ where: { referredUserId: userId, affiliateId: profile.id } })
    const isRecurring = !!existingCommission

    const settings = await getAffiliateSettings(dbi)
    if (isRecurring && !settings.recurringCommissionEnabled) return { skipped: 'recurring_disabled' }

    const commissionRatePct = resolveRate(settings, profile, isRecurring)
    const commissionAmountCents = Math.round(saleAmountCents * commissionRatePct / 100)
    // occurredAt permite que a reconciliação retroativa atribua a comissão ao
    // ciclo do pagamento original, não ao mês em que o backfill rodou.
    const cycleMonth = (occurredAt ? new Date(occurredAt) : new Date()).toISOString().slice(0, 7)

    const commission = await dbi.affiliateCommission.create({
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
