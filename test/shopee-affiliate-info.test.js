import { test } from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import { convert, fetchShopeeProductInfo, shopeeDecimalPriceToString, cleanAffiliateUrl, stripAffiliateTracking, normalizeShopeeCouponOrigin } from '../src/converters/shopee.js'

// Credenciais fictícias — o axios.post é stubbado, então o valor não importa.
const CREDS = { appId: '1234567890', secretKey: 'TEST_SECRET_KEY_PLACEHOLDER_0000' }

function stubAxiosPost(impl) {
  const original = axios.post
  axios.post = impl
  return () => { axios.post = original }
}

test('shopeeDecimalPriceToString formata decimal em reais (não micro-unidades)', () => {
  assert.equal(shopeeDecimalPriceToString('59.9'), '59,90')
  assert.equal(shopeeDecimalPriceToString(130.217), '130,22')
  assert.equal(shopeeDecimalPriceToString(0), '')
  assert.equal(shopeeDecimalPriceToString('abc'), '')
})

test('fetchShopeeProductInfo trata preço como decimal e deriva o preço "de" do desconto', async (t) => {
  let sentQuery = ''
  t.after(stubAxiosPost(async (_url, body) => {
    sentQuery = body.query
    return {
      data: {
        data: {
          productOfferV2: {
            nodes: [{
              productName: 'Calça Jeans Feminina Wide Leg rasgada pantalona',
              price: '59.9',
              priceMin: '59.9',
              priceMax: '59.9',
              priceDiscountRate: 54,
              imageUrl: 'https://cf.shopee.com.br/file/abc',
            }],
          },
        },
      },
    }
  }))

  const info = await fetchShopeeProductInfo('https://shopee.com.br/product/306423459/6895145599', CREDS)
  assert.equal(info.title, 'Calça Jeans Feminina Wide Leg rasgada pantalona')
  assert.equal(info.newPrice, '59,90')
  // 59,90 com 54% de desconto => original 130,22 (59.9 / (1 - 0.54))
  assert.equal(info.oldPrice, '130,22')
  // O schema productOfferV2 não tem `originPrice`; pedir esse campo derruba a query.
  assert.ok(!/originPrice/.test(sentQuery), 'a query NÃO deve pedir originPrice')
})

test('fetchShopeeProductInfo sem desconto não inventa preço "de"', async (t) => {
  t.after(stubAxiosPost(async () => ({
    data: { data: { productOfferV2: { nodes: [{
      productName: 'Produto sem desconto',
      price: '100.0',
      priceMin: '100.0',
      priceDiscountRate: 0,
    }] } } },
  })))

  const info = await fetchShopeeProductInfo('https://shopee.com.br/product/1/2', CREDS)
  assert.equal(info.newPrice, '100,00')
  assert.equal(info.oldPrice, '')
})

test('fetchShopeeProductInfo retorna null sem credenciais', async () => {
  assert.equal(await fetchShopeeProductInfo('https://shopee.com.br/product/1/2', {}), null)
})

// Regressão 1: o espelhamento da Shopee deve enviar o shortLink oficial de
// afiliado retornado pela API (formato visual esperado: s.shopee.com.br/...).
// Não resolver para a URL longa /product?...; se a API parar de devolver link
// curto, a conversão deve falhar para o worker não vazar link original/de outro
// afiliado.
test('convert() entrega o shortLink afiliado oficial da Shopee sem resolver para URL longa', async (t) => {
  const shortLink = 'https://s.shopee.com.br/AfXXXfake'
  let fetchCalled = false

  t.after(stubAxiosPost(async () => ({
    data: { data: { generateShortLink: { shortLink } } },
  })))

  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    fetchCalled = true
    throw new Error('convert não deve resolver shortLink')
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const result = await convert('https://shopee.com.br/product/1509055233/58258316548', CREDS)
  assert.equal(result, shortLink)
  assert.equal(fetchCalled, false, 'não deve chamar fetch para resolver o shortLink')
})

test('convert() rejeita resposta sem shortLink afiliado válido', async (t) => {
  t.after(stubAxiosPost(async () => ({
    data: { data: { generateShortLink: { shortLink: 'https://shopee.com.br/product/1509055233/58258316548?utm_medium=affiliates' } } },
  })))

  await assert.rejects(
    () => convert('https://shopee.com.br/product/1509055233/58258316548', CREDS),
    /shortLink afiliado válido/,
  )
})

