export const CAPACITY_CONTRACT_VERSION = 'admin-capacity-v1';

const FORBIDDEN_KEY = /(authorization|token|secret|password|cookie|cmdline|stdout|stderr|\benv\b|path)/i
const SAFE_SOURCE_KEYS = new Set(['name', 'status', 'observedAt', 'ageSeconds', 'errorCode'])
const SAFE_COMPONENT_KEYS = new Set(['key', 'environment', 'status', 'pid', 'uptimeSeconds', 'restartCount', 'cpuPercent', 'rssMb', 'count'])

function safeScalar(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  return typeof value === 'number' ? (Number.isFinite(value) ? value : null) : undefined
}

export function sanitizeCapacityValue(value) {
  const scalar = safeScalar(value)
  if (scalar !== undefined) return scalar
  if (Array.isArray(value)) return value.map(sanitizeCapacityValue).filter((item) => item !== undefined)
  if (!value || typeof value !== 'object') return undefined
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !FORBIDDEN_KEY.test(key))
    .map(([key, child]) => [key, sanitizeCapacityValue(child)])
    .filter(([, child]) => child !== undefined))
}

function pick(record, keys) {
  return Object.fromEntries([...keys].map((key) => [key, sanitizeCapacityValue(record?.[key] ?? null)]))
}

export function sanitizeCapacitySource(source) { return pick(source, SAFE_SOURCE_KEYS) }
export function sanitizeCapacityComponent(component) { return pick(component, SAFE_COMPONENT_KEYS) }

export function buildCapacityResponse(payload = {}) {
  const sanitized = sanitizeCapacityValue(payload) || {}
  return {
    ...sanitized,
    version: CAPACITY_CONTRACT_VERSION,
    sources: Array.isArray(payload.sources) ? payload.sources.map(sanitizeCapacitySource) : [],
  }
}
