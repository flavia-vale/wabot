import { normalizeAmazonCookie as normalizeCookieExport } from './amazon.js'

// Caminho observado no próprio Gerador de Links do portal brasileiro. Ele usa
// a sessão já autenticada da afiliada e NÃO pede App Key/App Secret/ID: o
// `trackId=default` pertence à conta carregada pelo cookie do portal.
const GENERATE_URL = 'https://portals.aliexpress.com/tools/linkGenerate/generatePromotionLinkV2.htm'
const PORTAL_REFERER = 'https://portals.aliexpress.com/tools/linkGenerate.htm'
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const MAX_HOPS = 6
const TOTAL_TIMEOUT_MS = 8000

const ALIEXPRESS_DOMAINS = ['aliexpress.com', 'aliexpress.us']
const SHORT_HOSTS = new Set(['a.aliexpress.com', 's.click.aliexpress.com'])
const PRODUCT_RE = /(?:\/item\/|[?&](?:productIds?|itemId)=)(\d{6,})/i
const TRACKING_KEYS = new Set([
  'aff_fcid', 'aff_fsk', 'aff_platform', 'aff_trace_key', 'terminal_id',
  'af', 'cv', 'dp', 'src', 'spm', 'pdp_ext_f', 'gatewayadapt',
])

export class AliExpressConversionError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'AliExpressConversionError'
    this.code = code
    this.stripFromMessage = true
  }
}

export const ALIEXPRESS_CONVERSION_ERROR = Object.freeze({
  INVALID_URL: 'aliexpress_invalid_url',
  RESOLUTION_FAILED: 'aliexpress_resolution_failed',
  API_REJECTED: 'aliexpress_api_rejected',
  INVALID_RESPONSE: 'aliexpress_invalid_response',
  SESSION_REJECTED: 'aliexpress_session_rejected',
})

export function describeAliExpressConversionError(code) {
  if (code === ALIEXPRESS_CONVERSION_ERROR.RESOLUTION_FAILED) return 'A AliExpress não respondeu a tempo para conferir esse link.'
  if (code === ALIEXPRESS_CONVERSION_ERROR.API_REJECTED) return 'A AliExpress recusou a geração do link de afiliado.'
  if (code === ALIEXPRESS_CONVERSION_ERROR.INVALID_RESPONSE) return 'A AliExpress não devolveu um link de afiliado válido.'
  if (code === ALIEXPRESS_CONVERSION_ERROR.SESSION_REJECTED) return 'A AliExpress não aceitou o código de acesso. Entre novamente no portal e copie um código novo.'
  return 'Esse endereço não é um link válido da AliExpress.'
}

