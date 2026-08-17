import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fetchProductInfo, getMlUserToken } from '../src/converters/productInfoScraper.js'

function mockHtmlResponse(html, url = 'https://www.amazon.com.br/dp/B0CXGBT3Z9') {
  return {
    ok: true,
    url,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null) },
    body: null,
    text: async () => html,
  }
}

function mockRedirectResponse(location, url) {
  return {
    ok: false,
    status: 301,
    url,
    headers: { get: (name) => (name.toLowerCase() === 'location' ? location : null) },
    text: async () => '',
  }
}

// Regressão: link de afiliado ML (meli.la) que expande para uma share /social/?ref=.
// A página tem o produto destacado (previous/current_price) seguido de outros
// produtos vizinhos com `"price":{"value":..}`. Sem a precedência de social share,
// extractMercadoLivreFromHtml casava o preço do vizinho (errado). Deve sair o
// preço do produto destacado pelo ref.
test('fetchProductInfo (ML social share) usa o preço do produto destacado, não o de produtos vizinhos', async (t) => {
  const expanded = 'https://www.mercadolivre.com.br/social/475630078?matt_word=475630078&ref=ENCRYPTEDREF'
  const socialHtml = `<!doctype html><html><head>
    <meta property="og:title" content="Lava E Seca Samsung Wd11m Com Digital Inverter Inox 11kg" />
    <title>Mercado Libre</title></head><body class="ui-pdp">
    <script>window.__PRELOADED_STATE__={"items":[
      {"id":"MLB19055866","price":{"previous_price":{"value":3699,"currency":"BRL"},"current_price":{"value":3344,"currency":"BRL"}}},
      {"id":"MLB777","price":{"value":195.61,"currency":"BRL"}},
      {"id":"MLB888","price":{"value":30,"currency":"BRL"}}
    ]}</script>
  </body></html>`

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const target = String(input)
    if (/meli\.la/.test(target)) {
      assert.equal(init?.redirect, 'manual')
      return mockRedirectResponse(expanded, target)
    }
    return mockHtmlResponse(socialHtml, expanded)
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://meli.la/2jBSikD', { mlCredentials: { ssid: 'x'.repeat(20) } })
  assert.match(info.title, /Lava E Seca Samsung/)
  assert.equal(info.newPrice, '3344,00')
  assert.equal(info.oldPrice, '3699,00')
})

// Regressão (painel "Criar oferta" não raspava meli.la, 2026-07-23): a página
// /social/?ref= é renderizada pelo ML server-side e serve og:title/preço para
// QUALQUER requisição — não exige cookie de sessão. Antes, sem mlCredentials
// (usuário sem ML conectado no painel), o código ignorava a share e
// canonicalizava para a PDP (produto.mercadolivre.com.br/MLB...), que o ML
// bloqueia com a parede anti-bot para IP de datacenter sem sessão — resultando
// em título/preço vazios ("Não conseguimos ler título e preço desse link").
test('fetchProductInfo (ML social share) funciona SEM mlCredentials — não exige cookie', async (t) => {
  const expanded = 'https://www.mercadolivre.com.br/social/475630078?matt_word=475630078&ref=ENCRYPTEDREF'
  const socialHtml = `<!doctype html><html><head>
    <meta property="og:title" content="Jaqueta Puffer Blusa De Frio Impermeável Inverno Bobojaco" />
    <title>Cuponito | Perfil Social</title></head><body>
    <script>window.__PRELOADED_STATE__={"price":{"previous_price":{"value":199,"currency":"BRL"},"current_price":{"value":76.61,"currency":"BRL"}}}</script>
  </body></html>`

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const target = String(input)
    if (/meli\.la/.test(target)) {
      assert.equal(init?.redirect, 'manual')
      return mockRedirectResponse(expanded, target)
    }
    // Sem credenciais, nenhum Cookie deve ser enviado ao buscar a share.
    assert.ok(!init?.headers?.Cookie, 'não deve enviar cookie sem mlCredentials')
    return mockHtmlResponse(socialHtml, expanded)
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://meli.la/2YH3Vob', {})
  assert.match(info.title, /Jaqueta Puffer/)
  assert.equal(info.newPrice, '76,61')
  assert.equal(info.oldPrice, '199,00')
})

