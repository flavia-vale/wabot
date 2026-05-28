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

test('fetchProductInfo extrai preço Amazon via a-price-whole/fraction quando a-offscreen não existir', async (t) => {
  const html = `<!doctype html><html><body>
    <span id="productTitle">Milagre Creme de Pentear, Lola Cosmetics</span>
    <span class="a-price-whole">35</span><span class="a-price-fraction">90</span>
  </body></html>`

  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => mockHtmlResponse(html)
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://www.amazon.com.br/Milagre-Creme-Pentear-Lola-Cosmetics/dp/B07GTMGKY1')
  assert.match(info.title, /Milagre Creme de Pentear/i)
  assert.equal(info.newPrice, '35,90')
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

test('fetchProductInfo usa campos alternativos de preço da Shopee quando price_min não vier', async (t) => {
  const shellHtml = '<!doctype html><html><head><title>Shopee Brasil</title></head><body>app shell</body></html>'
  const shopeeApiPayload = {
    data: {
      item: {
        name: 'KIT TERERÉ BLACK ERVA SABOR CEREJA ICE – GARRAFA TÉRMICA + COPO INOX + BOMBA + ERVA 500G',
        price_min: 0,
        price: 24567000,
        price_before_discount: 0,
      },
    },
  }

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes('/api/v4/item/get?itemid=23499408546&shopid=1750300958')) {
      return {
        ok: true,
        headers: { get: () => 'application/json; charset=utf-8' },
        json: async () => shopeeApiPayload,
      }
    }
    return mockHtmlResponse(shellHtml, 'https://shopee.com.br/KIT-TERERE-BLACK-ERVA-SABOR-CEREJA-ICE-i.1750300958.23499408546')
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://shopee.com.br/KIT-TERERE-BLACK-ERVA-SABOR-CEREJA-ICE-i.1750300958.23499408546')
  assert.match(info.title, /KIT TERERÉ BLACK ERVA SABOR CEREJA ICE/i)
  assert.equal(info.newPrice, '245,67')
})

test('fetchProductInfo extrai faixa de preço da Shopee pelo HTML quando API não trouxer preço', async (t) => {
  const shellHtml = '<!doctype html><html><head><title>Moletom Canguru</title></head><body><div>R$58,99</div><span>R$99,90</span></body></html>'
  const shopeeApiPayload = {
    data: {
      item: {
        name: 'Moletom Canguru Capuz Bolso Blusa de Frio Feminino Masculino Unissex Algodão Dragão Japonês',
        price_min: 0,
        price: 0,
        price_before_discount: 0,
      },
    },
  }

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes('/api/v4/item/get?itemid=58255937719&shopid=392751109')) {
      return {
        ok: true,
        headers: { get: () => 'application/json; charset=utf-8' },
        json: async () => shopeeApiPayload,
      }
    }
    return mockHtmlResponse(shellHtml, 'https://shopee.com.br/Moletom-Canguru-Capuz-Bolso-Blusa-de-Frio-Feminino-Masculino-Unissex-Algod%C3%A3o-Drag%C3%A3o-Japon%C3%AAs-i.392751109.58255937719')
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://shopee.com.br/Moletom-Canguru-Capuz-Bolso-Blusa-de-Frio-Feminino-Masculino-Unissex-Algod%C3%A3o-Drag%C3%A3o-Japon%C3%AAs-i.392751109.58255937719')
  assert.equal(info.newPrice, '58,99')
  assert.equal(info.oldPrice, '99,90')
})

