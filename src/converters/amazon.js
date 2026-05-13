import axios from 'axios'
import logger from '../logger.js'

const ASIN_RE = /(?:\/dp\/|\/gp\/product\/|\/product-reviews\/|\/exec\/obidos\/ASIN\/)([A-Z0-9]{10})/i
const AMAZON_HOST = /amazon\.com\.br|amzn\.to|a\.co|amzn\.divulgador\.link/
const SHORT_HOST = /amzn\.to|a\.co|amzn\.divulgador\.link/

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

async function createAmazonShortLink(longUrl, tag, creds) {
  const cookieHeader = buildCookieHeader(creds)
  if (!cookieHeader) {
    logger.warn('Amazon createShortLink: cookies vazios, pulando chamada API')
    return null
  }

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

    const shortUrl = res.data?.shortUrl || res.data?.shortenedUrl || res.data?.url
    if (shortUrl && /amzn\.to|a\.co/.test(shortUrl)) {
      logger.info({ longUrl, shortUrl }, 'Amazon createShortLink: amzn.to gerado')
      return shortUrl
    }

    logger.warn({
      status: res.status,
      rawBody: typeof res.data === 'string' ? res.data.slice(0, 500) : JSON.stringify(res.data).slice(0, 500),
      contentType: res.headers?.['content-type'],
    }, 'Amazon createShortLink: API respondeu sem shortUrl')
    return null
  } catch (err) {
    logger.warn({ err: err.message, status: err.response?.status }, 'Amazon createShortLink: erro na chamada API')
    return null
  }
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

    const longUrl = `https://www.amazon.com.br/dp/${asin}`

    if (hasCookies) {
      const shortUrl = await createAmazonShortLink(longUrl, tag, creds)
      if (shortUrl) return shortUrl
      logger.warn({ url, longUrl }, 'Amazon: API falhou — abortando (cookies preenchidos, fallback ?tag desativado)')
      return null
    }

    return `${longUrl}?tag=${tag}`
  } catch {
    return null
  }
}
