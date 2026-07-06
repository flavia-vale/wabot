import { test } from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import { clearMercadoLivreAffiliateCooldownsForTest, resolveToCleanProductUrl, convert } from '../src/converters/mercadolivre.js'

test('link de recomendação com MLB no path resolve para o produto (tracking removido)', async () => {
  const url = 'https://produto.mercadolivre.com.br/MLB-4049246221-secadora-roupas-portatil-_JM?searchVariation=188766696371#polycard_client=recommendations&reco_backend=x&c_id=/home/element'
  const clean = await resolveToCleanProductUrl(url)
  assert.equal(clean, 'https://produto.mercadolivre.com.br/MLB-4049246221-secadora-roupas-portatil-_JM?searchVariation=188766696371')
})

test('link /up/MLBU (recomendação/anúncio) usa wid= do fragmento como produto real', async () => {
  const url = 'https://www.mercadolivre.com.br/centrifuga-de-roupas-bcr15b/up/MLBU3956523918#polycard_client=recommendations_vip-pads-right&wid=MLB4664496065&sid=recos&is_advertising=true'
  const clean = await resolveToCleanProductUrl(url)
  assert.equal(clean, 'https://produto.mercadolivre.com.br/MLB4664496065-x-_JM')
})

test('convert sinaliza warning ml_ssid_expired quando API de afiliado rejeita auth (401)', async (t) => {
  t.mock.method(axios, 'post', async () => ({ status: 401, data: { message: 'unauthorized: sessão expirada' }, headers: {} }))
  const url = 'https://produto.mercadolivre.com.br/MLB-4049246221-secadora-_JM'
  const result = await convert(url, { tag: '475630078', ssid: 'ssid-expirado-1234567890' })
  assert.equal(typeof result, 'object')
  assert.equal(result.linkKind, 'product')
  assert.equal(result.warning, 'ml_ssid_expired')
  assert.match(result.url, /partner_id=475630078/)
})

test('convert sinaliza warning ml_affiliate_forbidden e não retrya quando API retorna 403', async (t) => {
  clearMercadoLivreAffiliateCooldownsForTest()
  let calls = 0
  t.mock.method(axios, 'post', async () => {
    calls += 1
    return { status: 403, data: '<html>blocked</html>', headers: { 'content-type': 'text/html' } }
  })
  const url = 'https://produto.mercadolivre.com.br/MLB-4049246221-secadora-_JM'
  const result = await convert(url, { tag: '475630078', ssid: 'ssid-valido-1234567890', csrf: 'csrf-token' })
  assert.equal(typeof result, 'object')
  assert.equal(result.linkKind, 'product')
  assert.equal(result.warning, 'ml_affiliate_forbidden')
  assert.match(result.url, /partner_id=475630078/)
  assert.equal(calls, 1)
})

test('convert sinaliza warning ml_affiliate_rate_limited e não retrya quando API retorna 429', async (t) => {
  clearMercadoLivreAffiliateCooldownsForTest()
  let calls = 0
  t.mock.method(axios, 'post', async () => {
    calls += 1
    return { status: 429, data: { message: 'rate limited' }, headers: {} }
  })
  const url = 'https://produto.mercadolivre.com.br/MLB-4049246221-secadora-_JM'
  const result = await convert(url, { tag: '475630078', ssid: 'ssid-valido-1234567890', csrf: 'csrf-token' })
  assert.equal(typeof result, 'object')
  assert.equal(result.linkKind, 'product')
  assert.equal(result.warning, 'ml_affiliate_rate_limited')
  assert.match(result.url, /partner_id=475630078/)
  assert.equal(calls, 1)
})


test('convert aplica cooldown após 403 e pula createLink na conversão seguinte da mesma credencial', async (t) => {
  clearMercadoLivreAffiliateCooldownsForTest()
  let calls = 0
  t.mock.method(axios, 'post', async () => {
    calls += 1
    return { status: 403, data: '<html>blocked</html>', headers: { 'content-type': 'text/html' } }
  })
  const url = 'https://produto.mercadolivre.com.br/MLB-4049246221-secadora-_JM'
  const creds = { tag: '475630078', ssid: 'ssid-forbidden-cooldown-1234567890', csrf: 'csrf-token' }

  const first = await convert(url, creds)
  const second = await convert(url, creds)

  assert.equal(first.warning, 'ml_affiliate_forbidden')
  assert.equal(second.warning, 'ml_affiliate_forbidden')
  assert.equal(calls, 1)
  clearMercadoLivreAffiliateCooldownsForTest()
})