// Regressão (comportamento DEFAULT, COUPON_LINK_CONVERT desligado): links de
// cupom/voucher Shopee (s.shopee.com.br/XXX que resolvem para /buyer/voucher ou
// similares, sem shopId+itemId) NÃO devem ser convertidos via API de afiliado.
// A API pode aceitar essas URLs e retornar um shortLink que roteia via web em
// vez de deep-link para o app, causando "Oops! Seu navegador não é mais
// aceito!" no browser do WhatsApp. convert() deve rejeitar antes de chamar a
// API, preservando o comportamento de strip (sem vazar o link de terceiro).
test('convert() rejeita link de cupom/voucher sem IDs de produto antes de chamar a API (flag OFF)', async (t) => {
  let apiCalled = false
  t.after(stubAxiosPost(async () => { apiCalled = true; return { data: {} } }))
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, status: 200, url: 'https://shopee.com.br/buyer/voucher?spm=xxx', headers: { get: () => null }, body: null, text: async () => '' })
  t.after(() => { globalThis.fetch = originalFetch })

  let caughtErr
  try {
    await convert('https://s.shopee.com.br/40eQK1or1O', CREDS)
  } catch (err) {
    caughtErr = err
  }
  assert.ok(caughtErr, 'deve lançar erro')
  assert.match(caughtErr.message, /link não é de produto/)
  assert.equal(caughtErr.stripFromMessage, true, 'erro deve ter stripFromMessage=true para bot-worker remover o link da mensagem')
  assert.equal(apiCalled, false, 'API de afiliado não deve ser chamada para link de cupom')
})

function withCouponConvertEnabled(t) {
  const prev = process.env.COUPON_LINK_CONVERT
  process.env.COUPON_LINK_CONVERT = 'true'
  t.after(() => {
    if (prev === undefined) delete process.env.COUPON_LINK_CONVERT
    else process.env.COUPON_LINK_CONVERT = prev
  })
}

// Resolve o short link de cupom para uma URL de voucher JÁ CARIMBADA com o
// afiliado de origem — é esse tracking que faz a API recusar com "Invalid
// origin URL" se não for removido antes.
function stubCouponResolution(t) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    url: 'https://shopee.com.br/m/cupom?promotionId=999&utm_source=an_123&utm_medium=affiliates&gads_t_sig=XYZ',
    headers: { get: () => null }, body: null, text: async () => '',
  })
  t.after(() => { globalThis.fetch = originalFetch })
}

// stripAffiliateTracking: remove tracking de terceiro, preserva identidade do
// cupom, idempotente.
test('stripAffiliateTracking remove tracking de terceiro e preserva a identidade do cupom', () => {
  const dirty = 'https://shopee.com.br/m/cupom?promotionId=999&signature=abc&utm_source=an_123&utm_medium=affiliates&gads_t_sig=XYZ&af_siteid=55'
  const clean = stripAffiliateTracking(dirty)
  assert.ok(clean.includes('promotionId=999'), 'mantém promotionId')
  assert.ok(clean.includes('signature=abc'), 'mantém signature')
  assert.ok(!/utm_source|utm_medium|gads_t_sig|af_siteid/.test(clean), 'remove todo tracking de terceiro')
  // Idempotente: sem tracking, devolve intacta.
  const pristine = 'https://shopee.com.br/voucher/details?promotionId=5&voucherCode=ABC'
  assert.equal(stripAffiliateTracking(pristine), pristine)
  // Não-URL: devolve como veio (fallback seguro).
  assert.equal(stripAffiliateTracking('not a url'), 'not a url')
})

test('normalizeShopeeCouponOrigin troca rotas mobile/app por /voucher/details e limpa tracking', () => {
  const dirty = 'https://shopee.com.br/m/cupom?promotionId=999&voucherCode=ABC&utm_source=an_123&utm_medium=affiliates&gads_t_sig=XYZ#app'
  const normalized = normalizeShopeeCouponOrigin(dirty)
  const u = new URL(normalized)
  assert.equal(u.origin + u.pathname, 'https://shopee.com.br/voucher/details')
  assert.equal(u.searchParams.get('promotionId'), '999')
  assert.equal(u.searchParams.get('voucherCode'), 'ABC')
  assert.equal(u.hash, '')
  assert.ok(!/utm_source|utm_medium|gads_t_sig/.test(normalized), 'remove tracking de terceiro antes da API')
})

