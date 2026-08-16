import crypto from 'node:crypto'
import axios from 'axios'
import logger from '../logger.js'
import { withMercadoLivreCredentialLock } from './mercadolivreCredentialLock.js'
import { shouldConvertCouponLinks } from './couponPolicy.js'
import { decideVitrineFallback } from './mlVitrinePolicy.js'

// Cache LRU simples para evitar reexpansão de short links repetidos
// (campanhas de cupons disparam o mesmo meli.la várias vezes seguidas).
// Só cacheia resoluções de host de encurtador para URL ML canônica/produto;
// não cacheia chamadas autenticadas da API de afiliados.
const RESOLVE_CACHE_MAX = Math.max(50, Number(process.env.ML_RESOLVE_CACHE_MAX) || 500)
const RESOLVE_CACHE_TTL_MS = Math.max(60_000, Number(process.env.ML_RESOLVE_CACHE_TTL_MS) || 6 * 60 * 60_000)
const ML_RESOLVE_FETCH_TIMEOUT_MS = Math.max(1_000, Number(process.env.ML_RESOLVE_FETCH_TIMEOUT_MS) || 4_000)
const resolveCache = new Map()
const ML_AFFILIATE_FORBIDDEN_COOLDOWN_MS = Math.max(60_000, Number(process.env.ML_AFFILIATE_FORBIDDEN_COOLDOWN_MS) || 15 * 60_000)
const ML_AFFILIATE_RATE_LIMIT_COOLDOWN_MS = Math.max(60_000, Number(process.env.ML_AFFILIATE_RATE_LIMIT_COOLDOWN_MS) || 5 * 60_000)
const ML_CREATE_LINK_MAX_CANDIDATES = Math.max(1, Number(process.env.ML_CREATE_LINK_MAX_CANDIDATES) || 1)
const affiliateCooldowns = new Map()

function getCachedResolve(url) {
  const entry = resolveCache.get(url)
  if (!entry) return null
  if (Date.now() - entry.at > RESOLVE_CACHE_TTL_MS) {
    resolveCache.delete(url)
    return null
  }
  // bump recência (LRU)
  resolveCache.delete(url)
  resolveCache.set(url, entry)
  return entry.value
}

function setCachedResolve(url, value) {
  if (!value) return
  if (resolveCache.size >= RESOLVE_CACHE_MAX) {
    const oldest = resolveCache.keys().next().value
    if (oldest) resolveCache.delete(oldest)
  }
  resolveCache.set(url, { value, at: Date.now() })
}


function affiliateCooldownKey(creds = {}) {
  const parts = [
    String(creds.userId || ''),
    String(creds.tag || ''),
    String(creds.id || ''),
    String(creds.ssid || creds.cookie || ''),
  ]
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16)
}

function pruneAffiliateCooldowns(now = Date.now()) {
  for (const [key, entry] of affiliateCooldowns) {
    if (!entry || entry.until <= now) affiliateCooldowns.delete(key)
  }
}

function getAffiliateCooldown(creds, now = Date.now()) {
  pruneAffiliateCooldowns(now)
  const entry = affiliateCooldowns.get(affiliateCooldownKey(creds))
  if (!entry || entry.until <= now) return null
  return entry
}

function setAffiliateCooldown(creds, failureType, now = Date.now()) {
  const warning = failureType === 'forbidden'
    ? ML_AFFILIATE_ERROR_WARNING.forbidden
    : failureType === 'rate_limited'
      ? ML_AFFILIATE_ERROR_WARNING.rate_limited
      : null
  if (!warning) return null
  const durationMs = failureType === 'forbidden'
    ? ML_AFFILIATE_FORBIDDEN_COOLDOWN_MS
    : ML_AFFILIATE_RATE_LIMIT_COOLDOWN_MS
  const entry = { failureType, warning, until: now + durationMs }
  affiliateCooldowns.set(affiliateCooldownKey(creds), entry)
  return entry
}

export function clearMercadoLivreAffiliateCooldownsForTest() {
  affiliateCooldowns.clear()
}

// Captura o Location do redirect meli.la sem seguir até o ML
// (follow-redirects lança erro na 3xx — Location fica em err.response.headers)
async function resolve(url) {
  const cached = getCachedResolve(url)
  if (cached) return cached
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(ML_RESOLVE_FETCH_TIMEOUT_MS),
    })
    if (res?.url && res.url !== url) {
      setCachedResolve(url, res.url)
      return res.url
    }
  } catch {
    // fallback para resolução manual abaixo
  }

  let current = url
  for (let i = 0; i < 8; i++) {
    try {
      const res = await axios.get(current, {
        maxRedirects: 0,
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })

      // Alguns meli.la retornam 200 com HTML intermediário (sem 3xx).
      // Tentar extrair URL final via meta refresh / canonical / location.href.
      const html = typeof res?.data === 'string' ? res.data : ''
      const metaRefresh = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"'>\s]+)["']/i)?.[1]
      const canonical = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
      const jsLocation = html.match(/(?:window\.)?location\.(?:href|replace)\s*=\s*["']([^"']+)["']/i)?.[1]
      const encodedOriginUrl = html.match(/"origin_url"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i)?.[1]
      const originUrl = encodedOriginUrl
        ? JSON.parse(`"${encodedOriginUrl}"`)
        : null
      const nextFromHtml = originUrl || metaRefresh || canonical || jsLocation
      if (!nextFromHtml) {
        if (current !== url) setCachedResolve(url, current)
        return current
      }

      const next = new URL(nextFromHtml, current).toString()
      if (next === current) {
        if (current !== url) setCachedResolve(url, current)
        return current
      }
      current = next
      continue
    } catch (err) {
      const location = err?.response?.headers?.location
      if (!location) {
        if (current !== url) setCachedResolve(url, current)
        return current
      }
      current = new URL(location, current).toString()
    }
  }
  if (current !== url) setCachedResolve(url, current)
  return current
}

function canonicalizeMlProductUrl(raw) {
  const normalizedRaw = String(raw).replace(/&amp;/gi, '&')
  const u = new URL(normalizedRaw)
  // ML usa `go=` em vários paths (/gz/webdevice/config, /social/..., afiliados etc.)
  // como destino real. Se o `go` é uma URL ML com MLB, esse é o produto verdadeiro.
  const goParam = u.searchParams.get('go')
  if (goParam && /MLB[-_]?[0-9]{6,}/i.test(goParam)) {
    try { return canonicalizeMlProductUrl(goParam) } catch { /* ignore */ }
  }
  if (u.pathname === '/gz/webdevice/config' && goParam) {
    return canonicalizeMlProductUrl(goParam)
  }
  u.hash = ''
  const removableParams = new Set([
    'matt_word', 'matt_tool', 'matt_event_ts', 'matt_d2id', 'matt_tracing_id',
    'forceInApp', 'ref', 'partner_id',
    'reco_backend', 'reco_client', 'reco_item_pos', 'reco_backend_type', 'reco_id',
    'sid', 'c_id', 'c_uid', 'polycard_client',
  ])
  for (const key of [...u.searchParams.keys()]) {
    const normalizedKey = key.replace(/^amp;/i, '')
    if (normalizedKey !== key) {
      const values = u.searchParams.getAll(key)
      u.searchParams.delete(key)
      for (const value of values) u.searchParams.append(normalizedKey, value)
    }
  }
  for (const p of removableParams) {
    u.searchParams.delete(p)
    u.searchParams.delete(`amp;${p}`)
  }
  return u.toString()
}

function extractMlbId(input) {
  if (!input) return null
  const m = String(input).match(/\bMLB[-_]?([0-9]{6,})\b/i)
  if (!m) return null
  return `MLB${m[1]}`
}

