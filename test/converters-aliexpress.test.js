import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALIEXPRESS_CONVERSION_ERROR,
  buildAliExpressApiRequest,
  convert,
  extractAliExpressProductId,
  isAliExpressUrl,
  resolveAliExpressUrl,
  signAliExpressParams,
  stripAliExpressTracking,
} from '../src/converters/aliexpress.js'

const credentials = { appKey: '123456', appSecret: 'a-secret-with-enough-characters', trackingId: 'espelha' }

function jsonResponse(body) {
  return { ok: true, async json() { return body } }
}

function apiPayload(url) {
  return {
    aliexpress_affiliate_link_generate_response: {
      resp_result: { result: { promotion_links: { promotion_link: [{ promotion_link: url }] } } },
    },
  }
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
  assert.equal(extractAliExpressProductId(encodeURIComponent('https://aliexpress.com/item/1005007777777777.html')), '1005007777777777')
})

test('remove identidade do afiliado de origem, utm e fragmento sem trocar o produto', () => {
  const result = stripAliExpressTracking('https://pt.aliexpress.com/item/1005001234567890.html?aff_fcid=third&aff_trace_key=secret&utm_source=other&sku=red#frag')
  assert.equal(result, 'https://pt.aliexpress.com/item/1005001234567890.html?sku=red')
})

test('assinatura é determinística, maiúscula e não inclui o próprio sign', () => {
  const params = { b: '2', a: '1' }
  assert.equal(signAliExpressParams(params, 'secret'), signAliExpressParams({ a: '1', b: '2' }, 'secret'))
  assert.match(signAliExpressParams(params, 'secret'), /^[A-F0-9]{64}$/)
  const request = buildAliExpressApiRequest('https://aliexpress.com/item/1005001234567890.html', credentials, { now: new Date('2026-09-10T12:34:56Z') })
  assert.equal(request.method, 'aliexpress.affiliate.link.generate')
  assert.equal(request.timestamp, '2026-09-10 12:34:56')
  assert.equal(request.tracking_id, 'espelha')
  assert.match(request.sign, /^[A-F0-9]{64}$/)
})

test('happy path: limpa link de terceiro e publica somente URL oficial devolvida pela API', async () => {
  let body
  const result = await convert(
    'https://pt.aliexpress.com/item/1005001234567890.html?aff_fcid=third&utm_source=third&sku=red',
    credentials,
    { fetchImpl: async (_url, options) => { body = new URLSearchParams(options.body); return jsonResponse(apiPayload('https://s.click.aliexpress.com/e/_ourLink')) } },
  )
  assert.deepEqual(result, { url: 'https://s.click.aliexpress.com/e/_ourLink', linkKind: 'product' })
  assert.equal(body.get('source_values'), 'https://pt.aliexpress.com/item/1005001234567890.html?sku=red')
  assert.equal(body.get('tracking_id'), 'espelha')
  assert.equal(body.has('app_secret'), false)
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

test('sem os três dados obrigatórios nunca chama rede nem publica original', async () => {
  let called = false
  assert.equal(await convert('https://aliexpress.com/item/1005001234567890.html', { appKey: '1' }, { fetchImpl: async () => { called = true } }), null)
  assert.equal(called, false)
})

test('campanha converte como coupon via API, nunca por reescrita local', async () => {
  const result = await convert('https://pt.aliexpress.com/w/wholesale-sale.html?aff_fcid=third', credentials, {
    fetchImpl: async () => jsonResponse(apiPayload('https://s.click.aliexpress.com/e/_campaign')),
  })
  assert.equal(result.linkKind, 'coupon')
  assert.equal(result.url, 'https://s.click.aliexpress.com/e/_campaign')
})

