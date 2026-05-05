const OG_IMAGE_RE = [
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
]

const JSON_LD_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
const IMAGE_CACHE_TTL_MS = 5 * 60 * 1000
const IMAGE_FETCH_TIMEOUT_MS = Number(process.env.IMAGE_FETCH_TIMEOUT_MS) || 2_500
const IMAGE_HTML_MAX_BYTES = Number(process.env.IMAGE_HTML_MAX_BYTES) || 512 * 1024
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

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BotConversorAfiliados/1.0)' },
    signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    redirect: 'follow',
  })
  if (!res.ok) return null
  const contentType = res.headers.get('content-type') || ''
  if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) return null
  return readLimitedText(res)
}

async function resolveByHtmlLayers(url) {
  const html = await fetchHtml(url)
  if (!html) return null

  for (const re of OG_IMAGE_RE) {
    const m = html.match(re)
    if (m?.[1]) return m[1]
  }

  return extractJsonLdImage(html)
}

async function resolveFromOfficialApi(_platform, _url) {
  return null
}

export function getImageResolverMetrics() {
  return Object.fromEntries(domainFailureMetrics)
}

export async function fetchProductImage(platform, productUrl) {
  const cached = getCached(productUrl)
  if (cached !== null) return cached

  try {
    const image = await resolveByHtmlLayers(productUrl)
      ?? await resolveFromOfficialApi(platform, productUrl)
      ?? null

    if (!image) incFailure(productUrl)
    setCached(productUrl, image)
    return image
  } catch {
    incFailure(productUrl)
    setCached(productUrl, null)
    return null
  }
}
