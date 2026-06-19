import logger from '../logger.js'
import { resolveRedisUrl } from './protocol.js'
import { buildRedisOptions } from '../core/redisFactory.js'

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
  // SCAN para descobrir as chaves, depois UM MGET pra ler todos os valores
  // (P2-5). Antes era um GET por chave (N+1 round-trips) — com muitos shards o
  // scrape de /metrics ficava lento e abria muito tráfego no plano de controle.
  let cursor = '0'
  const allKeys = []
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100)
    cursor = nextCursor
    for (const key of keys) allKeys.push(key)
  } while (cursor !== '0')

  let total = 0
  const byShard = {}
  if (allKeys.length === 0) return { total, byShard }

  const values = await redis.mget(allKeys)
  for (let i = 0; i < allKeys.length; i++) {
    const value = Number(values[i] || 0)
    if (!Number.isFinite(value)) continue
    total += value
    const shard = allKeys[i].slice(prefix.length) || 'unknown'
    byShard[shard] = value
  }

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

export async function getSupervisorOperationalCounters({ redisUrl, skipCache = false, ioredisModule = null } = {}) {
  if (!skipCache && countersCache && Date.now() - countersCacheAt < COUNTERS_CACHE_TTL_MS) {
    return countersCache
  }
  const url = redisUrl || resolveRedisUrl()
  if (!url) return emptyCounters()

  const mod = ioredisModule ?? (await import('ioredis'))
  const Redis = mod.default ?? mod.Redis ?? mod
  // maxRetriesPerRequest:1 preservado: /metrics quer fail-fast, não pendurar o
  // scrape num Redis indisponível.
  const redis = new Redis(url, buildRedisOptions('ops-counters', { lazyConnect: true, maxRetriesPerRequest: 1 }))
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