// Regressão: Amazon serve intermitentemente uma página de CAPTCHA (~5KB,
// opfcaptcha) no lugar da PDP. fetchProductInfo deve detectar e re-tentar até
// pegar a página real.
test('fetchProductInfo (Amazon) re-tenta quando cai na página de CAPTCHA', async (t) => {
  const captchaHtml = `<!doctype html><html><head><title>Amazon.com.br</title>
    <script>ue_sn = "opfcaptcha.amazon.com";</script></head>
    <body><!-- To discuss automated access to Amazon data please contact api-services-support@amazon.com. -->
    <form action="/errors/validateCaptcha"></form></body></html>`
  const realHtml = `<!doctype html><html><head><title>Amazon.com.br</title></head><body>
    <span id="productTitle">Granado Perfume Vintage Flora Magnífica 75 ml</span>
    <span class="a-price"><span class="a-offscreen">R$&nbsp;224,25</span></span>
    ${'<!-- padding -->'.repeat(4000)}
  </body></html>`

  let calls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    calls += 1
    // 1ª e 2ª chamadas: captcha; 3ª em diante: página real.
    return mockHtmlResponse(calls < 3 ? captchaHtml : realHtml, 'https://www.amazon.com.br/dp/B0G1TNVJPH')
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://www.amazon.com.br/dp/B0G1TNVJPH')
  assert.ok(calls >= 3, `deveria ter re-tentado (chamadas=${calls})`)
  assert.match(info.title, /Granado/)
  assert.equal(info.newPrice, '224,25')
})

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

// Regressão (produção, 2026-06): short link s.shopee.com.br cuja cadeia de
// redirect termina numa página anti-bot (verify/traffic) — o fetch follow
// antigo perdia a URL do produto que passou no hop intermediário e a oferta
// saía sem título E sem preço ("Não conseguimos ler título e preço desse
// link"). O resolvedor manual deve capturar os IDs do hop intermediário e a
// API v4 deve ser consultada com eles.
test('fetchProductInfo (regressão) lê título/preço de short link Shopee mesmo com hop anti-bot no fim da cadeia', async (t) => {
  const shellHtml = '<!doctype html><html><head><title>Shopee Brasil</title></head><body>app shell</body></html>'
  const shortUrl = 'https://s.shopee.com.br/4AxVbYMHaA'
  const verifyUrl = 'https://shopee.com.br/verify/traffic?next=https%3A%2F%2Fshopee.com.br%2FCafeteira-El%C3%A9trica-30-Xicaras-i.358101010.21697493290'
  let v4Query = null

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url === shortUrl) {
      assert.equal(init?.redirect, 'manual')
      return mockRedirectResponse(verifyUrl, url)
    }
    if (url.includes('/api/v4/item/get?')) {
      v4Query = url
      return {
        ok: true,
        headers: { get: () => 'application/json; charset=utf-8' },
        json: async () => ({ data: { item: { name: 'Cafeteira Elétrica 30 Xícaras Inox', price_before_discount: 19900000, price_min: 14990000 } } }),
      }
    }
    return mockHtmlResponse(shellHtml, url)
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo(shortUrl)
  assert.match(String(v4Query), /itemid=21697493290&shopid=358101010/)
  assert.equal(info.title, 'Cafeteira Elétrica 30 Xícaras Inox')
  assert.equal(info.oldPrice, '199,00')
  assert.equal(info.newPrice, '149,90')
})

