import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchProductInfo } from '../src/converters/productInfoScraper.js'

function mockHtmlResponse(html, url = 'https://www.amazon.com.br/dp/B0CXGBT3Z9') {
  return {
    ok: true,
    url,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null) },
    body: null,
    text: async () => html,
  }
}

test('fetchProductInfo extrai título e preço de página Amazon mesmo sem json-ld útil', async (t) => {
  const html = `<!doctype html><html><head><title>Amazon.com.br</title></head><body>
    <span id="productTitle">Amai, Absorvente Externo Fluxo Regular, Algodão Sem Químicos, Hipoalergênico, Sem plástico comum, Com Abas - 14 unidades</span>
    <span class="a-price"><span class="a-offscreen">R$&nbsp;64,99</span></span>
  </body></html>`

  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => mockHtmlResponse(html)
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://amazon.com.br/qualquer')
  assert.match(info.title, /Amai, Absorvente Externo Fluxo Regular/i)
  assert.equal(info.newPrice, '64,99')
})


test('fetchProductInfo usa fallback da API da Shopee para título e preços', async (t) => {
  const shellHtml = '<!doctype html><html><head><title>Shopee Brasil | Ofertas incríveis</title></head><body>app shell</body></html>'
  const shopeeApiPayload = {
    data: {
      item: {
        name: 'Kit Maquiagem Completo Com Pincéis Empreendedora Sucesso',
        price_before_discount: 7900000,
        price_min: 3318000,
      },
    },
  }

  let calls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    calls += 1
    const url = String(input)
    if (calls === 1) return mockHtmlResponse(shellHtml, 'https://shopee.com.br/Kit-Maquiagem-Completo-Com-Pinc%C3%A9is-Empreendedora-Sucesso-i.358101010.21697493290')
    if (url.includes('/api/v4/item/get?itemid=21697493290&shopid=358101010')) {
      return {
        ok: true,
        headers: { get: () => 'application/json; charset=utf-8' },
        json: async () => shopeeApiPayload,
      }
    }
    throw new Error(`unexpected fetch: ${url}`)
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://shopee.com.br/Kit-Maquiagem-Completo-Com-Pinc%C3%A9is-Empreendedora-Sucesso-i.358101010.21697493290?extraParams=1')
  assert.equal(info.title, 'Kit Maquiagem Completo Com Pincéis Empreendedora Sucesso')
  assert.equal(info.oldPrice, '79,00')
  assert.equal(info.newPrice, '33,18')
})
