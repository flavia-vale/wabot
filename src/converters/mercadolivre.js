import axios from 'axios'
import logger from '../logger.js'

// Cache LRU simples para evitar reexpansão de short links repetidos
// (campanhas de cupons disparam o mesmo meli.la várias vezes seguidas).
// Só cacheia resoluções de host de encurtador para URL ML canônica/produto;
// não cacheia chamadas autenticadas da API de afiliados.
const RESOLVE_CACHE_MAX = Math.max(50, Number(process.env.ML_RESOLVE_CACHE_MAX) || 500)
const RESOLVE_CACHE_TTL_MS = Math.max(60_000, Number(process.env.ML_RESOLVE_CACHE_TTL_MS) || 6 * 60 * 60_000)
const ML_RESOLVE_FETCH_TIMEOUT_MS = Math.max(1_000, Number(process.env.ML_RESOLVE_FETCH_TIMEOUT_MS) || 4_000)
const resolveCache = new Map()

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
}

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
  return null
}

function buildMlAffiliateError(classification) {
  const err = new Error(classification.type === 'expired'
    ? 'Credencial Mercado Livre inválida/expirada. Renove o SSID (ou cookie) e tente novamente.'
    : classification.type === 'forbidden'
      ? 'Mercado Livre recusou a geração do link afiliado (403). Usando fallback partner_id.'
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
    const res = await callCreateLinkApi(SESSION_PROBE_URL, tag || '', { cookieHeader, csrf })
    // 401 é sinal de auth: cookie expirado/inválido -> redireciona ao login.
    // 403/429 não provam expiração do SSID; são bloqueio/rate-limit e ficam
    // indeterminados para não alarmar a usuária com falso "SSID expirou".
    if (res.status === 401) return { configured: true, alive: false, reason: 'expired' }
    if (res.status === 403) return { configured: true, alive: null, reason: 'forbidden' }
    if (res.status === 429) return { configured: true, alive: null, reason: 'rate_limited' }
    return { configured: true, alive: true, reason: 'ok' }
  } catch {
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
  const RETRYABLE_STATUS = new Set([408, 409, 425, 500, 502, 503, 504])
  const retryBackoffMs = [400, 1200, 2800]
  for (const attempt of attempts) {
    for (let i = 0; i <= retryBackoffMs.length; i++) {
      try {
        logger.info({ attempt: attempt.label, retry: i, mlUrl, hasSsid: !!ssid, hasCsrf: !!csrf }, 'ML createLink: tentando chamada API')
        const res = await callCreateLinkApi(mlUrl, tag, attempt)
        const result = res.data?.urls?.[0]
        if (result?.short_url) {
          logger.info({ attempt: attempt.label, retry: i, mlUrl }, 'ML createLink: short_url gerado')
          return result.short_url
        }

        const status = Number(res.status) || 0
        const apiError = String(result?.error || result?.message || res.data?.error || res.data?.message || '')
        const affiliateFailure = classifyMlAffiliateFailure(status, apiError)
        if (affiliateFailure) terminalFailure = affiliateFailure

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
        if (affiliateFailure) terminalFailure = affiliateFailure
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
    throw buildMlAffiliateError(terminalFailure)
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
      const fromLanding = await tryExtractProductFromLanding(resolved)
      if (fromLanding) {
        finalId = extractMlbId(fromLanding)
        if (finalId) path = 'landing'
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
        // `/sec/` ainda presente aqui = não conseguimos resolver o short link de
        // afiliado de terceiro (resolve falhou / muro anti-bot). Encaminhá-lo com
        // um partner_id cosmético vazaria comissão pro dono do código, então o
        // tratamos como as landings /social/ e /up/: tenta extrair produto; sem
        // produto, retorna null (não encaminha).
        if (
          /^\/social\//i.test(u.pathname) ||
          /(?:^|\/)up\//i.test(u.pathname) ||
          /^\/sec\//i.test(u.pathname) ||
          /^\/$/.test(u.pathname)
        ) {
          const extracted = await tryExtractProductFromLanding(preCanonical)
          // Se não conseguimos extrair um produto real de uma landing /social/,
          // /up/ ou /sec/, retornar null é melhor que encaminhar o link de terceiro.
          if (extracted) target = extracted
          else return null
        }
      }
    }
    return target
  } catch {
    return null
  }
}

export async function convert(url, creds) {
  const { tag, ssid, resolveOnly } = creds
  try {
    // Checar domínio ML antes de qualquer coisa
    if (!ML_HOST.test(new URL(url).hostname)) return null

    const cleanTarget = await resolveToCleanProductUrl(url)
    if (!cleanTarget) return null
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
      const tries = [...candidates]
      try {
        const clean = new URL(candidates[0] ?? target)
        clean.search = ''
        tries.push(clean.toString())
      } catch {}
      try {
        const clean = new URL(target)
        clean.search = ''
        tries.push(clean.toString())
      } catch {}

      const seen = new Set()
      for (const candidate of tries) {
        if (seen.has(candidate)) continue
        seen.add(candidate)
        // Não enviar para a API um candidate que já diverge do MLB esperado
        if (anchorMlbId) {
          const candidateMlbId = extractMlbId(candidate)
          if (candidateMlbId && candidateMlbId !== anchorMlbId) {
            logger.warn({ candidate, anchorMlbId, candidateMlbId }, 'ML createLink: candidate diverge do MLB esperado — pulando')
            continue
          }
        }
        try {
          const affiliateUrl = await createAffiliateLink(candidate, tag, creds)
          if (!affiliateUrl) continue
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
          return affiliateUrl
        } catch (err) {
          logger.warn({ candidate, err: err.message }, 'ML createLink: tentativa falhou')
          // Falhas terminais repetiriam em todos os candidates: marca e para
          // de tentar (poupa chamadas) — cai no fallback com aviso específico.
          if (err.mlWarning || /credencial|inv[aá]lida|expirad|recusou|limitou/i.test(err.message)) {
            affiliateWarning = err.mlWarning || 'ml_ssid_expired'
            break
          }
        }
      }

      logger.warn({ url, target }, 'ML createLink: todas as tentativas falharam — usando fallback partner_id')
      // Cai no fallback partner_id abaixo (preserva ao menos o MLB correto)
    }

    let fallbackTarget = target
    const fallbackId = extractMlbId(target)
    if (fallbackId) {
      const parsed = new URL(target)
      if (/^\/p\/MLB/i.test(parsed.pathname)) {
        fallbackTarget = `https://produto.mercadolivre.com.br/${fallbackId}-x-_JM`
      }
    }
    const u = new URL(canonicalizeMlProductUrl(fallbackTarget))

    // Fallback: injetar partner_id na URL resolvida (ou na meli.la original se resolve falhou)
    u.searchParams.delete('partner_id')
    if (tag) u.searchParams.set('partner_id', tag)
    if (affiliateWarning) return { url: u.toString(), warning: affiliateWarning }
    return u.toString()
  } catch {
    return null
  }
}