// Regressão complementar: short link servido como interstitial 200 com
// redirect via JS (sem redirect HTTP). Mesmo com a API v4 fora do ar, o
// título deve sair do slug da URL do produto extraída do corpo.
test('fetchProductInfo (regressão) resolve short link Shopee servido como interstitial JS e usa título do slug', async (t) => {
  const shortUrl = 'https://s.shopee.com.br/4AxVbYMHaA'
  const interstitial = '<!doctype html><html><body><script>location.replace("https:\\/\\/shopee.com.br\\/Caneca-Ceramica-Premium-i.111.222?utm_source=an_x")</script></body></html>'
  const shellHtml = '<!doctype html><html><head><title>Shopee Brasil</title></head><body>app shell</body></html>'

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url === shortUrl) return mockHtmlResponse(interstitial, shortUrl)
    if (url.includes('/api/v4/item/get?')) {
      return { ok: false, headers: { get: () => 'application/json' } }
    }
    return mockHtmlResponse(shellHtml, url)
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo(shortUrl)
  assert.match(info.title, /Caneca Ceramica Premium/i)
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

// ── Shopee SSR sem creds ────────────────────────────────────────────────────

test('fetchProductInfo (Shopee sem creds) extrai título e preço do SSR retornado por crawler UA', async (t) => {
  // Simula: BROWSER_UA retorna SPA shell; facebookexternalhit retorna SSR com produto.
  const shellHtml = '<!doctype html><html><head><title>Shopee Brasil</title></head><body></body></html>'
  const ssrHtml = `<!doctype html><html><head>
    <meta property="og:title" content="Kit Maquiagem Completo Com Pincéis Profissionais" />
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Kit Maquiagem Completo Com Pincéis Profissionais","offers":{"@type":"Offer","price":"33.18","priceCurrency":"BRL"}}</script>
  </head><body>produto</body></html>`

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const ua = (init?.headers?.['User-Agent'] || init?.headers?.['user-agent'] || '')
    if (url.includes('/api/v4/item/get?')) {
      return { ok: false, headers: { get: () => 'application/json' }, json: async () => ({ error: 90309999 }) }
    }
    if (/facebookexternalhit|WhatsApp|Googlebot/i.test(ua)) {
      return mockHtmlResponse(ssrHtml, 'https://shopee.com.br/Kit-Maquiagem-i.358101010.21697493290')
    }
    return mockHtmlResponse(shellHtml, 'https://shopee.com.br/Kit-Maquiagem-i.358101010.21697493290')
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://shopee.com.br/Kit-Maquiagem-i.358101010.21697493290')
  assert.match(info.title, /Kit Maquiagem Completo Com Pincéis Profissionais/i)
  assert.equal(info.newPrice, '33,18')
})

test('fetchProductInfo (Shopee sem creds) usa título do slug quando crawler UA também falha', async (t) => {
  const shellHtml = '<!doctype html><html><head><title>Shopee Brasil</title></head><body></body></html>'
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes('/api/v4/item/get?')) {
      return { ok: false, headers: { get: () => 'application/json' }, json: async () => ({}) }
    }
    // todos os UAs retornam o shell
    return mockHtmlResponse(shellHtml, url)
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://shopee.com.br/Kit-Maquiagem-Com-Pinceis-i.358101010.21697493290')
  assert.match(info.title, /Kit Maquiagem Com Pinceis/i)
  // sem preço quando tudo falha
  assert.equal(info.newPrice, '')
})

test('fetchProductInfo (Shopee sem creds) detecta o shell SPA REAL de produção e dispara o retry com crawler UA', async (t) => {
  const realShellHtml = readFileSync(new URL('./fixtures/shopee-spa-shell.html', import.meta.url), 'utf8')
  const ssrHtml = `<!doctype html><html><head>
    <meta property="og:title" content="Kit Maquiagem Completo Com Pincéis Profissionais" />
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Kit Maquiagem Completo Com Pincéis Profissionais","offers":{"@type":"Offer","price":"33.18","priceCurrency":"BRL"}}</script>
  </head><body>produto</body></html>`

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const ua = (init?.headers?.['User-Agent'] || init?.headers?.['user-agent'] || '')
    if (url.includes('/api/v4/item/get?')) {
      return { ok: false, headers: { get: () => 'application/json' }, json: async () => ({ error: 90309999 }) }
    }
    if (/facebookexternalhit|WhatsApp|Googlebot/i.test(ua)) {
      return mockHtmlResponse(ssrHtml, 'https://shopee.com.br/Kit-Maquiagem-i.358101010.21697493290')
    }
    return mockHtmlResponse(realShellHtml, 'https://shopee.com.br/Kit-Maquiagem-i.358101010.21697493290')
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://shopee.com.br/Kit-Maquiagem-i.358101010.21697493290')
  assert.match(info.title, /Kit Maquiagem Completo Com Pincéis Profissionais/i)
  assert.equal(info.newPrice, '33,18')
})

