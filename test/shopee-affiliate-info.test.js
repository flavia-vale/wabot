import { test } from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import { convert, fetchShopeeProductInfo, shopeeDecimalPriceToString, cleanAffiliateUrl } from '../src/converters/shopee.js'

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

// Regressão 1: links afiliados de s.shopee.com.br bloqueiam o WebView do WhatsApp.
// convert() deve resolver e limpar a URL antes de retornar.
test('convert() resolve shortLink e entrega URL shopee.com.br limpa (sem s.shopee.com.br, sem parâmetros de ruído)', async (t) => {
  const shortLink = 'https://s.shopee.com.br/AfXXXfake'
  // URL com ruído real (gads_t_sig enorme, exp_group, __mobile__, etc.) — igual ao que
  // chegou em produção e causou mensagens ilegíveis no WhatsApp (regressão 2026-06).
  const noisyResolved = 'https://shopee.com.br/opaanlp/1509055233/58258316548'
    + '?__mobile__=1&exp_group=rollout&gads_t_sig=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    + '&mmp_pid=an_18322390884&uls_trackid=55v1tprk00ol'
    + '&utm_campaign=id_c08bc3b5b0f76ce3&utm_content=----&utm_medium=affiliates&utm_source=an_18322390884'

  t.after(stubAxiosPost(async () => ({
    data: { data: { generateShortLink: { shortLink } } },
  })))

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    if (url === shortLink) {
      return {
        ok: false, status: 302, url,
        headers: { get: (name) => name.toLowerCase() === 'location' ? noisyResolved : null },
        text: async () => '', body: null,
      }
    }
    throw new Error(`fetch inesperado: ${url}`)
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const result = await convert('https://shopee.com.br/product/1509055233/58258316548', CREDS)
  assert.ok(!result.includes('s.shopee.com.br'), 'não deve ter s.shopee.com.br')
  assert.ok(!result.includes('gads_t_sig'), 'não deve ter gads_t_sig (ruído)')
  assert.ok(!result.includes('exp_group'), 'não deve ter exp_group (ruído)')
  assert.ok(!result.includes('__mobile__'), 'não deve ter __mobile__ (ruído)')
  assert.ok(result.includes('utm_medium=affiliates'), 'deve manter utm_medium')
  assert.ok(result.includes('utm_source=an_18322390884'), 'deve manter utm_source')
  assert.ok(result.includes('mmp_pid=an_18322390884'), 'deve manter mmp_pid')
  assert.ok(result.includes('uls_trackid=55v1tprk00ol'), 'deve manter uls_trackid')
  assert.match(result, /shopee\.com\.br\/product\/1509055233\/58258316548/, 'deve usar path /product/ canônico')
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
