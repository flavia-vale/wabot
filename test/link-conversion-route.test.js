import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { linkConversionRoutes } from '../src/api/routes/linkConversion.js'

let counter = 0

async function buildApp({ userId, converter, fetchProductInfo, credentials = [], routeOptions = {} } = {}) {
  const app = Fastify({ logger: false })
  const effectiveUserId = userId || `link-conversion-user-${++counter}`
  app.decorate('authenticate', async (req) => { req.user = { sub: effectiveUserId } })
  await app.register(linkConversionRoutes, {
    prefix: '/api/link-conversion',
    converter,
    fetchProductInfo,
    findCredentials: async () => credentials,
    ...routeOptions,
  })
  return { app, userId: effectiveUserId }
}

function credential(platform = 'amazon', data = { tag: 'botinho-20', 'ubid-acbbr': 'ubid-cookie-value', 'at-acbbr': 'at-cookie-value', 'x-acbbr': 'x-cookie-value' }) {
  return { platform, data: JSON.stringify(data) }
}

test('POST /convert converte um link com credenciais do usuário', async (t) => {
  const userId = `link-conversion-user-${++counter}`
  let calls = 0
  const { app } = await buildApp({
    userId,
    credentials: [credential()],
    converter: async (platform, url, credentials) => {
      calls += 1
      assert.equal(platform, 'amazon')
      assert.equal(url, 'https://www.amazon.com.br/dp/B09VQ39F41')
      assert.equal(credentials.amazon.tag, 'botinho-20')
      return 'https://www.amazon.com.br/dp/B09VQ39F41?tag=botinho-20'
    },
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({
    method: 'POST',
    url: '/api/link-conversion/convert',
    payload: { text: 'Oferta: https://www.amazon.com.br/dp/B09VQ39F41' },
  })

  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.count, 1)
  assert.equal(body.results.length, 1)
  assert.equal(body.results[0].status, 'converted')
  assert.equal(body.results[0].convertedUrl, 'https://www.amazon.com.br/dp/B09VQ39F41?tag=botinho-20')
  assert.equal(calls, 1)
})

test('POST /convert rejeita mais de 10 links com mensagem explicativa', async (t) => {
  const { app } = await buildApp({ converter: async () => 'never' })
  t.after(async () => { await app.close() })
  const links = Array.from({ length: 11 }, (_, index) => `https://www.amazon.com.br/dp/B09VQ39F4${index}`).join('\n')

  const res = await app.inject({ method: 'POST', url: '/api/link-conversion/convert', payload: { text: links } })

  assert.equal(res.statusCode, 400)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'LINK_CONVERSION_LIMIT_EXCEEDED')
  assert.match(body.error, /máximo 10 links/i)
  assert.equal(body.count, 11)
  assert.equal(body.max, 10)
})

test('POST /convert retorna erro por item quando faltam credenciais', async (t) => {
  let calls = 0
  const { app } = await buildApp({ converter: async () => { calls += 1; return 'never' } })
  t.after(async () => { await app.close() })

  const res = await app.inject({
    method: 'POST',
    url: '/api/link-conversion/convert',
    payload: { text: 'https://www.amazon.com.br/dp/B09VQ39F41' },
  })

  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.results[0].status, 'error')
  assert.equal(body.results[0].code, 'MISSING_CREDENTIALS')
  assert.match(body.results[0].error, /Credenciais de Amazon ausentes/i)
  assert.equal(calls, 0)
})

test('POST /convert mantém lote vivo quando conversor lança erro', async (t) => {
  const userId = `link-conversion-user-${++counter}`
  const { app } = await buildApp({
    userId,
    credentials: [credential('magazineluiza', { tag: 'parceira' })],
    converter: async () => { throw new Error('serviço externo indisponível') },
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({
    method: 'POST',
    url: '/api/link-conversion/convert',
    payload: { text: 'https://www.magazineluiza.com.br/produto/p/abc123' },
  })

  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.results[0].status, 'error')
  assert.equal(body.results[0].code, 'CONVERSION_FAILED')
  assert.match(body.results[0].error, /serviço externo indisponível/i)
})


test('POST /convert rejeita texto grande antes de detectar links', async (t) => {
  const { app } = await buildApp({ routeOptions: { maxTextLength: 40 } })
  t.after(async () => { await app.close() })

  const res = await app.inject({
    method: 'POST',
    url: '/api/link-conversion/convert',
    payload: { text: `https://www.amazon.com.br/dp/B09VQ39F41 ${'x'.repeat(80)}` },
  })

  assert.equal(res.statusCode, 413)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'LINK_CONVERSION_TEXT_TOO_LARGE')
  assert.equal(body.maxLength, 40)
})

