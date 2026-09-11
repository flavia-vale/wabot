import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALIEXPRESS_CONVERSION_ERROR,
  buildAliExpressPortalUrl,
  convert,
  extractAliExpressProductId,
  isAliExpressUrl,
  resolveAliExpressUrl,
  stripAliExpressTracking,
} from '../src/converters/aliexpress.js'

const credentials = { cookie: 'xman_us_f=x_l=1; ali_apache_id=session-value' }

function jsonResponse(body) {
  return { ok: true, async json() { return body } }
}

function apiPayload(url) {
  return { code: '00', data: { shortLink: url }, success: true }
}

test('reconhece hosts oficiais e recusa domínios sósia/credenciais embutidas/http', () => {
  assert.equal(isAliExpressUrl('https://pt.aliexpress.com/item/1005001234567890.html'), true)
  assert.equal(isAliExpressUrl('https://a.aliexpress.com/_mAbCd'), true)
  assert.equal(isAliExpressUrl('https://aliexpress.com.evil.test/item/1005001234567890.html'), false)
  assert.equal(isAliExpressUrl('https://user:pass@aliexpress.com/item/1005001234567890.html'), false)
  assert.equal(isAliExpressUrl('http://aliexpress.com/item/1005001234567890.html'), false)
})

test('extrai item id de path, query e valor codificado', () => {
  assert.equal(extractAliExpressProductId('https://pt.aliexpress.com/item/1005001234567890.html'), '1005001234567890')
  assert.equal(extractAliExpressProductId('https://aliexpress.com/x?productId=1005009999999999'), '1005009999999999')
  assert.equal(extractAliExpressProductId('https://aliexpress.com/ssr/x?productIds=1005010564956854'), '1005010564956854')
  assert.equal(extractAliExpressProductId(encodeURIComponent('https://aliexpress.com/item/1005007777777777.html')), '1005007777777777')
})

test('remove identidade do afiliado de origem, utm e fragmento sem trocar o produto', () => {
  const result = stripAliExpressTracking('https://pt.aliexpress.com/item/1005001234567890.html?aff_fcid=third&aff_trace_key=secret&utm_source=other&sku=red#frag')
  assert.equal(result, 'https://pt.aliexpress.com/item/1005001234567890.html?sku=red')
})

test('monta exatamente a chamada observada no portal, com targetUrl codificada', () => {
  const source = 'https://www.aliexpress.com/ssr/x?productIds=1005010564956854&sku=azul'
  const request = new URL(buildAliExpressPortalUrl(source))
  assert.equal(request.origin, 'https://portals.aliexpress.com')
  assert.equal(request.pathname, '/tools/linkGenerate/generatePromotionLinkV2.htm')
  assert.equal(request.searchParams.get('shipTos'), 'BR')
  assert.equal(request.searchParams.get('trackId'), 'default')
  assert.equal(request.searchParams.get('targetUrl'), source)
})

test('happy path: limpa link de terceiro e publica somente URL oficial devolvida pela API', async () => {
  let requestUrl
  let requestOptions
  const result = await convert(
    'https://pt.aliexpress.com/item/1005001234567890.html?aff_fcid=third&utm_source=third&sku=red',
    credentials,
    { fetchImpl: async (url, options) => { requestUrl = new URL(url); requestOptions = options; return jsonResponse(apiPayload('https://s.click.aliexpress.com/e/_ourLink')) } },
  )
  assert.deepEqual(result, { url: 'https://s.click.aliexpress.com/e/_ourLink', linkKind: 'product' })
  assert.equal(requestUrl.searchParams.get('targetUrl'), 'https://pt.aliexpress.com/item/1005001234567890.html?sku=red')
  assert.equal(requestUrl.searchParams.get('trackId'), 'default')
  assert.equal(requestOptions.method, 'GET')
  assert.equal(requestOptions.headers.Cookie, credentials.cookie)
  assert.doesNotMatch(requestUrl.toString(), /session-value/)
})

test('short link resolve apenas dentro de hosts oficiais antes de gerar', async () => {
  const calls = []
  const result = await convert('https://a.aliexpress.com/_mAbCd', credentials, {
    fetchImpl: async (url, options) => {
      calls.push(String(url))
      if (options.redirect === 'manual') return { headers: { get: key => key === 'location' ? 'https://pt.aliexpress.com/item/1005002222222222.html?aff_fcid=third' : null } }
      return jsonResponse(apiPayload('https://s.click.aliexpress.com/e/_ours'))
    },
  })
  assert.equal(result.linkKind, 'product')
  assert.equal(calls.length, 2)
})

