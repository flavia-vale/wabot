import { randomBytes } from 'crypto'
import defaultDb from '../../db.js'
import { encryptCredential, decryptCredential } from '../../credentialCrypto.js'

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
  // pixKey é cifrado em repouso (D-3); decifra antes de comparar com o indicado.
  const pix = normalizeComparable(decryptCredential(profile?.pixKey))
  if (!pix) return false
  if (profile?.pixKeyType === 'email' && pix === normalizeComparable(referredUser?.email)) return true
  if (profile?.pixKeyType === 'phone' && normalizeDigits(pix) && normalizeDigits(pix) === normalizeDigits(referredUser?.contactPhone)) return true
  return false
}

export function evaluateAffiliateCommissionRisk({ profile, referredUser, affiliateSignals = {}, referredSignals = {} }) {
  if (!profile || !referredUser) return { decision: 'block', reason: 'missing_affiliate_or_user' }
  if (profile.userId && profile.userId === referredUser.id) return { decision: 'block', reason: 'self_referral' }
  if (normalizeComparable(profile.user?.email) && normalizeComparable(profile.user?.email) === normalizeComparable(referredUser.email)) return { decision: 'block', reason: 'same_email' }
  if (normalizeDigits(profile.user?.contactPhone) && normalizeDigits(profile.user?.contactPhone) === normalizeDigits(referredUser.contactPhone)) return { decision: 'block', reason: 'same_phone' }
  // Mesmo dispositivo/rede entre afiliado e indicado (hashes do toque de
  // atribuição) — sinal de auto-indicação disfarçada. Segura para revisão manual.
  if (affiliateSignals.ipHash && affiliateSignals.ipHash === referredSignals.ipHash) return { decision: 'hold', reason: 'same_ip_hash' }
  if (affiliateSignals.uaHash && affiliateSignals.uaHash === referredSignals.uaHash) return { decision: 'hold', reason: 'same_ua_hash' }
  if (pixMatchesReferredUser(profile, referredUser)) return { decision: 'hold', reason: `pix_matches_referred_${profile.pixKeyType}` }
  return { decision: 'allow' }
}

// Lê os hashes de IP/UA do toque de atribuição mais recente de um usuário, para
// o antifraude (R5) detectar afiliado e indicado vindos do mesmo dispositivo/rede.
// Guardado para fake dbs (db-free tests sem o modelo) e best-effort.
export async function latestTouchSignals(dbi, userId) {
  if (!userId || typeof dbi?.affiliateAttributionTouch?.findFirst !== 'function') return {}
  const touch = await dbi.affiliateAttributionTouch.findFirst({
    where: { userId },
    orderBy: { touchedAt: 'desc' },
    select: { ipHash: true, uaHash: true },
  }).catch(() => null)
  return { ipHash: touch?.ipHash ?? null, uaHash: touch?.uaHash ?? null }
}

// Ledger append-only de movimentação financeira de comissão (R3). A fonte de
// verdade do saldo continua sendo a própria AffiliateCommission; o ledger é a
// trilha imutável de auditoria (quem/quando/por quê de cada transição). Best-effort
// e guardado para fake dbs — nunca derruba a transação financeira que o originou.
export async function writeCommissionLedger({ commissionId, affiliateId = null, fromStatus = null, toStatus, amountCents = 0, reason = null, actor = 'system', at = new Date(), log, db: dbi = db } = {}) {
  if (!commissionId || !toStatus || typeof dbi?.affiliateCommissionLedger?.create !== 'function') return { skipped: true }
  try {
    await dbi.affiliateCommissionLedger.create({
      data: { commissionId, affiliateId, fromStatus, toStatus, amountCents: amountCents ?? 0, reason, actor: actor ?? 'system', createdAt: at },
    })
    return { created: true }
  } catch (err) {
    log?.error?.({ err: err?.message, commissionId, toStatus }, 'affiliate_commission_ledger_write_failed')
    return { skipped: true }
  }
}

