import { createHash } from 'crypto'

const REDACTED = '[REDACTED]'
const SENSITIVE_KEY_RE = /password|pass|secret|token|cookie|authorization|credential|jwt|session|refresh|access[_-]?token|mp_access|encryption/i
const PHONE_KEY_RE = /phone|telefone|celular|whatsapp/i
const EMAIL_KEY_RE = /email/i
const URL_KEY_RE = /url|link/i
const JID_KEY_RE = /jid|group/i

function shortHash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 12)
}

function redactUrl(value) {
  try {
    const url = new URL(String(value))
    return `${url.origin}${url.pathname}${url.search ? '?[REDACTED_QUERY]' : ''}`
  } catch {
    return String(value).slice(0, 160)
  }
}

function redactStringByKey(key, value) {
  if (SENSITIVE_KEY_RE.test(key)) return REDACTED
  if (PHONE_KEY_RE.test(key)) return `phone_hash:${shortHash(value)}`
  if (EMAIL_KEY_RE.test(key)) return `email_hash:${shortHash(String(value).toLowerCase().trim())}`
  if (JID_KEY_RE.test(key)) return `id_hash:${shortHash(value)}`
  if (URL_KEY_RE.test(key)) return redactUrl(value)
  return value
}

export function redactAdminPayload(value, { depth = 0, maxDepth = 8 } = {}) {
  if (value === null || value === undefined) return value
  if (depth > maxDepth) return '[MAX_DEPTH]'
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(item => redactAdminPayload(item, { depth: depth + 1, maxDepth }))
  if (typeof value !== 'object') return value

  const out = {}
  for (const [key, raw] of Object.entries(value)) {
    if (raw === null || raw === undefined) {
      out[key] = raw
      continue
    }
    if (typeof raw === 'string') {
      out[key] = redactStringByKey(key, raw)
      continue
    }
    if (SENSITIVE_KEY_RE.test(key)) {
      out[key] = REDACTED
      continue
    }
    out[key] = redactAdminPayload(raw, { depth: depth + 1, maxDepth })
  }
  return out
}

export function serializeAdminAuditValue(value) {
  if (value === undefined || value === null) return null
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return JSON.stringify(redactAdminPayload(parsed))
    } catch {
      return JSON.stringify(value.slice(0, 4000))
    }
  }
  return JSON.stringify(redactAdminPayload(value))
}
