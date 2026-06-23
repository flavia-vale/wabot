import { test } from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import { convert, fetchShopeeProductInfo, shopeeDecimalPriceToString } from '../src/converters/shopee.js'

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

// Regressão: links afiliados gerados pela API (s.shopee.com.br) bloqueiam o
// WebView do WhatsApp com "Seu navegador não é mais aceito!". O convert() deve
// resolver o shortLink para a URL canônica shopee.com.br antes de retornar.
test('convert() resolve o shortLink da API para URL canônica shopee.com.br (evita bloqueio WebView)', async (t) => {
  const shortLink = 'https://s.shopee.com.br/AfXXXfake'
  const canonicalWithUtm = 'https://shopee.com.br/product/306423459/6895145599?utm_medium=affiliates&utm_source=an_1234567890'

  t.after(stubAxiosPost(async () => ({
    data: { data: { generateShortLink: { shortLink } } },
  })))

  // Injeta fetchImpl para simular o redirect do s.shopee.com.br → shopee.com.br
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    if (url === shortLink) {
      return {
        ok: false,
        status: 302,
        url,
        headers: { get: (name) => name.toLowerCase() === 'location' ? canonicalWithUtm : null },
        text: async () => '',
        body: null,
      }
    }
    throw new Error(`fetch inesperado: ${url}`)
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const result = await convert('https://shopee.com.br/product/306423459/6895145599', CREDS)
  assert.equal(result, canonicalWithUtm, 'deve retornar shopee.com.br, não s.shopee.com.br')
  assert.ok(!result.includes('s.shopee.com.br'), 'resultado não deve ter short link da Shopee')
})
