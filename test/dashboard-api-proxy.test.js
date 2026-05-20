import test from 'node:test'
import assert from 'node:assert/strict'

import { getApiPort, getProxyResponseHeaders, getProxyUrl, POST } from '../dashboard/app/api/[...path]/route.js'

function makeRequest(url, headers = {}) {
  return new Request(url, { method: 'POST', headers })
}

test('proxy do dashboard roteia porta visual 3006 para API staging 3004', () => {
  const req = makeRequest('http://178.105.54.0:3006/api/auth/login?x=1', { host: '178.105.54.0:3006' })

  assert.equal(getApiPort(req), '3004')
  assert.equal(getProxyUrl(req), 'http://127.0.0.1:3004/api/auth/login?x=1')
})

test('proxy do dashboard roteia porta visual 3000 para API produção 3001', () => {
  const req = makeRequest('http://espelhagrupos.com.br:3000/api/auth/login', { host: 'espelhagrupos.com.br:3000' })

  assert.equal(getApiPort(req), '3001')
  assert.equal(getProxyUrl(req), 'http://127.0.0.1:3001/api/auth/login')
})

test('proxy remove headers hop-by-hop e força no-store nas respostas de API', () => {
  const upstream = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      connection: 'keep-alive',
      'transfer-encoding': 'chunked',
    },
  })

  const headers = getProxyResponseHeaders(upstream)

  assert.equal(headers.get('content-type'), 'application/json')
  assert.equal(headers.get('connection'), null)
  assert.equal(headers.get('transfer-encoding'), null)
  assert.equal(headers.get('x-wabot-api-proxy'), 'next-dashboard')
  assert.equal(headers.get('cache-control'), 'private, no-cache, no-store, max-age=0, must-revalidate')
})

test('proxy responde 502 JSON, não 404 HTML do Next, quando upstream está indisponível', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
  })
  globalThis.fetch = async () => {
    throw new Error('ECONNREFUSED')
  }

  const res = await POST(makeRequest('http://178.105.54.0:3006/api/auth/login', { host: '178.105.54.0:3006' }))
  const body = await res.json()

  assert.equal(res.status, 502)
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8')
  assert.equal(res.headers.get('x-wabot-api-proxy'), 'next-dashboard')
  assert.equal(res.headers.get('x-wabot-api-proxy-error'), 'upstream-unreachable')
  assert.equal(body.code, 'API_PROXY_UPSTREAM_UNREACHABLE')
})
