import db from './db.js'

const DEFAULT_DEDUPE_WINDOW_MS = 30_000
const DEFAULT_RETENTION_DAYS = 14
const recentEvents = new Map()
let lastPruneAt = 0

const SENSITIVE_METADATA_KEY = /(token|secret|password|cookie|credential|csrf|ssid|key|message|text|url|phone|email)/i

function nowMs() {
  return Date.now()
}

function normalizeType(type) {
  return String(type || '').trim().toLowerCase().replace(/[^a-z0-9_:-]/g, '_').slice(0, 80) || 'unknown'
}

function cleanString(value, max = 120) {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  if (!text) return null
  return text.slice(0, max)
}

function sanitizeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {}
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => value !== undefined && value !== null && !SENSITIVE_METADATA_KEY.test(key))
      .map(([key, value]) => {
        if (typeof value === 'number' || typeof value === 'boolean') return [key, value]
        return [key, String(value).slice(0, 160)]
      })
  )
}

function makeDedupeKey({ userId, type, code, lifecycle }) {
  return [userId, type, code || '', lifecycle || ''].join(':')
}

function shouldSkipDuplicate(key, atMs, windowMs) {
  const lastAt = recentEvents.get(key)
  if (lastAt && atMs - lastAt < windowMs) return true
  recentEvents.set(key, atMs)
  if (recentEvents.size > 5000) {
    for (const [eventKey, eventAt] of recentEvents.entries()) {
      if (atMs - eventAt > windowMs * 4) recentEvents.delete(eventKey)
      if (recentEvents.size <= 4000) break
    }
  }
  return false
}

async function pruneOldEvents({ retentionDays = DEFAULT_RETENTION_DAYS } = {}) {
  const current = nowMs()
  if (current - lastPruneAt < 60 * 60_000) return
  lastPruneAt = current
  const days = Math.max(1, Math.min(90, Number(retentionDays) || DEFAULT_RETENTION_DAYS))
  const cutoff = new Date(current - days * 24 * 60 * 60_000)
  await db.waConnectionEvent.deleteMany({ where: { occurredAt: { lt: cutoff } } })
}

export async function recordWaConnectionEvent({
  userId,
  type,
  code = null,
  lifecycle = null,
  ownerInstance = null,
  metadata = {},
  occurredAt = new Date(),
  dedupeWindowMs = Number(process.env.WA_CONNECTION_EVENT_DEDUPE_MS || DEFAULT_DEDUPE_WINDOW_MS),
} = {}) {
  const safeUserId = cleanString(userId, 128)
  if (!safeUserId) return { skipped: true, reason: 'missing_user' }

  const safeType = normalizeType(type)
  const safeCode = cleanString(code, 40)
  const safeLifecycle = cleanString(lifecycle, 80)
  const safeOwnerInstance = cleanString(ownerInstance, 120)
  const eventAt = occurredAt instanceof Date ? occurredAt : new Date(occurredAt)
  const eventAtMs = Number.isNaN(eventAt.getTime()) ? nowMs() : eventAt.getTime()
  const key = makeDedupeKey({ userId: safeUserId, type: safeType, code: safeCode, lifecycle: safeLifecycle })
  const windowMs = Math.max(0, Number(dedupeWindowMs) || 0)

  if (windowMs > 0 && shouldSkipDuplicate(key, eventAtMs, windowMs)) {
    return { skipped: true, reason: 'duplicate' }
  }

  try {
    const event = await db.waConnectionEvent.create({
      data: {
        userId: safeUserId,
        type: safeType,
        code: safeCode,
        lifecycle: safeLifecycle,
        ownerInstance: safeOwnerInstance,
        metadata: JSON.stringify(sanitizeMetadata(metadata)),
        occurredAt: new Date(eventAtMs),
      },
    })
    pruneOldEvents({ retentionDays: Number(process.env.WA_CONNECTION_EVENT_RETENTION_DAYS || DEFAULT_RETENTION_DAYS) }).catch(() => {})
    return { ok: true, event }
  } catch (err) {
    const message = String(err?.message ?? '')
    const schemaMissing = message.includes('no such table') || message.includes('Unknown argument') || message.includes('does not exist in the current database')
    return { skipped: true, reason: schemaMissing ? 'schema_unavailable' : 'write_failed', error: message }
  }
}

export function recordWaConnectionEventSafe(payload) {
  recordWaConnectionEvent(payload).catch(() => {})
}