// ── Mercado Livre SSR sem creds ─────────────────────────────────────────────

test('fetchProductInfo (ML sem creds) tenta facebookexternalhit quando HTML é anti-bot e extrai título+preço', async (t) => {
  const antibotHtml = '<!doctype html><html><head><title>Mercado Libre</title></head><body><div id="gz-verify">Verificação de segurança</div></body></html>'
  const ssrHtml = `<!doctype html><html><head>
    <meta property="og:title" content="Liquidificador Arno Faciclic Plus 550W" />
  </head><body class="ui-pdp">
    <h1 class="ui-pdp-title">Liquidificador Arno Faciclic Plus 550W</h1>
    <div class="ui-pdp-price__second-line">
      <span class="andes-money-amount__fraction">149</span>
      <span class="andes-money-amount__cents">90</span>
    </div>
  </body></html>`

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const ua = init?.headers?.['User-Agent'] || init?.headers?.['user-agent'] || ''
    if (url.includes('api.mercadolibre.com')) return { ok: false, headers: { get: () => null } }
    if (/facebookexternalhit|WhatsApp/i.test(ua)) {
      return mockHtmlResponse(ssrHtml, url)
    }
    return mockHtmlResponse(antibotHtml, url)
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://www.mercadolivre.com.br/liquidificador-arno/MLB123456')
  assert.match(info.title, /Liquidificador Arno Faciclic Plus/i)
  assert.equal(info.newPrice, '149,90')
})

// ── Amazon crawler UA fallback ───────────────────────────────────────────────

test('fetchProductInfo (Amazon) usa facebookexternalhit quando todos os retries de CAPTCHA falham', async (t) => {
  const captchaHtml = `<!doctype html><html><head><title>Amazon.com.br</title></head>
    <body><p>Type the characters you see in this image:</p>
    <img src="https://images-na.ssl-images-amazon.com/captcha/abc.jpg"/></body></html>`
  const productHtml = `<!doctype html><html><head><title>Fritadeira Air Fryer Mondial - Amazon.com.br</title></head>
    <body>
      <span id="productTitle"> Fritadeira Air Fryer Mondial 4L Preta </span>
      <span class="a-price a-text-price a-size-medium apexPriceToPay">
        <span class="a-offscreen">R$319,90</span>
      </span>
    </body></html>`

  const originalFetch = globalThis.fetch
  let normalCallCount = 0
  globalThis.fetch = async (input, init) => {
    const ua = init?.headers?.['User-Agent'] || ''
    if (/facebookexternalhit/i.test(ua)) {
      return mockHtmlResponse(productHtml, String(input))
    }
    normalCallCount++
    return mockHtmlResponse(captchaHtml, String(input))
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://www.amazon.com.br/dp/B09VQ39F41')
  assert.match(info.title, /Fritadeira Air Fryer Mondial/i)
  assert.equal(info.newPrice, '319,90')
  assert.ok(normalCallCount >= 2, 'deve tentar os retries normais antes do crawler UA')
})

// ── Regressões: caminho COM creds não deve chamar crawler UA ─────────────────

test('fetchProductInfo (Shopee COM creds) não chama crawler UA — usa API de afiliado', async (t) => {
  let crawlerUaCalled = false
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const ua = init?.headers?.['User-Agent'] || init?.headers?.['user-agent'] || ''
    if (/facebookexternalhit|WhatsApp|Googlebot/i.test(ua)) {
      crawlerUaCalled = true
    }
    if (String(input).includes('open-api.affiliate.shopee')) {
      return { ok: false, headers: { get: () => 'application/json' }, json: async () => ({}) }
    }
    return mockHtmlResponse('<!doctype html><html><head><title>Shopee Brasil</title></head><body></body></html>', String(input))
  }
  t.after(() => { globalThis.fetch = originalFetch })

  await fetchProductInfo('https://shopee.com.br/Produto-i.111.222', { shopeeCredentials: { appId: '123', secretKey: 'abc' } })
  assert.equal(crawlerUaCalled, false, 'crawler UA não deve ser chamado quando shopeeCreds está presente')
})

