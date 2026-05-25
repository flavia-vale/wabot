// Raspa o título do produto a partir da URL canônica do marketplace.
// Usado como guard anti-mismatch antes de enviar uma oferta: se o título
// raspado da página destino não tem nenhum token significativo em comum
// com o caption da mensagem monitorada, a mensagem é descartada com
// diagnóstico (cenário visto em prod: caption de "toalhas", link de
// "mochila" e foto de "jaqueta" tudo na mesma mensagem upstream).
//
// Deliberadamente independente do imageScrapers.js: a checagem de título
// roda em todas as ofertas e precisa ser barata (timeout curto, body
// pequeno) — não queremos arrastar HTML de 2MB da Amazon nem o pipeline
// de OG image só para extrair og:title.

const HTML_FETCH_TIMEOUT_MS = Number(process.env.PRODUCT_TITLE_FETCH_TIMEOUT_MS) || 3_000
const HTML_MAX_BYTES = Number(process.env.PRODUCT_TITLE_MAX_BYTES) || 256 * 1024
const DEFAULT_UA = 'Mozilla/5.0 (compatible; BotOfertaTitleCheck/1.0)'

const OG_TITLE_RE = [
  /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
]
const TWITTER_TITLE_RE = [
  /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["']/i,
]
const HTML_TITLE_RE = /<title[^>]*>([^<]+)<\/title>/i
const JSONLD_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

function decodeEntities(value = '') {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/gi, ' ')
}

async function readLimitedBody(res, maxBytes) {
  if (!res.body || typeof res.body.getReader !== 'function') {
    const text = await res.text()
    return text.length > maxBytes ? text.slice(0, maxBytes) : text
  }
  const reader = res.body.getReader()
  const chunks = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    chunks.push(value)
    if (received >= maxBytes) {
      await reader.cancel().catch(() => {})
      break
    }
  }
  const merged = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(merged)
}

function pickFromJsonLd(html) {
  for (const match of html.matchAll(JSONLD_RE)) {
    try {
      const parsed = JSON.parse(match[1])
      const nodes = Array.isArray(parsed) ? parsed : [parsed]
      for (const node of nodes) {
        if (!node) continue
        if (typeof node.name === 'string' && node.name.trim()) return node.name
        if (typeof node?.product?.name === 'string') return node.product.name
      }
    } catch {
      // ld+json com erro de parse — ignora
    }
  }
  return null
}

export function extractTitleFromHtml(html) {
  if (!html) return null

  for (const re of OG_TITLE_RE) {
    const m = html.match(re)
    if (m?.[1]) return decodeEntities(m[1]).trim() || null
  }
  for (const re of TWITTER_TITLE_RE) {
    const m = html.match(re)
    if (m?.[1]) return decodeEntities(m[1]).trim() || null
  }
  const jsonLd = pickFromJsonLd(html)
  if (jsonLd) return decodeEntities(jsonLd).trim() || null

  const m = html.match(HTML_TITLE_RE)
  if (m?.[1]) return decodeEntities(m[1]).trim() || null

  return null
}

export async function scrapeProductTitle(url, {
  timeoutMs = HTML_FETCH_TIMEOUT_MS,
  maxBytes = HTML_MAX_BYTES,
  ua = DEFAULT_UA,
  fetchImpl = fetch,
} = {}) {
  if (!url || typeof url !== 'string') return null
  try {
    const res = await fetchImpl(url, {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return null
    }
    const html = await readLimitedBody(res, maxBytes)
    return extractTitleFromHtml(html)
  } catch {
    return null
  }
}

export const __internals = { decodeEntities, readLimitedBody, pickFromJsonLd }