test('POST /convert limita frequência por usuário para proteger operação', async (t) => {
  const { app } = await buildApp({
    credentials: [credential()],
    routeOptions: { maxRequestsPerWindow: 2, rateLimitWindowMs: 60_000 },
    converter: async () => 'https://www.amazon.com.br/dp/B09VQ39F41?tag=botinho-20',
  })
  t.after(async () => { await app.close() })

  const payload = { text: 'https://www.amazon.com.br/dp/B09VQ39F41' }
  assert.equal((await app.inject({ method: 'POST', url: '/api/link-conversion/convert', payload })).statusCode, 200)
  assert.equal((await app.inject({ method: 'POST', url: '/api/link-conversion/convert', payload })).statusCode, 200)
  const blocked = await app.inject({ method: 'POST', url: '/api/link-conversion/convert', payload })

  assert.equal(blocked.statusCode, 429)
  const body = JSON.parse(blocked.body)
  assert.equal(body.code, 'LINK_CONVERSION_RATE_LIMITED')
  assert.equal(blocked.headers['retry-after'], '60')
})

test('POST /convert bloqueia lote concorrente do mesmo usuário', async (t) => {
  let releaseFirst
  const firstStarted = new Promise(resolve => {
    const waitForRelease = new Promise(release => { releaseFirst = release })
    resolve(waitForRelease)
  })
  const { app } = await buildApp({
    userId: `link-conversion-user-${++counter}`,
    credentials: [credential()],
    converter: async () => {
      const waitForRelease = await firstStarted
      await waitForRelease
      return 'https://www.amazon.com.br/dp/B09VQ39F41?tag=botinho-20'
    },
  })
  t.after(async () => { await app.close() })

  const payload = { text: 'https://www.amazon.com.br/dp/B09VQ39F41' }
  const first = app.inject({ method: 'POST', url: '/api/link-conversion/convert', payload })
  await new Promise(resolve => setImmediate(resolve))
  const second = await app.inject({ method: 'POST', url: '/api/link-conversion/convert', payload })
  releaseFirst()
  const firstResponse = await first

  assert.equal(firstResponse.statusCode, 200)
  assert.equal(second.statusCode, 429)
  const body = JSON.parse(second.body)
  assert.equal(body.code, 'LINK_CONVERSION_ALREADY_RUNNING')
})

