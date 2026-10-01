/**
 * Relógio compartilhado via Redis (SUPERVISOR_NODE_ROUTING).
 *
 * Por quê: `_enqueuedAt` é carimbado pelo relógio da API e comparado, no
 * supervisor, com o relógio DELE (`isCommandStale`, timeout de 5 s no
 * START_BOT). Com dois servidores, desvio de relógio maior que o timeout faria
 * todo comando parecer velho. Aqui os dois lados medem o desvio contra o
 * `TIME` do Redis (uma fonte só) e carimbam/comparam em "hora do Redis".
 *
 * O desvio é cacheado (padrão 60 s): custo de 1 round-trip por minuto. Se o
 * Redis falhar, mantém o último desvio conhecido (0 na primeira vez).
 */

/** Converte a resposta do `TIME` ([segundos, microssegundos]) em epoch ms. */
export function parseRedisTime(reply) {
  if (!Array.isArray(reply) || reply.length < 2) return null
  const sec = Number(reply[0])
  const usec = Number(reply[1])
  if (!Number.isFinite(sec) || !Number.isFinite(usec)) return null
  return sec * 1000 + Math.floor(usec / 1000)
}

export function createRedisClock({ time, ttlMs = 60_000, localNow = () => Date.now() } = {}) {
  let offsetMs = 0
  let measuredAt = -Infinity
  let inflight = null

  async function refresh() {
    try {
      const before = localNow()
      const redisNow = parseRedisTime(await time())
      const after = localNow()
      if (redisNow !== null) offsetMs = redisNow - Math.round((before + after) / 2)
    } catch {
      // mantém o último desvio
    }
    measuredAt = localNow()
  }

  return {
    /** Hora do Redis (epoch ms), com o desvio revalidado a cada `ttlMs`. */
    async now() {
      if (localNow() - measuredAt >= ttlMs) {
        inflight ??= refresh().finally(() => { inflight = null })
        await inflight
      }
      return localNow() + offsetMs
    },
    getOffsetMs: () => offsetMs,
  }
}
