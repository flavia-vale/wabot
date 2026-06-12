import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveShopeeShortLink, extractShopeeIds, normalizeShopeeUrl, isShopeeShortLink } from '../src/converters/shopee.js'

// ---------------------------------------------------------------------------
// Contexto (regressão de produção, 2026-06): o short link s.shopee.com.br
// deixou de resolver via fetch(redirect:'follow') — a Shopee intercala hop
// anti-bot no fim da cadeia e serve interstitial 200 com redirect JS. Como
// TODAS as fontes de título/preço/imagem dependem de (shopId, itemId), a
// oferta saía vazia ("Não conseguimos ler título e preço desse link").
// ---------------------------------------------------------------------------

function redirectResponse(location, url) {
  return {
    ok: false,
    status: 302,
    url,
    headers: { get: (name) => (name.toLowerCase() === 'location' ? location : null) },
    text: async () => '',
  }
}

function htmlResponse(html, url, { setCookie = null } = {}) {
  return {
    ok: true,
    status: 200,
    url,
    headers: {
      get: (name) => {
        const lower = name.toLowerCase()
        if (lower === 'content-type') return 'text/html; charset=utf-8'
        if (lower === 'set-cookie') return setCookie
        return null
      },
    },
    body: null,
    text: async () => html,
  }
}

test('extractShopeeIds cobre slug -i., /product/, /opaanlp/ e universal-link', () => {
  assert.deepEqual(extractShopeeIds('https://shopee.com.br/Caneca-Premium-i.123.456?utm=x'), { shopId: '123', itemId: '456' })
  assert.deepEqual(extractShopeeIds('https://shopee.com.br/product/123/456'), { shopId: '123', itemId: '456' })
  assert.deepEqual(extractShopeeIds('https://shopee.com.br/opaanlp/123/456?__mobile__=1'), { shopId: '123', itemId: '456' })
  assert.deepEqual(extractShopeeIds('https://shopee.com.br/universal-link/product/123/456?deep_and_web=1'), { shopId: '123', itemId: '456' })
  assert.equal(extractShopeeIds('https://shopee.com.br/m/cupom-de-desconto'), null)
  assert.equal(extractShopeeIds('https://s.shopee.com.br/4AxVbYMHaA'), null)
})

test('extractShopeeIds acha IDs URL-encoded dentro de query param (página anti-bot verify/traffic)', () => {
  const verifyUrl = 'https://shopee.com.br/verify/traffic?next=https%3A%2F%2Fshopee.com.br%2FCaneca-Premium-i.123.456%3Futm_source%3Dan_x'
  assert.deepEqual(extractShopeeIds(verifyUrl), { shopId: '123', itemId: '456' })
  // normalizeShopeeUrl reescreve direto para a forma canônica /product/
  assert.equal(normalizeShopeeUrl(verifyUrl), 'https://shopee.com.br/product/123/456')
})

test('resolveShopeeShortLink não toca em URLs que não são short link (zero fetches)', async () => {
  const fetchImpl = async () => { throw new Error('não deveria buscar') }
  const url = 'https://shopee.com.br/Caneca-Premium-i.123.456'
  assert.equal(await resolveShopeeShortLink(url, { fetchImpl }), url)
  assert.equal(isShopeeShortLink(url), false)
  assert.equal(isShopeeShortLink('https://s.shopee.com.br/abc'), true)
  assert.equal(isShopeeShortLink('https://shope.ee/abc'), true)
})

test('resolveShopeeShortLink segue redirect manual e para no primeiro hop com IDs', async () => {
  const product = 'https://shopee.com.br/Caneca-Premium-i.123.456?uls_trackid=xyz'
  let fetches = 0
  const fetchImpl = async (url, init) => {
    fetches++
    assert.equal(init.redirect, 'manual')
    assert.match(init.headers['User-Agent'], /Chrome/)
    return redirectResponse(product, url)
  }
  const resolved = await resolveShopeeShortLink('https://s.shopee.com.br/4AxVbYMHaA', { fetchImpl })
  assert.equal(resolved, product)
  // mesmo que a cadeia real continuasse para uma página anti-bot, paramos
  // no hop que já tem os IDs — uma única requisição.
  assert.equal(fetches, 1)
})

