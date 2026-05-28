const PROBE_SESSION_STATES = new Set(['disconnected', 'connecting', 'qr_pending', 'connected', 'error'])
const SESSION_TTL_MS = 10 * 60 * 1000
const store = new Map()

function sanitizeState(state) {
  return PROBE_SESSION_STATES.has(state) ? state : 'error'
}

export function getProbeSessionSnapshot(userId) {
  const row = store.get(userId)
  if (!row) return { sessionId: null, state: 'disconnected', qrExpiresAt: null, updatedAt: null, lastError: null }
  if (Date.now() - row.updatedAtMs > SESSION_TTL_MS && row.state !== 'connected') {
    store.delete(userId)
    return { sessionId: null, state: 'disconnected', qrExpiresAt: null, updatedAt: null, lastError: null }
  }
  return {
    sessionId: row.sessionId ?? null,
    state: sanitizeState(row.state),
    qrExpiresAt: row.qrExpiresAt ?? null,
    updatedAt: row.updatedAt ?? null,
    lastError: row.lastError ?? null,
  }
}

export function setProbeSession(userId, patch = {}) {
  const prev = store.get(userId) ?? {
    state: 'disconnected', sessionId: null, qrExpiresAt: null, updatedAt: null, updatedAtMs: 0, lastError: null,
  }
  const updatedAt = new Date()
  const next = {
    ...prev,
    ...patch,
    state: sanitizeState(patch.state ?? prev.state),
    updatedAt,
    updatedAtMs: updatedAt.getTime(),
  }
  store.set(userId, next)
  return getProbeSessionSnapshot(userId)
}

export function isProbeSessionSelectable(userId, probeAccountSessionId) {
  const row = store.get(userId)
  if (!row) return false
  return row.sessionId === probeAccountSessionId && (row.state === 'connected' || row.state === 'qr_pending' || row.state === 'connecting')
}