test('POST /convert aplica timeout por item para evitar request preso', async (t) => {
  const { app } = await buildApp({
    credentials: [credential()],
    routeOptions: { conversionTimeoutMs: 5, requestDeadlineMs: 100 },
    converter: async () => new Promise(resolve => setTimeout(() => resolve('late'), 50)),
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({
    method: 'POST',
    url: '/api/link-conversion/convert',
    payload: { text: 'https://www.amazon.com.br/dp/B09VQ39F41' },
  })

  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.results[0].status, 'error')
  assert.equal(body.results[0].code, 'CONVERSION_FAILED')
  assert.match(body.results[0].error, /Tempo limite de conversão excedido/i)
})

test('POST /scrape-offer tenta converter e usa link convertido para scrape quando sucesso', async (t) => {
  let converterCalls = 0
  let scraperUrl = ''
  const { app } = await buildApp({
    credentials: [credential()],
    converter: async (platform, url) => {
      converterCalls += 1
      assert.equal(platform, 'amazon')
      assert.equal(url, 'https://www.amazon.com.br/dp/B09VQ39F41')
      return 'https://www.amazon.com.br/dp/B09VQ39F41?tag=botinho-20'
    },
    fetchProductInfo: async (url) => {
      scraperUrl = url
      return { title: 'Mixer Vertical Turbo Chef', oldPrice: '199,90', newPrice: '149,90', finalUrl: url }
    },
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({
    method: 'POST',
    url: '/api/link-conversion/scrape-offer',
    payload: { url: 'https://www.amazon.com.br/dp/B09VQ39F41' },
  })

  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.title, 'Mixer Vertical Turbo Chef')
  assert.equal(body.oldPrice, '199,90')
  assert.equal(body.newPrice, '149,90')
  assert.equal(body.offerUrl, 'https://www.amazon.com.br/dp/B09VQ39F41?tag=botinho-20')
  assert.equal(scraperUrl, 'https://www.amazon.com.br/dp/B09VQ39F41?tag=botinho-20')
  assert.equal(converterCalls, 1)
  assert.equal(body.conversion.attempted, true)
  assert.equal(body.conversion.success, true)
  assert.equal(body.conversion.usedOriginalUrl, false)
  assert.equal(body.conversion.reasonCode, null)
})

test('POST /scrape-offer rejeita url inválida', async (t) => {
  const { app } = await buildApp({
    converter: async () => 'never',
    fetchProductInfo: async () => { throw new Error('não deve buscar') },
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({
    method: 'POST',
    url: '/api/link-conversion/scrape-offer',
    payload: { url: 'nao-eh-url' },
  })

  assert.equal(res.statusCode, 400)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'SCRAPE_OFFER_INVALID_URL')
})

test('POST /scrape-offer trata erros do scraper com fallback 200 e aviso', async (t) => {
  const { app } = await buildApp({
    converter: async () => 'never',
    fetchProductInfo: async () => { throw new Error('timeout') },
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({
    method: 'POST',
    url: '/api/link-conversion/scrape-offer',
    payload: { url: 'https://www.amazon.com.br/produto-teste/dp/B09VQ39F41' },
  })

  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.scrapeWarning?.code, 'SCRAPE_OFFER_FETCH_FAILED')
  assert.match(body.scrapeWarning?.message || '', /não foi possível ler as informações/i)
  assert.equal(body.title, 'produto teste')
  assert.equal(body.newPrice, '')
})


test('POST /scrape-offer reprocessa link curto de afiliado e mantém conversão', async (t) => {
  let converterCalls = 0
  const { app } = await buildApp({
    credentials: [credential()],
    converter: async () => {
      converterCalls += 1
      return 'https://www.amazon.com.br/dp/B09VQ39F41?tag=botinho-20'
    },
    fetchProductInfo: async (url) => ({ title: 'Produto', oldPrice: '', newPrice: '99,90', finalUrl: url }),
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({
    method: 'POST',
    url: '/api/link-conversion/scrape-offer',
    payload: { url: 'https://amzn.to/abc123' },
  })

  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(converterCalls, 1)
  assert.equal(body.conversion.success, true)
})

test('POST /scrape-offer usa link original quando credencial faltar', async (t) => {
  let scraperUrl = ''
  const original = 'https://www.amazon.com.br/dp/B09VQ39F41'
  const { app } = await buildApp({
    converter: async () => 'não deveria chamar',
    fetchProductInfo: async (url) => {
      scraperUrl = url
      return { title: 'Produto', oldPrice: '', newPrice: '99,90', finalUrl: url }
    },
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({ method: 'POST', url: '/api/link-conversion/scrape-offer', payload: { url: original } })

  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.offerUrl, original)
  assert.equal(scraperUrl, original)
  assert.equal(body.conversion.success, false)
  assert.equal(body.conversion.usedOriginalUrl, true)
  assert.equal(body.conversion.reasonCode, 'MISSING_CREDENTIALS')
})

test('POST /scrape-offer usa link original quando loja não é suportada para conversão', async (t) => {
  const original = 'https://exemplo.com/produto'
  const { app } = await buildApp({
    converter: async () => 'não deveria chamar',
    fetchProductInfo: async (url) => ({ title: 'Produto', oldPrice: '', newPrice: '49,90', finalUrl: url }),
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({ method: 'POST', url: '/api/link-conversion/scrape-offer', payload: { url: original } })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.offerUrl, original)
  assert.equal(body.conversion.success, false)
  assert.equal(body.conversion.reasonCode, 'UNSUPPORTED_PLATFORM')
})

test('POST /scrape-offer usa link original quando conversão falha', async (t) => {
  const original = 'https://www.magazineluiza.com.br/produto/p/abc123'
  const { app } = await buildApp({
    credentials: [credential('magazineluiza', { tag: 'parceira' })],
    converter: async () => { throw new Error('serviço fora') },
    fetchProductInfo: async (url) => ({ title: 'Produto', oldPrice: '', newPrice: '59,90', finalUrl: url }),
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({ method: 'POST', url: '/api/link-conversion/scrape-offer', payload: { url: original } })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.offerUrl, original)
  assert.equal(body.conversion.success, false)
  assert.equal(body.conversion.reasonCode, 'CONVERSION_FAILED')
})


test('POST /scrape-offer marca CONVERSION_TIMEOUT quando conversor estoura tempo', async (t) => {
  const original = 'https://www.magazineluiza.com.br/produto/p/abc123'
  const { app } = await buildApp({
    credentials: [credential('magazineluiza', { tag: 'parceira' })],
    routeOptions: { conversionTimeoutMs: 5 },
    converter: async () => new Promise(resolve => setTimeout(() => resolve('late'), 50)),
    fetchProductInfo: async (url) => ({ title: 'Produto', oldPrice: '', newPrice: '59,90', finalUrl: url }),
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({ method: 'POST', url: '/api/link-conversion/scrape-offer', payload: { url: original } })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.offerUrl, original)
  assert.equal(body.conversion.success, false)
  assert.equal(body.conversion.reasonCode, 'CONVERSION_TIMEOUT')
})


test('POST /scrape-offer reprocessa link curto de afiliado e mantém conversão', async (t) => {
  let converterCalls = 0
  const { app } = await buildApp({
    credentials: [credential()],
    converter: async () => {
      converterCalls += 1
      return 'https://www.amazon.com.br/dp/B09VQ39F41?tag=botinho-20'
    },
    fetchProductInfo: async (url) => ({ title: 'Produto', oldPrice: '', newPrice: '99,90', finalUrl: url }),
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({
    method: 'POST',
    url: '/api/link-conversion/scrape-offer',
    payload: { url: 'https://amzn.to/abc123' },
  })

  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(converterCalls, 1)
  assert.equal(body.conversion.success, true)
})

test('POST /scrape-offer usa link original quando credencial faltar', async (t) => {
  let scraperUrl = ''
  const original = 'https://www.amazon.com.br/dp/B09VQ39F41'
  const { app } = await buildApp({
    converter: async () => 'não deveria chamar',
    fetchProductInfo: async (url) => {
      scraperUrl = url
      return { title: 'Produto', oldPrice: '', newPrice: '99,90', finalUrl: url }
    },
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({ method: 'POST', url: '/api/link-conversion/scrape-offer', payload: { url: original } })

  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.offerUrl, original)
  assert.equal(scraperUrl, original)
  assert.equal(body.conversion.success, false)
  assert.equal(body.conversion.usedOriginalUrl, true)
  assert.equal(body.conversion.reasonCode, 'MISSING_CREDENTIALS')
})

test('POST /scrape-offer usa link original quando loja não é suportada para conversão', async (t) => {
  const original = 'https://exemplo.com/produto'
  const { app } = await buildApp({
    converter: async () => 'não deveria chamar',
    fetchProductInfo: async (url) => ({ title: 'Produto', oldPrice: '', newPrice: '49,90', finalUrl: url }),
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({ method: 'POST', url: '/api/link-conversion/scrape-offer', payload: { url: original } })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.offerUrl, original)
  assert.equal(body.conversion.success, false)
  assert.equal(body.conversion.reasonCode, 'UNSUPPORTED_PLATFORM')
})

test('POST /scrape-offer usa link original quando conversão falha', async (t) => {
  const original = 'https://www.magazineluiza.com.br/produto/p/abc123'
  const { app } = await buildApp({
    credentials: [credential('magazineluiza', { tag: 'parceira' })],
    converter: async () => { throw new Error('serviço fora') },
    fetchProductInfo: async (url) => ({ title: 'Produto', oldPrice: '', newPrice: '59,90', finalUrl: url }),
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({ method: 'POST', url: '/api/link-conversion/scrape-offer', payload: { url: original } })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.offerUrl, original)
  assert.equal(body.conversion.success, false)
  assert.equal(body.conversion.reasonCode, 'CONVERSION_FAILED')
})


test('POST /scrape-offer marca CONVERSION_TIMEOUT quando conversor estoura tempo', async (t) => {
  const original = 'https://www.magazineluiza.com.br/produto/p/abc123'
  const { app } = await buildApp({
    credentials: [credential('magazineluiza', { tag: 'parceira' })],
    routeOptions: { conversionTimeoutMs: 5 },
    converter: async () => new Promise(resolve => setTimeout(() => resolve('late'), 50)),
    fetchProductInfo: async (url) => ({ title: 'Produto', oldPrice: '', newPrice: '59,90', finalUrl: url }),
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({ method: 'POST', url: '/api/link-conversion/scrape-offer', payload: { url: original } })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.offerUrl, original)
  assert.equal(body.conversion.success, false)
  assert.equal(body.conversion.reasonCode, 'CONVERSION_TIMEOUT')
})
