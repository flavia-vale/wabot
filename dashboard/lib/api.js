const apiPortByDashboardPort = {
  '3000': '3001',
  '3006': '3004',
}

function resolveSplitPortApiBase({ protocol, hostname, port }) {
  const apiPort = apiPortByDashboardPort[port]
  if (!apiPort) return ''
  return `${protocol}//${hostname}:${apiPort}`
}

function resolveApiBase() {
  const forceSameOrigin = String(process.env.NEXT_PUBLIC_FORCE_SAME_ORIGIN_API ?? 'true').toLowerCase() === 'true'
  if (forceSameOrigin && typeof window !== 'undefined') {
    return window.location.origin
  }

  const configured = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (configured) {
    const isAbsoluteHttp = /^https?:\/\//i.test(configured)
    if (isAbsoluteHttp) {
      if (typeof window !== 'undefined') {
        try {
          const configuredUrl = new URL(configured)
          const currentUrl = new URL(window.location.origin)
          const isCrossOrigin = configuredUrl.origin !== currentUrl.origin
          const splitPortApiBase = resolveSplitPortApiBase(window.location)
          if (splitPortApiBase && configuredUrl.origin === currentUrl.origin) return splitPortApiBase
          if (isCrossOrigin) return splitPortApiBase || currentUrl.origin
        } catch {
          // fallback para comportamento padrão
        }
      }
      return configured
    }
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location
    const apiPort = apiPortByDashboardPort[port] || '3001'
    const isDefaultHttp = protocol === 'http:' && !port
    const isDefaultHttps = protocol === 'https:' && !port
    if (isDefaultHttp || isDefaultHttps) return `${protocol}//${hostname}`
    return `${protocol}//${hostname}:${apiPort}`
  }

  return 'http://localhost:3001'
}

const BASE = resolveApiBase()
const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou ou foi invalidada. Faça login novamente para continuar.'
const AUTH_TOKEN_KEY = 'wb_auth_token'

function getAuthToken() {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

function setAuthToken(token) {
  if (typeof window === 'undefined') return
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token)
    else localStorage.removeItem(AUTH_TOKEN_KEY)
  } catch {}
}

