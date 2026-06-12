import axios from 'axios'
import crypto from 'crypto'

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql'

function buildAuth(appId, secretKey, payload) {
  const timestamp = Math.floor(Date.now() / 1000)
  const sig = crypto
    .createHash('sha256')
    .update(`${appId}${timestamp}${payload}${secretKey}`)
    .digest('hex')
  return {
    header: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${sig}`,
    timestamp,
  }
}

export async function convert(url, creds) {
  const { appId, secretKey } = creds
  const canonical = await resolveCanonical(url)
  const safeUrl = canonical.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const body = {
    query: `mutation {
      generateShortLink(input: { originUrl: "${safeUrl}", subIds: [""] }) {
        shortLink
      }
    }`,
  }
  const payload = JSON.stringify(body)
  const { header } = buildAuth(appId, secretKey, payload)

  try {
    const { data } = await axios.post(ENDPOINT, body, {
      headers: {
        Authorization: header,
        'Content-Type': 'application/json',
      },
      timeout: 8000,
    })

    const link = data?.data?.generateShortLink?.shortLink
    if (!link) {
      const err = data?.errors?.[0]?.message
      throw new Error(err || 'Resposta inesperada')
    }
    return link
  } catch (err) {
    throw new Error(`Shopee converter: ${err.message}`)
  }
}

// Resolve short links (shope.ee, s.shopee.com.br) para a URL canônica
// e normaliza para o formato que a API de afiliado aceita como origem.
//
// Shopee BR ressuscitou em 2026 um shortlink no formato `/opaanlp/{shopId}/{itemId}`
// (campanha "Open Anuncio Link de Produto") já carimbado como afiliado de
// terceiros (`utm_medium=affiliates&utm_source=an_<id>` + assinatura
// `gads_t_sig`). A `generateShortLink` recusa URLs assim com "Invalid origin URL"
// porque o programa não reetiqueta link de outro afiliado. Solução: extrair
// (shopId, itemId) do path e reescrever para `/product/{shopId}/{itemId}` sem
// query string — formato canônico aceito.
const SHOPEE_PRODUCT_PATH_RE = /\/(?:opaanlp|product|universal-link\/product)\/(\d+)\/(\d+)(?=[/?#&%]|$)/
const SHOPEE_DASH_I_RE = /-i\.(\d+)\.(\d+)(?=[/?#&%]|$)/
const SHOPEE_SHORT_HOST_RE = /^(shope\.ee|s\.shopee\.com\.br)$/
const SHOPEE_BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const SHORT_LINK_MAX_HOPS = 6
const SHORT_LINK_BODY_MAX_BYTES = 512 * 1024

export function isShopeeShortLink(url) {
  try {
    return SHOPEE_SHORT_HOST_RE.test(new URL(String(url || '')).hostname)
  } catch {
    return false
  }
}

// Extrai (shopId, itemId) de qualquer string que contenha uma URL de produto
// Shopee — inclusive quando a URL do produto está URL-encoded dentro de um
// query param (ex.: página anti-bot `verify/traffic?next=https%3A%2F%2F...`).
// É a ÚNICA fonte de verdade de parsing de IDs; productInfoScraper e
// imageScrapers delegam para cá.
export function extractShopeeIds(value) {
  let text = String(value || '')
  for (let round = 0; round < 3; round++) {
    const m = text.match(SHOPEE_DASH_I_RE) || text.match(SHOPEE_PRODUCT_PATH_RE)
    if (m) return { shopId: m[1], itemId: m[2] }
    let decoded
    try { decoded = decodeURIComponent(text) } catch { break }
    if (decoded === text) break
    text = decoded
  }
  return null
}

export function normalizeShopeeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl)
    if (!/(^|\.)shopee\.com\.br$/.test(u.hostname)) return rawUrl
    const ids = extractShopeeIds(rawUrl)
    if (ids) return `https://shopee.com.br/product/${ids.shopId}/${ids.itemId}`
    return rawUrl
  } catch { return rawUrl }
}

