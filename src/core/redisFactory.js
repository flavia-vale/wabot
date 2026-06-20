/**
 * Factory canônico de conexões ioredis (P2-4).
 *
 * Antes, cada módulo abria `new Redis(url, {...})` com opções divergentes —
 * alguns sem `retryStrategy`/`connectTimeout`, nomes de conexão ausentes nos
 * logs do Redis, etc. Centralizar aqui dá um piso de resiliência consistente
 * SEM mudar a semântica de quem já passava opções específicas:
 *
 *   - `retryStrategy`: backoff exponencial LIMITADO (não martela o Redis num
 *     loop apertado, mas também não desiste). ioredis default cresce sem teto.
 *   - `connectTimeout`: corta um connect pendurado em vez de esperar o default.
 *   - `connectionName`: rotula a conexão no `CLIENT LIST` do Redis (debug).
 *
 * Propositalmente NÃO força `maxRetriesPerRequest`/`lazyConnect`: cada call
 * site mantém o seu (BullMQ exige `null`; o scrape de /metrics quer fail-fast
 * `1`; etc.) via `overrides`, que sempre vencem os defaults.
 */

// Backoff: 200ms, 400ms, ... até um teto de 5s. Sempre retorna número (sempre
// reconecta). times começa em 1.
export function defaultRetryStrategy(times) {
  return Math.min(Math.max(1, times) * 200, 5_000)
}

export const CANONICAL_REDIS_OPTIONS = Object.freeze({
  retryStrategy: defaultRetryStrategy,
  connectTimeout: 10_000,
})

/**
 * Monta o objeto de opções canônico. `role` vira `connectionName` (prefixado
 * por `wabot:`); `overrides` têm precedência sobre os defaults.
 */
export function buildRedisOptions(role, overrides = {}) {
  const opts = { ...CANONICAL_REDIS_OPTIONS, ...overrides }
  if (role && opts.connectionName === undefined) opts.connectionName = `wabot:${role}`
  return opts
}

/**
 * Cria uma conexão ioredis com as opções canônicas. `RedisCtor` permite
 * injeção em testes sem Redis real.
 */
export async function createRedisConnection(url, { role, RedisCtor = null, ...overrides } = {}) {
  const mod = RedisCtor ? null : await import('ioredis')
  const Redis = RedisCtor ?? mod.default ?? mod.Redis ?? mod
  return new Redis(url, buildRedisOptions(role, overrides))
}
