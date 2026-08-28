// Histórico macro de um cliente para o painel admin.
//
// Módulo PURO de propósito (padrão da casa): recebe as linhas já carregadas do
// banco e devolve os quatro blocos (cadastral, financeiro, técnico, uso) mais a
// linha do tempo unificada. Nada aqui importa `db.js` — o teste roda sem banco.
//
// Regra de tela que este módulo materializa (para não virar uma parede de
// detalhe): a linha do tempo só recebe MARCOS. Envio individual nunca vira um
// evento próprio — vira agregado diário; quedas de WhatsApp idem.
import { categorizeErrorMsg, ERROR_CATEGORIES } from '../../errorTaxonomy.js'

const DAY_MS = 24 * 60 * 60 * 1000

const PLAN_LABELS = {
  trial: 'Teste grátis',
  basic: 'Básico',
  pro: 'Pro',
}

const PAYMENT_STATUS_LABELS = {
  approved: 'Pagamento aprovado',
  pending: 'Pagamento aguardando',
  rejected: 'Pagamento recusado',
  cancelled: 'Pagamento cancelado',
  refunded: 'Pagamento devolvido',
}

const SUBSCRIPTION_STATUS_LABELS = {
  authorized: 'Assinatura ativa',
  active: 'Assinatura ativa',
  pending: 'Assinatura aguardando confirmação',
  paused: 'Assinatura pausada',
  cancelled: 'Assinatura cancelada',
}

// Categorias de erro (errorTaxonomy) em linguagem de gente. A regra de
// linguagem leiga do projeto vale aqui também: quem lê o painel não deve
// precisar decorar prefixo de errorMsg.
const ERROR_CATEGORY_LABELS = {
  [ERROR_CATEGORIES.DEDUP]: 'Repetição bloqueada',
  [ERROR_CATEGORIES.CONFIG_BLOCK]: 'Bloqueado pela configuração',
  [ERROR_CATEGORIES.DECRYPT]: 'Mensagem não pôde ser lida',
  [ERROR_CATEGORIES.INCOMING_ERROR]: 'Falha ao processar a mensagem recebida',
  [ERROR_CATEGORIES.TIMEOUT]: 'Demorou demais e desistiu',
  [ERROR_CATEGORIES.QUEUE_FULL]: 'Fila cheia',
  [ERROR_CATEGORIES.WORKER_RESTART]: 'O robô reiniciou no meio',
  [ERROR_CATEGORIES.CHANNEL_FORBIDDEN]: 'Sem permissão no canal',
  [ERROR_CATEGORIES.CHANNEL_THROTTLED]: 'O canal pediu para esperar',
  [ERROR_CATEGORIES.BAILEYS]: 'Erro do WhatsApp',
  [ERROR_CATEGORIES.CONVERSION]: 'Falha ao converter o link',
  [ERROR_CATEGORIES.CREDENTIAL_EXPIRED]: 'O código de acesso da loja venceu',
  [ERROR_CATEGORIES.OTHER]: 'Outros erros',
  [ERROR_CATEGORIES.UNKNOWN]: 'Não classificado',
}

export function planLabel(plan) {
  const key = String(plan ?? '').trim().toLowerCase()
  return PLAN_LABELS[key] ?? (key ? key : '—')
}

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function iso(value) {
  const date = toDate(value)
  return date ? date.toISOString() : null
}

function daysBetween(from, to) {
  const a = toDate(from)
  const b = toDate(to)
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / DAY_MS)
}

function dayKey(value) {
  const date = toDate(value)
  return date ? date.toISOString().slice(0, 10) : null
}

function isApproved(payment) {
  return String(payment?.status ?? '').toLowerCase() === 'approved'
}

function sortByDateDesc(rows, field) {
  return [...rows].sort((a, b) => {
    const av = toDate(a?.[field])?.getTime() ?? 0
    const bv = toDate(b?.[field])?.getTime() ?? 0
    return bv - av
  })
}

// ---------------------------------------------------------------- cadastral

export function buildCadastroBlock({ user, origin = null } = {}) {
  return {
    name: user?.name ?? null,
    email: user?.email ?? null,
    contactPhone: user?.contactPhone ?? null,
    phoneVerifiedAt: iso(user?.contactPhoneVerifiedAt),
    createdAt: iso(user?.createdAt),
    ageDays: daysBetween(user?.createdAt, new Date()),
    status: user?.status ?? null,
    supportStatus: user?.supportStatus ?? null,
    origin,
    termsAcceptedAt: iso(user?.termsAcceptedAt),
    termsVersion: user?.termsVersion ?? null,
    lastLoginAt: iso(user?.lastLoginAt),
    referralCode: user?.referralCode ?? null,
  }
}

