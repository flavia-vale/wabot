import axios from 'axios'
import logger from '../logger.js'

const ASIN_RE = /(?:\/dp\/|\/gp\/product\/|\/product-reviews\/|\/exec\/obidos\/ASIN\/)([A-Z0-9]{10})/i
const AMAZON_HOST = /amazon\.com\.br|amzn\.to|amzn\.la|a\.co|amzn\.divulgador\.link|amzlink\.to/
const SHORT_HOST = /amzn\.to|amzn\.la|a\.co|amzn\.divulgador\.link|amzlink\.to/

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
    if (SHORT_HOST.test(url)) target = await resolveShortUrl(url)

    const asin = extractAsin(target)
    if (!asin) {
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