test('convert aplica cooldown após 429 e pula createLink na conversão seguinte da mesma credencial', async (t) => {
  clearMercadoLivreAffiliateCooldownsForTest()
  let calls = 0
  t.mock.method(axios, 'post', async () => {
    calls += 1
    return { status: 429, data: { message: 'rate limited' }, headers: {} }
  })
  const url = 'https://produto.mercadolivre.com.br/MLB-4049246221-secadora-_JM'
  const creds = { tag: '475630078', ssid: 'ssid-cooldown-1234567890', csrf: 'csrf-token' }

  const first = await convert(url, creds)
  const second = await convert(url, creds)

  assert.equal(first.warning, 'ml_affiliate_rate_limited')
  assert.equal(second.warning, 'ml_affiliate_rate_limited')
  assert.equal(calls, 1)
  clearMercadoLivreAffiliateCooldownsForTest()
})

test('convert limita createLink ao primeiro candidate canônico por padrão', async (t) => {
  clearMercadoLivreAffiliateCooldownsForTest()
  let calls = 0
  t.mock.method(axios, 'post', async () => {
    calls += 1
    return { status: 400, data: { message: 'bad candidate' }, headers: {} }
  })
  const url = 'https://www.mercadolivre.com.br/secador/p/MLB70009242'
  const result = await convert(url, { tag: '475630078', ssid: 'ssid-valido-1234567890' })

  assert.equal(typeof result, 'object')
  assert.equal(result.linkKind, 'product')
  assert.match(result.url, /partner_id=475630078/)
  assert.equal(calls, 1)
})

test('convert mantém short_url quando validação é inconclusiva (muro anti-bot do VPS)', async (t) => {
  // createLink devolve short_url válido para o produto de catálogo
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { urls: [{ short_url: 'https://mercadolivre.com/sec/2Abcd' }] },
    headers: {},
  }))
  // Ao validar, o resolve do VPS cai no muro de verificação — sem MLB
  // extraível. Antes isso descartava o link e caía no partner_id; agora mantém.
  const wall = 'https://www.mercadolivre.com.br/gz/account-verification?go=https%3A%2F%2Fwww.mercadolivre.com.br%2Fsocial%2Floja&tid=abc'
  t.mock.method(global, 'fetch', async () => ({ url: wall }))

  const url = 'https://www.mercadolivre.com.br/secador/p/MLB70009242'
  const result = await convert(url, { tag: '475630078', ssid: 'ssid-valido-1234567890' })
  assert.deepEqual(result, { url: 'https://mercadolivre.com/sec/2Abcd', linkKind: 'product' })
})


test('convert persiste patch de cookies rotacionados quando createLink retorna Set-Cookie', async (t) => {
  clearMercadoLivreAffiliateCooldownsForTest()
  let patchArgs = null
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { urls: [{ short_url: 'https://mercadolivre.com/sec/2Abcd' }] },
    headers: {
      'set-cookie': [
        'ssid=ssid-novo; Path=/; HttpOnly',
        '_csrf=csrf-novo; Path=/',
        '_mldataSessionId=session-nova; Path=/',
      ],
    },
  }))
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/p/MLB70009242' }))

  const result = await convert('https://www.mercadolivre.com.br/secador/p/MLB70009242', {
    tag: '475630078',
    ssid: 'ssid-antigo',
    csrf: 'csrf-antigo',
    __onCredentialPatch: async (...args) => { patchArgs = args },
  })

  assert.deepEqual(result, { url: 'https://mercadolivre.com/sec/2Abcd', linkKind: 'product' })
  assert.deepEqual(patchArgs?.[0], 'mercadolivre')
  assert.equal(patchArgs?.[1]?.ssid, 'ssid-novo')
  assert.equal(patchArgs?.[1]?.csrf, 'csrf-novo')
  assert.match(patchArgs?.[1]?.cookie, /ssid=ssid-novo/)
  assert.match(patchArgs?.[1]?.cookie, /_csrf=csrf-novo/)
  assert.match(patchArgs?.[1]?.cookie, /_mldataSessionId=session-nova/)
})

