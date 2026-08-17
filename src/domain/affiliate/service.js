import { randomBytes } from 'crypto'
import defaultDb from '../../db.js'
import { encryptCredential, decryptCredential } from '../../credentialCrypto.js'
import { computeDebtCents, computeAvailableCents } from './affiliateBalance.js'
import { canRequestPayout } from './payoutPolicy.js'
import { validatePixKey } from './pixKeyValidation.js'
import { resolveOrphanTouchDecision } from './orphanTouchPolicy.js'
import { notifyCommissionEligible, notifyReferralPayment } from '../../emailTriggers/events.js'
import { evaluateStuckPromotion } from './stuckPromotionAlarm.js'

const AFFILIATE_STUCK_PROMOTION_THRESHOLD_MS = Number(process.env.AFFILIATE_STUCK_PROMOTION_THRESHOLD_MS) || 24 * 60 * 60 * 1000

// US4 (009-affiliate-improvements-r1): marcador persistido no campo já
// existente `campaign` de AffiliateAttributionTouch para sinalizar, sem
// migration nova, que a atribuição órfã por dispositivo pediu hold (settings
// orphanTouchMode='hold'/'both'). Lido em tryCreateAffiliateCommission para
// que a comissão resultante nasça held mesmo quando os sinais afiliado×
// indicado (evaluateAffiliateCommissionRisk) não disparam por si só.
export const ORPHAN_DEVICE_HOLD_MARKER = 'orphan_device_hold'

const db = defaultDb

const DEFAULT_SETTINGS = { cookieDurationHours: 24, commissionPercent: 30, commissionRecurringPercent: 30, recurringCommissionEnabled: true, commissionHoldDays: 30, attributionWindowDays: 30, attributionModel: 'last_non_direct', minPayoutCents: 5000, orphanTouchWindowDays: 7, orphanTouchMode: 'both', payoutRequestsEnabled: true }

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

