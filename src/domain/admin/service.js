import { buildLongExpiredWhere, wantsLongExpired, resolveLongExpiredDays } from '../../core/adminVisibility.js'
import { planLabel } from './customerHistory.js'
import { buildActivationFunnel } from './funnel.js'
import { resolveSignupOrigin } from './signupOrigin.js'
import { withPayingStatus } from './payingStatus.js'
import { loadEverPaidUserIds } from './payingLoader.js'
import { MANUAL_STOP_EVENT } from '../../email/accountActivity.js'
import { describeDisconnectReason } from './disconnectReason.js'
import { resolveSessionOwner } from '../../core/sessionOwnership.js'
import { describeSubscriptionStatus, describePendingSubscriptionNotice } from '../payments/subscriptionPolicy.js'

// Último evento de conexão por cliente, em UMA consulta. Mesmo padrão do
// `buildAdminOnlineOverview`: é o que separa "o robô está tentando" de
// "precisa da cliente" e de "ninguém está tentando".
async function loadLastConnectionEventByUser(db, userIds = [], { since = null } = {}) {
  const ids = [...new Set((userIds ?? []).filter(Boolean))]
  if (!db?.waConnectionEvent?.findMany || !ids.length) return new Map()
  try {
    const rows = await db.waConnectionEvent.findMany({
      where: { userId: { in: ids }, ...(since ? { occurredAt: { gte: since } } : {}) },
      orderBy: { occurredAt: 'asc' },
      select: { userId: true, type: true, occurredAt: true },
    })
    const map = new Map()
    for (const row of rows) map.set(row.userId, row)
    return map
  } catch {
    return new Map()
  }
}

const ORIGIN_SOURCE_LABELS = {
  direct: 'Direto',
  organic: 'Orgânico',
  promo_vip_7dias: 'Promo VIP 7 dias',
  google: 'Google',
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
}

function labelForSource(source) {
  const key = String(source ?? '').trim().toLowerCase()
  if (!key) return 'Não rastreada'
  return ORIGIN_SOURCE_LABELS[key] ?? String(source).trim()
}

// Monta a origem do cliente para a coluna "Origem" da gestão. Afiliado ganha
// nome/email de quem indicou; indicação de cliente idem; orgânico mostra a
// fonte (source/utm) do cadastro, ou "Não rastreada" quando não há sinal.
export function buildUserOrigin(user, { referrerMap = new Map(), signupMetaMap = new Map() } = {}) {
  if (user?.affiliateProfileId && user?.affiliateRef?.user) {
    const aff = user.affiliateRef.user
    return {
      type: 'affiliate',
      label: 'Afiliado',
      affiliateName: aff.name ?? null,
      affiliateEmail: aff.email ?? null,
      affiliateCode: user.affiliateRef.code ?? null,
    }
  }
  if (user?.referredBy && referrerMap.has(user.referredBy)) {
    const ref = referrerMap.get(user.referredBy)
    return {
      type: 'referral',
      label: 'Indicação de cliente',
      referrerName: ref.name ?? null,
      referrerEmail: ref.email ?? null,
    }
  }
  const meta = signupMetaMap.get(user?.id) ?? {}
  const rawSource = meta.utm_source || meta.source || null
  const detailBits = [meta.utm_medium, meta.utm_campaign].filter(Boolean)
  return {
    type: 'organic',
    label: labelForSource(rawSource),
    source: rawSource || null,
    medium: meta.utm_medium || null,
    campaign: meta.utm_campaign || null,
    detail: detailBits.length ? detailBits.join(' · ') : null,
  }
}

