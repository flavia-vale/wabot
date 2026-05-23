import logger from '../logger.js'
import { resolveRedisUrl } from './protocol.js'

const MISMATCH_PREFIX = 'supervisor:session_owner_mismatch_total:'
const CIRCUIT_PREFIX = 'supervisor:session_circuit_breaker_alert:'

async function sumKeysByPrefix(redis, prefix) {
  let cursor = '0'
  let total = 0
  const byShard = {}

  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100)
    cursor = nextCursor
    for (const key of keys) {
      const raw = await redis.get(key)
      const value = Number(raw || 0)
      if (!Number.isFinite(value)) continue
      total += value
      const shard = key.slice(prefix.length) || 'unknown'
      byShard[shard] = value
    }
  } while (cursor !== '0')

  return { total, byShard }
}

export async function getSupervisorOperationalCounters({ redisUrl } = {}) {
  const url = redisUrl || resolveRedisUrl()
  if (!url) {
    return {
      redisAvailable: false,
      sessionOwnerMismatchTotal: null,
      sessionOwnerMismatchByShard: {},
      sessionCircuitBreakerAlertTotal: null,
      sessionCircuitBreakerAlertByShard: {},
    }
  }

  const { default: Redis } = await import('ioredis')
  const redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 })
  try {
    await redis.connect()
    const mismatch = await sumKeysByPrefix(redis, MISMATCH_PREFIX)
    const circuit = await sumKeysByPrefix(redis, CIRCUIT_PREFIX)
    return {
      redisAvailable: true,
      sessionOwnerMismatchTotal: mismatch.total,
      sessionOwnerMismatchByShard: mismatch.byShard,
      sessionCircuitBreakerAlertTotal: circuit.total,
      sessionCircuitBreakerAlertByShard: circuit.byShard,
    }
  } catch (err) {
    logger.warn({ err: err?.message }, 'Falha ao ler contadores operacionais do supervisor')
    return {
      redisAvailable: false,
      sessionOwnerMismatchTotal: null,
      sessionOwnerMismatchByShard: {},
      sessionCircuitBreakerAlertTotal: null,
      sessionCircuitBreakerAlertByShard: {},
    }
  } finally {
    try { await redis.quit() } catch {}
  }
}
