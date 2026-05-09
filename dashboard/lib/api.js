const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou ou foi invalidada. Faça login novamente para continuar.'
const AUTH_TOKEN_KEY = 'wb_auth_token'

function getAuthToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(AUTH_TOKEN_KEY) || ''
}

function setAuthToken(token) {
  if (typeof window === 'undefined') return
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token)
  else localStorage.removeItem(AUTH_TOKEN_KEY)
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
    sessionStorage.setItem('loginRedirectMessage', SESSION_EXPIRED_MESSAGE)
    setAuthToken('')
    window.location.replace('/login?reason=session-expired')
    return
  }
  if (!res.ok) {
    const rawMessage = data?.message ?? data?.error ?? ''
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

  register: async (name, email, password, contactPhone, ref) => {
    const data = await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, contactPhone, ...(ref && { ref }) }) })
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
  sessionStart: () => apiFetch('/api/session/start', { method: 'POST' }),
  sessionStop: () => apiFetch('/api/session/stop', { method: 'POST' }),
  sessionForget: () => apiFetch('/api/session/forget', { method: 'POST' }),
  sessionPairingCode: (phone) => apiFetch('/api/session/pairing-code', { method: 'POST', body: JSON.stringify({ phone }) }),
  sessionQRTicket: () => apiFetch('/api/session/qr-ticket', { method: 'POST' }),
  sessionTelemetry: (payload) => apiFetch('/api/session/telemetry', { method: 'POST', body: JSON.stringify(payload) }),
  sessionWAGroups: () => apiFetch('/api/session/wa-groups'),

  groups: () => apiFetch('/api/groups'),
  addGroup: (waJid, name, role) =>
    apiFetch('/api/groups', { method: 'POST', body: JSON.stringify({ waJid, name, role }) }),
  updateGroup: (id, data) =>
    apiFetch(`/api/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGroup: (id) => apiFetch(`/api/groups/${id}`, { method: 'DELETE' }),
  groupTargets: (id) => apiFetch(`/api/groups/${id}/targets`),
  updateGroupTargets: (id, postIds) =>
    apiFetch(`/api/groups/${id}/targets`, { method: 'PUT', body: JSON.stringify({ postIds }) }),

  credentials: () => apiFetch('/api/credentials'),
  saveCredential: (platform, data) =>
    apiFetch(`/api/credentials/${platform}`, { method: 'PUT', body: JSON.stringify(data) }),

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
  scheduledCreate: (text, scheduledAt) =>
    apiFetch('/api/broadcast/scheduled', { method: 'POST', body: JSON.stringify({ text, scheduledAt }) }),
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
  adminSystemHealth: () => apiFetch('/api/admin/system/health'),
  adminSystemMetrics: () => apiFetch('/api/admin/system/metrics'),
  adminSuccessOverview: () => apiFetch('/api/admin/success/overview'),
  adminSuccessQueue: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()
    return apiFetch(`/api/admin/success/queue${query ? `?${query}` : ''}`)
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

  logs: (status = 'all', page = 1, limit = 20) =>
    apiFetch(`/api/logs?status=${status}&page=${page}&limit=${limit}`),
  logsClear: () => apiFetch('/api/logs/clear', { method: 'DELETE' }),
}

export function openQRSocket(token, handlers = {}) {
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : BASE
  const wsUrl = new URL('/api/session/qr', browserOrigin)
  wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  const ws = new WebSocket(wsUrl.toString(), ['BOTinho-auth', token])

  if (typeof handlers === 'function') {
    ws.onmessage = (e) => { try { handlers(JSON.parse(e.data)) } catch {} }
    return ws
  }

  const { onMessage, onError, onClose, onOpen } = handlers
  ws.onmessage = (e) => { try { onMessage?.(JSON.parse(e.data)) } catch {} }
  ws.onerror = (event) => onError?.(event)
  ws.onclose = (event) => onClose?.(event)
  ws.onopen = (event) => onOpen?.(event)

  return ws
}
