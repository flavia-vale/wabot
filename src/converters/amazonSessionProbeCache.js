// Cache TTL puro (sem DB/rede) da última sondagem de sessão Amazon, por userId.
//
// Contexto (RCA 001-amazon-cookie-expiry): o dashboard chama
// `GET /api/credentials/amazon/session` a cada carregamento do painel, sem
// cache/throttle. Cada chamada real dispara um `getShortUrl` que ROTACIONA o
// cookie de sessão — N aberturas do painel em pouco tempo = N rotações
// consumidas, e como cada rotação precisa ser reenviada na próxima chamada
// para a sessão continuar viva, aberturas frequentes agravam (mas não causam
// sozinhas) a expiração rápida. Este módulo garante que N aberturas dentro da
// janela TTL resultem em apenas 1 sondagem real — as demais são servidas do
// cache.
//
// Módulo puro e testável isoladamente: um único `Map` em memória do processo
// (por-userId), sem import de DB/rede/Prisma. Footprint desprezível (poucos
// bytes por usuário ativo) — não introduz processo/serviço novo.

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutos — janela curta, mas cobre reloads do painel

function resolveTtlMs() {
  const raw = Number(process.env.AMAZON_SESSION_PROBE_CACHE_TTL_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_MS
}

const cache = new Map() // userId -> { result, expiresAt }

export function getCachedProbe(userId, now = Date.now()) {
  const entry = cache.get(userId)
  if (!entry) return null
  if (entry.expiresAt <= now) {
    cache.delete(userId)
    return null
  }
  return entry.result
}

export function setCachedProbe(userId, result, now = Date.now()) {
  cache.set(userId, { result, expiresAt: now + resolveTtlMs() })
}

export function pruneExpired(now = Date.now()) {
  for (const [userId, entry] of cache.entries()) {
    if (entry.expiresAt <= now) cache.delete(userId)
  }
}

// Invalida a entrada de um usuário — usado quando a credencial `amazon` é
// regravada (PUT /:platform): sem isto, um cookie novo salvo pela usuária
// continuava sendo mascarado pelo resultado antigo em cache (ex.: expirado)
// até o TTL expirar (T022, review de código).
export function invalidateCachedProbe(userId) {
  cache.delete(userId)
}

// Poda periódica de baixa frequência (T024, review de código): sem isto,
// `pruneExpired` fica exportado mas nunca chamado em `src/`, e entradas de
// usuários que sondam uma única vez e não retornam permanecem no Map até um
// novo acesso do mesmo userId (a eviction em `getCachedProbe` é lazy).
// Espelha o padrão de `startLoginAttemptsCleanup` (src/api/routes/auth.js):
// timer top-level com `unref()` para não segurar o event loop nem exigir
// wiring em cada consumidor do módulo.
let pruneTimer = null
export function startProbeCachePrune() {
  if (pruneTimer) return pruneTimer
  pruneTimer = setInterval(() => pruneExpired(), 30 * 60_000)
  pruneTimer.unref?.()
  return pruneTimer
}

startProbeCachePrune()

export const __testing = { cache, resolveTtlMs, DEFAULT_TTL_MS }