test('convert ignora Set-Cookie de DELEÇÃO do ssid (valor vazio) — não bricka sessão viva', async (t) => {
  clearMercadoLivreAffiliateCooldownsForTest()
  let patchArgs = null
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { urls: [{ short_url: 'https://mercadolivre.com/sec/2Abcd' }] },
    headers: {
      'set-cookie': [
        'ssid=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        '_csrf=csrf-novo; Path=/',
      ],
    },
  }))
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/p/MLB70009242' }))

  const result = await convert('https://www.mercadolivre.com.br/secador/p/MLB70009242', {
    tag: '475630078',
    ssid: 'ssid-antigo',
    __onCredentialPatch: async (...args) => { patchArgs = args },
  })

  assert.deepEqual(result, { url: 'https://mercadolivre.com/sec/2Abcd', linkKind: 'product' })
  // ssid de deleção NÃO entra no patch; o ssid conhecido é preservado.
  assert.equal(patchArgs?.[1]?.ssid, 'ssid-antigo')
  assert.equal(patchArgs?.[1]?.csrf, 'csrf-novo')
  // O jar serializado nunca pode conter um ssid vazio (quebraria a auth no ML).
  assert.doesNotMatch(patchArgs?.[1]?.cookie, /ssid=(?:;|$)/)
  assert.match(patchArgs?.[1]?.cookie, /ssid=ssid-antigo/)
  assert.match(patchArgs?.[1]?.cookie, /_csrf=csrf-novo/)
})

test('convert trata Max-Age=0 como deleção e não sobrescreve o ssid conhecido', async (t) => {
  clearMercadoLivreAffiliateCooldownsForTest()
  let patchArgs = null
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { urls: [{ short_url: 'https://mercadolivre.com/sec/2Abcd' }] },
    headers: {
      'set-cookie': [
        'ssid=valor-de-logout; Path=/; Max-Age=0',
        '_csrf=csrf-novo; Path=/',
      ],
    },
  }))
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/p/MLB70009242' }))

  const result = await convert('https://www.mercadolivre.com.br/secador/p/MLB70009242', {
    tag: '475630078',
    ssid: 'ssid-antigo',
    __onCredentialPatch: async (...args) => { patchArgs = args },
  })

  assert.deepEqual(result, { url: 'https://mercadolivre.com/sec/2Abcd', linkKind: 'product' })
  assert.equal(patchArgs?.[1]?.ssid, 'ssid-antigo')
  assert.doesNotMatch(patchArgs?.[1]?.cookie, /valor-de-logout/)
  assert.match(patchArgs?.[1]?.cookie, /ssid=ssid-antigo/)
})


test('resolveToCleanProductUrl retorna null para /social/ sem produto extraível (sem ?ref=)', async (t) => {
  // Sem ?ref= a página é o perfil genérico do afiliado — sem produto identificável.
  // O mock simula resposta HTML vazia (sem recommended_items, wid, canonical MLB).
  t.mock.method(axios, 'get', async () => ({ data: '<html><body>Perfil do vendedor</body></html>' }))
  const url = 'https://www.mercadolivre.com.br/social/xetdaspromocoes?partner_id=475630078'
  const clean = await resolveToCleanProductUrl(url)
  assert.equal(clean, null)
})

test('convert retorna null para /social/ sem produto extraível (não encaminha loja de terceiro)', async (t) => {
  t.mock.method(axios, 'get', async () => ({ data: '<html><body>Perfil do vendedor</body></html>' }))
  const url = 'https://www.mercadolivre.com.br/social/xetdaspromocoes?partner_id=475630078'
  const result = await convert(url, { tag: 'meutag', ssid: 'ssid-valido' })
  assert.equal(result, null)
})

test('resolveToCleanProductUrl extrai produto de /social/?ref= quando o HTML tem recommended_items', async (t) => {
  const html = `<html><body>
    {"recommended_items":[{"id":"MLB1234567","product_id":"MLB9876543"}]}
  </body></html>`
  t.mock.method(axios, 'get', async () => ({ data: html }))
  const url = 'https://www.mercadolivre.com.br/social/xetdaspromocoes?partner_id=475630078&ref=abc123'
  const clean = await resolveToCleanProductUrl(url)
  assert.equal(clean, 'https://www.mercadolivre.com.br/p/MLB9876543')
})

test('short link /sec/ de terceiro é resolvido para o produto real (não encaminha o código alheio)', async (t) => {
  // mercadolivre.com/sec/<código> é um short link de AFILIADO do ML. O código
  // pertence a quem o gerou — pendurar ?partner_id= nele não transfere comissão.
  // Precisa ser resolvido até o produto real, como meli.la/mluvem.com.
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/p/MLB12345678' }))
  const url = 'https://mercadolivre.com/sec/2bw3uP4?partner_id=999999999'
  const clean = await resolveToCleanProductUrl(url)
  assert.equal(clean, 'https://www.mercadolivre.com.br/p/MLB12345678')
})

