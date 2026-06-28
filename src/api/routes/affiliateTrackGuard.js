// R2: guarda do POST /affiliate/track (público, sem auth).
//
// Rate-limit por IP + dedup de touch (mesmo visitor+afiliado em janela curta),
// para impedir inflação de métricas de atribuição e DoS de storage por botnet
// enchendo AffiliateAttributionTouch. Estado in-memory (sem Redis). Módulo puro
// e injetável (`now`) para teste — sem import de db.

export function createTrackGuard({
  rateWindowMs = Number(process.env.AFFILIATE_TRACK_RATE_WINDOW_MS) || 60_000,
  rateMax = Number(process.env.AFFILIATE_TRACK_RATE_MAX) || 20,
  dedupMs = Number(process.env.AFFILIATE_TRACK_DEDUP_MS) || 10 * 60_000,
  now = () => Date.now(),
} = {}) {
  const hitsByIp = new Map()
  const dedup = new Map()

  function rateLimited(ip) {
    const t = now()
    const key = ip || 'unknown'
    const cur = hitsByIp.get(key)
    if (!cur || cur.resetAt <= t) {
      hitsByIp.set(key, { count: 1, resetAt: t + rateWindowMs })
      return false
    }
    cur.count += 1
    return cur.count > rateMax
  }

  function isDuplicate(visitorId, affiliateId) {
    const t = now()
    const key = `${visitorId}|${affiliateId}`
    const last = dedup.get(key)
    if (last != null && t - last < dedupMs) return true
    dedup.set(key, t)
    return false
  }

  // Poda entradas expiradas para os mapas não crescerem indefinidamente.
  function cleanup() {
    const t = now()
    for (const [k, v] of hitsByIp) if (v.resetAt <= t) hitsByIp.delete(k)
    for (const [k, ts] of dedup) if (t - ts >= dedupMs) dedup.delete(k)
  }

  return { rateLimited, isDuplicate, cleanup, _sizes: () => ({ ips: hitsByIp.size, dedup: dedup.size }) }
}
