import crypto from 'node:crypto'

const API_URL = 'https://api-sg.aliexpress.com/sync'
const METHOD = 'aliexpress.affiliate.link.generate'
const MAX_HOPS = 6
const TOTAL_TIMEOUT_MS = 8000

const ALIEXPRESS_DOMAINS = ['aliexpress.com', 'aliexpress.us']
const SHORT_HOSTS = new Set(['a.aliexpress.com', 's.click.aliexpress.com'])
const PRODUCT_RE = /(?:\/item\/|[?&](?:productId|itemId)=)(\d{6,})/i
const TRACKING_KEYS = new Set([
  'aff_fcid', 'aff_fsk', 'aff_platform', 'aff_trace_key', 'terminal_id',
  'af', 'cv', 'dp', 'src', 'pdp_ext_f', 'gatewayadapt',
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
})

export function describeAliExpressConversionError(code) {
  if (code === ALIEXPRESS_CONVERSION_ERROR.RESOLUTION_FAILED) return 'A AliExpress não respondeu a tempo para conferir esse link.'
  if (code === ALIEXPRESS_CONVERSION_ERROR.API_REJECTED) return 'A AliExpress recusou a geração do link de afiliado.'
  if (code === ALIEXPRESS_CONVERSION_ERROR.INVALID_RESPONSE) return 'A AliExpress não devolveu um link de afiliado válido.'
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

function timestamp(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

export function signAliExpressParams(params, appSecret) {
  const canonical = Object.keys(params).sort().map(key => `${key}${params[key]}`).join('')
  return crypto.createHmac('sha256', String(appSecret)).update(canonical).digest('hex').toUpperCase()
}

export function buildAliExpressApiRequest(sourceUrl, credentials, { now = new Date() } = {}) {
  const params = {
    app_key: String(credentials.appKey).trim(),
    method: METHOD,
    promotion_link_type: '0',
    sign_method: 'sha256',
    source_values: sourceUrl,
    timestamp: timestamp(now),
    tracking_id: String(credentials.trackingId).trim(),
    v: '2.0',
  }
  params.sign = signAliExpressParams(params, credentials.appSecret)
  return params
}

function findPromotionUrl(payload) {
  const result = payload?.aliexpress_affiliate_link_generate_response?.resp_result?.result
    ?? payload?.resp_result?.result
    ?? payload?.result
  const links = result?.promotion_links?.promotion_link ?? result?.promotion_links ?? result?.promotionLinks
  const first = Array.isArray(links) ? links[0] : links
  return first?.promotion_link ?? first?.promotionLink ?? first?.url ?? null
}

export async function generateAliExpressLink(sourceUrl, credentials, { fetchImpl = globalThis.fetch, now } = {}) {
  const params = buildAliExpressApiRequest(sourceUrl, credentials, { now })
  let response
  try {
    response = await fetchImpl(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(TOTAL_TIMEOUT_MS),
    })
  } catch {
    throw new AliExpressConversionError(ALIEXPRESS_CONVERSION_ERROR.API_REJECTED, 'AliExpress affiliate API unavailable')
  }
  if (!response?.ok) throw new AliExpressConversionError(ALIEXPRESS_CONVERSION_ERROR.API_REJECTED, 'AliExpress affiliate API rejected the request')
  let payload
  try { payload = await response.json() } catch {
    throw new AliExpressConversionError(ALIEXPRESS_CONVERSION_ERROR.INVALID_RESPONSE, 'AliExpress affiliate API returned invalid JSON')
  }
  const promotionUrl = findPromotionUrl(payload)
  if (typeof promotionUrl !== 'string' || !isAliExpressUrl(promotionUrl)) {
    throw new AliExpressConversionError(ALIEXPRESS_CONVERSION_ERROR.INVALID_RESPONSE, 'AliExpress affiliate API returned an untrusted URL')
  }
  return promotionUrl
}

export async function convert(value, credentials, options = {}) {
  if (!credentials?.appKey || !credentials?.appSecret || !credentials?.trackingId) return null
  const resolved = await resolveAliExpressUrl(value, options)
  const clean = stripAliExpressTracking(resolved)
  const converted = await generateAliExpressLink(clean, credentials, options)
  return { url: converted, linkKind: extractAliExpressProductId(clean) ? 'product' : 'coupon' }
}