function buildCanonicalCandidates(targetUrl) {
  const id = extractMlbId(targetUrl)
  if (!id) return [targetUrl]
  const candidates = [
    targetUrl,
    `https://www.mercadolivre.com.br/p/${id}`,
    `https://produto.mercadolivre.com.br/${id}-x-_JM`,
  ]
  return [...new Set(candidates)]
}

function selectCreateLinkCandidates(targetUrl, candidates = [], anchorMlbId = null) {
  const seen = new Set()
  const selected = []
  const push = (candidate) => {
    if (!candidate || seen.has(candidate)) return
    seen.add(candidate)
    if (anchorMlbId) {
      const candidateMlbId = extractMlbId(candidate)
      if (candidateMlbId && candidateMlbId !== anchorMlbId) {
        logger.warn({ candidate, anchorMlbId, candidateMlbId }, 'ML createLink: candidate diverge do MLB esperado — pulando')
        return
      }
    }
    selected.push(candidate)
  }

  push(candidates[0] || targetUrl)
  // Escape hatch operacional: default 1 para reduzir amplificação. Se o ML mudar
  // formato e for preciso testar variações canônicas, a env aumenta o teto sem
  // reintroduzir o produto cartesiano N candidates × attempts × retries.
  for (const candidate of candidates.slice(1)) {
    if (selected.length >= ML_CREATE_LINK_MAX_CANDIDATES) break
    push(candidate)
  }
  return selected
}