test('fetchProductInfo resolve short link da Shopee antes de consultar a API', async (t) => {
  const shellHtml = '<!doctype html><html><head><title>Shopee Brasil</title></head><body>app shell</body></html>'
  const shopeeApiPayload = {
    data: {
      item: {
        name: 'Kit Maquiagem Completo Com Pincéis Empreendedora Sucesso',
        price_before_discount: 7900000,
        price_min: 3318000,
      },
    },
  }

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url === 'https://s.shopee.com.br/6L1arzoKKY') {
      return mockHtmlResponse(shellHtml, 'https://shopee.com.br/Kit-Maquiagem-Completo-Com-Pinc%C3%A9is-Empreendedora-Sucesso-i.358101010.21697493290')
    }
    if (url.includes('/api/v4/item/get?itemid=21697493290&shopid=358101010')) {
      return {
        ok: true,
        headers: { get: () => 'application/json; charset=utf-8' },
        json: async () => shopeeApiPayload,
      }
    }
    if (url.includes('shopee.com.br/Kit-Maquiagem-Completo-Com-Pinc')) {
      return mockHtmlResponse(shellHtml, 'https://shopee.com.br/Kit-Maquiagem-Completo-Com-Pinc%C3%A9is-Empreendedora-Sucesso-i.358101010.21697493290')
    }
    throw new Error(`unexpected fetch: ${url}`)
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://s.shopee.com.br/6L1arzoKKY')
  assert.equal(info.title, 'Kit Maquiagem Completo Com Pincéis Empreendedora Sucesso')
  assert.equal(info.oldPrice, '79,00')
  assert.equal(info.newPrice, '33,18')
})

test('fetchProductInfo usa título do slug da URL quando Shopee API falhar', async (t) => {
  const shellHtml = '<!doctype html><html><head><title>Shopee Brasil</title></head><body>app shell</body></html>'
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes('/api/v4/item/get?')) {
      return { ok: false, headers: { get: () => 'application/json' } }
    }
    return mockHtmlResponse(shellHtml, 'https://shopee.com.br/Kit-Maquiagem-Completo-Com-Pinc%C3%A9is-Empreendedora-Sucesso-i.358101010.21697493290')
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://shopee.com.br/Kit-Maquiagem-Completo-Com-Pinc%C3%A9is-Empreendedora-Sucesso-i.358101010.21697493290?extraParams=1')
  assert.match(info.title, /Kit Maquiagem Completo Com Pincéis Empreendedora Sucesso/i)
})

test('fetchProductInfo usa fallback da API de products do Mercado Livre para título e preço em URL /p/', async (t) => {
  const htmlShell = '<!doctype html><html><head><title>Mercado Libre</title></head><body>anti-bot shell</body></html>'
  const mlProductsPayload = {
    name: 'Secador de roupas 600w elétrico portátil suspenso cortina compacto econômico seca rápido 110v',
    buy_box_winner: { price: 189.9 },
  }

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes('mercadolivre.com.br/secador-de-roupas') && !url.includes('api.mercadolibre.com')) {
      return mockHtmlResponse(htmlShell, 'https://www.mercadolivre.com.br/secador-de-roupas-600w-eletrico-portatil-suspenso-cortina-compacto-econmico-seca-rapido-110v/p/MLB70009242')
    }
    if (url === 'https://api.mercadolibre.com/products/MLB70009242') {
      return {
        ok: true,
        headers: { get: () => 'application/json; charset=utf-8' },
        json: async () => mlProductsPayload,
      }
    }
    throw new Error(`unexpected fetch: ${url}`)
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://www.mercadolivre.com.br/secador-de-roupas-600w-eletrico-portatil-suspenso-cortina-compacto-econmico-seca-rapido-110v/p/MLB70009242')
  assert.match(info.title, /Secador de roupas 600w elétrico portátil/i)
  assert.equal(info.newPrice, '189,90')
})

test('fetchProductInfo mantém fallback de API do Mercado Livre mesmo quando fetch do HTML falha', async (t) => {
  const mlProductsPayload = {
    name: 'Secador de roupas 600w elétrico portátil suspenso cortina compacto econômico seca rápido 110v',
    buy_box_winner: { price: 189.9 },
  }

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes('mercadolivre.com.br/secador-de-roupas')) {
      throw new Error('network blocked')
    }
    if (url === 'https://api.mercadolibre.com/products/MLB70009242') {
      return {
        ok: true,
        headers: { get: () => 'application/json; charset=utf-8' },
        json: async () => mlProductsPayload,
      }
    }
    throw new Error(`unexpected fetch: ${url}`)
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://www.mercadolivre.com.br/secador-de-roupas-600w-eletrico-portatil-suspenso-cortina-compacto-econmico-seca-rapido-110v/p/MLB70009242')
  assert.match(info.title, /Secador de roupas 600w elétrico portátil/i)
  assert.equal(info.newPrice, '189,90')
})
