import axios from 'axios'
import logger from '../logger.js'
import { shouldConvertCouponLinks } from './couponPolicy.js'

// Host da loja Amazon BR de verdade (não o encurtador) — onde `?tag=` credita.
const AMAZON_STORE_HOST = /(^|\.)amazon\.com\.br$/

const ASIN_RE = /(?:\/dp\/|\/gp\/product\/|\/product-reviews\/|\/exec\/obidos\/ASIN\/)([A-Z0-9]{10})/i
const AMAZON_HOST = /amazon\.com\.br|link\.amazon|amzn\.to|amzn\.la|a\.co|amzn\.divulgador\.link|amzlink\.to/
const SHORT_HOST = /link\.amazon|amzn\.to|amzn\.la|a\.co|amzn\.divulgador\.link|amzlink\.to/

async function resolveShortUrl(url) {
  try {
    const res = await axios.get(url, {
      maxRedirects: 5,
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    return res.request?.res?.responseUrl || res.config?.url || url
  } catch (err) {
    logger.warn({ url, err: err.message }, 'Amazon: falha ao resolver short URL')
    return url
  }
}

function extractAsin(url) {
  const m = url.match(ASIN_RE)
  return m ? m[1].toUpperCase() : null
}

export function isAmazonShortLink(url) {
  try {
    return SHORT_HOST.test(new URL(String(url)).hostname)
  } catch {
    return SHORT_HOST.test(String(url || ''))
  }
}

const SHORT_LINK_MAX_HOPS = 6
const SHORT_LINK_BODY_MAX_BYTES = 256 * 1024
const SHORT_LINK_CLOUDFLARE_RETRY_BACKOFF_MS = [300, 800, 1500]
const SHORT_LINK_BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

function collectSetCookies(res, jar) {
  try {
    const raw = res?.headers?.getSetCookie?.() || []
    for (const cookie of raw) {
      const pair = cookie.split(';')[0]
      const idx = pair.indexOf('=')
      if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim())
    }
  } catch {}
}

// Quando o short link responde 200 (interstitial) em vez de redirect HTTP, o
// destino real fica no corpo: meta refresh, redirect JS (`location.replace`),
// canonical/og:url ou uma URL de produto Amazon embutida.
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
  ]) {
    const m = html.match(re)
    if (m?.[1]) candidates.push(m[1])
  }
  const embedded = html.match(/https?:\/\/[^"'<>\s]*amazon\.com\.br[^"'<>\s]*?\/(?:dp|gp\/product)\/[A-Z0-9]{10}[^"'<>\s]*/i)
  if (embedded?.[0]) candidates.push(embedded[0])

  let fallback = null
  for (const raw of candidates) {
    let abs
    try { abs = new URL(raw.replace(/&amp;/g, '&'), baseUrl).href } catch { continue }
    if (extractAsin(abs)) return abs
    if (!fallback) fallback = abs
  }
  return fallback
}

