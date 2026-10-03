// Rakuten: tradutor do feed XML (formato real medido em 2026-09-30, com o ID
// da cliente trocado) e cliente HTTP (token, cache, renovação, erros).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRakutenClient, credentialFingerprint } from '../src/integrations/rakuten/client.js'
import { RakutenAccessDeniedError, RakutenAuthError, RakutenRateLimitError } from '../src/integrations/rakuten/errors.js'
import { extractAdvertiser, extractCouponPage, parseRakutenDate, rakutenOfferId, translateCoupon } from '../src/integrations/rakuten/translate.js'
import { testRakutenCredentials, RAKUTEN_MESSAGES } from '../src/integrations/rakuten/accountService.js'

const xml = readFileSync(new URL('./fixtures/rakuten-coupons-page.xml', import.meta.url), 'utf8')
const CREDS = { clientId: 'ClienteFicticioCLIENTID', clientSecret: 'segredo-bem-comprido-123', sid: '4640819' }

test('feed: lê página, total e cada oferta (entidades, CDATA, cupom, datas)', () => {
  const page = extractCouponPage(xml)
  assert.equal(page.items.length, 5)
  assert.equal(page.total, 5)
  assert.equal(page.totalPages, 1)

  const results = page.items.map(translateCoupon)
  assert.deepEqual(results.map((r) => r.ok), [true, true, true, true, false])
  assert.equal(results[4].reason, 'missing_link')

  const coupon = results[0].record
  assert.equal(coupon.promotionId, '1897539.1097')
  assert.equal(coupon.advertiserId, '43984')
  assert.equal(coupon.advertiserName, 'Netshoes WL')
  assert.equal(coupon.couponCode, 'BEMVINDO10')
  assert.equal(coupon.promotionTypes, 'Liquidação')
  assert.equal(coupon.categories, 'Sapatos')
  assert.equal(coupon.networkId, '8')
  assert.match(coupon.clickUrl, /^https:\/\/click\.linksynergy\.com\/fs-bin\/click\?id=AbCdEfGhIjK&offerid=1897539\.1097&type=3/)
  assert.equal(coupon.startDate.toISOString(), '2023-06-21T17:56:00.000Z')

  assert.equal(results[1].record.couponCode, null)
  assert.equal(results[3].record.title, 'Fones & caixas com até 40% OFF')
  assert.equal(results[3].record.categories, 'Eletrônicos')
})

test('feed: resposta que não é o feed → null; página vazia → sem itens', () => {
  assert.equal(extractCouponPage('<html>erro</html>'), null)
  const empty = extractCouponPage('<?xml version="1.0"?><couponfeed><TotalMatches>3</TotalMatches><TotalPages>3</TotalPages><PageNumberRequested>9</PageNumberRequested></couponfeed>')
  assert.deepEqual(empty.items, [])
  assert.equal(empty.totalPages, 3)
})

test('identidade da oferta e datas', () => {
  assert.equal(rakutenOfferId('https://click.linksynergy.com/fs-bin/click?id=X&offerid=1.2&type=3'), '1.2')
  assert.match(rakutenOfferId('https://click.linksynergy.com/deeplink?id=X&mid=1&subid=0'), /^u:/)
  assert.equal(rakutenOfferId('javascript:alert(1)'), null)
  assert.equal(parseRakutenDate('2029-06-21T03:00Z').toISOString(), '2029-06-21T03:00:00.000Z')
  assert.equal(parseRakutenDate('2029-06-21T03:00:00').toISOString(), '2029-06-21T03:00:00.000Z')
  assert.equal(parseRakutenDate(''), null)
  assert.deepEqual(extractAdvertiser({ advertiser: { name: 'Netshoes WL', url: 'https://www.netshoes.com.br/', logo_url: 'https://merchant.linksynergy.com/fs/logo/lg_43984' } }), {
    name: 'Netshoes WL', storeUrl: 'https://www.netshoes.com.br/', logoUrl: 'https://merchant.linksynergy.com/fs/logo/lg_43984',
  })
  assert.equal(extractAdvertiser({}), null)
})

function response(status, body, { text = false, headers = {} } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    text: async () => (text ? body : JSON.stringify(body)),
  }
}

const noLimit = { acquire: async () => {} }

