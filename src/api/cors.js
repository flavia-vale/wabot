import { isIP } from 'node:net'

export const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3006',
  'http://127.0.0.1:3006',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://espelhagrupos.com.br',
  'https://espelhagrupos.com.br',
  'http://www.espelhagrupos.com.br',
  'https://www.espelhagrupos.com.br',
  'http://178.105.54.0:3006',
]

const PRODUCTION_API_PORT = '3001'
const ENV_KEYS_FOR_STRICT_PRODUCTION = ['APP_ENV', 'WABOT_ENV', 'DEPLOY_ENV']

export function isIpHost(hostname = '') {
  return isIP(String(hostname || '').trim()) !== 0
}

export function normalizeOrigin(origin) {
  try {
    const parsed = new URL(String(origin ?? '').trim())
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return null
  }
}

export function isStrictProductionRuntime(env = process.env) {
  const nodeEnv = String(env.NODE_ENV ?? '').trim().toLowerCase()
  if (nodeEnv !== 'production') return false

  const declaredEnvironments = ENV_KEYS_FOR_STRICT_PRODUCTION
    .map((key) => String(env[key] ?? '').trim().toLowerCase())
    .filter(Boolean)
  if (declaredEnvironments.includes('production')) return true

  const apiPort = String(env.API_PORT ?? PRODUCTION_API_PORT).trim()
  return apiPort === PRODUCTION_API_PORT
}

export function shouldAllowIpOrigins(env = process.env) {
  return !isStrictProductionRuntime(env)
}

export function getAllowedOrigins(env = process.env, defaultAllowedOrigins = DEFAULT_ALLOWED_ORIGINS) {
  const configured = env.CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean)

  const base = defaultAllowedOrigins.map((origin) => normalizeOrigin(origin)).filter(Boolean)
  const merged = [...new Set([...base, ...(configured?.length ? configured : [])])]

  if (shouldAllowIpOrigins(env)) return merged

  return merged.filter((origin) => {
    try {
      const host = new URL(origin).hostname
      return !isIpHost(host)
    } catch {
      return false
    }
  })
}

export function createCorsOriginChecker(allowedOrigins) {
  const allowed = allowedOrigins instanceof Set ? allowedOrigins : new Set(allowedOrigins)
  return function isOriginAllowed(origin) {
    if (!origin) return true
    const normalized = normalizeOrigin(origin)
    return Boolean(normalized && allowed.has(normalized))
  }
}