// ---------------------------------------------------------------- financeiro

// O trial NÃO tem tabela própria: existe como `plan='trial'` + `accessExpiresAt`.
// Reconstruímos o histórico a partir do cadastro e do primeiro pagamento
// aprovado — por isso `endsAt` só é confiável enquanto o cliente ainda está em
// trial (depois de assinar, `accessExpiresAt` já é a validade do plano pago).
export function summarizeTrial({ user, payments = [], now = new Date() } = {}) {
  const startedAt = toDate(user?.createdAt)
  const firstApproved = sortByDateDesc(payments.filter(isApproved), 'createdAt').pop() ?? null
  const convertedAt = toDate(firstApproved?.createdAt)
  const stillTrial = String(user?.plan ?? '') === 'trial'
  const endsAt = stillTrial ? toDate(user?.accessExpiresAt) : null

  return {
    startedAt: iso(startedAt),
    endsAt: iso(endsAt),
    converted: Boolean(convertedAt),
    convertedAt: iso(convertedAt),
    convertedToPlan: firstApproved?.plan ?? null,
    daysToConvert: convertedAt ? daysBetween(startedAt, convertedAt) : null,
    expired: Boolean(endsAt && endsAt < now),
    daysRemaining: endsAt ? daysBetween(now, endsAt) : null,
  }
}

export function buildFinanceiroBlock({
  user,
  payments = [],
  subscriptions = [],
  manualGrants = [],
  now = new Date(),
} = {}) {
  const approved = payments.filter(isApproved)
  const ordered = sortByDateDesc(payments, 'createdAt')
  const orderedApproved = sortByDateDesc(approved, 'createdAt')
  const subs = sortByDateDesc(subscriptions, 'createdAt')
  const activeSub = subs.find(sub => ['authorized', 'active'].includes(String(sub?.status ?? '').toLowerCase())) ?? null

  return {
    plan: user?.plan ?? null,
    planLabel: planLabel(user?.plan),
    accessExpiresAt: iso(user?.accessExpiresAt),
    daysRemaining: user?.accessExpiresAt ? daysBetween(now, user.accessExpiresAt) : null,
    trial: summarizeTrial({ user, payments, now }),
    ltv: approved.reduce((sum, payment) => sum + (Number(payment?.amount) || 0), 0),
    paidCount: approved.length,
    firstPaymentAt: iso(orderedApproved[orderedApproved.length - 1]?.createdAt),
    lastPaymentAt: iso(orderedApproved[0]?.createdAt),
    subscription: activeSub
      ? {
        plan: activeSub.plan ?? null,
        planLabel: planLabel(activeSub.plan),
        status: activeSub.status ?? null,
        startedAt: iso(activeSub.createdAt),
        nextChargeAt: iso(activeSub.nextChargeAt),
        cancelledAt: iso(activeSub.cancelledAt),
      }
      : null,
    subscriptions: subs.map(sub => ({
      id: sub.id ?? null,
      plan: sub.plan ?? null,
      planLabel: planLabel(sub.plan),
      status: sub.status ?? null,
      startedAt: iso(sub.createdAt),
      nextChargeAt: iso(sub.nextChargeAt),
      cancelledAt: iso(sub.cancelledAt),
    })),
    payments: ordered.map(payment => ({
      id: payment.id ?? null,
      plan: payment.plan ?? null,
      planLabel: planLabel(payment.plan),
      status: payment.status ?? null,
      amount: Number(payment.amount) || 0,
      createdAt: iso(payment.createdAt),
      expiresAt: iso(payment.expiresAt),
    })),
    manualGrants: sortByDateDesc(manualGrants, 'createdAt').map(grant => ({
      at: iso(grant.createdAt),
      reason: grant.reason ?? null,
      detail: grant.after ?? null,
    })),
  }
}

// ------------------------------------------------------------------ técnico

