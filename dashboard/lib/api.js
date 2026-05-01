const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

async function apiFetch(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    localStorage.removeItem('token')
    window.location.replace('/login')
    return
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export const api = {
  login: (email, password) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  register: (email, password, ref) =>
    apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, ...(ref && { ref }) }) }),

  me: () => apiFetch('/api/auth/me'),

  sessionStatus: () => apiFetch('/api/session/status'),
  sessionStart: () => apiFetch('/api/session/start', { method: 'POST' }),
  sessionStop: () => apiFetch('/api/session/stop', { method: 'POST' }),
  sessionForget: () => apiFetch('/api/session/forget', { method: 'POST' }),
  sessionPairingCode: (phone) => apiFetch('/api/session/pairing-code', { method: 'POST', body: JSON.stringify({ phone }) }),
  sessionWAGroups: () => apiFetch('/api/session/wa-groups'),

  groups: () => apiFetch('/api/groups'),
  addGroup: (waJid, name, role) =>
    apiFetch('/api/groups', { method: 'POST', body: JSON.stringify({ waJid, name, role }) }),
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
}

export function openQRSocket(token, onMessage) {
  const wsBase = BASE.replace('http', 'ws')
  const ws = new WebSocket(`${wsBase}/api/session/qr?token=${token}`)
  ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)) } catch {} }
  return ws
}