// Decifra o pixKey de um profile para exibição/uso, sem mutar o original (R1).
export function presentAffiliateProfile(profile) {
  if (!profile) return profile
  return { ...profile, pixKey: decryptCredential(profile.pixKey) }
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

// O3: fallback quando o cadastro NÃO trouxe visitorId (ex.: OAuth, body sem o
// campo). Casa touches anônimos recentes do MESMO afiliado e MESMO dispositivo
// (ipHash + uaHash) — exige os dois sinais juntos para não colar touches de IP
// compartilhado (NAT). Sem isso, um clique anônimo no link vira venda órfã.
export async function attachOrphanTouchesByDevice({ affiliateId, ipHash, uaHash, userId, windowDays = 30, db: dbi = db, now = new Date() } = {}) {
  if (!affiliateId || !userId || (!ipHash && !uaHash) || typeof dbi.affiliateAttributionTouch?.updateMany !== 'function') return { updated: 0, skipped: 'missing_signal_or_store' }
  const since = new Date(now.getTime() - Math.max(1, Number(windowDays) || 30) * 24 * 60 * 60 * 1000)
  const where = { affiliateId, userId: null, touchedAt: { gte: since } }
  if (ipHash) where.ipHash = ipHash
  if (uaHash) where.uaHash = uaHash
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
  // pixKey/CPF cifrado em repouso (D-3). encryptCredential é no-op sem a env
  // (dev/test) e idempotente.
  const encryptedPix = encryptCredential(pixKey)

  if (existing) {
    if (existing.status === 'rejected') {
      return presentAffiliateProfile(await db.affiliateProfile.update({
        where: { userId },
        data: { pixKey: encryptedPix, pixKeyType, status: 'pending', appliedAt: new Date(), rejectedAt: null, adminNotes: null },
      }))
    }
    const err = new Error('Candidatura já existe')
    err.statusCode = 409
    throw err
  }

  const code = await generateUniqueCode()
  return presentAffiliateProfile(await db.affiliateProfile.create({
    data: { userId, code, pixKey: encryptedPix, pixKeyType, status: 'pending', appliedAt: new Date() },
  }))
}

export async function getAffiliateMeData({ userId, db: dbi = db }) {
  const profile = await dbi.affiliateProfile.findUnique({ where: { userId } })
  if (!profile) return null

  // O6: agrega no banco (groupBy por mês+status) em vez de carregar TODAS as
  // comissões do afiliado em memória — escala com o tempo de vida do afiliado.
  const [totalReferrals, grouped] = await Promise.all([
    dbi.user.count({ where: { affiliateProfileId: profile.id } }),
    dbi.affiliateCommission.groupBy({
      by: ['cycleMonth', 'status'],
      where: { affiliateId: profile.id },
      _sum: { commissionAmountCents: true },
      _count: true,
    }),
  ])

  const payableStatuses = new Set(['eligible', 'approved'])
  const pendingStatuses = new Set(['pending', 'held'])
  let totalEarnedCents = 0, payableCents = 0, pendingCents = 0, reversedCents = 0, totalSales = 0
  const statusPriority = { held: 1, pending: 2, eligible: 3, approved: 4, paid: 5, reversed: 6 }
  const byMonth = {}
  for (const g of grouped) {
    const sum = g._sum?.commissionAmountCents ?? 0
    const count = typeof g._count === 'number' ? g._count : (g._count?._all ?? 0)
    if (g.status === 'paid') totalEarnedCents += sum
    else if (payableStatuses.has(g.status)) payableCents += sum
    else if (pendingStatuses.has(g.status)) pendingCents += sum
    else if (g.status === 'reversed') reversedCents += sum
    if (g.status !== 'reversed') totalSales += count

    if (!byMonth[g.cycleMonth]) byMonth[g.cycleMonth] = { month: g.cycleMonth, totalCents: 0, status: g.status, count: 0 }
    if (g.status !== 'reversed') byMonth[g.cycleMonth].totalCents += sum
    byMonth[g.cycleMonth].count += count
    const currentPriority = statusPriority[byMonth[g.cycleMonth].status] ?? 99
    const nextPriority = statusPriority[g.status] ?? 99
    if (nextPriority < currentPriority) byMonth[g.cycleMonth].status = g.status
  }

  return {
    profile: presentAffiliateProfile(profile),
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
  const current = typeof dbi.affiliateCommission.findUnique === 'function'
    ? await dbi.affiliateCommission.findUnique({ where: { id } })
    : null
  const fromStatus = current?.status ?? null
  const affiliateId = current?.affiliateId ?? null
  const amountCents = current?.commissionAmountCents ?? 0
  const now = new Date()
  const result = await dbi.affiliateCommission.updateMany({
    where: { id, status: { in: COMMISSION_APPROVABLE_STATUSES } },
    data: { status: 'approved', approvedAt: now, approvedByUserId: adminUserId ?? null },
  })
  if (result.count !== 1) return { updated: false, reason: 'not_approvable' }
  await writeCommissionLedger({ commissionId: id, affiliateId, fromStatus, toStatus: 'approved', amountCents, reason: 'manual_approve', actor: adminUserId ?? 'admin', at: now, db: dbi })
  const commission = typeof dbi.affiliateCommission.findUnique === 'function'
    ? await dbi.affiliateCommission.findUnique({ where: { id } })
    : null
  return { updated: true, commission }
}

export async function reverseAffiliateCommission({ id, reason, db: dbi = db } = {}) {
  if (!id) throw new Error('reverseAffiliateCommission: id obrigatório')
  const normalizedReason = String(reason ?? '').trim().slice(0, 500)
  if (!normalizedReason) return { updated: false, reason: 'missing_reason' }
  const current = typeof dbi.affiliateCommission.findUnique === 'function'
    ? await dbi.affiliateCommission.findUnique({ where: { id } })
    : null
  const fromStatus = current?.status ?? null
  const affiliateId = current?.affiliateId ?? null
  const amountCents = current?.commissionAmountCents ?? 0
  const now = new Date()
  const result = await dbi.affiliateCommission.updateMany({
    where: { id, status: { in: COMMISSION_REVERSIBLE_STATUSES } },
    data: { status: 'reversed', reversedAt: now, reversalReason: normalizedReason },
  })
  if (result.count !== 1) return { updated: false, reason: 'not_reversible' }
  await writeCommissionLedger({ commissionId: id, affiliateId, fromStatus, toStatus: 'reversed', amountCents, reason: normalizedReason, actor: 'admin', at: now, db: dbi })
  const commission = typeof dbi.affiliateCommission.findUnique === 'function'
    ? await dbi.affiliateCommission.findUnique({ where: { id } })
    : null
  return { updated: true, commission }
}

export async function reverseAffiliateCommissionForPayment({ paymentId, reason, db: dbi = db } = {}) {
  if (!paymentId) throw new Error('reverseAffiliateCommissionForPayment: paymentId obrigatório')
  const normalizedReason = String(reason ?? '').trim().slice(0, 500)
  if (!normalizedReason) return { updated: 0, reason: 'missing_reason' }
  // Captura as comissões afetadas ANTES do update para gravar o ledger com o
  // status de origem (guardado para fake dbs sem findMany).
  const affected = typeof dbi.affiliateCommission.findMany === 'function'
    ? await dbi.affiliateCommission.findMany({
      where: { paymentId, status: { in: COMMISSION_REVERSIBLE_STATUSES } },
      select: { id: true, affiliateId: true, status: true, commissionAmountCents: true },
    }).catch(() => [])
    : []
  const now = new Date()
  const result = await dbi.affiliateCommission.updateMany({
    where: { paymentId, status: { in: COMMISSION_REVERSIBLE_STATUSES } },
    data: { status: 'reversed', reversedAt: now, reversalReason: normalizedReason },
  })
  if ((result.count ?? 0) < 1) return { updated: 0, reason: 'not_reversible' }
  for (const c of affected) {
    await writeCommissionLedger({ commissionId: c.id, affiliateId: c.affiliateId, fromStatus: c.status, toStatus: 'reversed', amountCents: c.commissionAmountCents, reason: normalizedReason, actor: 'webhook', at: now, db: dbi })
  }
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

    // O1+O4: "venda inicial" é única por indicado, independente do afiliado e
    // ignorando comissões revertidas. Assim um reembolso não rebaixa a próxima
    // para 'recurring', e last-non-direct não paga uma SEGUNDA 'initial' a outro
    // afiliado pelo mesmo cliente.
    const existingCommission = await dbi.affiliateCommission.findFirst({
      where: { referredUserId: userId, status: { not: 'reversed' } },
      orderBy: { createdAt: 'asc' },
    })
    const isRecurring = !!existingCommission

    const settings = await getAffiliateSettings(dbi)
    if (isRecurring && !settings.recurringCommissionEnabled) return { skipped: 'recurring_disabled' }

    // R5: sinais de mesmo dispositivo/rede entre afiliado e indicado.
    const [affiliateSignals, referredSignals] = await Promise.all([
      latestTouchSignals(dbi, profile.userId),
      latestTouchSignals(dbi, userId),
    ])
    const risk = evaluateAffiliateCommissionRisk({ profile, referredUser: user, affiliateSignals, referredSignals })
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
    await writeCommissionLedger({ commissionId: commission.id, affiliateId: profile.id, fromStatus: null, toStatus: commission.status, amountCents: commissionAmountCents, reason: isHeld ? risk.reason : 'created', actor: 'system', log, db: dbi })
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
    select: { id: true, affiliateId: true, commissionAmountCents: true },
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
      await writeCommissionLedger({ commissionId: row.id, affiliateId: row.affiliateId, fromStatus: 'pending', toStatus: 'eligible', amountCents: row.commissionAmountCents, reason: 'hold_elapsed', actor: 'system', log, db: dbi })
      result.promoted++
    } catch (err) {
      result.failed++
      log?.error?.({ err: err?.message, commissionId: row.id }, 'affiliate_commission_eligibility_failed')
    }
  }
  return result
}