export function summarizeDisconnects(events = [], now = new Date()) {
  const windows = { last24h: 0, last7d: 0, last30d: 0 }
  const byCode = new Map()
  const byDay = new Map()

  for (const event of events) {
    if (String(event?.type ?? '') !== 'disconnect') continue
    const at = toDate(event.occurredAt)
    if (!at) continue
    const ageMs = now.getTime() - at.getTime()
    if (ageMs <= DAY_MS) windows.last24h++
    if (ageMs <= 7 * DAY_MS) windows.last7d++
    if (ageMs <= 30 * DAY_MS) windows.last30d++
    const code = event.code ? String(event.code) : 'sem código'
    byCode.set(code, (byCode.get(code) ?? 0) + 1)
    const key = dayKey(at)
    if (key) byDay.set(key, (byDay.get(key) ?? 0) + 1)
  }

  return {
    ...windows,
    topCodes: [...byCode.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    byDay: [...byDay.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => (a.date < b.date ? 1 : -1)),
  }
}

export function summarizeErrorsByCategory(logs = []) {
  const byCategory = new Map()
  for (const log of logs) {
    if (String(log?.status ?? '') !== 'error') continue
    const category = categorizeErrorMsg(log.errorMsg)
    byCategory.set(category, (byCategory.get(category) ?? 0) + 1)
  }
  return [...byCategory.entries()]
    .map(([category, count]) => ({ category, label: ERROR_CATEGORY_LABELS[category] ?? category, count }))
    .sort((a, b) => b.count - a.count)
}

export function buildTecnicoBlock({
  waSession = null,
  botRunning = false,
  connectionEvents = [],
  logs = [],
  credentialHealth = null,
  now = new Date(),
} = {}) {
  return {
    waStatus: waSession?.status ?? null,
    waLifecycle: waSession?.lifecycle ?? null,
    waPhone: waSession?.phone ?? null,
    lastHeartbeatAt: iso(waSession?.lastHeartbeatAt),
    lastDisconnectCode: waSession?.lastDisconnectCode ?? null,
    botRunning: Boolean(botRunning),
    disconnects: summarizeDisconnects(connectionEvents, now),
    errorsByCategory30d: summarizeErrorsByCategory(logs),
    credentialHealth,
  }
}

// ----------------------------------------------------------------------- uso

export function summarizeSendsByDay(logs = [], { days = 30, now = new Date() } = {}) {
  const buckets = new Map()
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(new Date(now.getTime() - i * DAY_MS))
    if (key) buckets.set(key, { date: key, success: 0, error: 0, skipped: 0, dedupBlocked: 0 })
  }
  for (const log of logs) {
    const key = dayKey(log?.sentAt)
    const bucket = key ? buckets.get(key) : null
    if (!bucket) continue
    const status = String(log?.status ?? '')
    if (status === 'success') bucket.success++
    else if (status === 'error') bucket.error++
    else if (status === 'skipped') bucket.skipped++
    bucket.dedupBlocked += Number(log?.dedupHits) || 0
  }
  return [...buckets.values()]
}

export function buildUsoBlock({
  user,
  groupCounts = { total: 0, monitor: 0, post: 0 },
  logs = [],
  automations = { total: 0, enabled: 0 },
  lastMessageAt = null,
  now = new Date(),
} = {}) {
  const since7d = now.getTime() - 7 * DAY_MS
  const since24h = now.getTime() - DAY_MS
  const counters = { success30d: 0, error30d: 0, skipped30d: 0, success7d: 0, success24h: 0, dedupBlocked30d: 0 }

  for (const log of logs) {
    const at = toDate(log?.sentAt)
    if (!at) continue
    const status = String(log?.status ?? '')
    if (status === 'success') {
      counters.success30d++
      if (at.getTime() >= since7d) counters.success7d++
      if (at.getTime() >= since24h) counters.success24h++
    } else if (status === 'error') counters.error30d++
    else if (status === 'skipped') counters.skipped30d++
    counters.dedupBlocked30d += Number(log?.dedupHits) || 0
  }

  return {
    groupCounts,
    sendCountTotal: Number(user?.sendCount) || 0,
    ...counters,
    automations,
    lastMessageAt: iso(lastMessageAt),
    byDay: summarizeSendsByDay(logs, { days: 30, now }),
  }
}

// ----------------------------------------------------------------- timeline

function pushEvent(list, event) {
  if (!event?.at) return
  list.push(event)
}

