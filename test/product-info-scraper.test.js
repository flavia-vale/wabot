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

test('fetchProductInfo extrai preço da Shopee por JSON inline quando API falha', async (t) => {
  const shellHtml = '<html><body>{"price_min":5899000,"price_before_discount":9990000,"price":5899000}</body></html>'

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes('/api/v4/item/get?itemid=58255937719&shopid=392751109')) {
      return {
        ok: true,
        headers: { get: () => 'application/json; charset=utf-8' },
        json: async () => ({ data: { item: { name: '', price_min: 0, price: 0, price_before_discount: 0 } } }),
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

test('fetchProductInfo extrai título e preços do HTML da PDP do Mercado Livre (sem API)', async (t) => {
  const html = `<!doctype html><html><head>
    <meta property="og:title" content="02 Forma Silicone Retangular Reutilizável Air Fryer"/>
    <title>Forma Silicone | Mercado Livre</title>
  </head><body>
    <h1 class="ui-pdp-title">02 Forma Silicone Retangular Reutilizável Air Fryer</h1>
    <div class="ui-pdp-price__main-container">
      <s class="andes-money-amount ui-pdp-price__original-value andes-money-amount--previous">
        <span class="andes-money-amount__currency-symbol">R$</span>
        <span class="andes-money-amount__fraction">59</span>
        <span class="andes-money-amount__cents">99</span>
      </s>
      <div class="ui-pdp-price__second-line">
        <span class="andes-money-amount andes-money-amount--cents-superscript">
          <span class="andes-money-amount__currency-symbol">R$</span>
          <span class="andes-money-amount__fraction">39</span>
          <span class="andes-money-amount__cents">90</span>
        </span>
      </div>
    </div>
  </body></html>`

  const originalFetch = globalThis.fetch
  // API de products responde 401 (estado atual) — extração precisa vir do HTML.
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes('api.mercadolibre.com')) {
      return { ok: false, status: 401, headers: { get: () => 'application/json' }, json: async () => ({}) }
    }
    return mockHtmlResponse(html, 'https://www.mercadolivre.com.br/forma-silicone/p/MLB69573479')
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://www.mercadolivre.com.br/forma-silicone/p/MLB69573479')
  assert.match(info.title, /02 Forma Silicone Retangular Reutilizável Air Fryer/i)
  assert.equal(info.newPrice, '39,90')
  assert.equal(info.oldPrice, '59,99')
})

test('fetchProductInfo extrai preços do JSON embarcado da PDP do Mercado Livre', async (t) => {
  const html = `<!doctype html><html><head>
    <meta property="og:title" content="Secador De Roupas Elétrico Portátil"/>
    </head><body><div id="ui-pdp-root"></div>
    <script type="application/json" id="__PRELOADED_STATE__">
      {"components":{"price":{"value":189.9,"original_price":259.9,"currency_id":"BRL"}}}
    </script></body></html>`

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes('api.mercadolibre.com')) {
      return { ok: false, status: 401, headers: { get: () => 'application/json' }, json: async () => ({}) }
    }
    return mockHtmlResponse(html, 'https://www.mercadolivre.com.br/secador/p/MLB70009242')
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://www.mercadolivre.com.br/secador/p/MLB70009242')
  assert.match(info.title, /Secador De Roupas Elétrico Portátil/i)
  assert.equal(info.newPrice, '189,90')
  assert.equal(info.oldPrice, '259,90')
})

test('fetchProductInfo envia cookie de sessão do ML e extrai dados da PDP autenticada', async (t) => {
  const antiBot = '<!doctype html><html><head><title>Mercado Libre</title></head><body>account-verification</body></html>'
  const realPdp = `<!doctype html><html><head>
    <meta property="og:title" content="Forma Universal Air Fryer Forno E Micro-ondas"/>
    </head><body>
    <h1 class="ui-pdp-title">Forma Universal Air Fryer Forno E Micro-ondas</h1>
    <div class="ui-pdp-price__second-line">
      <span class="andes-money-amount"><span class="andes-money-amount__fraction">29</span><span class="andes-money-amount__cents">90</span></span>
    </div>
  </body></html>`

  let sentCookie = null
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url.includes('api.mercadolibre.com')) {
      return { ok: false, status: 401, headers: { get: () => 'application/json' }, json: async () => ({}) }
    }
    const cookie = init?.headers?.Cookie || null
    if (cookie) sentCookie = cookie
    // Sem cookie de sessão, o ML devolve a página anti-bot.
    const body = cookie ? realPdp : antiBot
    return mockHtmlResponse(body, 'https://www.mercadolivre.com.br/forma-universal/p/MLB26402871')
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://www.mercadolivre.com.br/forma-universal/p/MLB26402871', {
    mlCredentials: { ssid: 'sessionid1234567890', csrf: 'tok', id: '42' },
  })
  assert.equal(sentCookie, 'id=42; _csrf=tok; ssid=sessionid1234567890')
  assert.match(info.title, /Forma Universal Air Fryer/i)
  assert.equal(info.newPrice, '29,90')
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