test('token: Basic do par no cabeçalho, SID no corpo; reaproveita o token até perto de vencer', async () => {
  const calls = []
  let clock = 0
  const client = createRakutenClient({
    limiter: noLimit,
    now: () => clock,
    fetchFn: async (url, init) => {
      calls.push({ url, init })
      if (url.endsWith('/token')) return response(200, { access_token: `tok-${calls.length}`, expires_in: 3600 })
      return response(200, xml, { text: true })
    },
  })
  await client.listCoupons(CREDS, { page: 2 })
  await client.listCoupons(CREDS)
  assert.equal(calls.filter((c) => c.url.endsWith('/token')).length, 1, 'um token para as duas chamadas')
  const tokenCall = calls[0]
  assert.equal(tokenCall.init.method, 'POST')
  assert.equal(tokenCall.init.headers.Authorization, `Bearer ${Buffer.from(`${CREDS.clientId}:${CREDS.clientSecret}`).toString('base64')}`)
  assert.equal(tokenCall.init.body, 'scope=4640819')
  const dataUrl = new URL(calls[1].url)
  assert.equal(dataUrl.pathname, '/coupon/1.0')
  assert.equal(dataUrl.searchParams.get('network'), '8')
  assert.equal(dataUrl.searchParams.get('pagenumber'), '2')
  assert.equal(calls[1].init.headers.Authorization, 'Bearer tok-1')
  assert.ok(!calls[1].url.includes(CREDS.clientSecret), 'segredo nunca na URL')

  clock = 3600 * 1000 // passou da validade (menos a folga de 5 min)
  await client.listCoupons(CREDS)
  assert.equal(calls.filter((c) => c.url.endsWith('/token')).length, 2, 'token vencido é renovado')
})

test('token recusado no meio → renova uma vez e repete; recusado de novo → acesso negado (passageiro)', async () => {
  let dataCalls = 0
  const client = createRakutenClient({
    limiter: noLimit,
    fetchFn: async (url) => {
      if (url.endsWith('/token')) return response(200, { access_token: 'novo', expires_in: 3600 })
      dataCalls++
      return dataCalls === 1 ? response(401, { error: 'invalid_token' }) : response(200, xml, { text: true })
    },
  })
  const body = await client.listCoupons(CREDS)
  assert.match(body, /couponfeed/)
  assert.equal(dataCalls, 2)

  const always401 = createRakutenClient({ limiter: noLimit, fetchFn: async (url) => (url.endsWith('/token') ? response(200, { access_token: 'x', expires_in: 3600 }) : response(401, {})) })
  // Revisão 2026-10-03 (R2): recusa em pedido de DADOS é passageira — quem
  // decide desligar a conta é a sync, depois de 3 seguidas.
  await assert.rejects(always401.listCoupons(CREDS), RakutenAccessDeniedError)
})

test('dados recusados na Rakuten (400/401 invalid_client) → erro de acesso sem segredo na mensagem; 429 → pausa', async () => {
  for (const status of [400, 401]) {
    const client = createRakutenClient({ limiter: noLimit, fetchFn: async () => response(status, { error: 'invalid_client' }) })
    const error = await client.verify(CREDS).catch((e) => e)
    assert.ok(error instanceof RakutenAuthError)
    assert.ok(!error.message.includes(CREDS.clientSecret))
    const result = await testRakutenCredentials({ client, creds: CREDS })
    assert.deepEqual(result, { ok: false, reason: 'auth', message: RAKUTEN_MESSAGES.auth })
  }
  const limited = createRakutenClient({ limiter: noLimit, fetchFn: async () => response(429, {}, { headers: { 'retry-after': '30' } }) })
  const error = await limited.verify(CREDS).catch((e) => e)
  assert.ok(error instanceof RakutenRateLimitError)
  assert.equal(error.retryAfterMs, 30_000)
  const ok = createRakutenClient({ limiter: noLimit, fetchFn: async () => response(200, { access_token: 'x', expires_in: 3600 }) })
  assert.equal((await testRakutenCredentials({ client: ok, creds: CREDS })).ok, true)
})

test('dados incompletos nem chegam à Rakuten; impressão digital não revela o segredo', async () => {
  let called = false
  const client = createRakutenClient({ limiter: noLimit, fetchFn: async () => { called = true; return response(200, {}) } })
  await assert.rejects(client.verify({ ...CREDS, sid: 'abc' }), RakutenAuthError)
  await assert.rejects(client.verify({ ...CREDS, clientSecret: '' }), RakutenAuthError)
  assert.equal(called, false)
  const fp = credentialFingerprint(CREDS)
  assert.match(fp, /^[0-9a-f]{64}$/)
  assert.ok(!fp.includes(CREDS.clientSecret))
})