// Colunas realmente ordenáveis no banco. Campos derivados (último envio, LTV)
// ficam de fora de propósito: ordenar por eles exigiria carregar a base
// inteira em memória a cada página.
const SORTABLE_CUSTOMER_FIELDS = new Set(['createdAt', 'accessExpiresAt', 'name', 'email', 'plan', 'status', 'sendCount', 'lastLoginAt'])

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
    // Vencidas há muito tempo saem da visão por padrão (ver
    // src/core/adminVisibility.js). É apresentação, não dado: "Ver mais"
    // (`incluirVencidos=1`) traz todas de volta.
    const includeLongExpired = wantsLongExpired(query.incluirVencidos)
    const longExpiredWhere = buildLongExpiredWhere({ now, includeLongExpired })
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
      ...(longExpiredWhere ? { AND: [longExpiredWhere] } : {}),
    }

    const since24h = addDays(now, -1)
    // Tamanho do que ficou escondido — o botão "Ver mais" precisa dizer quantas
    // são, senão parece que os números do painel encolheram sozinhos.
    const contarOcultas = () => (includeLongExpired ? Promise.resolve(0) : db.user.count({
      where: {
        ...(status ? { status } : {}),
        ...(plan ? { plan } : {}),
        accessExpiresAt: { lte: new Date(now.getTime() - resolveLongExpiredDays() * 24 * 60 * 60 * 1000) },
      },
    }).catch(() => 0))
    const [ocultasPorVencimento, total, users] = await Promise.all([
      contarOcultas(),
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        select: {
          id: true, name: true, email: true, contactPhone: true, status: true, plan: true, accessExpiresAt: true,
          affiliateProfileId: true,
          referredBy: true,
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
    const [successMap, successMap24h, errorMap, lastMessageMap, everPaidIds] = await Promise.all([
      getLogCountMap({ status: 'success', userIds }),
      getLogCountMap({ status: 'success', since: since24h, userIds }),
      getLogCountMap({ status: 'error', since: since24h, userIds }),
      getLogActivityMap({ userIds }),
      loadEverPaidUserIds(db, userIds),
    ])

    // Origem do cliente (coluna "Origem" na gestão): quem NÃO veio por afiliado
    // precisa mostrar por onde veio. Dois lookups em lote (sem N+1):
    // (1) indicador (referredBy → outro cliente); (2) evento de cadastro
    // (signup_created) que guarda source/utm no metadata para os orgânicos.
    const nonAffiliateIds = users.filter(u => !u.affiliateProfileId).map(u => u.id)
    const referrerIds = [...new Set(users.filter(u => !u.affiliateProfileId && u.referredBy).map(u => u.referredBy))]
    const [referrerRows, signupRows] = await Promise.all([
      referrerIds.length
        ? db.user.findMany({ where: { id: { in: referrerIds } }, select: { id: true, name: true, email: true } })
        : [],
      nonAffiliateIds.length
        ? db.analyticsEvent.findMany({
          where: { userId: { in: nonAffiliateIds }, event: 'signup_created' },
          orderBy: { createdAt: 'desc' },
          select: { userId: true, metadata: true },
        })
        : [],
    ])
    const referrerMap = new Map(referrerRows.map(r => [r.id, r]))
    const signupMetaMap = new Map()
    for (const row of signupRows) {
      if (!row.userId || signupMetaMap.has(row.userId)) continue // fica com o mais recente
      let meta = {}
      try { meta = JSON.parse(row.metadata || '{}') } catch { meta = {} }
      signupMetaMap.set(row.userId, meta)
    }

    const running = new Set(await listRunningBots())

    return {
      total,
      page,
      limit,
      ocultasPorVencimento,
      incluindoVencidasAntigas: includeLongExpired,
      janelaVencimentoDias: resolveLongExpiredDays(),
      users: users.map(user => {
        const groupCounts = getGroupCounts(user.groups)
        const successCount = successMap.get(user.id) ?? 0
        const successCount24h = successMap24h.get(user.id) ?? 0
        const errorCount24h = errorMap.get(user.id) ?? 0
        const userRunning = running.has(user.id)
        const lastMessageAt = lastMessageMap.get(user.id) ?? null
        const effectiveLastActivityAt = resolveEffectiveLastActivity(user, lastMessageAt)
        const riskUser = { ...user, lastActivityAt: effectiveLastActivityAt }
        const origin = buildUserOrigin(user, { referrerMap, signupMetaMap })
        return sanitizeUser(withPayingStatus({
          ...user,
          origin,
          groups: undefined,
          groupCounts,
          accessStatus: getAccessStatus(user, now),
          botRunning: userRunning,
          lastMessageAt,
          effectiveLastActivityAt,
          successCount,
          successCount24h,
          errorCount24h,
          credentialHealth: summarizeCredentialHealth(user.credentials),
          credentials: undefined,
          riskFlags: buildRiskFlags({ user: riskUser, groups: user.groups, successCount, errorCount: errorCount24h, now, running: userRunning }),
        }, { everPaid: everPaidIds.has(user.id), now: now.getTime() }), adminRole)
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
    const [successMap, errorMap, lastMessageMap, lastSuccessRows, runningList, everPaidIds, lastEventByUser] = await Promise.all([
      getLogCountMap({ status: 'success', userIds }),
      getLogCountMap({ status: 'error', since: since24h, userIds }),
      getLogActivityMap({ userIds }),
      userIds.length ? db.messageLog.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, status: 'success' },
        _max: { sentAt: true },
      }) : [],
      listRunningBots(),
      loadEverPaidUserIds(db, userIds),
      // Janela de 7 dias: quem está nesta tabela caiu faz tempo, e o evento
      // que explica a queda pode ser bem anterior às 48h usadas na aba Online.
      loadLastConnectionEventByUser(db, userIds, { since: addDays(now, -7) }),
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
        // Pagante em risco é quem JÁ PAGOU, não quem tem o campo `plan`
        // preenchido — liberação manual de acesso também escreve ali.
        const priorityLabel = everPaidIds.has(user.id)
          ? 'Pagante em risco'
          : successCount > 0 ? 'Trial ativado' : 'Onboarding'
        const rawContactPhone = user.contactPhone || user.waSession?.phone || ''
        // POR QUE caiu. Sem isso a tabela mostrava só o código cru do
        // WhatsApp, que junta num balde só casos com ações opostas (QR novo,
        // chip recusado, plano vencido, ninguém tentando).
        const ownership = resolveSessionOwner({
          status: user.waSession?.status ?? 'disconnected',
          lifecycle: user.waSession?.lifecycle ?? null,
          lastDisconnectCode: user.waSession?.lastDisconnectCode ?? null,
          lastEventType: lastEventByUser.get(user.id)?.type ?? null,
          workerRunning: botRunning,
          lastHeartbeatAt: user.waSession?.lastHeartbeatAt ?? null,
          accessExpiresAt: user.accessExpiresAt ?? null,
          now: now.getTime(),
        })
        const disconnectReason = describeDisconnectReason({
          owner: ownership.owner,
          hasSession: Boolean(user.waSession),
          lastDisconnectCode: user.waSession?.lastDisconnectCode ?? null,
        })
        const row = sanitizeUser(withPayingStatus({
          ...user,
          sessionOwner: ownership.owner,
          sessionOwnerReason: ownership.reason,
          canAdminRetry: ownership.canAdminRetry,
          disconnectReason,
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
          suggestedAction: ownership.canAdminRetry ? 'Reconectar WhatsApp e validar sessão' : disconnectReason.label,
          whatsappContactUrl: null,
        }, { everPaid: everPaidIds.has(user.id), now: now.getTime() }), adminRole)
        const visiblePhone = row.contactPhone || row.waSession?.phone || ''
        const canUseVisiblePhone = visiblePhone && !String(visiblePhone).includes('*')
        return { ...row, whatsappContactUrl: canUseVisiblePhone ? buildWhatsAppContactUrl(rawContactPhone, user.name) : null }
      })
      .filter(Boolean)
      .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))

    const total = enriched.length
    const paginated = enriched.slice(skip, skip + limit)
    const paidAtRisk = enriched.filter(user => user.everPaid).length
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


  // Lista larga de clientes para a página "Clientes" do admin. Diferente de
  // `listUsers` (que é a gestão operacional por RISCO), aqui a chave é o
  // HISTÓRICO: cadastro, situação, plano, vencimento, uso. Ordenável por
  // coluna e varrível de ponta a ponta.
  //
  // De propósito NÃO aplica `buildLongExpiredWhere`: esconder vencida antiga
  // existe para limpar a FILA DE TRABALHO (`listUsers`), e esta tela é o
  // arquivo de clientes — quem procura o histórico de alguém que cancelou há
  // seis meses precisa achá-la aqui. Para isolar os vencidos, o filtro
  // `situacao=vencido`.
  //
  // Todo agregado por cliente sai em LOTE (groupBy/findMany com `in`) — nunca
  // uma consulta por linha. Ver a mesma disciplina em `listUsers` acima.
  async function listCustomers({ query = {}, adminRole } = {}) {
    const { page, limit, skip } = getPagination(query, 50)
    const now = new Date()
    const search = String(query.search ?? '').trim()
    const situacao = String(query.situacao ?? '').trim()

    const where = {
      ...(search
        ? {
          OR: [
            { email: { contains: search } },
            { name: { contains: search } },
            { contactPhone: { contains: search.replace(/\D/g, '') || search } },
          ],
        }
        : {}),
      ...(situacao === 'trial' ? { plan: 'trial', status: 'active', OR: [{ accessExpiresAt: null }, { accessExpiresAt: { gte: now } }] } : {}),
      ...(situacao === 'ativo' ? { plan: { not: 'trial' }, status: 'active', OR: [{ accessExpiresAt: null }, { accessExpiresAt: { gte: now } }] } : {}),
      ...(situacao === 'vencido' ? { status: 'active', accessExpiresAt: { lt: now } } : {}),
      ...(situacao === 'bloqueado' ? { status: { in: ['banned', 'suspended'] } } : {}),
    }

    const sortField = SORTABLE_CUSTOMER_FIELDS.has(String(query.sort ?? '')) ? String(query.sort) : 'createdAt'
    const sortDir = String(query.dir ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { [sortField]: sortDir },
        take: limit,
        skip,
        select: {
          id: true, name: true, email: true, contactPhone: true, status: true, plan: true,
          accessExpiresAt: true, createdAt: true, sendCount: true, lastLoginAt: true,
          waSession: { select: { status: true, phone: true, updatedAt: true } },
          groups: { select: { role: true } },
        },
      }),
    ])

    const userIds = users.map(user => user.id)
    const [paymentRows, subscriptionRows, sendMap30d, lastMessageMap] = await Promise.all([
      userIds.length
        ? db.payment.groupBy({
          by: ['userId'],
          where: { userId: { in: userIds }, status: 'approved' },
          _sum: { amount: true },
          _count: { _all: true },
          _min: { createdAt: true },
          // `_max` sai de graça no mesmo groupBy e é o que separa "abandonou o
          // checkout" de "pagou e a confirmação ainda não chegou".
          _max: { createdAt: true },
        })
        : [],
      userIds.length
        ? db.subscription.findMany({
          where: { userId: { in: userIds } },
          orderBy: { createdAt: 'desc' },
          select: { userId: true, plan: true, status: true, createdAt: true, nextChargeAt: true, cancelledAt: true },
        })
        : [],
      getLogCountMap({ status: 'success', since: addDays(now, -30), userIds }),
      getLogActivityMap({ userIds }),
    ])

    const paymentMap = new Map(paymentRows.map(row => [row.userId, row]))
    const subscriptionMap = new Map()
    for (const row of subscriptionRows) {
      // findMany já vem em ordem decrescente: fica a assinatura mais recente,
      // salvo se houver uma ativa (essa ganha, é o que a coluna precisa dizer).
      const current = subscriptionMap.get(row.userId)
      const isActive = ['authorized', 'active'].includes(String(row.status ?? '').toLowerCase())
      if (!current || (isActive && !['authorized', 'active'].includes(String(current.status ?? '').toLowerCase()))) {
        subscriptionMap.set(row.userId, row)
      }
    }

    return {
      total,
      page,
      limit,
      sort: sortField,
      dir: sortDir,
      customers: users.map(user => {
        const payment = paymentMap.get(user.id) ?? null
        const subscription = subscriptionMap.get(user.id) ?? null
        // `paymentMap` já é só pagamento APROVADO — é a mesma fonte da tag.
        const everPaid = Number(payment?._count?._all ?? 0) > 0
        const pendingNotice = subscription
          ? describePendingSubscriptionNotice({
            status: subscription.status,
            subscriptionStartedAt: subscription.createdAt,
            lastApprovedPaymentAt: payment?._max?.createdAt ?? null,
          })
          : null
        return sanitizeUser(withPayingStatus({
          id: user.id,
          name: user.name,
          email: user.email,
          contactPhone: user.contactPhone,
          status: user.status,
          plan: user.plan,
          planLabel: planLabel(user.plan),
          accessStatus: getAccessStatus(user, now),
          accessExpiresAt: user.accessExpiresAt,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          waSession: user.waSession ?? null,
          groupCounts: getGroupCounts(user.groups),
          sendCount: user.sendCount ?? 0,
          sends30d: sendMap30d.get(user.id) ?? 0,
          lastMessageAt: lastMessageMap.get(user.id) ?? null,
          ltv: payment?._sum?.amount ?? 0,
          paidCount: payment?._count?._all ?? 0,
          firstPaymentAt: payment?._min?.createdAt ?? null,
          subscription: subscription
            ? {
              plan: subscription.plan,
              planLabel: planLabel(subscription.plan),
              status: subscription.status,
              statusLabel: pendingNotice?.label ?? describeSubscriptionStatus(subscription.status),
              awaitingConfirmation: Boolean(pendingNotice?.awaitingConfirmation),
              startedAt: subscription.createdAt,
              nextChargeAt: subscription.nextChargeAt,
              cancelledAt: subscription.cancelledAt,
            }
            : null,
        }, { everPaid, now: now.getTime() }), adminRole)
      }),
    }
  }

  /**
   * Funil de ativação por coorte de cadastro. Só LEITURA e tudo em lote — nunca
   * uma consulta por cliente. `MessageLog` e `AnalyticsEvent` são as duas
   * tabelas grandes do banco, então as duas entram por `groupBy` (agregação no
   * SQLite, não em memória) com filtro `in` na coorte, que é de dezenas de
   * linhas. Sem processo novo, sem impacto de RAM.
   */
  async function getActivationFunnel({ weeks = 8 } = {}) {
    const weeksCount = Math.min(26, Math.max(1, Number(weeks) || 8))
    const now = new Date()
    const since = addDays(now, -weeksCount * 7)

    const users = await db.user.findMany({
      where: { createdAt: { gte: since } },
      // Nome e e-mail entram para a lista de "com quem falar" de cada motivo.
      // Telefone NÃO — a tela é para começar a conversa, e telefone tem regra
      // de mascaramento por papel (`sanitizeUser`).
      select: { id: true, createdAt: true, name: true, email: true },
      orderBy: { createdAt: 'asc' },
    })

    const ids = users.map((user) => user.id)
    if (!ids.length) {
      return { weeksCount, since, generatedAt: now, ...buildActivationFunnel({ users: [] }) }
    }

    const [
      signupEvents, waSessions, connectedEvents, deliveries, checkouts, payments,
      credentials, groups, attempts, manualStops,
    ] = await Promise.all([
      db.analyticsEvent.findMany({
        where: { event: 'signup_created', userId: { in: ids } },
        select: { userId: true, metadata: true },
      }),
      db.waSession.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, status: true, phone: true },
      }),
      db.analyticsEvent.groupBy({
        by: ['userId'],
        where: { event: 'whatsapp_connected', userId: { in: ids } },
        _min: { createdAt: true },
      }),
      // Só `success`: linha de `MessageLog` que não saiu (o caso mais comum é
      // `skip:no_valid_conversions`, sem etiqueta de afiliada cadastrada) não
      // é "viu o produto funcionar".
      db.messageLog.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, status: 'success' },
        _min: { sentAt: true },
      }),
      db.analyticsEvent.groupBy({
        by: ['userId'],
        where: { event: 'checkout_started', userId: { in: ids } },
        _min: { createdAt: true },
      }),
      db.payment.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, status: 'approved' },
        _min: { createdAt: true },
      }),
      // As três abaixo respondem POR QUE a pessoa parou. Todas agregadas.
      db.credential.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _count: { _all: true } }),
      db.group.groupBy({ by: ['userId', 'role'], where: { userId: { in: ids } }, _count: { _all: true } }),
      // Sem filtro de status: aqui interessa se o robô TENTOU. Cruzado com as
      // entregas, é o que separa "nunca usou" de "usou e nada saiu".
      db.messageLog.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _count: { _all: true } }),
      // E1/E2: quem pediu para desligar. Desconectar é escolha (viagem, troca
      // de chip, pausa), e tratar isso como queda mandaria a conversa para o
      // lugar errado. Agregado por `groupBy`, nunca uma consulta por linha.
      db.waConnectionEvent.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, type: MANUAL_STOP_EVENT },
        _max: { occurredAt: true },
      }).catch(() => []),
    ])

    const originByUserId = new Map()
    for (const event of signupEvents) {
      if (!event.userId || originByUserId.has(event.userId)) continue
      let metadata = {}
      try { metadata = JSON.parse(event.metadata || '{}') } catch { metadata = {} }
      originByUserId.set(event.userId, resolveSignupOrigin(metadata))
    }

    // "Chegou a conectar" tem duas fontes de propósito: o evento durável
    // (`whatsapp_connected`) e a própria sessão com telefone/status — o evento
    // só existe para quem se cadastrou depois que ele foi criado, e a sessão
    // sozinha não conta quem conectou e desconectou faz tempo.
    // Existe linha de sessão = ela CLICOU em conectar. É o que separa quem nem
    // tentou de quem tentou e não conseguiu — dois problemas opostos.
    const triedPairingUserIds = new Set(waSessions.map((session) => session.userId).filter(Boolean))
    const connectedUserIds = new Set(connectedEvents.map((row) => row.userId).filter(Boolean))
    for (const session of waSessions) {
      if (session.status === 'connected' || session.phone) connectedUserIds.add(session.userId)
    }

    // Está conectada AGORA. Diferente de `connectedUserIds`, que é "chegou a
    // conectar alguma vez" — é justamente a diferença entre as duas que separa
    // quem nunca ativou de quem ativou e largou.
    const stillConnectedUserIds = new Set(
      waSessions.filter((session) => session.status === 'connected').map((session) => session.userId)
    )
    const stoppedByUserIds = new Set(manualStops.map((row) => row.userId).filter(Boolean))

    const credentialUserIds = new Set(credentials.map((row) => row.userId).filter(Boolean))
    const attemptedUserIds = new Set(attempts.map((row) => row.userId).filter(Boolean))
    const sourceGroupUserIds = new Set(groups.filter((row) => row.role === 'monitor').map((row) => row.userId))
    const destGroupUserIds = new Set(groups.filter((row) => row.role === 'post').map((row) => row.userId))

    const toDateMap = (rows, field) => new Map(
      rows
        .filter((row) => row.userId && row._min?.[field])
        .map((row) => [row.userId, row._min[field]])
    )

    return {
      weeksCount,
      since,
      generatedAt: now,
      ...buildActivationFunnel({
        users,
        originByUserId,
        connectedUserIds,
        firstDeliveryByUserId: toDateMap(deliveries, 'sentAt'),
        firstCheckoutByUserId: toDateMap(checkouts, 'createdAt'),
        firstPaymentByUserId: toDateMap(payments, 'createdAt'),
        triedPairingUserIds,
        credentialUserIds,
        sourceGroupUserIds,
        destGroupUserIds,
        attemptedUserIds,
        stillConnectedUserIds,
        stoppedByUserIds,
      }),
    }
  }

  return { getOverview, listUsers, listCustomers, listWaDisconnectedUsers, listLogs, getActivationFunnel }
}