test('fetchProductInfo (ML COM creds) não chama facebookexternalhit — usa cookie+UA mobile existente', async (t) => {
  let crawlerUaCalled = false
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const ua = init?.headers?.['User-Agent'] || init?.headers?.['user-agent'] || ''
    if (/facebookexternalhit/i.test(ua)) crawlerUaCalled = true
    return mockHtmlResponse(`<!doctype html><html><head>
        <meta property="og:title" content="Produto ML"/>
        </head><body class="ui-pdp">
        <span class="andes-money-amount__fraction">199</span>
        <span class="andes-money-amount__cents">90</span>
        </body></html>`, String(input))
  }
  t.after(() => { globalThis.fetch = originalFetch })

  await fetchProductInfo('https://produto.mercadolivre.com.br/MLB123', {
    mlCredentials: { ssid: 'x'.repeat(20) },
  })
  assert.equal(crawlerUaCalled, false, 'crawler UA não deve ser chamado quando mlCredentials está presente')
})

// Regressão: a página anti-bot/verificação do ML tem og:title "Mercado Libre"
// (grafia espanhola) e nenhum marcador de produto. Antes esse rótulo de loja
// vazava como TÍTULO de produto (na oferta espelhada saía "Mercado Libre" +
// preço errado). isBogusScrapeTitle agora cobre a grafia espanhola e o título
// final é filtrado — deve vir vazio em vez do rótulo genérico.
test('fetchProductInfo (ML) não vaza "Mercado Libre" da página anti-bot como título', async (t) => {
  const antiBotHtml = `<!doctype html><html><head>
    <meta property="og:title" content="Mercado Libre"/>
    <title>Mercado Libre</title></head>
    <body><div id="gz-verify">account-verification</div></body></html>`

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => mockHtmlResponse(antiBotHtml, String(input))
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://produto.mercadolivre.com.br/MLB123', {
    mlCredentials: { ssid: 'x'.repeat(20) },
  })
  assert.equal(info.title, '', 'rótulo genérico de loja não pode virar título de produto')
})

// Regressão (incidente 2026-06-23): a página anti-bot da Shopee serve og:title
// "Oops! Seu navegador não é mais aceito!" — uma FRASE, não um rótulo de loja.
// Antes ela vazava como TÍTULO da oferta espelhada. isBogusScrapeTitle agora
// casa a frase por padrão; o título final deve vir vazio (→ o espelhamento cai
// no relay do texto original em vez de emitir o interstício).
test('fetchProductInfo (Shopee) não vaza o interstício anti-bot "Oops! Seu navegador..." como título', async (t) => {
  const antiBotHtml = `<!doctype html><html><head>
    <meta property="og:title" content="Oops! Seu navegador não é mais aceito!"/>
    <title>Oops! Seu navegador não é mais aceito!</title></head>
    <body>browser blocked</body></html>`

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => mockHtmlResponse(antiBotHtml, String(input))
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://s.shopee.com.br/5VTC0c5D8e')
  assert.equal(info.title, '', 'interstício anti-bot não pode virar título de produto')
})