// O3/US4: fallback quando o cadastro NÃO trouxe visitorId (ex.: OAuth, body
// sem o campo). Casa touches anônimos recentes do MESMO afiliado e MESMO
// dispositivo (ipHash + uaHash) — exige os dois sinais juntos para não colar
// touches de IP compartilhado (NAT). Sem isso, um clique anônimo no link vira
// venda órfã. US4 (009-affiliate-improvements-r1): a janela e o hold agora
// vêm de `orphanTouchWindowDays`/`orphanTouchMode` das settings (era 30 dias
// hardcoded), avaliados por-touch via `orphanTouchPolicy.resolveOrphanTouchDecision`.
export async function attachOrphanTouchesByDevice({ affiliateId, ipHash, uaHash, userId, windowDays, db: dbi = db, now = new Date() } = {}) {
  if (!affiliateId || !userId || (!ipHash && !uaHash) || typeof dbi.affiliateAttributionTouch?.findMany !== 'function') return { updated: 0, skipped: 'missing_signal_or_store' }

  const settings = windowDays != null
    ? { orphanTouchWindowDays: windowDays, orphanTouchMode: 'off' } // compat: chamador explícito de windowDays preserva comportamento legado sem hold
    : await getAffiliateSettings(dbi)

  const where = { affiliateId, userId: null }
  if (ipHash) where.ipHash = ipHash
  if (uaHash) where.uaHash = uaHash
  const candidates = await dbi.affiliateAttributionTouch.findMany({ where, orderBy: { touchedAt: 'desc' } })

  let updated = 0
  let held = false
  for (const touch of candidates) {
    const touchAgeDays = (now.getTime() - new Date(touch.touchedAt).getTime()) / (24 * 60 * 60 * 1000)
    const decision = resolveOrphanTouchDecision({
      orphanTouchWindowDays: settings.orphanTouchWindowDays,
      orphanTouchMode: settings.orphanTouchMode,
      touchAgeDays,
    })
    if (!decision.withinWindow) continue
    const data = { userId }
    if (decision.shouldHold) data.campaign = ORPHAN_DEVICE_HOLD_MARKER
    await dbi.affiliateAttributionTouch.update({ where: { id: touch.id }, data })
    updated++
    if (decision.shouldHold) held = true
  }
  return { updated, held }
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
  // US3 (009-affiliate-improvements-r1): valida o FORMATO da chave PIX contra
  // o tipo declarado ANTES de qualquer cifragem/persistência (FR-021).
  const validation = validatePixKey({ pixKey, pixKeyType })
  if (!validation.ok) {
    const err = new Error(validation.error)
    err.statusCode = 400
    throw err
  }

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
  // debtLedgerRows: US1 — saldo devedor é derivado do ledger (affiliateBalance.js),
  // nunca uma coluna mutável. groupBy por toStatus evita carregar linhas em memória.
  const [totalReferrals, grouped, debtLedgerRows] = await Promise.all([
    dbi.user.count({ where: { affiliateProfileId: profile.id } }),
    dbi.affiliateCommission.groupBy({
      by: ['cycleMonth', 'status'],
      where: { affiliateId: profile.id },
      _sum: { commissionAmountCents: true },
      _count: true,
    }),
    typeof dbi.affiliateCommissionLedger?.groupBy === 'function'
      ? dbi.affiliateCommissionLedger.groupBy({
        by: ['toStatus'],
        where: { affiliateId: profile.id, toStatus: { in: ['debt', 'debt_settled'] } },
        _sum: { amountCents: true },
      }).catch(() => [])
      : [],
  ])
  const debtCents = computeDebtCents({
    ledgerRows: debtLedgerRows.map(g => ({ toStatus: g.toStatus, amountCents: g._sum?.amountCents ?? 0 })),
  })

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
    if (g.status !== 'reversed') {
      byMonth[g.cycleMonth].totalCents += sum
      // US7 (FR-027): "Vendas"/"Vendas válidas" precisam bater — o count por
      // mês (histórico) também exclui revertidas, igual ao totalSales acima
      // (antes somava count de TODOS os status, inclusive reversed).
      byMonth[g.cycleMonth].count += count
    }
    const currentPriority = statusPriority[byMonth[g.cycleMonth].status] ?? 99
    const nextPriority = statusPriority[g.status] ?? 99
    if (nextPriority < currentPriority) byMonth[g.cycleMonth].status = g.status
  }

  // US7 (FR-028): lifetimeEarnedCents = tudo que já foi "ganho" (não
  // revertido), independente de já ter sido pago — distinto de
  // totalEarnedCents (que continua sendo só o que foi efetivamente pago via
  // PIX). Soma paid + payable (eligible/approved) + pending (pending/held).
  const lifetimeEarnedCents = totalEarnedCents + payableCents + pendingCents

  return {
    profile: presentAffiliateProfile(profile),
    stats: { totalReferrals, totalSales, totalEarnedCents, payableCents, pendingCents, reversedCents, debtCents, lifetimeEarnedCents },
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

// Dias após o fim do teste grátis (accessExpiresAt) em que a indicação ainda é
// considerada "em aberto" no painel do afiliado, mesmo sem o indicado ter
// assinado ainda.
export const REFERRAL_GRACE_PERIOD_DAYS = 30

// resolveAccessStatus mistura duas coisas diferentes sob o mesmo rótulo
// "expired": (a) o teste grátis do indicado acabou sem ele nunca ter assinado
// — a indicação continua válida, o afiliado ainda ganha comissão se a pessoa
// assinar depois — e (b) uma assinatura PAGA que venceu (o indicado já rendeu
// comissão pelo menos uma vez). Mostrar "Expirado" para o caso (a) passava a
// impressão errada de que a indicação tinha morrido. resolveReferralStatus
// separa os dois: só entra em "aguardando assinatura"/"indicação vencida"
// quando o indicado NUNCA pagou (paymentCount === 0); quem já pagou continua
// classificado pela assinatura atual (resolveAccessStatus), que aqui já
// significa "assinatura", não "indicação". Não bloqueia comissão nenhuma —
// tryCreateAffiliateCommission não depende deste status; é só exibição.
export function resolveReferralStatus(user, paymentCount = 0, now = new Date()) {
  if (user.status === 'banned' || user.status === 'suspended') return user.status
  if (paymentCount > 0 || user.plan !== 'trial') return resolveAccessStatus(user, now)
  if (!user.accessExpiresAt || new Date(user.accessExpiresAt) >= now) return 'trial'
  const daysSinceExpiry = Math.floor((now - new Date(user.accessExpiresAt)) / 86400000)
  return daysSinceExpiry >= REFERRAL_GRACE_PERIOD_DAYS ? 'referral_expired' : 'awaiting_subscription'
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
        select: { referredUserId: true, commissionType: true, commissionAmountCents: true, status: true, eligibleAt: true, paidAt: true },
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
    const cur = commAgg.get(c.referredUserId) ?? {
      initialCents: 0, recurringCents: 0, totalCents: 0,
      pendingCents: 0, payableCents: 0, paidCents: 0, reversedCents: 0,
      lastEligibleAt: null, lastPaidAt: null, statuses: {},
    }
    const amount = c.commissionAmountCents ?? 0
    if (c.commissionType === 'recurring') cur.recurringCents += amount
    else cur.initialCents += amount
    cur.totalCents += amount
    if (c.status === 'pending' || c.status === 'held') cur.pendingCents += amount
    else if (c.status === 'eligible' || c.status === 'approved') cur.payableCents += amount
    else if (c.status === 'paid') cur.paidCents += amount
    else if (c.status === 'reversed') cur.reversedCents += amount
    cur.statuses[c.status] = (cur.statuses[c.status] ?? 0) + 1
    if (c.eligibleAt && (!cur.lastEligibleAt || new Date(c.eligibleAt) > new Date(cur.lastEligibleAt))) cur.lastEligibleAt = c.eligibleAt
    if (c.paidAt && (!cur.lastPaidAt || new Date(c.paidAt) > new Date(cur.lastPaidAt))) cur.lastPaidAt = c.paidAt
    commAgg.set(c.referredUserId, cur)
  }

  const referrals = users.map(u => {
    const pay = payAgg.get(u.id) ?? { count: 0, totalCents: 0, lastPaymentAt: null }
    const comm = commAgg.get(u.id) ?? { initialCents: 0, recurringCents: 0, totalCents: 0, pendingCents: 0, payableCents: 0, paidCents: 0, reversedCents: 0, lastEligibleAt: null, lastPaidAt: null, statuses: {} }
    const accessStatus = resolveAccessStatus(u, now)
    const isActive = accessStatus === 'active' || accessStatus === 'trial'
    const referralStatus = resolveReferralStatus(u, pay.count, now)

    if (anonymized) {
      // Visão do próprio afiliado: sem e-mail/telefone e sem valores de
      // pagamento do cliente. Mantém nº de pagamentos e a comissão (ganho do
      // próprio afiliado) e mascara o nome.
      return {
        name: maskName(u.name),
        createdAt: u.createdAt,
        accessStatus,
        referralStatus,
        isActive,
        paymentCount: pay.count,
        lastPaymentAt: pay.lastPaymentAt,
        commissionInitialCents: comm.initialCents,
        commissionRecurringCents: comm.recurringCents,
        commissionTotalCents: comm.totalCents,
        commissionPendingCents: comm.pendingCents,
        commissionPayableCents: comm.payableCents,
        commissionPaidCents: comm.paidCents,
        commissionReversedCents: comm.reversedCents,
        lastCommissionEligibleAt: comm.lastEligibleAt,
        lastCommissionPaidAt: comm.lastPaidAt,
        commissionStatuses: comm.statuses,
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
      referralStatus,
      isActive,
      paymentCount: pay.count,
      totalPaidCents: pay.totalCents,
      lastPaymentAt: pay.lastPaymentAt,
      commissionInitialCents: comm.initialCents,
      commissionRecurringCents: comm.recurringCents,
      commissionTotalCents: comm.totalCents,
      commissionPendingCents: comm.pendingCents,
      commissionPayableCents: comm.payableCents,
      commissionPaidCents: comm.paidCents,
      commissionReversedCents: comm.reversedCents,
      lastCommissionEligibleAt: comm.lastEligibleAt,
      lastCommissionPaidAt: comm.lastPaidAt,
      commissionStatuses: comm.statuses,
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

// US1 (009-affiliate-improvements-r1): checa se já existe lançamento de
// dívida para essa comissão — idempotência do estorno de comissão paga
// (FR-003/R2). Reprocessar o mesmo estorno/webhook não duplica a dívida.
async function hasExistingDebtLedgerEntry(dbi, commissionId) {
  if (typeof dbi?.affiliateCommissionLedger?.findFirst !== 'function') return false
  const existing = await dbi.affiliateCommissionLedger.findFirst({
    where: { commissionId, toStatus: 'debt' },
  }).catch(() => null)
  return !!existing
}

export async function reverseAffiliateCommissionForPayment({ paymentId, reason, db: dbi = db } = {}) {
  if (!paymentId) throw new Error('reverseAffiliateCommissionForPayment: paymentId obrigatório')
  const normalizedReason = String(reason ?? '').trim().slice(0, 500)
  if (!normalizedReason) return { updated: 0, reason: 'missing_reason' }
  // Captura as comissões afetadas ANTES do update para gravar o ledger com o
  // status de origem (guardado para fake dbs sem findMany). Inclui 'paid'
  // (US1: estorno de comissão já paga vira dívida em vez de reversão simples).
  const affected = typeof dbi.affiliateCommission.findMany === 'function'
    ? await dbi.affiliateCommission.findMany({
      where: { paymentId, status: { in: [...COMMISSION_REVERSIBLE_STATUSES, 'paid'] } },
      select: { id: true, affiliateId: true, status: true, commissionAmountCents: true },
    }).catch(() => [])
    : []
  if (!affected.length) return { updated: 0, reason: 'not_reversible' }

  const now = new Date()
  let updatedCount = 0

  for (const c of affected) {
    if (c.status === 'paid') {
      // FR-001/FR-003: estorno de comissão paga NÃO reverte o pagamento em si
      // (já foi repassado) — gera dívida idempotente no ledger, sem duplicar
      // se o webhook reentrar.
      const alreadyDebt = await hasExistingDebtLedgerEntry(dbi, c.id)
      if (alreadyDebt) continue
      const result = await dbi.affiliateCommission.updateMany({
        where: { id: c.id, status: 'paid' },
        data: { status: 'reversed', reversedAt: now, reversalReason: normalizedReason },
      })
      if ((result.count ?? 0) < 1) continue
      updatedCount += result.count
      await writeCommissionLedger({ commissionId: c.id, affiliateId: c.affiliateId, fromStatus: 'paid', toStatus: 'debt', amountCents: -Math.abs(c.commissionAmountCents ?? 0), reason: 'reversal_after_paid', actor: 'webhook', at: now, db: dbi })
      continue
    }

    const result = await dbi.affiliateCommission.updateMany({
      where: { id: c.id, status: { in: COMMISSION_REVERSIBLE_STATUSES } },
      data: { status: 'reversed', reversedAt: now, reversalReason: normalizedReason },
    })
    if ((result.count ?? 0) < 1) continue
    updatedCount += result.count
    await writeCommissionLedger({ commissionId: c.id, affiliateId: c.affiliateId, fromStatus: c.status, toStatus: 'reversed', amountCents: c.commissionAmountCents, reason: normalizedReason, actor: 'webhook', at: now, db: dbi })
  }

  return { updated: updatedCount }
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

    // US4: se a atribuição deste indicado veio de toque órfão por dispositivo
    // marcado para hold (orphanTouchMode='hold'/'both'), a comissão nasce held
    // mesmo quando o risco por sinais afiliado×indicado não dispara sozinho.
    const orphanHoldTouch = typeof dbi.affiliateAttributionTouch?.findFirst === 'function'
      ? await dbi.affiliateAttributionTouch.findFirst({ where: { affiliateId: profile.id, userId, campaign: ORPHAN_DEVICE_HOLD_MARKER } }).catch(() => null)
      : null
    const effectiveRisk = risk.decision === 'allow' && orphanHoldTouch
      ? { decision: 'hold', reason: 'orphan_device_attribution' }
      : risk

    const commissionRatePct = resolveRate(settings, profile, isRecurring)
    const commissionAmountCents = Math.round(saleAmountCents * commissionRatePct / 100)
    // occurredAt permite que a reconciliação retroativa atribua a comissão ao
    // ciclo do pagamento original, não ao mês em que o backfill rodou.
    const cycleMonth = (occurredAt ? new Date(occurredAt) : new Date()).toISOString().slice(0, 7)
    const eligibleAt = addDays(occurredAt, settings.commissionHoldDays ?? DEFAULT_SETTINGS.commissionHoldDays)
    const isHeld = effectiveRisk.decision === 'hold'

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
        ...(isHeld ? { heldAt: new Date(), holdReason: effectiveRisk.reason } : {}),
      },
    })

    // US7 (009-affiliate-improvements-r1, R3/FR-006): reforço determinístico
    // contra a corrida de dois pagamentos concorrentes do MESMO indicado —
    // ambos podem ter visto isRecurring=false e criado 'initial' em paralelo.
    // Reconsulta pós-criação: a comissão 'initial' não-revertida MAIS ANTIGA
    // (por createdAt) permanece 'initial'; qualquer outra perde a corrida e é
    // rebaixada a 'recurring' aqui mesmo (2ª tentativa determinística).
    let finalCommission = commission
    if (!isRecurring) {
      const earliestInitial = typeof dbi.affiliateCommission.findFirst === 'function'
        ? await dbi.affiliateCommission.findFirst({
          where: { referredUserId: userId, status: { not: 'reversed' }, commissionType: 'initial' },
          orderBy: { createdAt: 'asc' },
        }).catch(() => null)
        : null
      if (earliestInitial && earliestInitial.id !== commission.id) {
        const recurringRatePct = resolveRate(settings, profile, true)
        const recurringAmountCents = Math.round(saleAmountCents * recurringRatePct / 100)
        finalCommission = await dbi.affiliateCommission.update({
          where: { id: commission.id },
          data: { commissionType: 'recurring', commissionRatePct: recurringRatePct, commissionAmountCents: recurringAmountCents },
        })
        log?.info?.({ commissionId: commission.id, referredUserId: userId }, 'affiliate_commission_race_demoted_to_recurring')
      }
    }

    await writeCommissionLedger({ commissionId: finalCommission.id, affiliateId: profile.id, fromStatus: null, toStatus: finalCommission.status, amountCents: finalCommission.commissionAmountCents, reason: isHeld ? effectiveRisk.reason : 'created', actor: 'system', log, db: dbi })
    // Avisa a afiliada que uma indicação dela assinou. Comissão em análise
    // (held) não vira e-mail: o valor ainda pode não se confirmar, e prometer
    // dinheiro que some depois é pior que não avisar. Fire-and-forget.
    if (!isHeld) {
      notifyReferralPayment({
        db: dbi,
        affiliateUserId: profile.userId,
        commissionCents: finalCommission.commissionAmountCents,
        holdDays: settings.commissionHoldDays ?? DEFAULT_SETTINGS.commissionHoldDays,
        logger: log,
      }).catch(() => {})
    }
    return { created: true, commissionId: finalCommission.id, commissionType: finalCommission.commissionType, status: finalCommission.status }
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
    select: { id: true, affiliateId: true, commissionAmountCents: true, affiliate: { select: { user: { select: { id: true, name: true, email: true, status: true } } } } },
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
      // US5 (009-affiliate-improvements-r1, T037): notificação fire-and-forget,
      // best-effort e no-op sem SMTP — nunca atrasa/derruba a promoção em si.
      notifyCommissionEligible({ db: dbi, user: row.affiliate?.user, amountCents: row.commissionAmountCents, logger: log }).catch(() => {})
    } catch (err) {
      result.failed++
      log?.error?.({ err: err?.message, commissionId: row.id }, 'affiliate_commission_eligibility_failed')
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// US2 (009-affiliate-improvements-r1): saque self-service com valor mínimo.
// ---------------------------------------------------------------------------

// Saldo (disponível/devedor) derivado de duas agregações no banco (padrão O6,
// sem carregar linhas em memória) — reaproveitado por createPayoutRequest e
// pela confirmação de saque.
async function getAffiliateBalanceSnapshot({ affiliateId, dbi }) {
  const [commissionRows, debtLedgerRows] = await Promise.all([
    dbi.affiliateCommission.groupBy({
      by: ['status'],
      where: { affiliateId, status: { in: COMMISSION_PAYABLE_STATUSES } },
      _sum: { commissionAmountCents: true },
    }),
    typeof dbi.affiliateCommissionLedger?.groupBy === 'function'
      ? dbi.affiliateCommissionLedger.groupBy({
        by: ['toStatus'],
        where: { affiliateId, toStatus: { in: ['debt', 'debt_settled'] } },
        _sum: { amountCents: true },
      }).catch(() => [])
      : [],
  ])
  const availableCents = computeAvailableCents({
    commissionRows: commissionRows.map(g => ({ status: g.status, commissionAmountCents: g._sum?.commissionAmountCents ?? 0 })),
  })
  const debtCents = computeDebtCents({
    ledgerRows: debtLedgerRows.map(g => ({ toStatus: g.toStatus, amountCents: g._sum?.amountCents ?? 0 })),
  })
  return { availableCents, debtCents }
}

export async function createPayoutRequest({ userId, db: dbi = db } = {}) {
  const profile = await dbi.affiliateProfile.findUnique({ where: { userId } })
  if (!profile || profile.status !== 'approved') return { created: false, reason: 'not_approved' }

  const settings = await getAffiliateSettings(dbi)
  if (settings.payoutRequestsEnabled === false) return { created: false, reason: 'disabled' }

  const [{ availableCents, debtCents }, openRequest] = await Promise.all([
    getAffiliateBalanceSnapshot({ affiliateId: profile.id, dbi }),
    typeof dbi.affiliatePayoutRequest?.findFirst === 'function'
      ? dbi.affiliatePayoutRequest.findFirst({ where: { affiliateId: profile.id, status: 'requested' } })
      : null,
  ])

  const decision = canRequestPayout({
    availableCents,
    debtCents,
    minPayoutCents: settings.minPayoutCents ?? 5000,
    hasOpenRequest: !!openRequest,
  })
  if (!decision.ok) return { created: false, reason: decision.reason, error: decision.error }

  // O valor sacado NUNCA vem do cliente — é sempre o saldo disponível
  // calculado no servidor no momento do pedido (snapshot).
  const payoutRequest = await dbi.affiliatePayoutRequest.create({
    data: { affiliateId: profile.id, amountCents: availableCents, status: 'requested' },
  })
  return { created: true, payoutRequest }
}

export async function listAffiliatePayoutRequests({ affiliateId, db: dbi = db } = {}) {
  if (typeof dbi.affiliatePayoutRequest?.findMany !== 'function') return []
  return dbi.affiliatePayoutRequest.findMany({
    where: { affiliateId },
    orderBy: { requestedAt: 'desc' },
  })
}

// Distribui o valor a amortizar entre as comissões que originaram dívida
// (mais antigas primeiro), preservando o vínculo obrigatório do ledger com
// uma AffiliateCommission real (FK) em vez de um id sintético. O outstanding
// por comissão é `debt` menos `debt_settled` já lançados para ela.
async function outstandingDebtByCommission(dbi, affiliateId) {
  if (typeof dbi.affiliateCommissionLedger?.findMany !== 'function') return []
  const rows = await dbi.affiliateCommissionLedger.findMany({
    where: { affiliateId, toStatus: { in: ['debt', 'debt_settled'] } },
    select: { commissionId: true, toStatus: true, amountCents: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  const byCommission = new Map()
  for (const r of rows) {
    const cur = byCommission.get(r.commissionId) ?? { debt: 0, settled: 0, firstDebtAt: null }
    if (r.toStatus === 'debt') {
      cur.debt += -(Number(r.amountCents) || 0)
      if (!cur.firstDebtAt) cur.firstDebtAt = r.createdAt
    } else {
      cur.settled += Number(r.amountCents) || 0
    }
    byCommission.set(r.commissionId, cur)
  }
  return [...byCommission.entries()]
    .map(([commissionId, v]) => ({ commissionId, outstanding: Math.max(0, v.debt - v.settled), firstDebtAt: v.firstDebtAt }))
    .filter(x => x.outstanding > 0)
    .sort((a, b) => new Date(a.firstDebtAt) - new Date(b.firstDebtAt))
}

export async function confirmPayoutRequest({ id, adminUserId, db: dbi = db } = {}) {
  if (!id) throw new Error('confirmPayoutRequest: id obrigatório')
  const request = await dbi.affiliatePayoutRequest.findUnique({ where: { id } })
  if (!request) return { updated: false, reason: 'not_found' }

  const now = new Date()
  // Reserva o pedido primeiro (idempotente por estado) antes de tocar em
  // ledger/comissões — reprocessar uma confirmação já resolvida é 409.
  const claim = await dbi.affiliatePayoutRequest.updateMany({
    where: { id, status: 'requested' },
    data: { status: 'paid', resolvedAt: now, resolvedByUserId: adminUserId ?? null },
  })
  if (claim.count !== 1) return { updated: false, reason: 'not_requested' }

  const affiliateId = request.affiliateId

  // 1) abate a dívida primeiro, sem tornar o repasse negativo (FR-002).
  const outstandingList = await outstandingDebtByCommission(dbi, affiliateId)
  const totalDebt = outstandingList.reduce((sum, x) => sum + x.outstanding, 0)
  let remainingToSettle = Math.min(totalDebt, request.amountCents ?? 0)
  for (const item of outstandingList) {
    if (remainingToSettle <= 0) break
    const amount = Math.min(item.outstanding, remainingToSettle)
    await writeCommissionLedger({ commissionId: item.commissionId, affiliateId, fromStatus: 'debt', toStatus: 'debt_settled', amountCents: amount, reason: 'payout_offset', actor: adminUserId ?? 'admin', at: now, db: dbi })
    remainingToSettle -= amount
  }

  // 2) marca as comissões elegíveis/aprovadas correspondentes como pagas
  // (reaproveita o mesmo mecanismo do mark-paid manual).
  const commissions = typeof dbi.affiliateCommission?.findMany === 'function'
    ? await dbi.affiliateCommission.findMany({
      where: { affiliateId, status: { in: COMMISSION_PAYABLE_STATUSES } },
      select: { id: true, status: true, commissionAmountCents: true },
    })
    : []
  const settledCommissionIds = []
  for (const c of commissions) {
    const result = await dbi.affiliateCommission.updateMany({
      where: { id: c.id, status: { in: COMMISSION_PAYABLE_STATUSES } },
      data: { status: 'paid', paidAt: now, paidByUserId: adminUserId ?? null },
    })
    if ((result.count ?? 0) < 1) continue
    settledCommissionIds.push(c.id)
    await writeCommissionLedger({ commissionId: c.id, affiliateId, fromStatus: c.status, toStatus: 'paid', amountCents: c.commissionAmountCents, reason: 'payout_confirm', actor: adminUserId ?? 'admin', at: now, db: dbi })
  }

  const updated = await dbi.affiliatePayoutRequest.update({
    where: { id },
    data: { settledCommissionIds: JSON.stringify(settledCommissionIds) },
  })
  return { updated: true, payoutRequest: updated }
}

// ---------------------------------------------------------------------------
// US6 (009-affiliate-improvements-r1): alarme operacional se a promoção
// pending→eligible parar de avançar. Reaproveita o `reconciliationTimer`
// existente em payments.js (sem novo timer/processo — sem impacto de RAM).
// ---------------------------------------------------------------------------
export async function checkStuckPromotions({ db: dbi = db, log, now = new Date(), thresholdMs = AFFILIATE_STUCK_PROMOTION_THRESHOLD_MS } = {}) {
  if (typeof dbi.affiliateCommission?.findMany !== 'function') return { shouldAlarm: false, count: 0, oldestMs: 0 }
  const rows = await dbi.affiliateCommission.findMany({
    where: { status: 'pending', eligibleAt: { lt: new Date(now.getTime() - thresholdMs) } },
    select: { id: true, eligibleAt: true },
  })
  const result = evaluateStuckPromotion({ rows, now, thresholdMs })
  if (result.shouldAlarm) {
    log?.error?.({ count: result.count, oldestMs: result.oldestMs }, 'affiliate_promotion_stuck')
    try {
      const { trackAnalyticsEventSafe } = await import('../../analytics.js')
      trackAnalyticsEventSafe?.({ event: 'ops_affiliate_promotion_stuck', metadata: { count: result.count, oldestMs: result.oldestMs } })
    } catch (err) {
      log?.error?.({ err: err?.message }, 'affiliate_promotion_stuck_event_failed')
    }
  }
  return result
}

export async function rejectPayoutRequest({ id, adminUserId, reason, db: dbi = db } = {}) {
  if (!id) throw new Error('rejectPayoutRequest: id obrigatório')
  const normalizedReason = String(reason ?? '').trim().slice(0, 500)
  if (!normalizedReason) return { updated: false, reason: 'missing_reason' }

  const now = new Date()
  const claim = await dbi.affiliatePayoutRequest.updateMany({
    where: { id, status: 'requested' },
    data: { status: 'rejected', rejectionReason: normalizedReason, resolvedAt: now, resolvedByUserId: adminUserId ?? null },
  })
  if (claim.count !== 1) return { updated: false, reason: 'not_requested' }

  const payoutRequest = await dbi.affiliatePayoutRequest.findUnique({ where: { id } })
  return { updated: true, payoutRequest }
}
