const OG_IMAGE_RE = [
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
]

const JSON_LD_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
const IMAGE_CACHE_TTL_MS = 5 * 60 * 1000
const IMAGE_FETCH_TIMEOUT_MS = Number(process.env.IMAGE_FETCH_TIMEOUT_MS) || 2_500
const IMAGE_HTML_MAX_BYTES = Number(process.env.IMAGE_HTML_MAX_BYTES) || 512 * 1024
const IMAGE_BUFFER_TIMEOUT_MS = Number(process.env.IMAGE_BUFFER_TIMEOUT_MS) || 5_000
const IMAGE_BUFFER_MAX_BYTES = Number(process.env.IMAGE_BUFFER_MAX_BYTES) || 5 * 1024 * 1024

// User-Agent de browser real: Shopee e outros sites bloqueiam UAs de bot e
// devolvem HTML sem og:image, causando "sem imagem" nos anúncios.
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const imageCache = new Map()
const domainFailureMetrics = new Map()

function getDomain(url) {
  try { return new URL(url).hostname } catch { return 'invalid-url' }
}

function incFailure(url) {
  const domain = getDomain(url)
  domainFailureMetrics.set(domain, (domainFailureMetrics.get(domain) ?? 0) + 1)
}

function getCached(url) {
  const cached = imageCache.get(url)
  if (!cached) return null
  if (cached.expiresAt < Date.now()) {
    imageCache.delete(url)
    return null
  }
  return cached.value
}

function setCached(url, value) {
  imageCache.set(url, { value, expiresAt: Date.now() + IMAGE_CACHE_TTL_MS })
}

function extractJsonLdImage(html) {
  const scripts = [...html.matchAll(JSON_LD_RE)]
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1])
      const nodes = Array.isArray(parsed) ? parsed : [parsed]
      for (const node of nodes) {
        const image = node?.image
        if (typeof image === 'string') return image
        if (Array.isArray(image) && typeof image[0] === 'string') return image[0]
        if (image?.url) return image.url
      }
    } catch {
      // ignora json-ld inválido
    }
  }
  return null
}

async function readLimitedText(res) {
  const contentLength = Number(res.headers.get('content-length'))
  if (contentLength && contentLength > IMAGE_HTML_MAX_BYTES) return null
  if (!res.body) return res.text()

  const reader = res.body.getReader()
  const chunks = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > IMAGE_HTML_MAX_BYTES) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }

  const body = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(body)
}

async function fetchHtml(url, { ua = 'Mozilla/5.0 (compatible; BotConversorAfiliados/1.0)' } = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    redirect: 'follow',
  })
  if (!res.ok) return { html: null, finalUrl: url }
  const contentType = res.headers.get('content-type') || ''
  if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    return { html: null, finalUrl: res.url || url }
  }
  const html = await readLimitedText(res)
  return { html, finalUrl: res.url || url }
}

async function resolveByHtmlLayers(url, opts) {
  const { html } = await fetchHtml(url, opts)
  if (!html) return null

  for (const re of OG_IMAGE_RE) {
    const m = html.match(re)
    if (m?.[1]) return m[1]
  }

  return extractJsonLdImage(html)
}

// Extrai (shopid, itemid) de URLs Shopee no formato:
//   https://shopee.com.br/produto-i.{shopid}.{itemid}
//   https://shopee.com.br/product/{shopid}/{itemid}
function parseShopeeIds(url) {
  try {
    const u = new URL(url)
    if (!/shopee\.com\.br$/.test(u.hostname)) return null
    const m1 = u.pathname.match(/-i\.(\d+)\.(\d+)(?:\/|$)/)
    if (m1) return { shopid: m1[1], itemid: m1[2] }
    const m2 = u.pathname.match(/^\/product\/(\d+)\/(\d+)(?:\/|$)/)
    if (m2) return { shopid: m2[1], itemid: m2[2] }
    return null
  } catch { return null }
}

// Resolve short links da Shopee (shope.ee, s.shopee.com.br) para a URL canônica.
async function resolveShopeeShortLink(url) {
  try {
    const u = new URL(url)
    if (!/^(shope\.ee|s\.shopee\.com\.br)$/.test(u.hostname)) return url
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
      redirect: 'follow',
    })
    return res.url || url
  } catch { return url }
}

