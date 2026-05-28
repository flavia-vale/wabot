// Scraper de informação de produto a partir do link (já-afiliado).
// A ferramenta "Gerar oferta" recebe um link que JÁ é de afiliado — não deve
// re-converter. Aqui buscamos título e preços para preencher o template.

const HTML_FETCH_TIMEOUT_MS = Number(process.env.PRODUCT_INFO_TIMEOUT_MS) || 8_000
const HTML_MAX_BYTES = Number(process.env.PRODUCT_INFO_MAX_BYTES) || 2 * 1024 * 1024
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const JSON_LD_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
const OG_TITLE_RE = [
  /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
]
const TITLE_TAG_RE = /<title[^>]*>([^<]+)<\/title>/i
const META_PRICE_RE = [
  /<meta[^>]+(?:property|itemprop)=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+(?:property|itemprop)=["']og:price:amount["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+(?:property|itemprop)=["']price["'][^>]+content=["']([^"']+)["']/i,
]

function decodeEntities(value = '') {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

function normalizeText(value) {
  return decodeEntities(value || '').replace(/\s+/g, ' ').trim()
}

function toPriceString(value) {
  if (value == null) return ''
  const num = Number(value)
  if (Number.isFinite(num) && num > 0) return num.toFixed(2).replace('.', ',')
  const cleaned = String(value).trim()
  return cleaned || ''
}

async function readLimitedText(res) {
  const contentLength = Number(res.headers.get('content-length'))
  if (contentLength && contentLength > HTML_MAX_BYTES) return null
  if (!res.body) return res.text()
  const reader = res.body.getReader()
  const chunks = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    chunks.push(value)
    if (received > HTML_MAX_BYTES) {
      await reader.cancel().catch(() => {})
      break
    }
  }
  const body = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(body)
}

async function fetchHtml(url, { ua = BROWSER_UA, timeoutMs = HTML_FETCH_TIMEOUT_MS } = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': ua,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  })
  if (!res.ok) return { html: null, finalUrl: res.url || url }
  const contentType = res.headers.get('content-type') || ''
  if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    return { html: null, finalUrl: res.url || url }
  }
  const html = await readLimitedText(res)
  return { html, finalUrl: res.url || url }
}

function findProductNodes(html) {
  const nodes = []
  for (const match of html.matchAll(JSON_LD_RE)) {
    let parsed
    try { parsed = JSON.parse(match[1]) } catch { continue }
    const queue = Array.isArray(parsed) ? [...parsed] : [parsed]
    while (queue.length) {
      const node = queue.shift()
      if (!node || typeof node !== 'object') continue
      if (Array.isArray(node['@graph'])) queue.push(...node['@graph'])
      const type = node['@type']
      const types = Array.isArray(type) ? type : [type]
      if (types.some(t => typeof t === 'string' && t.toLowerCase().includes('product'))) {
        nodes.push(node)
      }
    }
  }
  return nodes
}

function pickOffer(offers) {
  if (!offers) return null
  const list = Array.isArray(offers) ? offers : [offers]
  for (const offer of list) {
    if (offer && typeof offer === 'object') return offer
  }
  return null
}

function extractFromJsonLd(html) {
  const products = findProductNodes(html)
  for (const product of products) {
    const title = normalizeText(product.name)
    const offer = pickOffer(product.offers)
    const newPrice = toPriceString(offer?.price ?? offer?.lowPrice)
    // priceSpecification pode trazer o preço cheio (de) — costuma estar no
    // próprio nó offer ou em offer.priceSpecification quando é AggregateOffer.
    let oldPrice = ''
    const specs = offer?.priceSpecification
    if (Array.isArray(specs)) {
      for (const spec of specs) {
        if (spec?.priceType && /list|original|strikethrough/i.test(String(spec.priceType))) {
          oldPrice = toPriceString(spec.price)
          break
        }
      }
    } else if (specs && typeof specs === 'object') {
      oldPrice = toPriceString(specs.price)
    }
    if (!oldPrice) oldPrice = toPriceString(offer?.highPrice)
    if (title || newPrice) return { title, oldPrice, newPrice }
  }
  return null
}

function extractTitleFallback(html) {
  if (!html) return ''
  for (const re of OG_TITLE_RE) {
    const m = html.match(re)
    if (m?.[1]) return normalizeText(m[1])
  }
  const m = html.match(TITLE_TAG_RE)
  return m?.[1] ? normalizeText(m[1]) : ''
}

function extractTitleFromUrl(url) {
  try {
    const u = new URL(String(url || ''))
    const host = u.hostname.replace(/^www\./, '')
    if (/shopee\.com\.br$/.test(host)) {
      const m = u.pathname.match(/^\/([^/]+)-i\.\d+\.\d+/i)
      if (m?.[1]) return normalizeText(decodeURIComponent(m[1]).replace(/-/g, ' '))
    }
    if (/amazon\.com\.br$/.test(host)) {
      const m = u.pathname.match(/^\/([^/]+)\/dp\/[A-Z0-9]{10}/i)
      if (m?.[1]) return normalizeText(decodeURIComponent(m[1]).replace(/-/g, ' '))
    }
    if (/mercadolivre\.com\.br$/.test(host)) {
      const m = u.pathname.match(/^\/([^/]+)\/(?:up|p)\//i)
      if (m?.[1]) return normalizeText(decodeURIComponent(m[1]).replace(/-/g, ' '))
    }
  } catch {}
  return ''
}

function parseMercadoLivreProductIdFromUrl(url) {
  const m = String(url || '').match(/\/p\/(MLB[0-9]+)/i)
  return m?.[1]?.toUpperCase() || null
}

async function fetchMercadoLivreProductInfo(url, { timeoutMs = HTML_FETCH_TIMEOUT_MS } = {}) {
  const productId = parseMercadoLivreProductIdFromUrl(url)
  if (!productId) return null
  const endpoint = `https://api.mercadolibre.com/products/${productId}`
  try {
    const res = await fetch(endpoint, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'application/json,text/plain,*/*',
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const payload = await res.json().catch(() => null)
    const name = normalizeText(payload?.name || '')
    const price = toPriceString(payload?.buy_box_winner?.price || payload?.buy_box_winner?.sale_price?.amount)
    if (!name && !price) return null
    return { title: name, oldPrice: '', newPrice: price }
  } catch {
    return null
  }
}


function extractAmazonTitleAndPrice(html) {
  const titleMatch = html.match(/<span[^>]+id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i)
  const offscreenPrice = html.match(/<span[^>]+class=["'][^"']*a-offscreen[^"']*["'][^>]*>[^0-9]*([0-9]+(?:[\.,][0-9]{2})?)<\/span>/i)
  const whole = html.match(/<span[^>]+class=["'][^"']*a-price-whole[^"']*["'][^>]*>([0-9\.]+)<\/span>/i)?.[1]
  const fraction = html.match(/<span[^>]+class=["'][^"']*a-price-fraction[^"']*["'][^>]*>([0-9]{2})<\/span>/i)?.[1]
  const title = titleMatch?.[1] ? normalizeText(titleMatch[1]) : ''
  const inlinePrice = whole && fraction ? `${whole},${fraction}` : ''
  const newPrice = offscreenPrice?.[1] ? toPriceString(offscreenPrice[1]) : toPriceString(inlinePrice)
  return { title, newPrice }
}


function parseShopeeIdsFromUrl(url) {
  const raw = String(url || '')
  const m = raw.match(/-i\.(\d+)\.(\d+)(?:[/?#]|$)/) || raw.match(/\/product\/(\d+)\/(\d+)(?:[/?#]|$)/)
  if (!m) return null
  return { shopId: m[1], itemId: m[2] }
}

async function resolveShopeeUrl(url, { timeoutMs = HTML_FETCH_TIMEOUT_MS } = {}) {
  try {
    const u = new URL(String(url || ''))
    if (!/^(shope\.ee|s\.shopee\.com\.br)$/.test(u.hostname)) return String(url || '')
    const res = await fetch(String(url), {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    })
    return String(res?.url || url)
  } catch {
    return String(url || '')
  }
}

function shopeePriceIntToString(value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return ''
  return toPriceString(num / 100000)
}

async function fetchShopeeItemInfo(url, { timeoutMs = HTML_FETCH_TIMEOUT_MS } = {}) {
  const canonical = await resolveShopeeUrl(url, { timeoutMs })
  const ids = parseShopeeIdsFromUrl(canonical)
  if (!ids) return null
  const endpoint = `https://shopee.com.br/api/v4/item/get?itemid=${ids.itemId}&shopid=${ids.shopId}`
  try {
    const res = await fetch(endpoint, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'application/json,text/plain,*/*',
        Referer: String(canonical || 'https://shopee.com.br/'),
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const payload = await res.json().catch(() => null)
    const item = payload?.data?.item
    if (!item) return null
    return {
      title: normalizeText(item.name || ''),
      oldPrice: shopeePriceIntToString(item.price_before_discount),
      newPrice: shopeePriceIntToString(item.price_min || item.price),
    }
  } catch {
    return null
  }
}

function extractMetaPrice(html) {
  if (!html) return ''
  for (const re of META_PRICE_RE) {
    const m = html.match(re)
    if (m?.[1]) return toPriceString(m[1])
  }
  return ''
}

// Landings sociais do Mercado Livre (meli.la, mluvem.com, /social/...) embedam
// o produto destacado num JSON inline com a estrutura:
//   "price":{"previous_price":{"value":599.99,...},"current_price":{"value":399.99,...}}
// A primeira ocorrência é o produto que a share aponta — pegamos esses dois
// valores diretamente, já que /produto/MLB* normal cai em anti-bot.
function extractFromMercadoLivreLanding(html) {
  const block = html.match(/"price"\s*:\s*\{[^{}]*"previous_price"\s*:\s*\{\s*"value"\s*:\s*([0-9]+(?:\.[0-9]+)?)[^{}]*\}[^{}]*"current_price"\s*:\s*\{\s*"value"\s*:\s*([0-9]+(?:\.[0-9]+)?)/)
  if (block) {
    return { oldPrice: toPriceString(block[1]), newPrice: toPriceString(block[2]) }
  }
  // Em ofertas sem desconto, só vem current_price — devolvemos só o novo.
  const single = html.match(/"current_price"\s*:\s*\{\s*"value"\s*:\s*([0-9]+(?:\.[0-9]+)?)/)
  if (single) {
    return { oldPrice: '', newPrice: toPriceString(single[1]) }
  }
  return null
}

export async function fetchProductInfo(url, opts = {}) {
  let html = null
  let finalUrl = url
  try {
    const fetched = await fetchHtml(url, opts)
    html = fetched?.html ?? null
    finalUrl = fetched?.finalUrl || url
  } catch {
    html = null
    finalUrl = url
  }

  const jsonLd = html ? extractFromJsonLd(html) : null
  const mlLanding = html ? extractFromMercadoLivreLanding(html) : null
  const amazonFallback = html ? extractAmazonTitleAndPrice(html) : null
  const shopeeApiFallback = await fetchShopeeItemInfo(finalUrl || url, opts)
  const mercadoLivreApiFallback = await fetchMercadoLivreProductInfo(finalUrl || url, opts)
  const titleFromUrl = extractTitleFromUrl(finalUrl || url)
  const title = jsonLd?.title || amazonFallback?.title || shopeeApiFallback?.title || mercadoLivreApiFallback?.title || titleFromUrl || extractTitleFallback(html)
  const newPrice = jsonLd?.newPrice || mlLanding?.newPrice || amazonFallback?.newPrice || shopeeApiFallback?.newPrice || mercadoLivreApiFallback?.newPrice || extractMetaPrice(html)
  const oldPrice = jsonLd?.oldPrice || mlLanding?.oldPrice || shopeeApiFallback?.oldPrice || mercadoLivreApiFallback?.oldPrice || ''
  return { title, oldPrice, newPrice, finalUrl }
}