test('resolveShopeeShortLink devolve URL com IDs mesmo quando a cadeia termina em verify/traffic', async () => {
  const verify = 'https://shopee.com.br/verify/traffic?next=https%3A%2F%2Fshopee.com.br%2FCaneca-Premium-i.123.456'
  const fetchImpl = async (url) => redirectResponse(verify, url)
  const resolved = await resolveShopeeShortLink('https://s.shopee.com.br/4AxVbYMHaA', { fetchImpl })
  assert.deepEqual(extractShopeeIds(resolved), { shopId: '123', itemId: '456' })
})

test('resolveShopeeShortLink extrai alvo de interstitial 200 com redirect JS (slashes escapadas)', async () => {
  const short = 'https://s.shopee.com.br/4AxVbYMHaA'
  const interstitial = '<!doctype html><html><body><script>setTimeout(function(){location.replace("https:\\/\\/shopee.com.br\\/Caneca-Premium-i.123.456?utm_source=an_x")},10)</script></body></html>'
  const fetchImpl = async (url) => htmlResponse(interstitial, url)
  const resolved = await resolveShopeeShortLink(short, { fetchImpl })
  assert.deepEqual(extractShopeeIds(resolved), { shopId: '123', itemId: '456' })
})

test('resolveShopeeShortLink extrai alvo de meta refresh', async () => {
  const short = 'https://s.shopee.com.br/4AxVbYMHaA'
  const interstitial = '<html><head><meta http-equiv="refresh" content="0;url=https://shopee.com.br/product/123/456"></head><body>redirecionando…</body></html>'
  const fetchImpl = async (url) => htmlResponse(interstitial, url)
  const resolved = await resolveShopeeShortLink(short, { fetchImpl })
  assert.deepEqual(extractShopeeIds(resolved), { shopId: '123', itemId: '456' })
})

test('resolveShopeeShortLink propaga cookies recebidos nos hops anteriores', async () => {
  const hop2 = 'https://s.shopee.com.br/intermediate'
  const product = 'https://shopee.com.br/Caneca-Premium-i.123.456'
  const seen = []
  const fetchImpl = async (url, init) => {
    seen.push({ url, cookie: init.headers.Cookie || null })
    if (url === 'https://s.shopee.com.br/4AxVbYMHaA') {
      const res = redirectResponse(hop2, url)
      res.headers = {
        get: (name) => {
          const lower = name.toLowerCase()
          if (lower === 'location') return hop2
          if (lower === 'set-cookie') return 'SPC_F=token123; Path=/; HttpOnly'
          return null
        },
      }
      return res
    }
    return redirectResponse(product, url)
  }
  const resolved = await resolveShopeeShortLink('https://s.shopee.com.br/4AxVbYMHaA', { fetchImpl })
  assert.equal(resolved, product)
  assert.equal(seen[0].cookie, null)
  assert.match(seen[1].cookie, /SPC_F=token123/)
})

test('resolveShopeeShortLink usa res.url quando a implementação de fetch segue redirects sozinha', async () => {
  const product = 'https://shopee.com.br/Caneca-Premium-i.123.456'
  const fetchImpl = async () => htmlResponse('<html>app shell</html>', product)
  const resolved = await resolveShopeeShortLink('https://s.shopee.com.br/4AxVbYMHaA', { fetchImpl })
  assert.equal(resolved, product)
})

test('resolveShopeeShortLink degrada para a URL original quando o fetch falha', async () => {
  const short = 'https://s.shopee.com.br/4AxVbYMHaA'
  const fetchImpl = async () => { throw new Error('rede fora') }
  assert.equal(await resolveShopeeShortLink(short, { fetchImpl }), short)
})

test('resolveShopeeShortLink devolve a URL corrente quando o corpo não tem alvo (sem loop infinito)', async () => {
  const short = 'https://s.shopee.com.br/4AxVbYMHaA'
  const fetchImpl = async (url) => htmlResponse('<html><body>página opaca sem redirect</body></html>', url)
  assert.equal(await resolveShopeeShortLink(short, { fetchImpl }), short)
})
