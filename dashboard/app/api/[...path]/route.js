export const runtime = 'nodejs'

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

function getHostPort(host = '') {
  const normalizedHost = String(host).trim()
  const portMatch = normalizedHost.match(/:(\d+)$/)
  return portMatch?.[1] || ''
}

function getApiPort(request) {
  const hostPort = getHostPort(request.headers.get('host'))
  return apiPortByDashboardPort[hostPort] || process.env.API_PORT || '3001'
}

function getProxyUrl(request) {
  const url = new URL(request.url)
  return `http://127.0.0.1:${getApiPort(request)}${url.pathname}${url.search}`
}

function getProxyRequestHeaders(request) {
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase())) headers.set(key, value)
  })
  return headers
}

function getProxyResponseHeaders(upstreamResponse) {
  const headers = new Headers()
  upstreamResponse.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase())) headers.set(key, value)
  })
  headers.set('x-wabot-api-proxy', 'next-dashboard')
  return headers
}

async function proxyApiRequest(request) {
  const method = request.method.toUpperCase()
  const hasBody = method !== 'GET' && method !== 'HEAD'
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
}

export const GET = proxyApiRequest
export const POST = proxyApiRequest
export const PUT = proxyApiRequest
export const PATCH = proxyApiRequest
export const DELETE = proxyApiRequest
export const HEAD = proxyApiRequest
export const OPTIONS = proxyApiRequest
