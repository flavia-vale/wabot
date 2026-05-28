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

function firstPositiveShopeePrice(...values) {
  for (const value of values) {
    const num = Number(value)
    if (Number.isFinite(num) && num > 0) return value
  }
  return null
}

function extractShopeeModelPrices(item) {
  const models = Array.isArray(item?.models) ? item.models : []
  let minCurrent = null
  let maxOld = null
  for (const model of models) {
    const current = Number(firstPositiveShopeePrice(model?.price, model?.price_stocks?.[0]?.price, model?.price_info?.price))
    const old = Number(firstPositiveShopeePrice(model?.price_before_discount, model?.price_info?.price_before_discount))
    if (Number.isFinite(current) && current > 0) {
      minCurrent = minCurrent == null ? current : Math.min(minCurrent, current)
    }
    if (Number.isFinite(old) && old > 0) {
      maxOld = maxOld == null ? old : Math.max(maxOld, old)
    }
  }
  return { minCurrent, maxOld }
}

function extractShopeePriceFromHtml(html) {
  if (!html) return ''
  const ptBr = html.match(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/)
  if (ptBr?.[1]) return toPriceString(ptBr[1])
  const jsonDecimal = html.match(/"(?:price|current_price)"\s*:\s*"?([0-9]+\.[0-9]{2})"?/) || html.match(/"(?:price|current_price)"\s*:\s*([0-9]+\.[0-9]{2})/)
  if (jsonDecimal?.[1]) return toPriceString(jsonDecimal[1])
  return ''
}