// Extrai MLB do HTML usando SÓ fontes estruturadas (que apontam para o
// produto da própria página, não para recomendações).
// Em ordem de confiança:
//   1) tags <link rel=canonical>, <meta og:url>, <meta twitter:url>
//   2) landing social: recommended_items[0] e/ou parâmetro wid=
//   3) JSON-LD com @type Product
//   4) blobs __PRELOADED_STATE__ / __NEXT_DATA__ com itemId/productId/MLB
// O regex genérico "primeira ocorrência de MLB no HTML" foi removido por
// ser instável: o ML serve carrosséis de recomendações antes do produto.
async function tryExtractProductFromLanding(url) {
  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const html = typeof res?.data === 'string' ? res.data : ''

    // 1) tags <head> ancoradas
    const tagSources = [
      { label: 'canonical', value: html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] },
      { label: 'og:url', value: html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i)?.[1] },
      { label: 'twitter:url', value: html.match(/<meta[^>]*name=["']twitter:url["'][^>]*content=["']([^"']+)["']/i)?.[1] },
    ]
    for (const src of tagSources) {
      if (!src.value) continue
      const mlb = extractMlbId(src.value)
      if (!mlb) continue
      try {
        const canon = canonicalizeMlProductUrl(src.value)
        logger.info({ landingUrl: url, source: src.label, value: src.value, mlb }, 'ML landing: extraído de tag ancorada')
        return canon
      } catch { /* ignore */ }
    }

    // 2) landings sociais do ML (mostram vários produtos do vendedor):
    //    a) recommended_items[0] — primeiro item é o destacado pela share
    //    b) parâmetro wid= (watched item id) nas URLs internas — id global
    //       do produto compartilhado, com lookup do product_id correspondente
    const recoMatch = html.match(/"recommended_items"\s*:\s*\[\s*\{\s*"id"\s*:\s*"(MLB[-_]?[0-9]+)"(?:[^{}]*?"product_id"\s*:\s*"(MLB[-_]?[0-9]+)")?/i)
    if (recoMatch) {
      const productMlb = recoMatch[2] ? extractMlbId(recoMatch[2]) : null
      const listingMlb = extractMlbId(recoMatch[1])
      if (productMlb) {
        const canonical = `https://www.mercadolivre.com.br/p/${productMlb}`
        logger.info({ landingUrl: url, productMlb, listingMlb, source: 'recommended_items[0]' }, 'ML landing: extraído de recommended_items[0]')
        return canonical
      }
      if (listingMlb) {
        const canonical = `https://produto.mercadolivre.com.br/${listingMlb}-x-_JM`
        logger.info({ landingUrl: url, mlb: listingMlb, source: 'recommended_items[0]:id' }, 'ML landing: extraído de recommended_items[0] (listagem)')
        return canonical
      }
    }
    const widMatch = html.match(/[?&;]wid=(MLB[-_]?[0-9]+)/i)
    if (widMatch?.[1]) {
      const listingMlb = extractMlbId(widMatch[1])
      if (listingMlb) {
        const productLookup = new RegExp(`"id"\\s*:\\s*"${listingMlb}"\\s*,\\s*"product_id"\\s*:\\s*"(MLB[-_]?[0-9]+)"`, 'i')
        const productMatch = html.match(productLookup)
        if (productMatch?.[1]) {
          const productMlb = extractMlbId(productMatch[1])
          if (productMlb) {
            const canonical = `https://www.mercadolivre.com.br/p/${productMlb}`
            logger.info({ landingUrl: url, productMlb, listingMlb, source: 'wid+lookup' }, 'ML landing: extraído de wid com lookup de product_id')
            return canonical
          }
        }
        const canonical = `https://produto.mercadolivre.com.br/${listingMlb}-x-_JM`
        logger.info({ landingUrl: url, mlb: listingMlb, source: 'wid' }, 'ML landing: extraído de wid (sem catalog product_id)')
        return canonical
      }
    }

    // 3) JSON-LD com @type Product
    const ldBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
    for (const block of ldBlocks) {
      const inner = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '')
      try {
        const data = JSON.parse(inner)
        const items = Array.isArray(data) ? data : [data]
        for (const item of items) {
          if (!item || typeof item !== 'object') continue
          const isProduct = String(item['@type'] || '').toLowerCase().includes('product')
          if (!isProduct) continue
          const candidateStr = [item.url, item['@id'], item.sku, item.productID, item.mpn]
            .filter(Boolean)
            .map(String)
            .join(' ')
          const mlb = extractMlbId(candidateStr)
          if (!mlb) continue
          const canonical = `https://www.mercadolivre.com.br/p/${mlb}`
          logger.info({ landingUrl: url, mlb, source: 'json-ld' }, 'ML landing: extraído de JSON-LD Product')
          return canonical
        }
      } catch { /* json inválido, próximo bloco */ }
    }

    // 4) blobs JSON inline (__PRELOADED_STATE__, __NEXT_DATA__, etc.)
    // Procura ocorrências do padrão "itemId":"MLB..." ou "productId":"MLB..."
    // que tipicamente aparecem só na descrição do produto da página, não
    // em cards de recomendação (recomendações usam ids diferentes).
    const blobMatch = html.match(/"(?:itemId|productId|catalog_product_id|product_id|item_id|mlbId|MLB)"\s*:\s*"(MLB[-_]?[0-9]{6,})"/i)
    if (blobMatch?.[1]) {
      const mlb = extractMlbId(blobMatch[1])
      if (mlb) {
        const canonical = `https://www.mercadolivre.com.br/p/${mlb}`
        logger.info({ landingUrl: url, mlb, source: 'json-blob' }, 'ML landing: extraído de blob JSON inline')
        return canonical
      }
    }

    logger.warn({ landingUrl: url }, 'ML landing: nenhuma fonte estruturada produziu MLB — desistindo')
    return null
  } catch (err) {
    logger.warn({ landingUrl: url, err: err.message }, 'ML landing: erro ao buscar HTML')
    return null
  }
}

// Divulgação de PRODUTO via /social/<handle>?ref=<blob> (RCA 2026-07-10).
//
// Todo link meli.la desse tipo de canal resolve, server-side, para
// `mercadolivre.com.br/social/<handle>?ref=<blob-opaco-por-produto>`. O `ref`
// é um blob cifrado (não decodificável por nós), MAS o próprio ML o resolve no
// servidor e renderiza o produto-alvo de duas formas confiáveis no HTML:
//   1) og:title / og:image = título e foto do produto certo;
//   2) um CARD DESTACADO (featured) — o PRIMEIRO polycard do HTML, marcado com
//      `c_id=/home/card-featured/element` — cujo metadata traz o `product_id`
//      de catálogo correto. Os polycards seguintes são RECOMENDAÇÕES da vitrine
//      (produtos quaisquer) e NÃO devem ser usados.
//
// Discriminador robusto (validado em produção 2026-07-10):
//   - `card-featured` presente  => é divulgação de produto => extrai o featured.
//   - `card-featured` ausente    => vitrine/lista genérica ("Minhas listas de
//     recomendações", /lists, cupom) => retorna null (NÃO fabrica produto — era
//     exatamente o bug do "produto aleatório/foto errada" que motivou remover a
//     heurística antiga de recommended_items[0]).
//
// Por que a heurística antiga (recommended_items[0]) falhava: pegava o primeiro
// item de RECOMENDAÇÃO, não o card destacado. Aqui usamos o featured (og +
// primeiro polycard), que é o alvo real do ref.
// O card destacado traz o endereço REAL do anúncio no campo `url` (sem esquema
// e com as barras escapadas como /). Usá-lo é sempre melhor do que montar
// um endereço na mão.
//
// RCA 2026-07-28 (404 em produção): quando o card não tem `product_id` de
// catálogo, o código caía direto no ramo que FABRICA
// `produto.mercadolivre.com.br/<id>-x-_JM` — sem hífen depois de MLB e com o
// slug inventado "-x-". O endereço real do ML é
// `produto.mercadolivre.com.br/MLB-<id>-<nome-do-produto>-_JM`. O endereço
// fabricado respondeu 404 quando aberto do próprio VPS, e essa forma era ~16%
// dos links de ML de uma cliente (370 em 7 dias). Não regredir: preferir
// SEMPRE o `url` do card antes de fabricar.
function extractFeaturedCardUrl(metadata, expectedMlbId) {
  const raw = metadata.match(/"url"\s*:\s*"([^"]+)"/i)?.[1]
  if (!raw) return null

  // O HTML traz a URL como string JSON escapada (/, \/ etc.).
  let decoded = raw
  try {
    decoded = JSON.parse(`"${raw.replace(/(?<!\\)"/g, '\\"')}"`)
  } catch { /* mantém o valor cru */ }
  decoded = String(decoded).trim()
  if (!decoded) return null
  if (!/^https?:\/\//i.test(decoded)) decoded = `https://${decoded.replace(/^\/+/, '')}`

  let u
  try { u = new URL(decoded) } catch { return null }
  // Segurança: só aceitamos endereço do próprio ML vindo do HTML de terceiro.
  if (!ML_HOST.test(u.hostname)) return null

  // Anti-mismatch (mesma filosofia da validação do short link): se o endereço
  // aponta para um MLB diferente do card, não é o produto destacado.
  const urlMlbId = extractMlbId(u.pathname)
  if (!urlMlbId) return null
  if (expectedMlbId && urlMlbId !== expectedMlbId) return null

  u.search = ''
  u.hash = ''
  return u.toString()
}

// Reconhece o endereço que NÓS montamos quando não há código de catálogo nem
// endereço pronto no card: `produto.mercadolivre.com.br/MLB<id>-x-_JM`.
//
// RCA 2026-08-15 (cliente Matheus Chaves): esse formato NÃO EXISTE no Mercado
// Livre — o endereço real é `produto.mercadolivre.com.br/MLB-<id>-<nome>-_JM`
// (com hífen depois de MLB e com o nome do produto no meio). Confirmado abrindo
// no celular E no computador: dá "Tivemos um problema" / "Parece que esta página
// não existe". Em 7 dias, 10 dos 79 envios de Mercado Livre dele saíram assim,
// gravados como `success` no painel — o cliente recebia link quebrado e o painel
// dizia que estava tudo certo.
//
// Por que isso ficava escondido: enquanto a API de afiliados gera o link curto,
// o endereço montado é só a ENTRADA da chamada (e o ML aceita — validado ao vivo
// com a credencial dele: devolveu `meli.la` funcionando). Quem chega ao grupo é o
// `meli.la`, não o endereço montado. Só quando a chamada falha — código de acesso
// vencido, 403, 429 — o plano B publica o endereço montado cru, e aí o link
// quebrado vai para o grupo.
//
// Por isso a guarda é no PUBLICAR, não no montar: montar continua valendo (é
// entrada útil para a API), publicar não.
export function isSyntheticListingUrl(raw) {
  if (!raw) return false
  let u
  try { u = new URL(String(raw)) } catch { return false }
  if (!ML_HOST.test(u.hostname)) return false
  return /^\/MLB[0-9]{6,}-x-_JM\/?$/i.test(u.pathname)
}

export function extractFeaturedSocialProduct(html) {
  if (typeof html !== 'string' || !html) return null
  // Sem card destacado => não é divulgação de um produto específico.
  if (!/card-featured/i.test(html)) return null
  // Blindagem contra o bug histórico da "foto errada": ancoramos a extração no
  // PRIMEIRO polycard (o card destacado), não no primeiro `product_id` que
  // aparecer no HTML. Assim, mesmo que algum id apareça antes no documento (nav,
  // header, blob não relacionado), pegamos o produto do card destacado — o alvo
  // real do ref. Os polycards seguintes são recomendações e ficam de fora.
  const firstPolycard = html.match(/"polycards"\s*:\s*\[\s*\{[\s\S]*?"metadata"\s*:\s*\{([\s\S]*?)\}/i)?.[1]
  if (firstPolycard) {
    const productId = firstPolycard.match(/"product_id"\s*:\s*"(MLB[0-9]+)"/i)?.[1]
    if (productId) return `https://www.mercadolivre.com.br/p/${productId}`
    const listingId = firstPolycard.match(/"id"\s*:\s*"(MLB[0-9]+)"/i)?.[1]
    // Endereço real do ML antes de qualquer fabricação (ver extractFeaturedCardUrl).
    const cardUrl = extractFeaturedCardUrl(firstPolycard, listingId)
    if (cardUrl) return cardUrl
    // Último recurso: sem `url` utilizável no card, montamos o endereço pelo id.
    // Essa forma já respondeu 404 em produção — por isso ela é o ÚLTIMO caminho,
    // não o primeiro.
    if (listingId) return `https://produto.mercadolivre.com.br/${listingId}-x-_JM`
  }
  return null
}

const ML_BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// Busca o HTML da share /social/<handle>?ref=<blob> (o ML resolve o ref e
// renderiza o produto destacado) e extrai o produto-alvo. Retorna a URL
// canônica do produto ou null (vitrine/lista sem produto específico). É a
// ÚNICA fonte usada para essas shares — NÃO cai na heurística frágil de
// recommended_items[0] de tryExtractProductFromLanding.
async function tryExtractFeaturedProductFromSocialShare(url) {
  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': ML_BROWSER_UA,
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    })
    const html = typeof res?.data === 'string' ? res.data : ''
    const featured = extractFeaturedSocialProduct(html)
    if (featured) {
      logger.info({ landingUrl: url, featured }, 'ML social share: produto destacado extraído do ref resolvido pelo ML')
      return featured
    }
    logger.info({ landingUrl: url }, 'ML social share: sem card destacado (vitrine/lista) — não fabrica produto')
    return null
  } catch (err) {
    logger.warn({ landingUrl: url, err: err.message }, 'ML social share: erro ao buscar HTML')
    return null
  }
}

// Chama a API real de afiliados do ML para gerar um meli.la com a tag do usuário
// Endpoint descoberto via reverse-engineering do portal afiliados.mercadolivre.com.br
function buildCookieHeader({ ssid, csrf, cookie, id }) {
  if (cookie) return cookie
  const pairs = []
  if (id) pairs.push(`id=${id}`)
  if (csrf) pairs.push(`_csrf=${csrf}`)
  if (ssid) pairs.push(`ssid=${ssid}`)
  return pairs.join('; ')
}

function parseCookieHeader(cookieHeader = '') {
  const jar = new Map()
  for (const part of String(cookieHeader || '').split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    jar.set(trimmed.slice(0, eq), trimmed.slice(eq + 1))
  }
  return jar
}

function getSetCookieLines(headers = {}) {
  const value = headers?.['set-cookie'] ?? headers?.['Set-Cookie']
  if (!value) return []
  return Array.isArray(value) ? value.filter(Boolean) : [value]
}

// Detecta `Set-Cookie` de DELEÇÃO. O ML (e qualquer servidor) apaga um cookie
// reemitindo-o com valor vazio (`ssid=;`), `Max-Age=0` ou `Expires` no passado.
// Tratar uma deleção como "rotação" gravaria `ssid=` vazio no jar — e como o jar
// (`cookie`) tem precedência sobre o campo `ssid` em buildCookieHeader, isso
// passaria a enviar um SSID vazio em todo request, brickando uma sessão que
// ainda podia estar viva (deleção transitória/espúria). Por isso deleções são
// IGNORADAS: nunca sobrescrevem nem removem um valor já conhecido no jar. Se o
// ML realmente nos deslogou, o próximo request responde 401 e o painel sinaliza
// expiração — sem depender de persistir o cookie de deleção.
function parseSetCookieLine(line) {
  const raw = String(line || '')
  const first = raw.split(';')[0]?.trim()
  if (!first) return null
  const eq = first.indexOf('=')
  if (eq <= 0) return null
  const name = first.slice(0, eq)
  const value = first.slice(eq + 1)
  const attrs = raw.slice(raw.indexOf(';') + 1)
  const maxAgeZero = /;\s*max-age\s*=\s*0\s*(?:;|$)/i.test(raw)
  const expiresPast = (() => {
    const m = raw.match(/;\s*expires\s*=\s*([^;]+)/i)
    if (!m) return false
    const ts = Date.parse(m[1].trim())
    return Number.isFinite(ts) && ts <= Date.now()
  })()
  const isDeletion = value === '' || maxAgeZero || (attrs && expiresPast)
  return { name, value, isDeletion }
}

function mergeSetCookieIntoJar(cookieHeader, setCookieLines) {
  const jar = parseCookieHeader(cookieHeader)
  for (const line of setCookieLines) {
    const parsed = parseSetCookieLine(line)
    if (!parsed) continue
    // Deleção nunca poda/sobrescreve o jar — só rotações com valor real entram.
    if (parsed.isDeletion) continue
    jar.set(parsed.name, parsed.value)
  }
  return jar
}

function serializeCookieJar(jar) {
  // Defesa em profundidade: nunca serializar par com valor vazio (um `ssid=`
  // vazio no header de cookie derruba a autenticação no ML).
  return [...jar.entries()]
    .filter(([, value]) => value !== '')
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

function buildCredentialPatchFromSetCookie(creds = {}, cookieHeader = '', headers = {}) {
  const lines = getSetCookieLines(headers)
  if (!lines.length) return null
  const before = parseCookieHeader(cookieHeader)
  const after = mergeSetCookieIntoJar(cookieHeader, lines)
  const changedNames = [...after.keys()].filter(name => before.get(name) !== after.get(name))
  if (!changedNames.length) return null

  const patch = { cookie: serializeCookieJar(after) }
  if (after.has('ssid')) patch.ssid = after.get('ssid')
  if (after.has('_csrf')) patch.csrf = after.get('_csrf')
  if (after.has('id')) patch.id = after.get('id')

  // Quando a credencial foi cadastrada em campos separados, mantenha os campos
  // conhecidos mesmo que o ML só tenha rotacionado cookies companheiros no jar.
  if (!patch.ssid && creds.ssid) patch.ssid = creds.ssid
  if (!patch.csrf && creds.csrf) patch.csrf = creds.csrf
  if (!patch.id && creds.id) patch.id = creds.id
  return patch
}

async function notifyCredentialPatch(creds = {}, patch) {
  if (!patch) return
  if (typeof creds.__onCredentialPatch === 'function') {
    await creds.__onCredentialPatch('mercadolivre', patch)
  }
}

async function callCreateLinkApi(mlUrl, tag, { cookieHeader, csrf }) {
  const res = await axios.post(
    'https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink',
    { urls: [mlUrl], tag },
    {
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.mercadolivre.com.br/afiliados/linkbuilder',
        'Origin': 'https://www.mercadolivre.com.br',
      },
      timeout: 10000,
      validateStatus: () => true,
    }
  )
  return res
}

// URL neutra (home do ML) usada só para checar a validade da sessão de afiliado.
// O endpoint createLink responde 401 (Unauthorized -> login) quando o ssid
// expirou e 200 quando a sessão está viva; com uma URL não-produto ele NÃO cria
// nenhum link de afiliado (created=undefined), então o probe é sem efeito
// colateral.
const SESSION_PROBE_URL = 'https://www.mercadolivre.com.br/'
const ML_AFFILIATE_ERROR_WARNING = {
  expired: 'ml_ssid_expired',
  forbidden: 'ml_affiliate_forbidden',
  rate_limited: 'ml_affiliate_rate_limited',
  busy: 'ml_affiliate_busy',
  unsupported_url: 'ml_url_not_supported',
}

// error_code 111 ("URL not allowed in affiliates program") é a resposta padrão
// do ML quando a URL não é um produto/cupom válido para o programa de afiliados
// (ex.: página de vitrine/perfil /social/<handle> sem produto). Vem com HTTP 200
// (não é 401/403/429), então precisa de detecção por texto — e NÃO é falha de
// credencial: renovar SSID não resolve, a URL em si não é aceita pelo ML.
function classifyMlAffiliateFailure(status, apiError = '') {
  if (status === 401 || /auth|unauthoriz|login|sess[aã]o|expirad/i.test(apiError)) {
    return { type: 'expired', warning: ML_AFFILIATE_ERROR_WARNING.expired, retryable: false }
  }
  if (status === 403 || /forbidden/i.test(apiError)) {
    return { type: 'forbidden', warning: ML_AFFILIATE_ERROR_WARNING.forbidden, retryable: false }
  }
  if (status === 429) {
    return { type: 'rate_limited', warning: ML_AFFILIATE_ERROR_WARNING.rate_limited, retryable: false }
  }
  if (/not allowed in affiliates program|url not allowed/i.test(apiError)) {
    return { type: 'unsupported_url', warning: ML_AFFILIATE_ERROR_WARNING.unsupported_url, retryable: false }
  }
  return null
}

function buildMlAffiliateError(classification) {
  const err = new Error(classification.type === 'expired'
    ? 'Credencial Mercado Livre inválida/expirada. Renove o SSID (ou cookie) e tente novamente.'
    : classification.type === 'forbidden'
      ? 'Mercado Livre recusou a geração do link afiliado (403). Usando fallback partner_id.'
      : classification.type === 'unsupported_url'
        ? 'Mercado Livre não aceita esse link no programa de afiliados (página sem produto, ex.: vitrine/perfil de terceiro). Não é problema de credencial — cadastre o link da SUA vitrine em Painel → IDs de afiliada → Mercado Livre para que esses casos usem sua vitrine automaticamente.'
        : 'Mercado Livre limitou temporariamente a geração de links afiliados (429). Usando fallback partner_id.')
  err.mlWarning = classification.warning
  err.mlFailureType = classification.type
  return err
}

// Checa se a sessão de afiliado do Mercado Livre (cookie ssid) ainda está
// válida, com UM request autenticado. Usado pelo painel para avisar a usuária
// quando o SSID expira (a raspagem/conversão do ML quebra silenciosamente sem
// renovar o cookie). Retorno: { configured, alive, reason }:
//   - configured=false -> sem ssid/cookie cadastrado (nada a checar)
//   - alive=true        -> sessão válida
//   - alive=false       -> expirada (401) -> painel pede renovação do SSID
//   - alive=null        -> indeterminado (erro de rede/status atípico): não alarmar
export async function checkMercadoLivreSession(creds = {}) {
  const { ssid, csrf, cookie, id, tag } = creds || {}
  const cookieHeader = buildCookieHeader({ ssid, csrf, cookie, id })
  if (!cookieHeader) return { configured: false, alive: null, reason: 'no_cookie' }
  try {
    const res = await withMercadoLivreCredentialLock(creds, () => callCreateLinkApi(SESSION_PROBE_URL, tag || '', { cookieHeader, csrf }))
    const credentialPatch = buildCredentialPatchFromSetCookie(creds, cookieHeader, res.headers)
    // 401 é sinal de auth: cookie expirado/inválido -> redireciona ao login.
    // 403/429 não provam expiração do SSID; são bloqueio/rate-limit e ficam
    // indeterminados para não alarmar a usuária com falso "SSID expirou".
    if (res.status === 401) return { configured: true, alive: false, reason: 'expired', ...(credentialPatch ? { credentialPatch } : {}) }
    if (res.status === 403) return { configured: true, alive: null, reason: 'forbidden', ...(credentialPatch ? { credentialPatch } : {}) }
    if (res.status === 429) return { configured: true, alive: null, reason: 'rate_limited', ...(credentialPatch ? { credentialPatch } : {}) }
    return { configured: true, alive: true, reason: 'ok', ...(credentialPatch ? { credentialPatch } : {}) }
  } catch (err) {
    if (err?.code === 'ML_AFFILIATE_LOCK_TIMEOUT') return { configured: true, alive: null, reason: 'busy' }
    return { configured: true, alive: null, reason: 'network_error' }
  }
}

async function createAffiliateLink(mlUrl, tag, creds) {
  const { ssid, csrf, cookie, id } = creds

  if (!ssid && !cookie) {
    logger.warn({ ssid, cookie, id }, 'ML createLink: ssid vazio, pulando chamada API')
    return null
  }

  // Tenta primeiro sem csrf — alguns fluxos do ML aceitam só com ssid
  const attempts = []
  attempts.push({ cookieHeader: buildCookieHeader({ ssid, cookie, id }), csrf: null, label: 'no-csrf' })
  if (csrf) {
    attempts.push({ cookieHeader: buildCookieHeader({ ssid, csrf, cookie, id }), csrf, label: 'with-csrf' })
  }

  let lastError = null
  let terminalFailure = null
  let terminalCredentialPatch = null
  const RETRYABLE_STATUS = new Set([408, 409, 425, 500, 502, 503, 504])
  const retryBackoffMs = [400, 1200, 2800]
  for (const attempt of attempts) {
    for (let i = 0; i <= retryBackoffMs.length; i++) {
      try {
        logger.info({ attempt: attempt.label, retry: i, mlUrl, hasSsid: !!ssid, hasCsrf: !!csrf }, 'ML createLink: tentando chamada API')
        const res = await callCreateLinkApi(mlUrl, tag, attempt)
        const credentialPatch = buildCredentialPatchFromSetCookie(creds, attempt.cookieHeader, res.headers)
        const result = res.data?.urls?.[0]
        if (result?.short_url) {
          logger.info({ attempt: attempt.label, retry: i, mlUrl, rotatedCookie: !!credentialPatch }, 'ML createLink: short_url gerado')
          return { shortUrl: result.short_url, credentialPatch }
        }

        const status = Number(res.status) || 0
        const apiError = String(result?.error || result?.message || res.data?.error || res.data?.message || '')
        const affiliateFailure = classifyMlAffiliateFailure(status, apiError)
        if (affiliateFailure) {
          terminalFailure = affiliateFailure
          terminalCredentialPatch = credentialPatch
        }

        lastError = {
          status,
          attempt: attempt.label,
          retry: i,
          apiError,
          urls: res.data?.urls,
          rawBody: typeof res.data === 'string' ? res.data.slice(0, 500) : JSON.stringify(res.data).slice(0, 500),
          responseHeaders: { 'content-type': res.headers?.['content-type'], 'set-cookie': res.headers?.['set-cookie']?.length },
        }

        if (affiliateFailure) {
          logger.warn({ ...lastError, failureType: affiliateFailure.type }, 'ML createLink: falha terminal sem retry')
          break
        }

        if (RETRYABLE_STATUS.has(status) && i < retryBackoffMs.length) {
          const wait = retryBackoffMs[i]
          logger.warn({ ...lastError, retryInMs: wait }, 'ML createLink: status transitório sem short_url — retry')
          await new Promise(resolve => setTimeout(resolve, wait))
          continue
        }

        logger.warn(lastError, 'ML createLink: API respondeu sem short_url')
        break
      } catch (err) {
        const status = Number(err.response?.status) || 0
        const apiError = String(err.response?.data?.error || err.response?.data?.message || err.message || '')
        const affiliateFailure = classifyMlAffiliateFailure(status, apiError)
        if (affiliateFailure) {
          terminalFailure = affiliateFailure
          terminalCredentialPatch = buildCredentialPatchFromSetCookie(creds, attempt.cookieHeader, err.response?.headers)
        }
        lastError = { attempt: attempt.label, retry: i, err: err.message, status, apiError }

        if (affiliateFailure) {
          logger.warn({ ...lastError, failureType: affiliateFailure.type }, 'ML createLink: falha terminal sem retry')
          break
        }

        if (RETRYABLE_STATUS.has(status) && i < retryBackoffMs.length) {
          const wait = retryBackoffMs[i]
          logger.warn({ ...lastError, retryInMs: wait }, 'ML createLink: erro transitório — retry')
          await new Promise(resolve => setTimeout(resolve, wait))
          continue
        }

        logger.warn(lastError, 'ML createLink: erro ao chamar API')
        break
      }
    }
    if (terminalFailure) break
  }

  if (terminalFailure) {
    const err = buildMlAffiliateError(terminalFailure)
    err.credentialPatch = terminalCredentialPatch
    throw err
  }

  return null
}


// Retorna 'match' | 'mismatch' | 'inconclusive'.
//
// Crítico: 'inconclusive' NÃO é motivo para descartar o short link. Do VPS
// (IP de datacenter) o `resolve()` quase sempre bate no muro anti-bot do ML
// (`/gz/account-verification`), de onde não dá pra extrair MLB nenhum. Erro de
// rede idem. Tratar esses casos como falha jogava fora short links válidos e
// caía no fallback partner_id (sintoma: links /p/MLB... saindo "com id" em vez
// do meli.la). Só descartamos com mismatch comprovado — resolveu para um MLB
// real e diferente do esperado.
async function validateAffiliateRedirect(affiliateUrl, expectedMlbId) {
  if (!affiliateUrl || !expectedMlbId) return 'inconclusive'
  try {
    const resolved = await resolve(affiliateUrl)
    const hitVerificationWall = /\/gz\/account-verification/i.test(String(resolved))

    let finalId = extractMlbId(resolved)
    let path = 'direct'
    if (!finalId) {
      try {
        const canon = canonicalizeMlProductUrl(resolved)
        finalId = extractMlbId(canon)
        if (finalId) path = 'canonicalize'
      } catch { /* ignore */ }
    }
    // Atrás do muro de verificação a landing é a própria tela anti-bot (sem
    // produto), então nem tentamos raspar — só desperdiça uma chamada.
    if (!finalId && !hitVerificationWall) {
      // Para essa conta o short link de afiliado resolve, do IP de datacenter do
      // VPS, para a página de vitrine/share da PRÓPRIA afiliada
      // (`/social/<tag>?ref=<blob>`), não direto para o produto. Nesse caso
      // usamos o MESMO extrator confiável da entrada (card-featured) ANTES da
      // heurística frágil — assim há mais chance de CONFIRMAR match no produto
      // certo, em vez de pegar um produto de recomendação da vitrine (RCA
      // 2026-07-13). Só cai em tryExtractProductFromLanding se não for /social/.
      let isSocialShare = false
      try { isSocialShare = /^\/social\//i.test(new URL(resolved).pathname) } catch { /* ignore */ }
      if (isSocialShare) {
        const featured = await tryExtractFeaturedProductFromSocialShare(resolved)
        if (featured) {
          finalId = extractMlbId(featured)
          if (finalId) path = 'featured'
        }
      }
      if (!finalId) {
        const fromLanding = await tryExtractProductFromLanding(resolved)
        if (fromLanding) {
          finalId = extractMlbId(fromLanding)
          if (finalId) path = 'landing'
        }
      }
    }

    if (!finalId) {
      logger.warn(
        { affiliateUrl, resolved, expectedMlbId, hitVerificationWall },
        'ML validate: inconclusivo (muro anti-bot ou sem MLB extraível) — mantendo short link'
      )
      return 'inconclusive'
    }
    const ok = finalId === expectedMlbId
    // Só descartamos com mismatch COMPROVADO — ou seja, quando o MLB veio da
    // própria URL de redirect (`direct`/`canonicalize`). Um MLB derivado de uma
    // página de vitrine/share `/social/<tag>?ref=` (paths `featured`/`landing`)
    // NÃO prova mismatch: a vitrine mistura o produto-alvo com recomendações, e
    // um chute errado ali descartava um short link de afiliado VÁLIDO,
    // rebaixando a oferta para o `partner_id` cru (RCA 2026-07-13). Nesse caso
    // um non-match vira `inconclusive` e mantemos o short link (que é NOSSO, com
    // a tag da cliente — invariante de "nunca encaminhar link de terceiro"
    // preservada). Só o `match` da vitrine confirma; o non-match não veta.
    if (!ok && (path === 'featured' || path === 'landing')) {
      logger.warn(
        { affiliateUrl, resolved, finalId, expectedMlbId, path },
        'ML validate: divergência derivada de vitrine/landing é inconclusiva — mantendo short link'
      )
      return 'inconclusive'
    }
    logger[ok ? 'info' : 'warn'](
      { affiliateUrl, resolved, finalId, expectedMlbId, path, ok },
      ok ? 'ML validate: short_url confere' : 'ML validate: short_url resolveu para MLB diferente do esperado'
    )
    return ok ? 'match' : 'mismatch'
  } catch (err) {
    logger.warn({ affiliateUrl, expectedMlbId, err: err.message }, 'ML validate: erro ao resolver short_url — inconclusivo, mantendo')
    return 'inconclusive'
  }
}

const ML_HOST = /mercadolivre|mercadolibre|meli\.la|mluvem\.com/

// `mercadolivre.com/sec/<código>` é o formato NOVO de short link de afiliado do
// ML (o mesmo que a API createLink devolve). O código pertence a quem o gerou —
// pendurar `?partner_id=` nele NÃO transfere a comissão (o ML credita o dono do
// short link). Por isso tratamos como meli.la/mluvem.com: resolver até a URL real
// antes de reconverter com a tag da usuária.
function isMlAffiliateShortLink(rawUrl) {
  try {
    const u = new URL(rawUrl)
    return ML_HOST.test(u.hostname) && /^\/sec\//i.test(u.pathname)
  } catch {
    return false
  }
}

export async function resolveToCleanProductUrl(url) {
  try {
    if (!ML_HOST.test(new URL(url).hostname)) return null

    let target = url
    if (/meli\.la|mluvem\.com/.test(url) || isMlAffiliateShortLink(url)) {
      target = await resolve(url)
    }

    // Para landings /social/..., o ?ref= identifica QUAL produto a share
    // representa (sem ele, ML serve o perfil genérico do vendedor com um
    // produto destacado aleatório). canonicalizeMlProductUrl remove ref
    // como tracking comum, então preservamos a URL pré-canonicalize aqui
    // para usar na extração da landing.
    const preCanonical = target
    target = canonicalizeMlProductUrl(target)
    if (!extractMlbId(target)) {
      // Links de recomendação/anúncio (/up/MLBU..., vip-pads, etc.) trazem o
      // path como id de catálogo (MLBU...) e o produto real compartilhado em
      // `wid=MLB...` dentro do fragmento (#...), que canonicalize descarta.
      // Recuperamos o MLB direto do fragmento, sem round-trip de rede.
      const widMlb = extractMlbId(String(preCanonical).match(/[?#&;]wid=(MLB[-_]?[0-9]+)/i)?.[1])
      if (widMlb) {
        target = `https://produto.mercadolivre.com.br/${widMlb}-x-_JM`
      } else {
        const u = new URL(target)
        // Divulgação de PRODUTO via /social/<handle>?ref=<blob> (RCA 2026-07-10):
        // o ML resolve o ref server-side e renderiza o produto-alvo como card
        // destacado no HTML. Buscamos o HTML da URL COM ref (preCanonical —
        // canonicalize remove o ref) e extraímos SÓ o card destacado (não as
        // recomendações). Se houver produto destacado, esse é o alvo real.
        //
        // NÃO regride o bug do "produto aleatório/foto errada": a extração é
        // gated no marcador `card-featured`. Vitrine/lista genérica (perfil sem
        // produto, /lists, cupom — og:title "Minhas listas de recomendações")
        // NÃO tem card destacado → extração devolve null → tratada como cupom no
        // convert() (createLink nosso / vitrine cadastrada) ou descartada. Nunca
        // usa recommended_items[0] (a heurística frágil removida em edbc86b).
        if (
          /^\/social\//i.test(u.pathname) &&
          !/\/lists(?:\/|$)/i.test(u.pathname) &&
          /[?&]ref=/i.test(String(preCanonical))
        ) {
          const featured = await tryExtractFeaturedProductFromSocialShare(preCanonical)
          if (featured) return featured
        }
        // Sem card destacado extraível, landing de TERCEIRO (código /sec/ não
        // resolvido, ou vitrine/perfil /social/): retornar null (convert() cai
        // no cupom/vitrine cadastrada — nunca produto aleatório/quebrado).
        if (/^\/sec\//i.test(u.pathname) || /^\/social\//i.test(u.pathname)) {
          return null
        }
        // Demais landings de 1ª parte sem produto (home `/`, /cupom/, /m/,
        // /ofertas, /up/ sem wid...): `target` segue sendo a URL resolvida SEM MLB
        // → o convert() pendura partner_id e marca linkKind:'coupon' (banner).
      }
    }
    return target
  } catch {
    return null
  }
}

// Vitrine da PRÓPRIA afiliada, cadastrada em Painel → IDs de afiliada →
// Mercado Livre (campo `vitrineUrl`, junto das demais credenciais ML — mesmo
// Credential.data, sem tabela/migration nova). Usada como fallback quando o ML
// recusa createLink para uma vitrine/perfil de TERCEIRO (error_code 111: "URL
// not allowed in affiliates program") — recusa que é regra do programa de
// afiliados do ML, não depende de credencial válida nem de qual ambiente
// (staging/prod) está rodando. RCA 2026-07-08.
export function isValidMlVitrineUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return false
  try {
    return ML_HOST.test(new URL(raw.trim()).hostname)
  } catch {
    return false
  }
}

export function buildVitrineFallback(creds = {}) {
  const vitrineUrl = typeof creds.vitrineUrl === 'string' ? creds.vitrineUrl.trim() : ''
  if (!isValidMlVitrineUrl(vitrineUrl)) return null
  return { url: vitrineUrl, linkKind: 'coupon', warning: 'ml_vitrine_fallback_used' }
}

// True só quando o link ORIGINAL compartilhado (antes de qualquer resolução
// de rede) já era diretamente uma página /social/ do ML — ou seja, temos
// CERTEZA de que é vitrine/perfil, porque foi isso que veio na mensagem.
//
// Quando o link original é um encurtador (meli.la/mluvem/sec) que só POR
// FALHA DE RESOLUÇÃO (bloqueio anti-bot da rede do VPS — não recusa real do
// ML) aterrissa numa página ambígua, NÃO temos certeza de que é vitrine: por
// trás do encurtador pode haver um produto de verdade (inclusive de loja
// oficial, que o ML também recusa com o MESMO error_code 111, por motivo
// totalmente diferente — exclusão do programa de afiliados, não vitrine).
// Regressão real (RCA 2026-07-08): um link de produto genuíno (kit de cuecas,
// vendido por loja oficial) foi diagnosticado como "vitrine de terceiro,
// cadastre a sua" — mensagem enganosa para esse caso.
export function isDirectVitrineShare(originalUrl) {
  try {
    const u = new URL(originalUrl)
    return ML_HOST.test(u.hostname) && /^\/social\//i.test(u.pathname)
  } catch {
    return false
  }
}

// Cupom do ML sem produto (vitrine /social/ de terceiro, home, /cupom/,
// /ofertas...). resolveToCleanProductUrl devolve null porque não há produto pra
// mostrar no card. Com a conversão de cupom ligada, em vez de descartar a
// mensagem inteira (skip:no_valid_conversions), tentamos gerar NOSSO short link
// de afiliado (createLink) para a landing de cupom resolvida — mantendo a
// mensagem com banner de cupom.
//
// EM AVALIAÇÃO (AGENTS.md, linha do cupom ML): o ML pode NÃO creditar link de
// página não-produto (a comissão pode ir pro dono do código/handle). Por isso
// isto fica atrás do flag COUPON_LINK_CONVERT (rollout seguro) e PRECISA ser
// validado clicando no link num celular ANTES de ligar em prod.
//
// Invariante de segurança preservada: o link de terceiro NUNCA é encaminhado —
// ou sai NOSSO short link, ou retorna null (descarta). Nada de passthrough do
// código alheio.
async function convertMlCouponWithoutProduct(url, creds) {
  const { tag, ssid } = creds
  if (!shouldConvertCouponLinks() || !tag || !ssid) return null

  const resolved = await resolve(url).catch(() => url)
  let landing
  try {
    landing = new URL(canonicalizeMlProductUrl(resolved))
  } catch {
    return null
  }
  // Só landing de 1ª parte do ML. Código /sec/ de terceiro NÃO resolvido (muro
  // anti-bot) não dá pra converter com segurança — createLink no código alheio
  // creditaria o dono. Melhor descartar.
  if (!ML_HOST.test(landing.hostname)) return null
  if (/^\/sec\//i.test(landing.pathname)) return null

  try {
    const affiliateResult = await withMercadoLivreCredentialLock(
      creds,
      () => createAffiliateLink(landing.toString(), tag, creds),
    )
    const affiliateUrl = typeof affiliateResult === 'string'
      ? affiliateResult
      : affiliateResult?.shortUrl
    if (affiliateUrl) {
      await notifyCredentialPatch(creds, affiliateResult?.credentialPatch)
      logger.info({ url, landing: landing.toString(), affiliateUrl }, 'ML cupom: short link de afiliado gerado (sem produto)')
      return { url: affiliateUrl, linkKind: 'coupon' }
    }
  } catch (err) {
    await notifyCredentialPatch(creds, err.credentialPatch)
    logger.warn({ url, resolved, err: err.message }, 'ML cupom: createLink falhou — descartando (não encaminha link de terceiro)')

    // Decisão centralizada (feature 007-ml-vitrine-fallback-expired):
    // isDirectVitrine só é true quando o link ORIGINAL compartilhado já era
    // diretamente uma página /social/ (certeza de vitrine/perfil de
    // terceiro) — não quando chegamos aqui via encurtador ambíguo que falhou
    // a resolver (RCA regressão 2026-07-08, preservado por
    // isDirectVitrineShare). hasVitrine reflete se a própria afiliada tem
    // vitrine cadastrada (Credential.data.vitrineUrl).
    const isDirectVitrine = isDirectVitrineShare(url)
    const hasVitrine = !!buildVitrineFallback(creds)
    const outcome = decideVitrineFallback({
      failureType: err.mlFailureType,
      isDirectVitrine,
      hasVitrine,
    })

    if (outcome === 'use_vitrine') {
      // ML recusou createLink para essa página. Isso acontece tanto por
      // `unsupported_url` (regra do programa de afiliados — comportamento
      // 004 preservado) quanto por `expired` quando o link JÁ é vitrine
      // direta de terceiro (FR-001: renovar o SSID nunca resolveria isso,
      // então usamos a vitrine própria da mesma forma). Se a usuária tem uma
      // vitrine PRÓPRIA cadastrada, usamos ela sempre que isso acontece —
      // melhora a monetização sem risco.
      const fallback = buildVitrineFallback(creds)
      logger.info({ url, vitrineUrl: fallback.url, mlFailureType: err.mlFailureType }, 'ML cupom: ML recusou o link de terceiro — usando vitrine cadastrada da própria afiliada')
      return fallback
    }

    if (outcome === 'missing_vitrine') {
      // Certeza de vitrine/perfil de terceiro (link original /social/), sem
      // vitrine própria cadastrada: motivo específico e acionável (FR-003),
      // sem mencionar SSID (FR-005) — renovar SSID nunca resolveria isso.
      logger.warn({ url, mlFailureType: err.mlFailureType }, 'ML cupom: vitrine de terceiro confirmada sem vitrine própria cadastrada — ignorando com motivo específico')
      err.conversionLogErrorMsg = 'skip:ml_vitrine_missing'
      err.conversionLogStatus = 'skipped'
      throw err
    }

    if (outcome === 'discard') {
      // Recusa ambígua (não veio de link de vitrine direto): não sabemos se
      // por trás havia um produto de verdade (ex.: loja oficial, mesmo
      // error_code 111 por exclusão do programa de afiliados — não por ser
      // vitrine). Comportamento seguro histórico: descarta sem mensagem
      // enganosa (RCA regressão 2026-07-08).
      logger.warn({ url }, 'ML cupom: recusa ambígua (não veio de link de vitrine direto) — descartando sem culpar vitrine/credencial')
      return null
    }

    // outcome === 'passthrough': falhas classificadas (SSID expirado em
    // link não-vitrine, 403, 429, etc.) sobem para o convert() e depois para
    // o bot-worker.js, que grava o motivo REAL no painel em vez do genérico
    // "não retornou link convertido — confira as credenciais" (enganoso
    // quando o problema não é a credencial).
    if (err.mlFailureType) throw err
  }
  return null
}

export async function convert(url, creds) {
  const { tag, ssid, resolveOnly } = creds
  try {
    // Checar domínio ML antes de qualquer coisa
    if (!ML_HOST.test(new URL(url).hostname)) return null

    const cleanTarget = await resolveToCleanProductUrl(url)
    if (!cleanTarget) {
      // Sem produto: cupom/vitrine de terceiro. resolveOnly quer a URL do produto
      // (não faz sentido converter cupom aqui). Caso normal: tenta converter o
      // cupom para NOSSO link de afiliado em vez de descartar a mensagem.
      // GUARDA ANTI-REGRESSÃO (US2/FR-005, T019): o ramo de vitrine
      // (buildVitrineFallback, dentro de convertMlCouponWithoutProduct) só é
      // alcançável a partir DESTE `if (!cleanTarget)` — ou seja, exclusivamente
      // quando não há produto conversível. Link de produto legítimo (cleanTarget
      // truthy) NUNCA entra neste bloco, então a vitrine cadastrada jamais
      // substitui um link de produto. Não mover esta chamada para fora deste
      // `if`, nem tratar `cleanTarget` como opcional aqui.
      if (resolveOnly) return null
      return await convertMlCouponWithoutProduct(url, creds)
    }
    if (resolveOnly) return cleanTarget
    const target = cleanTarget
    const candidates = buildCanonicalCandidates(target)

    // Âncora: MLB esperado é o do target resolvido (não do candidate enviado à API).
    // Sem essa âncora, se um candidate vier com MLB errado a validação compararia
    // errado-com-errado e passaria.
    const anchorMlbId = extractMlbId(target)
    logger.info({ inputUrl: url, target, anchorMlbId, hasSsid: !!ssid }, 'ML convert: target resolvido')

    // Sinaliza falhas terminais da API de afiliados do ML: a oferta ainda sai
    // via fallback partner_id, mas o painel mostra o motivo correto (expiração,
    // bloqueio 403 ou rate-limit 429) em vez de culpar sempre o SSID.
    let affiliateWarning = null

    // Sem MLB no target, não há como validar — chamar a API neste caso é
    // tiro no escuro (o ML pode devolver short para produto qualquer).
    // Pular API e cair direto no fallback partner_id.
    if (ssid && !anchorMlbId) {
      logger.warn({ inputUrl: url, target }, 'ML convert: anchorMlbId nulo — pulando API de afiliados (fallback partner_id)')
    } else if (ssid) {
      const cooldown = getAffiliateCooldown(creds)
      if (cooldown) {
        affiliateWarning = cooldown.warning
        logger.warn({ failureType: cooldown.failureType, until: new Date(cooldown.until).toISOString() }, 'ML createLink: cooldown ativo — usando fallback partner_id')
      }

      const tries = cooldown ? [] : selectCreateLinkCandidates(target, candidates, anchorMlbId)
      for (const candidate of tries) {
        try {
          const affiliateResult = await withMercadoLivreCredentialLock(creds, () => createAffiliateLink(candidate, tag, creds))
          const affiliateUrl = typeof affiliateResult === 'string' ? affiliateResult : affiliateResult?.shortUrl
          if (!affiliateUrl) continue
          await notifyCredentialPatch(creds, affiliateResult?.credentialPatch)
          if (anchorMlbId) {
            const verdict = await validateAffiliateRedirect(affiliateUrl, anchorMlbId)
            // Só descartamos com mismatch comprovado. 'inconclusive' (muro
            // anti-bot do VPS / erro de rede) mantém o short link — descartar
            // jogava fora links válidos e caía no fallback partner_id.
            if (verdict === 'mismatch') {
              logger.warn({ affiliateUrl, anchorMlbId, candidate }, 'ML createLink: short_url resolveu para produto diferente — descartando')
              continue
            }
          }
          // Só chega aqui com anchorMlbId truthy (o ramo `ssid && !anchorMlbId`
          // acima cobre o caso sem MLB) — link de produto de verdade.
          return { url: affiliateUrl, linkKind: 'product' }
        } catch (err) {
          logger.warn({ candidate, err: err.message }, 'ML createLink: tentativa falhou')
          // Falhas terminais repetiriam em todos os candidates: marca e para
          // de tentar (poupa chamadas) — cai no fallback com aviso específico.
          if (err.code === 'ML_AFFILIATE_LOCK_TIMEOUT') {
            affiliateWarning = ML_AFFILIATE_ERROR_WARNING.busy
            break
          }
          if (err.mlWarning || /credencial|inv[aá]lida|expirad|recusou|limitou/i.test(err.message)) {
            await notifyCredentialPatch(creds, err.credentialPatch)
            affiliateWarning = err.mlWarning || 'ml_ssid_expired'
            if (err.mlFailureType === 'forbidden' || err.mlFailureType === 'rate_limited') {
              setAffiliateCooldown(creds, err.mlFailureType)
            }
            break
          }
        }
      }

      logger.warn({ url, target }, 'ML createLink: todas as tentativas falharam — usando fallback partner_id')
      // Cai no fallback partner_id abaixo (preserva ao menos o MLB correto)
    }

    // NÃO reescrever /p/MLB (id de CATÁLOGO) para produto.../MLB-x-_JM: esse
    // formato `-x-_JM` é de id de LISTING, e reusar o id de catálogo nele gera
    // uma URL inexistente (404 "Parece que esta página não existe" — bug real no
    // card). A própria página /p/MLB é válida; só penduramos partner_id nela. O
    // formato -x-_JM só é correto para o wid= (listing id), já tratado no resolve.
    // Plano B publica o `target` cru com `partner_id`. Se o `target` é um
    // endereço que NÓS montamos (ver isSyntheticListingUrl), ele não existe no
    // Mercado Livre e o grupo receberia "Tivemos um problema" / "Parece que esta
    // página não existe". Nesse caso é melhor não enviar a oferta do que enviar
    // link quebrado: a linha vira falha de conversão (honesta no painel) em vez
    // de `success` mentiroso. Não regredir — era exatamente isso que fazia o
    // cliente reclamar de "links do mercado livre dando erro".
    if (isSyntheticListingUrl(target)) {
      logger.warn(
        { url, target, affiliateWarning },
        'ML fallback: endereço montado por nós não existe no ML — descartando a oferta em vez de publicar link quebrado',
      )
      return null
    }

    const fallbackId = extractMlbId(target)
    const u = new URL(canonicalizeMlProductUrl(target))

    // Fallback: injetar partner_id na URL resolvida (ou na meli.la original se resolve falhou)
    u.searchParams.delete('partner_id')
    if (tag) u.searchParams.set('partner_id', tag)
    // fallbackId (mesmo extractMlbId de anchorMlbId, recalculado sobre target)
    // decide produto vs. cupom: link sem MLB nenhum (ex.: página de cupons)
    // não tem produto pra mostrar no card do preview.
    const fallbackLinkKind = fallbackId ? 'product' : 'coupon'
    if (affiliateWarning) return { url: u.toString(), linkKind: fallbackLinkKind, warning: affiliateWarning }
    return { url: u.toString(), linkKind: fallbackLinkKind }
  } catch (err) {
    // Erros classificados (ver classifyMlAffiliateFailure) sobem para o
    // bot-worker.js para virar diagnóstico específico no painel. Qualquer
    // outro erro inesperado (rede, parsing, etc.) continua engolido — mantém
    // o comportamento histórico resiliente para o caminho de produto normal.
    if (err?.mlFailureType) throw err
    return null
  }
}