// A linha do tempo é a peça que mais arrisca virar lixo visual. Só entram
// marcos: cadastro, dinheiro, mudança de acesso, contato do suporte, e os
// agregados diários de queda de WhatsApp e de envio. Um envio isolado NUNCA
// vira linha.
export function buildCustomerTimeline({
  user,
  financeiro,
  connectionSummary = { byDay: [] },
  sendsByDay = [],
  contactLogs = [],
  now = new Date(),
  limit = 60,
} = {}) {
  const events = []

  pushEvent(events, {
    at: iso(user?.createdAt),
    kind: 'cadastro',
    title: 'Criou a conta',
    detail: user?.email ?? null,
  })
  pushEvent(events, {
    at: financeiro?.trial?.endsAt,
    kind: 'financeiro',
    title: financeiro?.trial?.expired ? 'Teste grátis venceu' : 'Teste grátis vence',
    detail: null,
  })

  for (const sub of financeiro?.subscriptions ?? []) {
    pushEvent(events, {
      at: sub.startedAt,
      kind: 'financeiro',
      title: SUBSCRIPTION_STATUS_LABELS[String(sub.status ?? '').toLowerCase()] ?? 'Assinatura registrada',
      detail: `Plano ${sub.planLabel}`,
    })
    pushEvent(events, {
      at: sub.cancelledAt,
      kind: 'financeiro',
      title: 'Cancelou a assinatura',
      detail: `Plano ${sub.planLabel}`,
    })
  }

  for (const payment of financeiro?.payments ?? []) {
    pushEvent(events, {
      at: payment.createdAt,
      kind: 'financeiro',
      title: PAYMENT_STATUS_LABELS[String(payment.status ?? '').toLowerCase()] ?? 'Pagamento registrado',
      detail: `Plano ${payment.planLabel} · R$ ${payment.amount.toFixed(2).replace('.', ',')}`,
    })
  }

  for (const grant of financeiro?.manualGrants ?? []) {
    pushEvent(events, {
      at: grant.at,
      kind: 'financeiro',
      title: 'Acesso liberado na mão pelo admin',
      detail: grant.reason ?? null,
    })
  }

  for (const contact of contactLogs ?? []) {
    pushEvent(events, {
      at: iso(contact.createdAt),
      kind: 'suporte',
      title: `Contato do suporte (${contact.channel ?? 'whatsapp'})`,
      detail: [contact.reason, contact.outcome].filter(Boolean).join(' · ') || null,
    })
  }

  for (const day of connectionSummary?.byDay ?? []) {
    if (!day?.count) continue
    pushEvent(events, {
      at: `${day.date}T12:00:00.000Z`,
      kind: 'tecnico',
      title: day.count === 1 ? 'WhatsApp caiu 1 vez' : `WhatsApp caiu ${day.count} vezes`,
      detail: null,
      aggregate: true,
    })
  }

  for (const day of sendsByDay ?? []) {
    const total = (day?.success ?? 0) + (day?.error ?? 0)
    if (!total) continue
    pushEvent(events, {
      at: `${day.date}T12:00:00.000Z`,
      kind: 'uso',
      title: day.success === 0
        ? 'Nenhuma oferta saiu'
        : day.success === 1 ? '1 oferta enviada' : `${day.success} ofertas enviadas`,
      detail: day.error ? `${day.error} com erro` : null,
      aggregate: true,
    })
  }

  return events
    .filter(event => toDate(event.at))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, Math.max(1, limit))
}

// --------------------------------------------------------------- composição

export function buildCustomerHistory({
  user,
  origin = null,
  payments = [],
  subscriptions = [],
  manualGrants = [],
  connectionEvents = [],
  contactLogs = [],
  logs = [],
  groupCounts = { total: 0, monitor: 0, post: 0 },
  automations = { total: 0, enabled: 0 },
  credentialHealth = null,
  waSession = null,
  botRunning = false,
  lastMessageAt = null,
  now = new Date(),
  timelineLimit = 60,
} = {}) {
  const cadastro = buildCadastroBlock({ user, origin })
  const financeiro = buildFinanceiroBlock({ user, payments, subscriptions, manualGrants, now })
  const tecnico = buildTecnicoBlock({ waSession, botRunning, connectionEvents, logs, credentialHealth, now })
  const uso = buildUsoBlock({ user, groupCounts, logs, automations, lastMessageAt, now })
  const timeline = buildCustomerTimeline({
    user,
    financeiro,
    connectionSummary: tecnico.disconnects,
    sendsByDay: uso.byDay,
    contactLogs,
    now,
    timelineLimit,
    limit: timelineLimit,
  })

  return {
    id: user?.id ?? null,
    // Os seis números do cabeçalho. Mais que isso vira parede.
    headline: {
      situacao: cadastro.status,
      plano: financeiro.planLabel,
      vencimento: financeiro.accessExpiresAt,
      ltv: financeiro.ltv,
      envios30d: uso.success30d,
      quedas7d: tecnico.disconnects.last7d,
    },
    cadastro,
    financeiro,
    tecnico,
    uso,
    timeline,
  }
}