// specs/012-shein-store-support (D-006/T041): o og:title do oneLink da SHEIN
// é sempre a MESMA frase promocional, igual para qualquer produto. Sem a
// guarda, ela vazaria como título de produto — mesma classe de bug do
// interstício anti-bot da Shopee acima.
test('fetchProductInfo (SHEIN) não vaza a frase promocional genérica do oneLink como título', async (t) => {
  const oneLinkHtml = `<!doctype html><html><head>
    <meta property="og:title" content="Não perca esta oferta grande na SHEIN! Economize muito agora!"/>
    <title>SHEIN</title></head>
    <body><input id="url" value="https://m.shein.com/br/ark/default?goods_id=485735309"></body></html>`

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => mockHtmlResponse(oneLinkHtml, String(input))
  t.after(() => { globalThis.fetch = originalFetch })

  const info = await fetchProductInfo('https://onelink.shein.com/14/4v4p6bpzshsx')
  assert.equal(info.title, '', 'frase promocional genérica não pode virar título de produto')
})

// 005-ml-cookie-expiry (US1/T006): getMlUserToken passa a retornar
// { token, credentialPatch } em vez de uma string solta, para que o chamador
// persista o refresh_token ROTACIONADO (single-use no ML) em vez de
// descartá-lo — causa raiz nova confirmada em research.md.

test('getMlUserToken: access token expirado + fetch mockado => credentialPatch com refresh_token novo (≠ do anterior)', async (t) => {
  const prevEnv = { ML_CLIENT_ID: process.env.ML_CLIENT_ID, ML_CLIENT_SECRET: process.env.ML_CLIENT_SECRET }
  process.env.ML_CLIENT_ID = 'client-id-test'
  process.env.ML_CLIENT_SECRET = 'client-secret-test'
  t.after(() => {
    process.env.ML_CLIENT_ID = prevEnv.ML_CLIENT_ID
    process.env.ML_CLIENT_SECRET = prevEnv.ML_CLIENT_SECRET
  })

  t.mock.method(global, 'fetch', async () => ({
    ok: true,
    json: async () => ({ access_token: 'access-fresh', refresh_token: 'refresh-fresh', expires_in: 21600 }),
  }))

  const result = await getMlUserToken({
    oauthAccessToken: 'access-old',
    oauthTokenExpiry: Date.now() - 1000,
    oauthRefreshToken: 'refresh-old',
  })

  assert.equal(result.token, 'access-fresh')
  assert.ok(result.credentialPatch)
  assert.equal(result.credentialPatch.oauthAccessToken, 'access-fresh')
  assert.equal(result.credentialPatch.oauthRefreshToken, 'refresh-fresh')
  assert.notEqual(result.credentialPatch.oauthRefreshToken, 'refresh-old')
})

test('getMlUserToken: access ainda válido => reusa sem chamar fetch, credentialPatch é null', async (t) => {
  const fetchSpy = t.mock.fn(async () => { throw new Error('fetch não deveria ser chamado') })
  t.mock.method(global, 'fetch', fetchSpy)

  const result = await getMlUserToken({
    oauthAccessToken: 'access-valid',
    oauthTokenExpiry: Date.now() + 60_000,
    oauthRefreshToken: 'refresh-any',
  })

  assert.equal(result.token, 'access-valid')
  assert.equal(result.credentialPatch, null)
  assert.equal(fetchSpy.mock.callCount(), 0)
})

test('getMlUserToken: fetch falha (!res.ok) => { token:null, credentialPatch:null } sem apagar os campos de entrada', async (t) => {
  const prevEnv = { ML_CLIENT_ID: process.env.ML_CLIENT_ID, ML_CLIENT_SECRET: process.env.ML_CLIENT_SECRET }
  process.env.ML_CLIENT_ID = 'client-id-test'
  process.env.ML_CLIENT_SECRET = 'client-secret-test'
  t.after(() => {
    process.env.ML_CLIENT_ID = prevEnv.ML_CLIENT_ID
    process.env.ML_CLIENT_SECRET = prevEnv.ML_CLIENT_SECRET
  })

  t.mock.method(global, 'fetch', async () => ({ ok: false }))

  const input = {
    oauthAccessToken: 'access-old',
    oauthTokenExpiry: Date.now() - 1000,
    oauthRefreshToken: 'refresh-old',
  }
  const result = await getMlUserToken(input)

  assert.equal(result.token, null)
  assert.equal(result.credentialPatch, null)
  // quem chama não é instruído a reescrever nada: input original permanece intocado
  assert.equal(input.oauthRefreshToken, 'refresh-old')
})