function isCloudflareChallenge(res, html = '') {
  const mitigated = res?.headers?.get?.('cf-mitigated')
  if (String(mitigated || '').toLowerCase() === 'challenge') return true
  return /<title>Just a moment\.\.\.<\/title>|challenges\.cloudflare\.com|cf-mitigated/i.test(String(html || ''))
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

// Resolvedor robusto de short link da Amazon (amzn.to, amzn.la, a.co, etc.).
// Modelado em resolveShopeeShortLink: NÃO usa fetch(redirect:'follow') direto
// porque encurtadores como amzn.la podem servir interstitial 200 com redirect
// via JS/meta em vez de redirect HTTP — nesse caso o res.url final perde a URL
// do produto e tanto a conversão (extractAsin) quanto o scrape de título/preço
// morrem. Segue redirects manualmente com cookie jar e para no primeiro hop
// cuja URL já contém o ASIN; sem redirect HTTP, extrai o alvo do corpo.
export async function resolveAmazonShortLink(url, {
  timeoutMs = 8000,
  fetchImpl = globalThis.fetch,
  cloudflareRetryBackoffMs = SHORT_LINK_CLOUDFLARE_RETRY_BACKOFF_MS,
  sleepImpl = sleep,
} = {}) {
  let current = String(url || '')
  if (!isAmazonShortLink(current)) return current

  const jar = new Map()
  let cloudflareRetry = 0
  for (let hop = 0; hop < SHORT_LINK_MAX_HOPS; hop++) {
    if (extractAsin(current)) return current

    let res
    try {
      const cookieHeader = [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
      res = await fetchImpl(current, {
        headers: {
          'User-Agent': SHORT_LINK_BROWSER_UA,
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

    if (isCloudflareChallenge(res, html) && cloudflareRetry < cloudflareRetryBackoffMs.length) {
      const wait = cloudflareRetryBackoffMs[cloudflareRetry++]
      logger.warn({ url, current, status: res?.status, retryInMs: wait, cloudflareRetry }, 'Amazon: short link bloqueado por Cloudflare challenge — retry')
      if (wait > 0) await sleepImpl(wait)
      continue
    }

    if (isCloudflareChallenge(res, html)) {
      logger.warn({ url, current, status: res?.status, retries: cloudflareRetry }, 'Amazon: short link bloqueado por Cloudflare challenge — sem ASIN')
    }
    return current
  }
  return current
}

function buildCookieHeader(creds) {
  const pairs = []
  const ubid = creds['ubid-acbbr']
  const at = creds['at-acbbr']
  const x = creds['x-acbbr']
  if (ubid) pairs.push(`ubid-acbbr=${ubid}`)
  if (at) pairs.push(`at-acbbr=${at}`)
  if (x) pairs.push(`x-acbbr=${x}`)
  return pairs.join('; ')
}

const SHORTLINK_RETRY_BACKOFF_MS = [1000, 3000, 8000]
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function createAmazonShortLink(longUrl, tag, creds) {
  const cookieHeader = buildCookieHeader(creds)
  if (!cookieHeader) {
    logger.warn('Amazon createShortLink: cookies vazios, pulando chamada API')
    return { shortUrl: null, transient: false }
  }

  // Retry com backoff em erros transitórios (5xx, network, timeout). 4xx e
  // resposta válida sem shortUrl falham na primeira tentativa — re-tentar
  // credencial ruim ou bug de schema só queima cota da Amazon.
  let lastStatus = null
  for (let attempt = 0; attempt <= SHORTLINK_RETRY_BACKOFF_MS.length; attempt++) {
    try {
      const res = await axios.get('https://www.amazon.com.br/associates/sitestripe/getShortUrl', {
        params: { longUrl, marketplaceId: 'A2Q3Y263D00KWC', tag },
        headers: {
          'Cookie': cookieHeader,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://www.amazon.com.br/',
          'X-Requested-With': 'XMLHttpRequest',
        },
        timeout: 10000,
        validateStatus: () => true,
      })
      lastStatus = res.status

      const shortUrl = res.data?.shortUrl || res.data?.shortenedUrl || res.data?.url
      if (shortUrl && /amzn\.to|a\.co/.test(shortUrl)) {
        logger.info({ longUrl, shortUrl, attempt }, 'Amazon createShortLink: amzn.to gerado')
        return { shortUrl, transient: false }
      }

      if (res.status >= 500 && attempt < SHORTLINK_RETRY_BACKOFF_MS.length) {
        const wait = SHORTLINK_RETRY_BACKOFF_MS[attempt]
        logger.warn({ status: res.status, attempt, retryInMs: wait }, 'Amazon createShortLink: 5xx — retry')
        await sleep(wait)
        continue
      }

      logger.warn({
        status: res.status,
        attempt,
        rawBody: typeof res.data === 'string' ? res.data.slice(0, 500) : JSON.stringify(res.data).slice(0, 500),
        contentType: res.headers?.['content-type'],
      }, 'Amazon createShortLink: API respondeu sem shortUrl')
      return { shortUrl: null, transient: res.status >= 500 }
    } catch (err) {
      lastStatus = err.response?.status ?? null
      if (attempt < SHORTLINK_RETRY_BACKOFF_MS.length) {
        const wait = SHORTLINK_RETRY_BACKOFF_MS[attempt]
        logger.warn({ err: err.message, status: lastStatus, attempt, retryInMs: wait }, 'Amazon createShortLink: erro de rede — retry')
        await sleep(wait)
        continue
      }
      logger.warn({ err: err.message, status: lastStatus, attempt }, 'Amazon createShortLink: erro na chamada API')
      return { shortUrl: null, transient: true }
    }
  }
  return { shortUrl: null, transient: lastStatus == null || lastStatus >= 500 }
}

function withAffiliateTag(target, tag) {
  const u = new URL(target)
  u.searchParams.set('tag', tag)
  return u.toString()
}

async function convertStoreUrlWithoutAsin(target, tag, creds, hasCookies) {
  const longUrl = withAffiliateTag(target, tag)
  if (hasCookies) {
    const { shortUrl, transient } = await createAmazonShortLink(longUrl, tag, creds)
    if (shortUrl) return shortUrl
    logger.warn({ target, longUrl, transient }, 'Amazon: API não retornou shortUrl para link sem ASIN — fallback para ?tag=')
    return { url: longUrl, warning: transient ? null : 'amazon_cookies_expired' }
  }
  return longUrl
}

function buildLongUrl(target, asin) {
  try {
    const pathname = new URL(target).pathname
    if (/\/[^/]+\/dp\/[A-Z0-9]{10}/i.test(pathname)) {
      const cleanPathname = pathname.replace(/\/dp\/[A-Z0-9]{10}.*/i, `/dp/${asin}`)
      return `https://www.amazon.com.br${cleanPathname}`
    }
  } catch {}
  return `https://www.amazon.com.br/dp/${asin}`
}

export async function convert(url, creds) {
  const { tag } = creds
  const hasCookies = !!buildCookieHeader(creds)

  try {
    if (!AMAZON_HOST.test(new URL(url).hostname)) return null

    let target = url
    if (SHORT_HOST.test(url)) {
      // Resolvedor robusto PRIMEIRO: atravessa o interstitial do amzn.la
      // (redirect via JS/meta) e também segue o redirect HTTP do amzn.to. Bater
      // no axios antes fazia DOIS hits rápidos no encurtador no caminho feliz —
      // o segundo hit do amzn.la era barrado pelo anti-bot, o robusto voltava
      // sem ASIN e a conversão falhava (enquanto o scrape, com 1 hit só,
      // funcionava). O axios fica como fallback só quando o robusto não acha o
      // ASIN, preservando o hit único no caso comum.
      target = await resolveAmazonShortLink(url)
      if (!extractAsin(target)) {
        const viaAxios = await resolveShortUrl(url)
        if (extractAsin(viaAxios)) target = viaAxios
      }
    }

    const asin = extractAsin(target)
    if (!asin) {
      // Cupom/oferta sem ASIN: o afiliado Amazon credita com `?tag=` em QUALQUER
      // URL amazon.com.br, então (com a conversão de cupom ligada) anexamos a
      // tag à URL resolvida em vez de descartar. Só quando o target já está num
      // host Amazon REAL — não no encurtador não-resolvido, onde a tag não
      // gruda em nada útil. Com cookies válidos do SiteStripe, tentamos gerar
      // amzn.to também para Prime/cupons; se falhar, o fallback ?tag= credita.
      if (shouldConvertCouponLinks() && tag && AMAZON_STORE_HOST.test(new URL(target).hostname)) {
        return await convertStoreUrlWithoutAsin(target, tag, creds, hasCookies)
      }
      logger.warn({ url, target }, 'Amazon: ASIN não encontrado, abortando para evitar link malformado')
      return null
    }

    const longUrl = buildLongUrl(target, asin)

    if (hasCookies) {
      const { shortUrl, transient } = await createAmazonShortLink(longUrl, tag, creds)
      if (shortUrl) return shortUrl
      // Cookies sitestripe expiram (~14-30d) e a API retorna 4xx. Antes
      // descartávamos a oferta nesse caso, mas o link longo ?tag= credita
      // comissão normalmente (só a tag é obrigatória). Entregar com link
      // longo é sempre melhor que perder a oferta — o usuário só precisa
      // renovar os cookies pra voltar a gerar amzn.to. Em 4xx (não
      // transient) sinalizamos `cookies_expired` pro painel avisar a
      // cliente; 5xx é instabilidade do lado da Amazon e não pede ação.
      logger.warn({ url, longUrl, transient }, 'Amazon: API não retornou shortUrl — fallback para ?tag=')
      return { url: `${longUrl}?tag=${tag}`, warning: transient ? null : 'amazon_cookies_expired' }
    }

    return `${longUrl}?tag=${tag}`
  } catch {
    return null
  }
}
