import {
  getProxyUrl,
  getProxyRequestHeaders,
  getProxyResponseHeaders,
} from '../../api/[...path]/route.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

async function proxyShortlink(request) {
  try {
    const upstreamResponse = await fetch(getProxyUrl(request), {
      method: 'GET',
      headers: getProxyRequestHeaders(request),
      redirect: 'manual',
    })

    return new Response(null, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: getProxyResponseHeaders(upstreamResponse),
    })
  } catch {
    return new Response('Shortlink indisponível', { status: 502 })
  }
}

export const GET = proxyShortlink
export const HEAD = proxyShortlink
