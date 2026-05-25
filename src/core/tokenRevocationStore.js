import logger from '../logger.js'
import { parseEnumEnv, logModeSummary } from './envModes.js'

const MEM = new Map()
let redisClient = null
let redisInitPromise = null
let redisHealthy = false

const REVOCATION_STORE_MODE = parseEnumEnv('REVOCATION_STORE_MODE', process.env.REVOCATION_STORE_MODE || 'auto', ['auto', 'memory', 'redis'], 'auto')

logModeSummary('token-revocation-store', {
  revocationStoreMode: REVOCATION_STORE_MODE,
  hasRedisUrl: Boolean(process.env.REDIS_URL),
})

function redisEnabled() {
  if (REVOCATION_STORE_MODE === 'memory') return false
  if (REVOCATION_STORE_MODE === 'redis') return Boolean(process.env.REDIS_URL)
  return Boolean(process.env.REDIS_URL)
}

async function getRedis() {
  if (!redisEnabled()) return null
  if (redisClient && redisHealthy) return redisClient
  if (redisInitPromise) return redisInitPromise

  redisInitPromise = (async () => {
    try {
      const ioredis = await import('ioredis')
      const Redis = ioredis.default ?? ioredis.Redis ?? ioredis
      const client = new Redis(process.env.REDIS_URL, {
        lazyConnect: false,
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
      })
      client.on('ready', () => { redisHealthy = true })
      client.on('error', (err) => {
        redisHealthy = false
        logger.warn({ err: err?.message }, 'tokenRevocationStore: redis error')
      })
      client.on('end', () => { redisHealthy = false })
      await client.ping()
      redisHealthy = true
      redisClient = client
      return redisClient
    } catch (err) {
      redisHealthy = false
      redisClient = null
      logger.warn({ err: err?.message }, 'tokenRevocationStore: Redis indisponível, fallback memory')
      return null
    } finally {
      redisInitPromise = null
    }
  })()

  return redisInitPromise
}

export async function revokeTokenJtiGlobal(jti, exp) {
  if (!jti) return
  const key = String(jti)
  const expiresAtMs = Number.isFinite(exp) ? exp * 1000 : Date.now() + (7 * 24 * 60 * 60 * 1000)
  MEM.set(key, expiresAtMs)
  const redis = await getRedis()
  if (!redis) return
  const ttlSec = Math.max(1, Math.floor((expiresAtMs - Date.now()) / 1000))
  try {
    await redis.set(`revoked:${key}`, String(expiresAtMs), 'EX', ttlSec)
  } catch (err) {
    logger.warn({ err: err?.message }, 'tokenRevocationStore: falha ao persistir em Redis')
  }
}

export async function isTokenRevokedGlobal(jti) {
  if (!jti) return false
  const key = String(jti)
  const local = MEM.get(key)
  if (local) {
    if (Date.now() <= local) return true
    MEM.delete(key)
  }

  const redis = await getRedis()
  if (!redis) return false
  try {
    const v = await redis.get(`revoked:${key}`)
    if (!v) return false
    const expiresAtMs = Number(v)
    if (!Number.isFinite(expiresAtMs)) return true
    return Date.now() <= expiresAtMs
  } catch {
    return false
  }
}
