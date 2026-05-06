const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou ou foi invalidada. Faça login novamente para continuar.'

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    sessionStorage.setItem('loginRedirectMessage', SESSION_EXPIRED_MESSAGE)
    window.location.replace('/login?reason=session-expired')
    return
  }
  if (!res.ok) {
    const message = data.message || data.error || `HTTP ${res.status}`
    const err = new Error(message)
    if (data.code) err.code = data.code
    if (typeof data.retryable === 'boolean') err.retryable = data.retryable
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  login: (email, password) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  register: (email, password, contactPhone, ref) =>
    apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, contactPhone, ...(ref && { ref }) }) }),

  me: () => apiFetch('/api/auth/me'),
  logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),

  sessionStatus: () => apiFetch('/api/session/status'),
  sessionStart: () => apiFetch('/api/session/start', { method: 'POST' }),
  sessionStop: () => apiFetch('/api/session/stop', { method: 'POST' }),
  sessionForget: () => apiFetch('/api/session/forget', { method: 'POST' }),
  sessionPairingCode: (phone) => apiFetch('/api/session/pairing-code', { method: 'POST', body: JSON.stringify({ phone }) }),
  sessionQRTicket: () => apiFetch('/api/session/qr-ticket', { method: 'POST' }),
  sessionWAGroups: () => apiFetch('/api/session/wa-groups'),

  groups: () => apiFetch('/api/groups'),
  addGroup: (waJid, name, role) =>
    apiFetch('/api/groups', { method: 'POST', body: JSON.stringify({ waJid, name, role }) }),
  updateGroup: (id, data) =>
    apiFetch(`/api/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGroup: (id) => apiFetch(`/api/groups/${id}`, { method: 'DELETE' }),

  credentials: () => apiFetch('/api/credentials'),
  saveCredential: (platform, data) =>
    apiFetch(`/api/credentials/${platform}`, { method: 'PUT', body: JSON.stringify(data) }),

  paymentsStatus: () => apiFetch('/api/payments/status'),
  paymentsCheckout: (plan) =>
    apiFetch('/api/payments/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),

  getConfig: () => apiFetch('/api/config'),
  saveConfig: (data) => apiFetch('/api/config', { method: 'PUT', body: JSON.stringify(data) }),

  broadcastSend: (text, jids) =>
    apiFetch('/api/broadcast/send', { method: 'POST', body: JSON.stringify({ text, jids }) }),
  scheduledList: () => apiFetch('/api/broadcast/scheduled'),
  scheduledCreate: (text, scheduledAt) =>
    apiFetch('/api/broadcast/scheduled', { method: 'POST', body: JSON.stringify({ text, scheduledAt }) }),
  scheduledCancel: (id) => apiFetch(`/api/broadcast/scheduled/${id}`, { method: 'DELETE' }),

  dashboardStatus: () => apiFetch('/api/dashboard/status'),

  adminMe: () => apiFetch('/api/admin/me'),
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
  const wsBase = BASE.replace('http', 'ws')
  const ws = new WebSocket(`${wsBase}/api/session/qr`, ['wabot-auth', token])

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