test('redirect para domínio externo falha fechado e a API nunca é chamada', async () => {
  let calls = 0
  await assert.rejects(
    resolveAliExpressUrl('https://a.aliexpress.com/_mAbCd', {
      fetchImpl: async () => { calls++; return { headers: { get: () => 'https://evil.test/steal' } } },
    }),
    error => error.code === ALIEXPRESS_CONVERSION_ERROR.RESOLUTION_FAILED && error.stripFromMessage === true,
  )
  assert.equal(calls, 1)
})

test('resposta com URL maliciosa ou JSON inválido falha fechado', async () => {
  await assert.rejects(
    convert('https://aliexpress.com/item/1005001234567890.html', credentials, { fetchImpl: async () => jsonResponse(apiPayload('https://aliexpress.com.evil.test/x')) }),
    error => error.code === ALIEXPRESS_CONVERSION_ERROR.INVALID_RESPONSE,
  )
  await assert.rejects(
    convert('https://aliexpress.com/item/1005001234567890.html', credentials, { fetchImpl: async () => ({ ok: true, async json() { throw new Error('bad json') } }) }),
    error => error.code === ALIEXPRESS_CONVERSION_ERROR.INVALID_RESPONSE,
  )
})

test('sem código de acesso nunca chama rede nem publica original', async () => {
  let called = false
  assert.equal(await convert('https://aliexpress.com/item/1005001234567890.html', {}, { fetchImpl: async () => { called = true } }), null)
  assert.equal(called, false)
})

test('aceita exportação JSON do Cookie-Editor e nunca a coloca na URL', async () => {
  const cookieJson = JSON.stringify([{ name: 'session', value: 'very-secret', domain: '.aliexpress.com' }])
  let requestUrl
  let sentCookie
  await convert('https://aliexpress.com/item/1005001234567890.html', { cookie: cookieJson }, {
    fetchImpl: async (url, options) => {
      requestUrl = String(url)
      sentCookie = options.headers.Cookie
      return jsonResponse(apiPayload('https://s.click.aliexpress.com/e/_ours'))
    },
  })
  assert.equal(sentCookie, 'session=very-secret')
  assert.doesNotMatch(requestUrl, /very-secret|session%3D/)
})

test('sessão recusada recebe classificação própria e nunca publica original', async () => {
  await assert.rejects(
    convert('https://aliexpress.com/item/1005001234567890.html', credentials, {
      fetchImpl: async () => jsonResponse({ code: '12', data: null, success: false }),
    }),
    error => error.code === ALIEXPRESS_CONVERSION_ERROR.SESSION_REJECTED,
  )
})

test('campanha converte como coupon via API, nunca por reescrita local', async () => {
  const result = await convert('https://pt.aliexpress.com/w/wholesale-sale.html?aff_fcid=third', credentials, {
    fetchImpl: async () => jsonResponse(apiPayload('https://s.click.aliexpress.com/e/_campaign')),
  })
  assert.equal(result.linkKind, 'coupon')
  assert.equal(result.url, 'https://s.click.aliexpress.com/e/_campaign')
})

test('caso real SSR/productIds usa o endpoint do portal e reconhece produto', async () => {
  const original = 'https://www.aliexpress.com/ssr/300001995/N3KsYt2f3a?spm=a2g0o.best.3fornn.1.24972c256xSeys&disableNav=YES&pha_manifest=ssr&_immersiveMode=true&productIds=1005010564956854'
  let calledUrl
  const result = await convert(original, credentials, {
    fetchImpl: async (url) => {
      calledUrl = new URL(url)
      return jsonResponse(apiPayload('https://s.click.aliexpress.com/e/_c2zl8sq9'))
    },
  })
  assert.deepEqual(result, { url: 'https://s.click.aliexpress.com/e/_c2zl8sq9', linkKind: 'product' })
  const target = new URL(calledUrl.searchParams.get('targetUrl'))
  assert.equal(target.searchParams.get('productIds'), '1005010564956854')
  assert.equal(target.searchParams.has('spm'), false)
})
