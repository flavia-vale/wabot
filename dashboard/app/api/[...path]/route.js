export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const apiPortByDashboardPort = {
  '3000': '3001',
  '3006': '3004',
}

const hopByHopHeaders = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

const noStoreHeaders = {
  'cache-control': 'private, no-cache, no-store, max-age=0, must-revalidate',
  pragma: 'no-cache',
  expires: '0',
}

function getHostPort(host = '') {
  const normalizedHost = String(host).trim()
  const portMatch = normalizedHost.match(/:(\d+)$/)
  return portMatch?.[1] || ''
}

export function getApiPort(request) {
  const hostPort = getHostPort(request.headers.get('host'))
  return apiPortByDashboardPort[hostPort] || process.env.API_PORT || '3001'
}

export function getProxyUrl(request) {
  const url = new URL(request.url)
  return `http://127.0.0.1:${getApiPort(request)}${url.pathname}${url.search}`
}

export function getProxyRequestHeaders(request) {
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase())) headers.set(key, value)
  })
  return headers
}

function applyNoStoreHeaders(headers) {
  Object.entries(noStoreHeaders).forEach(([key, value]) => headers.set(key, value))
  return headers
}

export function getProxyResponseHeaders(upstreamResponse) {
  const headers = new Headers()
  upstreamResponse.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase())) headers.set(key, value)
  })
  headers.set('x-wabot-api-proxy', 'next-dashboard')
  return applyNoStoreHeaders(headers)
}

async function proxyApiRequest(request) {
  const method = request.method.toUpperCase()
  const hasBody = method !== 'GET' && method !== 'HEAD'

  try {
    const upstreamResponse = await fetch(getProxyUrl(request), {
      method,
      headers: getProxyRequestHeaders(request),
      body: hasBody ? request.body : undefined,
      duplex: hasBody ? 'half' : undefined,
      redirect: 'manual',
    })

    return new Response(method === 'HEAD' ? null : upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: getProxyResponseHeaders(upstreamResponse),
    })
  } catch (err) {
    const headers = applyNoStoreHeaders(new Headers({
      'content-type': 'application/json; charset=utf-8',
      'x-wabot-api-proxy': 'next-dashboard',
      'x-wabot-api-proxy-error': 'upstream-unreachable',
    }))

    return new Response(JSON.stringify({
      error: 'API indisponível no momento. Tente novamente em instantes.',
      code: 'API_PROXY_UPSTREAM_UNREACHABLE',
    }), {
      status: 502,
      statusText: 'Bad Gateway',
      headers,
    })
  }
}

export const GET = proxyApiRequest
export const POST = proxyApiRequest
export const PUT = proxyApiRequest
export const PATCH = proxyApiRequest
export const DELETE = proxyApiRequest
export const HEAD = proxyApiRequest
export const OPTIONS = proxyApiRequest