test('getMlUserToken: fetch rejeita (erro de rede) => { token:null, credentialPatch:null }', async (t) => {
  const prevEnv = { ML_CLIENT_ID: process.env.ML_CLIENT_ID, ML_CLIENT_SECRET: process.env.ML_CLIENT_SECRET }
  process.env.ML_CLIENT_ID = 'client-id-test'
  process.env.ML_CLIENT_SECRET = 'client-secret-test'
  t.after(() => {
    process.env.ML_CLIENT_ID = prevEnv.ML_CLIENT_ID
    process.env.ML_CLIENT_SECRET = prevEnv.ML_CLIENT_SECRET
  })

  t.mock.method(global, 'fetch', async () => { throw new Error('ECONNRESET') })

  const result = await getMlUserToken({
    oauthAccessToken: 'access-old',
    oauthTokenExpiry: Date.now() - 1000,
    oauthRefreshToken: 'refresh-old',
  })

  assert.equal(result.token, null)
  assert.equal(result.credentialPatch, null)
})

test('getMlUserToken: sem oauthRefreshToken => { token:null, credentialPatch:null }', async () => {
  const result = await getMlUserToken({})
  assert.equal(result.token, null)
  assert.equal(result.credentialPatch, null)
})

// 005-ml-cookie-expiry (T030, Phase 7 — achado de review, severidade baixa):
// duas chamadas concorrentes de refresh OAuth para a MESMA credencial (mesmo
// ssid) usam o MESMO refresh_token single-use — sem serialização, as duas
// batem na API do ML ao mesmo tempo e uma delas recebe `!res.ok` porque a
// outra já invalidou o token. `getMlUserToken` agora serializa o refresh sob
// o mesmo lock por credencial do eixo cookie (`withMercadoLivreCredentialLock`).
test('getMlUserToken: duas chamadas concorrentes para a MESMA credencial serializam o refresh (nunca sobrepõem)', async (t) => {
  const prevEnv = { ML_CLIENT_ID: process.env.ML_CLIENT_ID, ML_CLIENT_SECRET: process.env.ML_CLIENT_SECRET }
  process.env.ML_CLIENT_ID = 'client-id-test'
  process.env.ML_CLIENT_SECRET = 'client-secret-test'
  t.after(() => {
    process.env.ML_CLIENT_ID = prevEnv.ML_CLIENT_ID
    process.env.ML_CLIENT_SECRET = prevEnv.ML_CLIENT_SECRET
  })

  let inFlight = 0
  let maxConcurrent = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    inFlight++
    maxConcurrent = Math.max(maxConcurrent, inFlight)
    await new Promise(resolve => setTimeout(resolve, 30))
    inFlight--
    return {
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ access_token: 'new-access-token', refresh_token: 'new-refresh-token', expires_in: 21600 }),
    }
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const creds = {
    ssid: 'x'.repeat(20),
    oauthAccessToken: 'access-old',
    oauthTokenExpiry: Date.now() - 1000,
    oauthRefreshToken: 'refresh-old',
  }

  const [r1, r2] = await Promise.all([
    getMlUserToken({ ...creds }),
    getMlUserToken({ ...creds }),
  ])

  assert.equal(maxConcurrent, 1, 'as duas chamadas de refresh OAuth para a mesma credencial nunca devem sobrepor')
  assert.equal(r1.credentialPatch?.oauthRefreshToken, 'new-refresh-token')
  assert.equal(r2.credentialPatch?.oauthRefreshToken, 'new-refresh-token')
})