export function isAliExpressHostname(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '')
  return ALIEXPRESS_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`))
}

export function isAliExpressUrl(value) {
  try {
    const url = new URL(String(value || ''))
    return url.protocol === 'https:' && !url.username && !url.password && isAliExpressHostname(url.hostname)
  } catch {
    return false
  }
}

export function extractAliExpressProductId(value) {
  let text = String(value || '')
  for (let round = 0; round < 3; round++) {
    const match = text.match(PRODUCT_RE)
    if (match) return match[1]
    try {
      const decoded = decodeURIComponent(text)
      if (decoded === text) break
      text = decoded
    } catch { break }
  }
  return null
}

export function isAliExpressShortLink(value) {
  try { return SHORT_HOSTS.has(new URL(String(value || '')).hostname.toLowerCase()) } catch { return false }
}

// A API da AliExpress deve receber a identidade do recurso, nunca os carimbos
// do afiliado de origem. Preservamos parâmetros desconhecidos porque campanhas
// podem depender deles; removemos apenas a família documentada/observada de
// atribuição e todos os utm_*.
export function stripAliExpressTracking(value) {
  const url = new URL(String(value))
  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase()
    if (TRACKING_KEYS.has(lower) || lower.startsWith('utm_')) url.searchParams.delete(key)
  }
  url.hash = ''
  return url.toString()
}

function readLocation(response) {
  return response?.headers?.get?.('location') || response?.headers?.location || null
}

export async function resolveAliExpressUrl(value, { fetchImpl = globalThis.fetch, maxHops = MAX_HOPS, totalTimeoutMs = TOTAL_TIMEOUT_MS } = {}) {
  if (!isAliExpressUrl(value)) throw new AliExpressConversionError(ALIEXPRESS_CONVERSION_ERROR.INVALID_URL, 'invalid AliExpress URL')
  let current = new URL(String(value)).toString()
  if (!isAliExpressShortLink(current)) return current

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), totalTimeoutMs)
  const visited = new Set()
  try {
    for (let hop = 0; hop < maxHops; hop++) {
      if (visited.has(current)) break
      visited.add(current)
      let response
      try {
        response = await fetchImpl(current, { redirect: 'manual', signal: controller.signal })
      } catch {
        throw new AliExpressConversionError(ALIEXPRESS_CONVERSION_ERROR.RESOLUTION_FAILED, 'AliExpress short-link resolution failed')
      }
      const location = readLocation(response)
      if (!location) {
        if (!isAliExpressShortLink(current)) return current
        throw new AliExpressConversionError(ALIEXPRESS_CONVERSION_ERROR.RESOLUTION_FAILED, 'AliExpress short link did not redirect')
      }
      let next
      try { next = new URL(location, current).toString() } catch {
        throw new AliExpressConversionError(ALIEXPRESS_CONVERSION_ERROR.RESOLUTION_FAILED, 'AliExpress returned an invalid redirect')
      }
      if (!isAliExpressUrl(next)) {
        throw new AliExpressConversionError(ALIEXPRESS_CONVERSION_ERROR.RESOLUTION_FAILED, 'AliExpress redirect left trusted domains')
      }
      current = next
      if (!isAliExpressShortLink(current)) return current
    }
    throw new AliExpressConversionError(ALIEXPRESS_CONVERSION_ERROR.RESOLUTION_FAILED, 'AliExpress redirect limit reached')
  } finally {
    clearTimeout(timer)
  }
}

export function buildAliExpressPortalUrl(sourceUrl, { shipTo = 'BR', trackId = 'default' } = {}) {
  const requestUrl = new URL(GENERATE_URL)
  requestUrl.searchParams.set('shipTos', shipTo)
  requestUrl.searchParams.set('trackId', trackId)
  requestUrl.searchParams.set('targetUrl', sourceUrl)
  return requestUrl.toString()
}

export async function generateAliExpressLink(sourceUrl, credentials, { fetchImpl = globalThis.fetch, totalTimeoutMs = TOTAL_TIMEOUT_MS } = {}) {
  const cookie = normalizeCookieExport(credentials?.cookie).trim()
  if (!cookie) return null
  let response
  try {
    response = await fetchImpl(buildAliExpressPortalUrl(sourceUrl), {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        Cookie: cookie,
        Referer: PORTAL_REFERER,
        'User-Agent': BROWSER_UA,
        'X-Requested-With': 'XMLHttpRequest',
      },
      signal: AbortSignal.timeout(totalTimeoutMs),
    })
  } catch {
    throw new AliExpressConversionError(ALIEXPRESS_CONVERSION_ERROR.API_REJECTED, 'AliExpress link generator unavailable')
  }
  if (!response?.ok) {
    const code = response?.status === 401 || response?.status === 403
      ? ALIEXPRESS_CONVERSION_ERROR.SESSION_REJECTED
      : ALIEXPRESS_CONVERSION_ERROR.API_REJECTED
    throw new AliExpressConversionError(code, 'AliExpress link generator rejected the request')
  }
  let payload
  try { payload = await response.json() } catch {
    throw new AliExpressConversionError(ALIEXPRESS_CONVERSION_ERROR.INVALID_RESPONSE, 'AliExpress link generator returned invalid JSON')
  }
  if (payload?.success !== true || payload?.code !== '00') {
    throw new AliExpressConversionError(ALIEXPRESS_CONVERSION_ERROR.SESSION_REJECTED, 'AliExpress session was not accepted')
  }
  const promotionUrl = payload?.data?.shortLink
  if (typeof promotionUrl !== 'string' || !isAliExpressUrl(promotionUrl)) {
    throw new AliExpressConversionError(ALIEXPRESS_CONVERSION_ERROR.INVALID_RESPONSE, 'AliExpress link generator returned an untrusted URL')
  }
  return promotionUrl
}

export async function convert(value, credentials, options = {}) {
  if (!credentials?.cookie) return null
  const totalTimeoutMs = Number(options.totalTimeoutMs) > 0 ? Number(options.totalTimeoutMs) : TOTAL_TIMEOUT_MS
  const deadlineAt = Date.now() + totalTimeoutMs
  const resolved = await resolveAliExpressUrl(value, { ...options, totalTimeoutMs })
  const clean = stripAliExpressTracking(resolved)
  const remainingMs = deadlineAt - Date.now()
  if (remainingMs <= 0) throw new AliExpressConversionError(ALIEXPRESS_CONVERSION_ERROR.API_REJECTED, 'AliExpress conversion deadline reached')
  const converted = await generateAliExpressLink(clean, credentials, { ...options, totalTimeoutMs: remainingMs })
  return { url: converted, linkKind: extractAliExpressProductId(clean) ? 'product' : 'coupon' }
}