test('/sec/ que resolve para landing sem MLB sai com partner_id na URL REAL (não no código de terceiro)', async (t) => {
  // Resolve o /sec/ para uma página real de cupom (sem MLB único). O fallback
  // injeta o partner_id da usuária na URL real resolvida — o código de afiliado
  // de terceiro (2bw3uP4) desaparece, então a comissão não vaza.
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/cupom/MANDAGOL' }))
  const url = 'https://mercadolivre.com/sec/3cupomXy?partner_id=999999999'
  const result = await convert(url, { tag: '475630078', ssid: 'ssid-valido-1234567890' })
  assert.equal(typeof result, 'object')
  assert.equal(result.linkKind, 'coupon')
  assert.match(result.url, /partner_id=475630078/)
  assert.doesNotMatch(result.url, /\/sec\//)
  assert.doesNotMatch(result.url, /999999999/)
})

test('/sec/ não-resolvível (muro anti-bot) não é encaminhado com partner_id cosmético', async (t) => {
  // Quando não conseguimos escapar do short link de terceiro (resolve falha e a
  // landing não dá produto), retornar null é melhor que vazar comissão pendurando
  // um partner_id cosmético no /sec/ alheio.
  t.mock.method(global, 'fetch', async () => { throw new Error('network') })
  t.mock.method(axios, 'get', async () => ({ data: '<html><body>redirecionando...</body></html>' }))
  const url = 'https://mercadolivre.com/sec/9wallZz?partner_id=999999999'
  const result = await convert(url, { tag: '475630078', ssid: 'ssid-valido-1234567890' })
  assert.equal(result, null)
})

test('resolveToCleanProductUrl NÃO fabrica produto de /social/ sem ?ref= mesmo com recommended_items no HTML (bug do card de cupom com foto errada)', async (t) => {
  // Vitrine /social/ de handle alheio, SEM ?ref= (nenhum produto designado).
  // Mesmo que o HTML traga recommended_items, NÃO podemos pegar o [0] — seria um
  // produto ALEATÓRIO. Antes, era isso que fazia um CUPOM sair com foto de
  // produto errado. Sem seletor explícito (?ref=), não fabricamos produto.
  const html = `<html><body>{"recommended_items":[{"id":"MLB1234567","product_id":"MLB9876543"}]}</body></html>`
  t.mock.method(axios, 'get', async () => ({ data: html }))
  const url = 'https://www.mercadolivre.com.br/social/xetdaspromocoes?partner_id=475630078'
  const clean = await resolveToCleanProductUrl(url)
  assert.equal(clean, null)
})

test('/sec/ que resolve para a home (sem produto) vira CUPOM, não fabrica produto de recommended_items', async (t) => {
  // O /sec/ de cupom resolve para a home genérica do ML. Antes, o
  // tryExtractProductFromLanding raspava um recommended_items[0] (produto
  // aleatório) e o card saía com foto de produto errado. Agora a home (1ª parte,
  // sem código de terceiro) vira banner de cupom com partner_id da usuária.
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/' }))
  const html = `<html><body>{"recommended_items":[{"id":"MLB1234567","product_id":"MLB9876543"}]}</body></html>`
  t.mock.method(axios, 'get', async () => ({ data: html }))
  const url = 'https://mercadolivre.com/sec/7homeZz'
  const result = await convert(url, { tag: '475630078', ssid: 'ssid-valido-1234567890' })
  assert.equal(typeof result, 'object')
  assert.equal(result.linkKind, 'coupon')
  assert.match(result.url, /partner_id=475630078/)
  assert.doesNotMatch(result.url, /MLB9876543/)
})

test('convert descarta short_url quando validação comprova MLB diferente', async (t) => {
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { urls: [{ short_url: 'https://mercadolivre.com/sec/9Zxy' }] },
    headers: {},
  }))
  // resolve devolve um produto real, mas de outro MLB → mismatch comprovado.
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/p/MLB99999999' }))

  const url = 'https://www.mercadolivre.com.br/secador/p/MLB70009242'
  const result = await convert(url, { tag: '475630078', ssid: 'ssid-valido-1234567890' })
  // short_url descartado → cai no fallback partner_id preservando o MLB certo
  assert.equal(typeof result, 'object')
  assert.equal(result.linkKind, 'product')
  assert.match(result.url, /partner_id=475630078/)
  assert.match(result.url, /MLB70009242/)
})