function extractShopeePriceRangeFromHtml(html) {
  if (!html) return null
  const matches = [...html.matchAll(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/g)]
  if (!matches.length) return null
  const values = matches
    .map((m) => String(m[1] || '').trim())
    .map((v) => Number.parseFloat(v.replace(/\./g, '').replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (!values.length) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  if (min === max) return { oldPrice: '', newPrice: toPriceString(min) }
  return { oldPrice: toPriceString(max), newPrice: toPriceString(min) }
}

function extractShopeePriceRangeFromJsonInHtml(html) {
  if (!html) return null

  const minMatch = html.match(/"price_min"\s*:\s*(\d{4,})/)
  const oldMatch = html.match(/"price_before_discount"\s*:\s*(\d{4,})/)
  const maxOldMatch = html.match(/"price_max_before_discount"\s*:\s*(\d{4,})/)
  const fallbackPriceMatch = html.match(/"price"\s*:\s*(\d{4,})/)

  const currentRaw = firstPositiveShopeePrice(minMatch?.[1], fallbackPriceMatch?.[1])
  const oldRaw = firstPositiveShopeePrice(oldMatch?.[1], maxOldMatch?.[1])

  const newPrice = shopeePriceIntToString(currentRaw)
  const oldPrice = shopeePriceIntToString(oldRaw)
  if (newPrice || oldPrice) return { newPrice, oldPrice }
  return null
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

    const modelPrices = extractShopeeModelPrices(item)
    const oldRaw = firstPositiveShopeePrice(item.price_before_discount, item.price_max_before_discount, item.price_min_before_discount, modelPrices.maxOld)
    const currentRaw = firstPositiveShopeePrice(item.price_min, item.price, item.price_max, modelPrices.minCurrent)

    return {
      title: normalizeText(item.name || ''),
      oldPrice: shopeePriceIntToString(oldRaw),
      newPrice: shopeePriceIntToString(currentRaw),
    }
  } catch {
    return null
  }
}

// Converte um bloco DOM `andes-money-amount` (fração + centavos) do Mercado
// Livre para string "39,90". A fração pode trazer milhar com ponto (1.299).
function parseAndesAmount(segment) {
  if (!segment) return ''
  const fraction = segment.match(/andes-money-amount__fraction[^>]*>\s*([0-9.]+)\s*</i)?.[1]
  if (!fraction) return ''
  const cents = segment.match(/andes-money-amount__cents[^>]*>\s*([0-9]{2})\s*</i)?.[1]
  const whole = fraction.replace(/\./g, '')
  return cents ? `${whole},${cents}` : `${whole},00`
}

// Extrai título e preços direto do HTML da página de produto (PDP) do Mercado
// Livre. Usado como caminho principal desde que a API pública
// (api.mercadolibre.com/products) passou a exigir autenticação e responder 401.
// Cobre tanto o DOM renderizado (`ui-pdp-title`, `andes-money-amount`) quanto o
// JSON embarcado (`"price":{"value":..,"original_value":..}`).
function extractMercadoLivreFromHtml(html) {
  if (!html) return null
  if (!/mercadolivre|mercadolibre|ui-pdp-/i.test(html)) return null

  let title = ''
  for (const re of OG_TITLE_RE) {
    const m = html.match(re)
    if (m?.[1]) { title = normalizeText(m[1]); break }
  }
  if (!title) {
    const h1 = html.match(/<h1[^>]+class=["'][^"']*ui-pdp-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
    if (h1?.[1]) title = normalizeText(h1[1].replace(/<[^>]+>/g, ' '))
  }

  // Preço "de" (riscado) vem num <s class="... ui-pdp-price__original-value ...">.
  let oldPrice = ''
  const originalBlock = html.match(/ui-pdp-price__original-value[\s\S]{0,400}?<\/s>/i)
  if (originalBlock) oldPrice = parseAndesAmount(originalBlock[0])

  // Preço atual: primeiro andes-money-amount dentro do bloco principal de preço.
  let newPrice = ''
  const currentBlock = html.match(/ui-pdp-price__second-line[\s\S]{0,600}?<\/div>/i)
  if (currentBlock) newPrice = parseAndesAmount(currentBlock[0])

  // Fallback via JSON embarcado no HTML (__PRELOADED_STATE__ etc.).
  if (!newPrice) {
    const m = html.match(/"price"\s*:\s*\{[^{}]*"value"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i)
    if (m?.[1]) newPrice = toPriceString(m[1])
  }
  if (!oldPrice) {
    const m = html.match(/"original_price"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i)
      || html.match(/"original_value"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i)
    if (m?.[1]) oldPrice = toPriceString(m[1])
  }

  if (!title && !newPrice && !oldPrice) return null
  return { title, oldPrice, newPrice }
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
  const mlHtml = html ? extractMercadoLivreFromHtml(html) : null
  const mlLanding = html ? extractFromMercadoLivreLanding(html) : null
  const amazonFallback = html ? extractAmazonTitleAndPrice(html) : null
  const shopeeApiFallback = await fetchShopeeItemInfo(finalUrl || url, opts)
  const shopeeHtmlRange = extractShopeePriceRangeFromHtml(html)
  const shopeeJsonRange = extractShopeePriceRangeFromJsonInHtml(html)
  const mercadoLivreApiFallback = await fetchMercadoLivreProductInfo(finalUrl || url, opts)
  const titleFromUrl = extractTitleFromUrl(finalUrl || url)
  const title = jsonLd?.title || mlHtml?.title || amazonFallback?.title || shopeeApiFallback?.title || mercadoLivreApiFallback?.title || titleFromUrl || extractTitleFallback(html)
  const newPrice = jsonLd?.newPrice || mlHtml?.newPrice || mlLanding?.newPrice || amazonFallback?.newPrice || shopeeApiFallback?.newPrice || shopeeJsonRange?.newPrice || shopeeHtmlRange?.newPrice || mercadoLivreApiFallback?.newPrice || extractMetaPrice(html) || extractShopeePriceFromHtml(html)
  const oldPrice = jsonLd?.oldPrice || mlHtml?.oldPrice || mlLanding?.oldPrice || shopeeApiFallback?.oldPrice || shopeeJsonRange?.oldPrice || shopeeHtmlRange?.oldPrice || mercadoLivreApiFallback?.oldPrice || ''
  return { title, oldPrice, newPrice, finalUrl }
}