function shopeeImageUrl(hash) {
  if (!hash) return null
  if (/^https?:\/\//i.test(hash)) return hash
  return `https://down-br.img.susercontent.com/file/${hash}`
}

// User-Agents que a Shopee atende com SSR (renderizando og:image no HTML).
// O SPA não embute og:image para UAs comuns, então UA de browser ou bot retorna
// página vazia. facebookexternalhit/WhatsApp são whitelisted pela Shopee.
const SHOPEE_CRAWLER_UAS = [
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'WhatsApp/2.24.10.85 A',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
]

async function resolveShopeeImage(url, creds) {
  // 1) Caminho preferencial: API de afiliado (GraphQL) — usa creds que já temos.
  if (creds?.shopee?.appId && creds?.shopee?.secretKey) {
    try {
      const { fetchShopeeImage } = await import('./shopee.js')
      const img = await fetchShopeeImage(url, creds.shopee)
      if (img) return img
    } catch {
      // segue para fallbacks
    }
  }

  const canonical = await resolveShopeeShortLink(url)

  for (const ua of SHOPEE_CRAWLER_UAS) {
    const img = await resolveByHtmlLayers(canonical, { ua }).catch(() => null)
    if (img) return img
  }

  // Fallback: API v4 de itens (público) — pode ser bloqueado por anti-bot,
  // mas tentamos antes de desistir.
  const ids = parseShopeeIds(canonical)
  if (ids) {
    try {
      const apiUrl = `https://shopee.com.br/api/v4/item/get?itemid=${ids.itemid}&shopid=${ids.shopid}`
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept': 'application/json',
          'Referer': canonical,
          'X-API-SOURCE': 'pc',
          'X-Requested-With': 'XMLHttpRequest',
        },
        signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
      })
      if (res.ok) {
        const json = await res.json()
        const item = json?.data || json?.item
        const hash = item?.image || item?.images?.[0]
        const built = shopeeImageUrl(hash)
        if (built) return built
      }
    } catch {
      // segue para retorno nulo
    }
  }
  return null
}

export function getImageResolverMetrics() {
  return Object.fromEntries(domainFailureMetrics)
}

export async function fetchProductImage(platform, productUrl, creds) {
  const cached = getCached(productUrl)
  if (cached !== null) return cached

  try {
    let image = null
    if (platform === 'shopee') {
      image = await resolveShopeeImage(productUrl, creds)
    }
    if (!image) image = await resolveByHtmlLayers(productUrl)

    if (!image) incFailure(productUrl)
    setCached(productUrl, image)
    return image
  } catch {
    incFailure(productUrl)
    setCached(productUrl, null)
    return null
  }
}

// Baixa o conteúdo da imagem como Buffer enviando User-Agent/Referer adequados.
// Necessário para o WhatsApp porque a Baileys, ao receber `{ image: { url } }`,
// usa um UA padrão que CDNs como o da Shopee podem rejeitar — resultando em
// "imagem quebrada" no destino.
export async function fetchImageBuffer(imageUrl, refererUrl) {
  if (!imageUrl) return null
  try {
    const headers = {
      'User-Agent': BROWSER_UA,
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    }
    if (refererUrl) {
      try { headers['Referer'] = new URL(refererUrl).origin + '/' } catch {}
    }
    const res = await fetch(imageUrl, {
      headers,
      signal: AbortSignal.timeout(IMAGE_BUFFER_TIMEOUT_MS),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    if (contentType && !contentType.startsWith('image/')) return null
    const contentLength = Number(res.headers.get('content-length'))
    if (contentLength && contentLength > IMAGE_BUFFER_MAX_BYTES) return null

    const reader = res.body?.getReader()
    if (!reader) {
      const ab = await res.arrayBuffer()
      if (ab.byteLength > IMAGE_BUFFER_MAX_BYTES) return null
      return Buffer.from(ab)
    }
    const chunks = []
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > IMAGE_BUFFER_MAX_BYTES) {
        await reader.cancel().catch(() => {})
        return null
      }
      chunks.push(value)
    }
    return Buffer.concat(chunks.map(c => Buffer.from(c)), received)
  } catch {
    return null
  }
}
