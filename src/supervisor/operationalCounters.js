import logger from '../logger.js'
import { resolveRedisUrl } from './protocol.js'

const MISMATCH_PREFIX = 'supervisor:session_owner_mismatch_total:'
const CIRCUIT_PREFIX = 'supervisor:session_circuit_breaker_alert:'
const QUARANTINE_PREFIX = 'supervisor:session_quarantine_total:'

// /metrics está fora do rate limit e sem autenticação; sem cache, cada scrape
// abria uma conexão Redis nova + SCAN + GETs — vetor barato de carga no plano
// de controle. TTL curto mantém o painel atual o suficiente.
const COUNTERS_CACHE_TTL_MS = Math.max(0, Number(process.env.SUPERVISOR_COUNTERS_CACHE_TTL_MS ?? 15_000))
let countersCache = null
let countersCacheAt = 0

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

function emptyCounters() {
  return {
    redisAvailable: false,
    sessionOwnerMismatchTotal: null,
    sessionOwnerMismatchByShard: {},
    sessionCircuitBreakerAlertTotal: null,
    sessionCircuitBreakerAlertByShard: {},
    sessionQuarantineTotal: null,
    sessionQuarantineByShard: {},
  }
}

export async function getSupervisorOperationalCounters({ redisUrl, skipCache = false } = {}) {
  if (!skipCache && countersCache && Date.now() - countersCacheAt < COUNTERS_CACHE_TTL_MS) {
    return countersCache
  }
  const url = redisUrl || resolveRedisUrl()
  if (!url) return emptyCounters()

  const { default: Redis } = await import('ioredis')
  const redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 })
  try {
    await redis.connect()
    const mismatch = await sumKeysByPrefix(redis, MISMATCH_PREFIX)
    const circuit = await sumKeysByPrefix(redis, CIRCUIT_PREFIX)
    const quarantine = await sumKeysByPrefix(redis, QUARANTINE_PREFIX)
    const result = {
      redisAvailable: true,
      sessionOwnerMismatchTotal: mismatch.total,
      sessionOwnerMismatchByShard: mismatch.byShard,
      sessionCircuitBreakerAlertTotal: circuit.total,
      sessionCircuitBreakerAlertByShard: circuit.byShard,
      sessionQuarantineTotal: quarantine.total,
      sessionQuarantineByShard: quarantine.byShard,
    }
    countersCache = result
    countersCacheAt = Date.now()
    return result
  } catch (err) {
    logger.warn({ err: err?.message }, 'Falha ao ler contadores operacionais do supervisor')
    return emptyCounters()
  } finally {
    try { await redis.quit() } catch {}
  }
}