function handleSessionExpiredRedirect() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage?.setItem('loginRedirectMessage', SESSION_EXPIRED_MESSAGE)
  } catch {}
  setAuthToken('')
  try {
    window.location.replace('/login?reason=session-expired')
  } catch {
    window.location.href = '/login?reason=session-expired'
  }
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : { error: await res.text().catch(() => '') }
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    handleSessionExpiredRedirect()
    const err = new Error(SESSION_EXPIRED_MESSAGE)
    err.code = 'SESSION_EXPIRED'
    err.status = 401
    throw err
  }
  if (!res.ok) {
    const rawMessage = data?.message ?? (typeof data?.error === 'object' ? data.error?.message : data?.error) ?? ''
    const normalizedMessage = typeof rawMessage === 'string' ? rawMessage : JSON.stringify(rawMessage)
    const safeMessage = String(normalizedMessage ?? '').trim()
    const message = safeMessage && !safeMessage.startsWith('<') ? safeMessage : `HTTP ${res.status}`
    const err = new Error(message)
    if (data.code) err.code = data.code
    if (typeof data.retryable === 'boolean') err.retryable = data.retryable
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  login: async (email, password) => {
    const data = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    setAuthToken(data?.token || '')
    return data
  },

  register: async (name, email, password, contactPhone, refOrAttribution = '') => {
    const attribution = typeof refOrAttribution === 'object' && refOrAttribution !== null
      ? refOrAttribution
      : { ...(refOrAttribution && { ref: refOrAttribution }) }
    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, contactPhone, ...attribution }),
    })
    setAuthToken(data?.token || '')
    return data
  },

  registerPromoVip: async (name, email, password, contactPhone, couponCode) => {
    const data = await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, contactPhone, source: 'promo_vip_7dias', coupon_code: couponCode }) })
    setAuthToken(data?.token || '')
    return data
  },

  me: () => apiFetch('/api/auth/me'),
  logout: async () => {
    const data = await apiFetch('/api/auth/logout', { method: 'POST' })
    setAuthToken('')
    return data
  },

  sessionStatus: () => apiFetch('/api/session/status'),
  sessionStatusFast: () => apiFetch('/api/session/status?metrics=0'),
  sessionStart: () => apiFetch('/api/session/start', { method: 'POST' }),
  sessionStop: () => apiFetch('/api/session/stop', { method: 'POST' }),
  sessionForget: () => apiFetch('/api/session/forget', { method: 'POST' }),
  sessionPairingCode: (phone) => apiFetch('/api/session/pairing-code', { method: 'POST', body: JSON.stringify({ phone }) }),
  sessionQRTicket: () => apiFetch('/api/session/qr-ticket', { method: 'POST' }),
  sessionQRLatest: () => apiFetch('/api/session/qr-latest'),
  sessionTelemetry: (payload) => apiFetch('/api/session/telemetry', { method: 'POST', body: JSON.stringify(payload) }),
  sessionWAGroups: () => apiFetch('/api/session/wa-groups'),

  groups: () => apiFetch('/api/groups'),
  addGroup: (waJid, name, role, kind) =>
    apiFetch('/api/groups', { method: 'POST', body: JSON.stringify({ waJid, name, role, ...(kind ? { kind } : {}) }) }),
  updateGroup: (id, data) =>
    apiFetch(`/api/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGroup: (id) => apiFetch(`/api/groups/${id}`, { method: 'DELETE' }),
  groupTargets: (id) => apiFetch(`/api/groups/${id}/targets`),
  updateGroupTargets: (id, postIds) =>
    apiFetch(`/api/groups/${id}/targets`, { method: 'PUT', body: JSON.stringify({ postIds }) }),

  credentials: () => apiFetch('/api/credentials'),
  saveCredential: (platform, data) =>
    apiFetch(`/api/credentials/${platform}`, { method: 'PUT', body: JSON.stringify(data) }),

  convertLinks: (text) =>
    apiFetch('/api/link-conversion/convert', { method: 'POST', body: JSON.stringify({ text }) }),
  scrapeOffer: (url) =>
    apiFetch('/api/link-conversion/scrape-offer', { method: 'POST', body: JSON.stringify({ url }) }),

  paymentsStatus: () => apiFetch('/api/payments/status'),
  paymentsOverview: () => apiFetch('/api/payments/overview'),
  paymentsCheckout: (plan) =>
    apiFetch('/api/payments/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
  paymentsRecover: (paymentId) =>
    apiFetch('/api/payments/recover', { method: 'POST', body: JSON.stringify({ paymentId }) }),

  getConfig: () => apiFetch('/api/config'),
  saveConfig: (data) => apiFetch('/api/config', { method: 'PUT', body: JSON.stringify(data) }),

  broadcastSend: (text, jids) =>
    apiFetch('/api/broadcast/send', { method: 'POST', body: JSON.stringify({ text, jids }) }),
  scheduledList: () => apiFetch('/api/broadcast/scheduled'),
  scheduledCreate: (text, scheduledAt, jids) =>
    apiFetch('/api/broadcast/scheduled', {
      method: 'POST',
      body: JSON.stringify({ text, scheduledAt, ...(Array.isArray(jids) ? { jids } : {}) }),
    }),
  scheduledCancel: (id) => apiFetch(`/api/broadcast/scheduled/${id}`, { method: 'DELETE' }),

  dashboardStatus: () => apiFetch('/api/dashboard/status'),
  publicFaq: () => apiFetch('/api/public/faq'),
  publicPlans: () => apiFetch('/api/public/plans', { cache: 'no-store' }),
  publicLpContent: () => apiFetch('/api/public/lp-content'),
  publicTutorialContent: () => apiFetch('/api/public/tutorial-content'),

  adminMe: () => apiFetch('/api/admin/me'),
  adminLpContent: () => apiFetch('/api/admin/lp-content'),
  adminUpdateLpPlan: (id, data) => apiFetch(`/api/admin/lp-content/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminUpdateTutorialContent: (data) => apiFetch('/api/admin/lp-content/tutorial', { method: 'PUT', body: JSON.stringify(data) }),
  adminFaq: () => apiFetch('/api/admin/faq'),
  adminCreateFaq: (data) => apiFetch('/api/admin/faq', { method: 'POST', body: JSON.stringify(data) }),
  adminUpdateFaq: (id, data) => apiFetch(`/api/admin/faq/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adminDeleteFaq: (id) => apiFetch(`/api/admin/faq/${id}`, { method: 'DELETE' }),
  adminOverview: () => apiFetch('/api/admin/overview'),
  adminPipeline: () => apiFetch('/api/admin/pipeline'),
  adminUpdatePipelineIssueStatus: (id, status) =>
    apiFetch(`/api/admin/pipeline/issues/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  adminUsers: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    return apiFetch(`/api/admin/users${query ? `?${query}` : ''}`)
  },
  adminUserDetail: (id) => apiFetch(`/api/admin/users/${id}`),
  adminLogs: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    return apiFetch(`/api/admin/logs${query ? `?${query}` : ''}`)
  },
  adminSessions: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    return apiFetch(`/api/admin/sessions${query ? `?${query}` : ''}`)
  },
  adminSessionTelemetry: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    return apiFetch(`/api/admin/session-telemetry${query ? `?${query}` : ''}`)
  },
  adminSystemHealth: () => apiFetch('/api/admin/system/health'),
  adminSystemMetrics: () => apiFetch('/api/admin/system/metrics'),
  adminSystemObservability: () => apiFetch('/api/admin/system/observability'),
  adminTelegramOverview: () => apiFetch('/api/admin/telegram/overview'),
  adminTelegramRequests: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    return apiFetch(`/api/admin/telegram/requests${query ? `?${query}` : ''}`)
  },
  adminSuccessOverview: () => apiFetch('/api/admin/success/overview'),
  adminSuccessQueue: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    return apiFetch(`/api/admin/success/queue${query ? `?${query}` : ''}`)
  },
  adminSuccessMetrics: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    return apiFetch(`/api/admin/success/metrics${query ? `?${query}` : ''}`)
  },
  adminCreateContactLog: (id, data) =>
    apiFetch(`/api/admin/users/${id}/contact-log`, { method: 'POST', body: JSON.stringify(data) }),
  adminFinanceOverview: () => apiFetch('/api/admin/finance/overview'),
  adminPayments: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    return apiFetch(`/api/admin/payments${query ? `?${query}` : ''}`)
  },
  adminBillingWebhooks: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    return apiFetch(`/api/admin/billing/webhooks${query ? `?${query}` : ''}`)
  },
  adminSubscriptions: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    return apiFetch(`/api/admin/subscriptions${query ? `?${query}` : ''}`)
  },
  adminUpdateAccess: (id, data) =>
    apiFetch(`/api/admin/users/${id}/access`, { method: 'POST', body: JSON.stringify(data) }),

  adminMarketingOverview: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    return apiFetch(`/api/admin/marketing/overview${query ? `?${query}` : ''}`)
  },
  adminMarketingCampaigns: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    return apiFetch(`/api/admin/marketing/campaigns${query ? `?${query}` : ''}`)
  },

  adminMarketingFunnel: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    return apiFetch(`/api/admin/marketing/funnel${query ? `?${query}` : ''}`)
  },

  adminMarketingDataTrust: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    return apiFetch(`/api/admin/marketing/data-trust${query ? `?${query}` : ''}`)
  },
  adminMarketingPrompts: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    return apiFetch(`/api/admin/marketing/prompts${query ? `?${query}` : ''}`)
  },
  adminMarketingCohorts: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    return apiFetch(`/api/admin/marketing/cohorts${query ? `?${query}` : ''}`)
  },
  adminMarketingAlerts: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    return apiFetch(`/api/admin/marketing/alerts${query ? `?${query}` : ''}`)
  },




  resolveChannelInvite: (url) =>
    apiFetch('/api/groups/resolve-channel-invite', { method: 'POST', body: JSON.stringify({ url }) }),
  resolveChannelJid: (jid) =>
    apiFetch('/api/groups/resolve-channel-jid', { method: 'POST', body: JSON.stringify({ jid }) }),
  followChannelNow: (id) => apiFetch(`/api/groups/${id}/follow-now`, { method: 'POST' }),
  refreshChannelAdmin: (id) => apiFetch(`/api/groups/${id}/refresh-admin`, { method: 'POST' }),
  waChannels: () => apiFetch('/api/groups/wa/channels'),

  // PR-5 follow-up: anti-ban
  channelHealth: (id) => apiFetch(`/api/groups/${id}/health`),
  channelSnapshots: (id) => apiFetch(`/api/groups/${id}/snapshots`),
  channelSnapshotNow: (id) => apiFetch(`/api/groups/${id}/snapshot-now`, { method: 'POST' }),
  channelRecreate: (id, newJid) => apiFetch(`/api/groups/${id}/recreate`, { method: 'POST', body: JSON.stringify({ newJid }) }),
  channelRiskScore: (id, days = 7) => apiFetch(`/api/groups/${id}/risk-score/recompute?days=${days}`, { method: 'POST' }),
  lintChannelCopy: ({ title, template }) => apiFetch('/api/groups/lint', { method: 'POST', body: JSON.stringify({ title, template }) }),

  preservationConfig: () => apiFetch('/api/preservation/config'),
  updatePreservationConfig: (patch) => apiFetch('/api/preservation/config', { method: 'PUT', body: JSON.stringify(patch) }),
  preservationHealth: () => apiFetch('/api/preservation/monitoring/health'),
  preservationRiskScore: () => apiFetch('/api/preservation/monitoring/risk-score'),
  preservationRiskScoreRecomputeAll: () => apiFetch('/api/preservation/monitoring/risk-score/recompute-all', { method: 'POST' }),
  preservationFollows: (limit = 20) => apiFetch(`/api/preservation/monitoring/follows?limit=${limit}`),
  preservationSnapshots: () => apiFetch('/api/preservation/monitoring/snapshots'),
  preservationProbe: () => apiFetch('/api/preservation/monitoring/probe'),
  preservationProbeSessionStart: () => apiFetch('/api/preservation/probe/session/start', { method: 'POST' }),
  preservationProbeSessionStatus: () => apiFetch('/api/preservation/probe/session/status'),
  preservationProbeSessionStop: () => apiFetch('/api/preservation/probe/session/stop', { method: 'POST' }),
  preservationProbeSessionSelect: (probeAccountSessionId) => apiFetch('/api/preservation/probe/session/select', { method: 'POST', body: JSON.stringify({ probeAccountSessionId }) }),
  preservationClicks: () => apiFetch('/api/preservation/monitoring/clicks'),

  logs: (status = 'all', page = 1, limit = 20, search = '') => {
    const params = new URLSearchParams({ status, page: String(page), limit: String(limit) })
    const q = String(search || '').trim()
    if (q) params.set('search', q)
    return apiFetch(`/api/logs?${params.toString()}`)
  },
  logsSummary: (period = '7d') => apiFetch(`/api/logs/summary?period=${encodeURIComponent(period)}`),
  logsSeries: (days = 7) => apiFetch(`/api/logs/series?days=${encodeURIComponent(days)}`),
  logsClear: () => apiFetch('/api/logs/clear', { method: 'DELETE' }),

  offerAutomations: () => apiFetch('/api/offer-automations'),
  offerAutomationCreate: (data) =>
    apiFetch('/api/offer-automations', { method: 'POST', body: JSON.stringify(data) }),
  offerAutomationUpdate: (id, data) =>
    apiFetch(`/api/offer-automations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  offerAutomationDelete: (id) =>
    apiFetch(`/api/offer-automations/${id}`, { method: 'DELETE' }),
  offerAutomationTrigger: (id) =>
    apiFetch(`/api/offer-automations/${id}/trigger`, { method: 'POST' }),
  offerAutomationSearchPreview: (params) =>
    apiFetch('/api/offer-automations/search-preview', { method: 'POST', body: JSON.stringify(params) }),
  variationsGet: () => apiFetch('/api/config'),
  variationsUpdate: (data) =>
    apiFetch('/api/config', {
      method: 'PUT',
      body: JSON.stringify(typeof data === 'string' ? { copyVariationPoolJson: data } : data),
    }),
}

export function openQRSocket(token, handlers = {}) {
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : BASE
  const apiOrigin = new URL(BASE, browserOrigin).origin
  const browserIsHttps = browserOrigin.startsWith('https://')
  const shouldFallbackToCurrentHost = apiOrigin !== browserOrigin
  const fallbackOrigin = browserOrigin
  const wsUrl = new URL('/api/session/qr', apiOrigin)
  wsUrl.protocol = browserIsHttps ? 'wss:' : 'ws:'
  const ws = new WebSocket(wsUrl.toString(), ['BOTinho-auth', token])

  if (typeof handlers === 'function') {
    ws.onmessage = (e) => { try { handlers(JSON.parse(e.data)) } catch {} }
    return ws
  }

  const { onMessage, onError, onClose, onOpen } = handlers
  ws.onmessage = (e) => { try { onMessage?.(JSON.parse(e.data)) } catch {} }
  ws.onerror = (event) => {
    if (!shouldFallbackToCurrentHost) {
      onError?.(event)
      return
    }
    try {
      const fallbackUrl = new URL('/api/session/qr', fallbackOrigin)
      fallbackUrl.protocol = browserIsHttps ? 'wss:' : 'ws:'
      const fallbackWs = new WebSocket(fallbackUrl.toString(), ['BOTinho-auth', token])
      fallbackWs.onmessage = (e) => { try { onMessage?.(JSON.parse(e.data)) } catch {} }
      fallbackWs.onerror = (fallbackEvent) => onError?.(fallbackEvent)
      fallbackWs.onclose = (fallbackEvent) => onClose?.(fallbackEvent)
      fallbackWs.onopen = (fallbackEvent) => onOpen?.(fallbackEvent)
    } catch {
      onError?.(event)
    }
  }
  ws.onclose = (event) => onClose?.(event)
  ws.onopen = (event) => onOpen?.(event)

  return ws
}
