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
  for (const re of OG_TITLE_RE) {
    const m = html.match(re)
    if (m?.[1]) return normalizeText(m[1])
  }
  const m = html.match(TITLE_TAG_RE)
  return m?.[1] ? normalizeText(m[1]) : ''
}

function extractMetaPrice(html) {
  for (const re of META_PRICE_RE) {
    const m = html.match(re)
    if (m?.[1]) return toPriceString(m[1])
  }
  return ''
}

export async function fetchProductInfo(url, opts = {}) {
  const { html, finalUrl } = await fetchHtml(url, opts)
  if (!html) return { title: '', oldPrice: '', newPrice: '', finalUrl }
  const jsonLd = extractFromJsonLd(html)
  const title = jsonLd?.title || extractTitleFallback(html)
  const newPrice = jsonLd?.newPrice || extractMetaPrice(html)
  const oldPrice = jsonLd?.oldPrice || ''
  return { title, oldPrice, newPrice, finalUrl }
}
