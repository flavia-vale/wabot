// Cliente HTTP Awin: token só no cabeçalho, nunca na URL; erros mapeados;
// limitador por token.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createAwinClient, isValidPublisherId, tokenFingerprint } from '../src/integrations/awin/client.js'
import { createTokenRateLimiter } from '../src/integrations/awin/rateLimiter.js'
import { AwinAuthError, AwinHttpError, AwinRateLimitError, AwinTimeoutError } from '../src/integrations/awin/errors.js'

const TOKEN = 'abcd1234-segredo-muito-longo-5678'

function jsonResponse(status, body, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
  }
}

const noLimit = { acquire: async () => {} }

test('listPromotions: POST no caminho certo, corpo com filters+pagination e token SÓ no cabeçalho', async () => {
  const calls = []
  const client = createAwinClient({ limiter: noLimit, fetchFn: async (url, init) => { calls.push({ url, init }); return jsonResponse(200, { data: [], pagination: { total: 0 } }) } })
  await client.listPromotions(TOKEN, '2701264', { filters: { type: 'promotion' }, page: 2, pageSize: 500 })
  assert.equal(calls.length, 1)
  const { url, init } = calls[0]
  assert.equal(url, 'https://api.awin.com/publisher/2701264/promotions')
  assert.ok(!url.includes(TOKEN), 'token vazou na URL')
  assert.ok(!url.includes('accessToken'))
  assert.equal(init.method, 'POST')
  assert.equal(init.headers.Authorization, `Bearer ${TOKEN}`)
  assert.deepEqual(JSON.parse(init.body), { filters: { type: 'promotion' }, pagination: { page: 2, pageSize: 200 } })
})

test('listAccounts: GET /accounts?type=publisher', async () => {
  let seen
  const client = createAwinClient({ limiter: noLimit, fetchFn: async (url, init) => { seen = { url, init }; return jsonResponse(200, { userId: 1, accounts: [] }) } })
  await client.listAccounts(TOKEN)
  assert.equal(seen.url, 'https://api.awin.com/accounts?type=publisher')
  assert.equal(seen.init.method, 'GET')
  assert.equal(seen.init.body, undefined)
})

test('401 e 403 viram AwinAuthError; 429 vira AwinRateLimitError com espera; 500 vira AwinHttpError', async () => {
  for (const status of [401, 403]) {
    const client = createAwinClient({ limiter: noLimit, fetchFn: async () => jsonResponse(status, {}) })
    await assert.rejects(client.listAccounts(TOKEN), AwinAuthError)
  }
  const limited = createAwinClient({ limiter: noLimit, fetchFn: async () => jsonResponse(429, {}, { 'retry-after': '90' }) })
  await assert.rejects(limited.listAccounts(TOKEN), (error) => error instanceof AwinRateLimitError && error.retryAfterMs === 90_000)
  const broken = createAwinClient({ limiter: noLimit, fetchFn: async () => jsonResponse(500, {}) })
  await assert.rejects(broken.listAccounts(TOKEN), AwinHttpError)
})

test('mensagens de erro nunca carregam o token', async () => {
  const client = createAwinClient({ limiter: noLimit, fetchFn: async () => { throw new Error(`falhou com ${TOKEN}`) } })
  await assert.rejects(client.listAccounts(TOKEN), (error) => !String(error.message).includes(TOKEN) && !String(error.stack).includes(TOKEN))
})

test('timeout vira AwinTimeoutError', async () => {
  const client = createAwinClient({
    limiter: noLimit,
    timeoutMs: 20,
    fetchFn: (url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    }),
  })
  await assert.rejects(client.listAccounts(TOKEN), AwinTimeoutError)
})

test('token vazio ou Publisher ID inválido não chegam a chamar a Awin', async () => {
  let called = 0
  const client = createAwinClient({ limiter: noLimit, fetchFn: async () => { called++; return jsonResponse(200, {}) } })
  await assert.rejects(client.listAccounts('  '), AwinAuthError)
  await assert.rejects(client.listPromotions(TOKEN, '12ab'), AwinHttpError)
  assert.equal(called, 0)
  assert.equal(isValidPublisherId('2701264'), true)
  assert.equal(isValidPublisherId('27 01'), false)
})

test('impressão digital do token é estável e não contém o token', () => {
  assert.equal(tokenFingerprint(TOKEN), tokenFingerprint(TOKEN))
  assert.notEqual(tokenFingerprint(TOKEN), tokenFingerprint(`${TOKEN}x`))
  assert.ok(!tokenFingerprint(TOKEN).includes('segredo'))
})

test('limitador: no máximo N chamadas por minuto por token; tokens diferentes não se bloqueiam', async () => {
  let clock = 0
  const sleeps = []
  const limiter = createTokenRateLimiter({
    maxPerMinute: 3,
    now: () => clock,
    sleep: async (ms) => { sleeps.push(ms); clock += ms },
  })
  for (let i = 0; i < 3; i++) await limiter.acquire('a')
  assert.equal(sleeps.length, 0)
  await limiter.acquire('b')
  assert.equal(sleeps.length, 0, 'outro token não espera')
  await limiter.acquire('a')
  assert.equal(sleeps.length, 1, 'quarta chamada do mesmo token espera a janela')
  assert.equal(sleeps[0], 60_000)
})

test('generateLink: gerador oficial com link curto, token só no cabeçalho', async () => {
  let seen
  const client = createAwinClient({ limiter: noLimit, fetchFn: async (url, init) => { seen = { url, init }; return jsonResponse(200, { url: 'https://www.awin1.com/cread.php?x', shortUrl: 'https://tidd.ly/abc' }) } })
  const result = await client.generateLink(TOKEN, '2701264', { advertiserId: '51271', destinationUrl: 'https://www.mizuno.com.br/x', shorten: true })
  assert.deepEqual(result, { url: 'https://www.awin1.com/cread.php?x', shortUrl: 'https://tidd.ly/abc' })
  assert.equal(seen.url, 'https://api.awin.com/publishers/2701264/linkbuilder/generate')
  assert.ok(!seen.url.includes(TOKEN))
  assert.equal(seen.init.headers.Authorization, `Bearer ${TOKEN}`)
  assert.deepEqual(JSON.parse(seen.init.body), { advertiserId: 51271, destinationUrl: 'https://www.mizuno.com.br/x', shorten: true })

  const refused = createAwinClient({ limiter: noLimit, fetchFn: async () => jsonResponse(200, { description: 'Unknown error! Please try again later!' }) })
  assert.deepEqual(await refused.generateLink(TOKEN, '2701264', { advertiserId: '1', shorten: true }), { url: null, shortUrl: null })
  await assert.rejects(refused.generateLink(TOKEN, '2701264', { advertiserId: 'abc' }), AwinHttpError)
})
