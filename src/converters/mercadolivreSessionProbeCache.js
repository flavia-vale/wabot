// Cache TTL puro (sem DB/rede) da última sondagem de sessão do Mercado Livre,
// por userId. Espelha 1:1 src/converters/amazonSessionProbeCache.js
// (005-ml-cookie-expiry, agravante CONFIRMADO em research.md).
//
// Contexto: o dashboard chama `GET /api/credentials/mercadolivre/session` a
// cada carregamento do painel, sem cache/throttle. Cada chamada real dispara
// um probe (`createLink`/checkMercadoLivreSession) que pode ROTACIONAR o
// cookie de sessão — N aberturas do painel em pouco tempo = N sondagens
// reais consumidas. Este módulo garante que N aberturas dentro da janela TTL
// resultem em apenas 1 sondagem real — as demais são servidas do cache.
//
// Módulo puro e testável isoladamente: um único `Map` em memória do processo
// (por-userId), sem import de DB/rede/Prisma. Footprint desprezível (poucos
// bytes por usuário ativo) — não introduz processo/serviço novo.

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutos — janela curta, mas cobre reloads do painel

function resolveTtlMs() {
  const raw = Number(process.env.ML_SESSION_PROBE_CACHE_TTL_MS)
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

// Só armazena resultado definitivo (`alive === true || alive === false`).
// Estados transitórios (`alive === null` — ex.: network_error/forbidden/
// rate_limited/busy) NUNCA entram no cache: um único blip não pode fixar o
// painel nesse estado pela janela inteira do TTL (espelha o fix T023 do
// precedente Amazon).
export function setCachedProbe(userId, result, now = Date.now()) {
  if (result?.alive !== true && result?.alive !== false) return
  cache.set(userId, { result, expiresAt: now + resolveTtlMs() })
}

export function pruneExpired(now = Date.now()) {
  for (const [userId, entry] of cache.entries()) {
    if (entry.expiresAt <= now) cache.delete(userId)
  }
}

// Invalida a entrada de um usuário — usado quando a credencial `mercadolivre`
// é regravada (PUT /:platform): sem isto, um cookie/token novo recadastrado
// pela usuária continuaria mascarado pelo resultado antigo em cache (ex.:
// expirado) até o TTL expirar sozinho.
export function invalidateCachedProbe(userId) {
  cache.delete(userId)
}

// Poda periódica de baixa frequência: sem isto, `pruneExpired` fica
// exportado mas nunca chamado em `src/`, e entradas de usuários que sondam
// uma única vez e não retornam permanecem no Map até um novo acesso do mesmo
// userId (a eviction em `getCachedProbe` é lazy). Espelha o padrão de
// `startProbeCachePrune` do módulo Amazon.
let pruneTimer = null
export function startProbeCachePrune() {
  if (pruneTimer) return pruneTimer
  pruneTimer = setInterval(() => pruneExpired(), 30 * 60_000)
  pruneTimer.unref?.()
  return pruneTimer
}

startProbeCachePrune()

export const __testing = { cache, resolveTtlMs, DEFAULT_TTL_MS }