// Com COUPON_LINK_CONVERT=true, cupom Shopee deve ser convertido, mas a origin
// enviada à API nunca pode ser a rota mobile/app que dispara "navegador não
// aceito"; ela precisa sair como /voucher/details.
test('convert() converte cupom Shopee usando origin /voucher/details segura quando COUPON_LINK_CONVERT=true', async (t) => {
  withCouponConvertEnabled(t)
  stubCouponResolution(t)
  let sentQuery = ''
  t.after(stubAxiosPost(async (_url, body) => {
    sentQuery = body.query
    return { data: { data: { generateShortLink: { shortLink: 'https://s.shopee.com.br/cupomAFIL123' } } } }
  }))

  const result = await convert('https://s.shopee.com.br/40eQK1or1O', CREDS)
  assert.equal(result, 'https://s.shopee.com.br/cupomAFIL123')
  assert.ok(sentQuery.includes('https://shopee.com.br/voucher/details'), 'origin enviada usa rota web segura')
  assert.ok(sentQuery.includes('promotionId=999'), 'origin mantém a identidade do cupom')
  assert.ok(!/\/m\/cupom|\/buyer\/voucher|utm_source|utm_medium|gads_t_sig/.test(sentQuery), 'origin não leva rota mobile/app nem tracking de terceiro')
})

test('convert() converte URL direta de cupom Shopee com COUPON_LINK_CONVERT=true sem rota mobile/app', async (t) => {
  withCouponConvertEnabled(t)
  let sentQuery = ''
  t.after(stubAxiosPost(async (_url, body) => {
    sentQuery = body.query
    return { data: { data: { generateShortLink: { shortLink: 'https://s.shopee.com.br/cupomDIRETO' } } } }
  }))

  const result = await convert('https://shopee.com.br/m/cupom?promotionId=999&voucherCode=ABC', CREDS)
  assert.equal(result, 'https://s.shopee.com.br/cupomDIRETO')
  assert.ok(sentQuery.includes('https://shopee.com.br/voucher/details'))
  assert.ok(!sentQuery.includes('/m/cupom'))
})

// Invariante de segurança: mesmo com o flag ligado, se a API recusar o cupom,
// caímos no strip — NUNCA devolvemos o link original do concorrente.
test('convert() faz strip seguro quando COUPON_LINK_CONVERT=true mas a API recusa o cupom', async (t) => {
  withCouponConvertEnabled(t)
  stubCouponResolution(t)
  t.after(stubAxiosPost(async () => ({ data: { errors: [{ message: 'Invalid origin URL' }] } })))

  let caughtErr
  try {
    await convert('https://s.shopee.com.br/40eQK1or1O', CREDS)
  } catch (err) {
    caughtErr = err
  }
  assert.ok(caughtErr, 'deve lançar')
  assert.equal(caughtErr.stripFromMessage, true, 'fallback seguro: nunca encaminha o link original do concorrente')
})

// Regressão 2: cleanAffiliateUrl deve preservar a URL como-está quando não
// consegue extrair IDs (fallback seguro: melhor URL longa do que link perdido).
test('cleanAffiliateUrl preserva URL sem IDs de produto intacta (fallback seguro)', () => {
  const noIds = 'https://shopee.com.br/m/cupom-de-desconto?foo=bar'
  assert.equal(cleanAffiliateUrl(noIds), noIds)
})

test('cleanAffiliateUrl normaliza /opaanlp/ para /product/ e limpa ruído', () => {
  const noisy = 'https://shopee.com.br/opaanlp/123/456?__mobile__=1&gads_t_sig=XXXX&utm_medium=affiliates&mmp_pid=an_999&uls_trackid=abc'
  const result = cleanAffiliateUrl(noisy)
  assert.match(result, /\/product\/123\/456/)
  assert.ok(!result.includes('gads_t_sig'), 'gads_t_sig removido')
  assert.ok(!result.includes('__mobile__'), '__mobile__ removido')
  assert.ok(result.includes('utm_medium=affiliates'))
  assert.ok(result.includes('mmp_pid=an_999'))
  assert.ok(result.includes('uls_trackid=abc'))
})
