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