function collectSetCookies(res, jar) {
  const headers = res?.headers
  let lines = []
  if (typeof headers?.getSetCookie === 'function') {
    lines = headers.getSetCookie() || []
  } else {
    const single = headers?.get?.('set-cookie')
    if (single) lines = [single]
  }
  for (const line of lines) {
    const pair = String(line).split(';')[0]
    const eq = pair.indexOf('=')
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
  }
}

function decodeHtmlUrl(raw) {
  return String(raw || '').replace(/\\\//g, '/').replace(/&amp;/g, '&').trim()
}

// Quando o short link responde 200 (interstitial de tracking) em vez de
// redirect HTTP, o destino real fica no corpo: meta refresh, redirect JS
// (`location.replace(...)`), og:url/canonical ou uma URL de produto embutida.
function extractRedirectTargetFromHtml(html, baseUrl) {
  if (!html) return null
  const candidates = []
  const metaRefresh = html.match(/http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url\s*=\s*([^"'>\s]+)/i)
  if (metaRefresh?.[1]) candidates.push(metaRefresh[1])
  const jsRedirect = html.match(/location\.(?:replace|assign)\(\s*["']([^"']+)["']/i)
    || html.match(/location(?:\.href)?\s*=\s*["']([^"']+)["']/i)
  if (jsRedirect?.[1]) candidates.push(jsRedirect[1])
  for (const re of [
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i,
  ]) {
    const m = html.match(re)
    if (m?.[1]) candidates.push(m[1])
  }
  const embedded = html.match(/https?:(?:\\\/\\\/|\/\/)[^"'<>\s]*?(?:-i\.\d+\.\d+|(?:\\\/|\/)(?:product|opaanlp)(?:\\\/|\/)\d+(?:\\\/|\/)\d+)[^"'<>\s]*/i)
  if (embedded?.[0]) candidates.push(embedded[0])

  let fallback = null
  for (const raw of candidates) {
    let abs
    try { abs = new URL(decodeHtmlUrl(raw), baseUrl).href } catch { continue }
    if (extractShopeeIds(abs)) return abs
    if (!fallback) fallback = abs
  }
  return fallback
}

async function readBodyLimited(res) {
  try {
    if (!res?.body?.getReader) {
      const text = await res?.text?.()
      return typeof text === 'string' ? text.slice(0, SHORT_LINK_BODY_MAX_BYTES) : null
    }
    const reader = res.body.getReader()
    const chunks = []
    let received = 0
    while (received < SHORT_LINK_BODY_MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.byteLength
    }
    await reader.cancel().catch(() => {})
    const body = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }
    return new TextDecoder().decode(body)
  } catch {
    return null
  }
}

// Resolvedor canônico de short link da Shopee. NÃO usar fetch(redirect:'follow')
// direto: a Shopee intercala hops de anti-bot (verify/traffic) no FIM da cadeia
// e serve interstitials 200 com redirect via JS — nos dois casos o `res.url`
// final perde a URL do produto e TODAS as fontes de título/preço/imagem morrem
// juntas (afiliado GraphQL, API v4 e título via slug dependem dos IDs).
// Estratégia: seguir os redirects manualmente carregando cookies da cadeia e
// parar no PRIMEIRO hop cuja URL já contenha (shopId, itemId) — inclusive
// URL-encoded em query param. Sem redirect HTTP, extrai o alvo do corpo.
export async function resolveShopeeShortLink(url, { timeoutMs = 8000, fetchImpl = globalThis.fetch } = {}) {
  let current = String(url || '')
  if (!isShopeeShortLink(current)) return current

  const jar = new Map()
  for (let hop = 0; hop < SHORT_LINK_MAX_HOPS; hop++) {
    if (extractShopeeIds(current)) return current

    let res
    try {
      const cookieHeader = [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
      res = await fetchImpl(current, {
        headers: {
          'User-Agent': SHOPEE_BROWSER_UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch {
      return current
    }

    collectSetCookies(res, jar)

    const location = res?.headers?.get?.('location')
    if (location) {
      try { current = new URL(location, current).href } catch { return current }
      continue
    }

    // Implementações de fetch que seguem redirects sozinhas reportam a URL
    // final em res.url mesmo com redirect:'manual' (e.g. proxies/stubs).
    if (res?.url && res.url !== current) {
      current = res.url
      continue
    }

    const html = await readBodyLimited(res)
    const target = extractRedirectTargetFromHtml(html, current)
    if (target && target !== current) {
      current = target
      continue
    }
    return current
  }
  return current
}

async function resolveCanonical(url) {
  try {
    const resolved = await resolveShopeeShortLink(url, { timeoutMs: 5000 })
    return normalizeShopeeUrl(resolved)
  } catch { return url }
}

function parseIds(url) {
  return extractShopeeIds(url)
}

// Consulta a API de afiliado (GraphQL) para obter a imagem oficial do produto.
// Mais confiável que scraping HTML, que a Shopee bloqueia para UAs comuns.
export async function fetchShopeeImage(url, creds) {
  if (!creds?.appId || !creds?.secretKey) return null
  const canonical = await resolveCanonical(url)
  const ids = parseIds(canonical)
  if (!ids) return null

  const body = {
    query: `{
      productOfferV2(itemId: ${ids.itemId}, shopId: ${ids.shopId}, listType: 0, sortType: 2, page: 1, limit: 1) {
        nodes { imageUrl productName }
      }
    }`,
  }
  const payload = JSON.stringify(body)
  const { header } = buildAuth(creds.appId, creds.secretKey, payload)

  try {
    const { data } = await axios.post(ENDPOINT, body, {
      headers: { Authorization: header, 'Content-Type': 'application/json' },
      timeout: 6000,
    })
    const node = data?.data?.productOfferV2?.nodes?.[0]
    return node?.imageUrl || null
  } catch {
    return null
  }
}

// A API de afiliado (productOfferV2) devolve os preços como string decimal em
// reais (ex.: "59.9"), NÃO em micro-unidades. Por isso aqui é só normalizar o
// decimal para o formato pt-BR "59,90" — diferente do payload da API v4 pública
// (item/get) que vem em centavos*100000 e é tratado em productInfoScraper.js.
export function shopeeDecimalPriceToString(value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return ''
  return num.toFixed(2).replace('.', ',')
}

// Consulta a API de afiliado (GraphQL) para obter título e preço do produto.
// Retorna { title, newPrice, oldPrice } ou null em caso de falha/sem creds.
//
// Campos confirmados do schema productOfferV2 (2026-06): price, priceMin,
// priceMax, priceDiscountRate, productName, imageUrl. NÃO existe `originPrice`
// (pedir esse campo derruba a query inteira com erro 10010). O preço "de" é
// derivado do preço atual + a taxa de desconto inteira (`priceDiscountRate`).
export async function fetchShopeeProductInfo(url, creds) {
  if (!creds?.appId || !creds?.secretKey) return null
  try {
    const canonical = await resolveCanonical(url)
    const ids = parseIds(canonical)
    if (!ids) return null

    const body = {
      query: `{
        productOfferV2(itemId: ${ids.itemId}, shopId: ${ids.shopId}, listType: 0, sortType: 2, page: 1, limit: 1) {
          nodes { imageUrl productName price priceMin priceMax priceDiscountRate }
        }
      }`,
    }
    const payload = JSON.stringify(body)
    const { header } = buildAuth(creds.appId, creds.secretKey, payload)

    const { data } = await axios.post(ENDPOINT, body, {
      headers: { Authorization: header, 'Content-Type': 'application/json' },
      timeout: 6000,
    })
    const node = data?.data?.productOfferV2?.nodes?.[0]
    if (!node) return null

    const title = typeof node.productName === 'string' ? node.productName.trim() : ''
    const currentRaw = node.priceMin ?? node.price ?? null
    const newPrice = shopeeDecimalPriceToString(currentRaw)

    // Preço "de": reconstruído a partir do desconto. priceDiscountRate é a % de
    // desconto inteira (ex.: 54 = 54% off), então original = atual / (1 - rate/100).
    let oldPrice = ''
    const rate = Number(node.priceDiscountRate)
    const current = Number(currentRaw)
    if (Number.isFinite(rate) && rate > 0 && rate < 100 && Number.isFinite(current) && current > 0) {
      oldPrice = shopeeDecimalPriceToString(current / (1 - rate / 100))
    }

    if (!title && !newPrice) return null
    return { title, newPrice, oldPrice }
  } catch {
    return null
  }
}