test('fetchProductInfo retenta URL ML com cookie quando meli.la redireciona cross-domain sem cookie (caso html=null)', async (t) => {
  const realPdp = `<!doctype html><html><head>
    <meta property="og:title" content="02 Forma Silicone Retangular Reutilizável Air Fryer"/>
  </head><body>
    <h1 class="ui-pdp-title">02 Forma Silicone Retangular Reutilizável Air Fryer</h1>
    <div class="ui-pdp-price__second-line">
      <span class="andes-money-amount">
        <span class="andes-money-amount__fraction">39</span>
        <span class="andes-money-amount__cents">90</span>
      </span>
    </div>
  </body></html>`

  let retryCookieSent = null
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const cookie = init?.headers?.Cookie
    // meli.la redireciona para ML, mas a URL final retorna 403 sem cookie
    // (simula o redirect cross-domain onde o cookie foi descartado pelo fetch)
    if (/meli\.la/.test(url)) {
      return { ok: false, status: 403, url: 'https://www.mercadolivre.com.br/forma-silicone/p/MLB69573479', headers: { get: () => null }, body: null, text: async () => '' }
    }
    if (url.includes('api.mercadolibre.com')) {
      return { ok: false, status: 403, headers: { get: () => 'application/json' }, json: async () => ({}) }
    }
    // Retry direto na URL ML: com cookie → produto real
    if (url.includes('mercadolivre.com.br/forma-silicone')) {
      if (cookie) {
        retryCookieSent = cookie
        return { ok: true, status: 200, url, headers: { get: (n) => n === 'content-type' ? 'text/html' : null }, body: null, text: async () => realPdp }
      }
      return { ok: false, status: 403, url, headers: { get: () => null }, body: null, text: async () => '' }
    }
    throw new Error(`unexpected fetch: ${url}`)
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://meli.la/2jUq4U9', {
    mlCredentials: { ssid: 'sessionid1234567890', tag: '123456', id: '42' },
  })

  assert.ok(retryCookieSent, 'deve ter reenviado o cookie no retry')
  assert.match(retryCookieSent, /ssid=sessionid1234567890/)
  assert.match(info.title, /02 Forma Silicone Retangular Reutiliz/i)
  assert.equal(info.newPrice, '39,90')
})

test('fetchProductInfo retenta URL ML com cookie quando meli.la redireciona para página anti-bot (caso html=antibot)', async (t) => {
  const antiBot = '<!doctype html><html><head><title>Mercado Libre</title></head><body>account-verification</body></html>'
  const realPdp = `<!doctype html><html><head>
    <meta property="og:title" content="Fritadeira Air Fryer Digital 4L"/>
  </head><body>
    <h1 class="ui-pdp-title">Fritadeira Air Fryer Digital 4L</h1>
    <div class="ui-pdp-price__second-line">
      <span class="andes-money-amount">
        <span class="andes-money-amount__fraction">299</span>
        <span class="andes-money-amount__cents">00</span>
      </span>
    </div>
  </body></html>`

  let fetchSequence = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const cookie = init?.headers?.Cookie
    fetchSequence.push({ url: url.slice(0, 60), hasCookie: !!cookie })
    if (/meli\.la/.test(url)) {
      // Redirect para ML, mas sem cookie o ML serve anti-bot (200 status)
      return { ok: true, status: 200, url: 'https://www.mercadolivre.com.br/fritadeira/p/MLB99991111', headers: { get: (n) => n === 'content-type' ? 'text/html' : null }, body: null, text: async () => antiBot }
    }
    if (url.includes('api.mercadolibre.com')) {
      return { ok: false, status: 403, headers: { get: () => 'application/json' }, json: async () => ({}) }
    }
    if (url.includes('mercadolivre.com.br/fritadeira')) {
      if (cookie) {
        return { ok: true, status: 200, url, headers: { get: (n) => n === 'content-type' ? 'text/html' : null }, body: null, text: async () => realPdp }
      }
      return { ok: true, status: 200, url, headers: { get: (n) => n === 'content-type' ? 'text/html' : null }, body: null, text: async () => antiBot }
    }
    throw new Error(`unexpected fetch: ${url}`)
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://meli.la/ABCDE123', {
    mlCredentials: { ssid: 'sessionid1234567890', tag: '123456', id: '42' },
  })

  const retryCall = fetchSequence.find(c => c.url.includes('mercadolivre.com.br/fritadeira') && c.hasCookie)
  assert.ok(retryCall, 'deve ter feito retry com cookie na URL ML')
  assert.match(info.title, /Fritadeira Air Fryer Digital 4L/i)
  assert.equal(info.newPrice, '299,00')
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
