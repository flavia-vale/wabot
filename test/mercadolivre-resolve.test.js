import { test } from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import { clearMercadoLivreAffiliateCooldownsForTest, resolveToCleanProductUrl, convert, extractFeaturedSocialProduct } from '../src/converters/mercadolivre.js'

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

test('resolveToCleanProductUrl NÃO fabrica produto de /social/ NEM com ?ref= (robustez: vitrine/lista de terceiro nunca vira produto)', async (t) => {
  // Antes, /social/?ref= com recommended_items extraía o [0] como produto. Mas a
  // heurística do ?ref= era insuficiente: uma share de LISTA
  // (/social/<handle>/lists/<uuid>?ref=...) também carrega ?ref= e acabava
  // pegando um produto ALEATÓRIO — que saía com foto errada E virava um /p/MLB de
  // catálogo que o fallback transformava numa URL 404. Robustez: NENHUMA página
  // /social/ vira produto; o convert() a trata como cupom (createLink nosso).
  const html = `<html><body>{"recommended_items":[{"id":"MLB1234567","product_id":"MLB9876543"}]}</body></html>`
  t.mock.method(axios, 'get', async () => ({ data: html }))
  const url = 'https://www.mercadolivre.com.br/social/xetdaspromocoes/lists/uuid-9?partner_id=475630078&ref=abc123'
  const clean = await resolveToCleanProductUrl(url)
  assert.equal(clean, null)
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

test('produto de catálogo /p/MLB com createLink falho NÃO vira URL 404 produto.../MLB-x-_JM (mantém /p/ válida)', async (t) => {
  // Bug real (screenshot): card de produto abrindo "Parece que esta página não
  // existe". O fallback reescrevia /p/MLB (id de CATÁLOGO) para
  // produto.../MLB-x-_JM (formato de LISTING) → 404. Agora mantém a /p/ válida.
  clearMercadoLivreAffiliateCooldownsForTest()
  t.mock.method(axios, 'post', async () => ({ status: 400, data: { message: 'bad candidate' }, headers: {} }))
  const url = 'https://www.mercadolivre.com.br/p/MLB70009242'
  const result = await convert(url, { tag: '475630078', ssid: 'ssid-valido-1234567890' })
  assert.equal(typeof result, 'object')
  assert.equal(result.linkKind, 'product')
  assert.match(result.url, /\/p\/MLB70009242/)
  assert.match(result.url, /partner_id=475630078/)
  assert.doesNotMatch(result.url, /produto\.mercadolivre\.com\.br/)
  assert.doesNotMatch(result.url, /-x-_JM/)
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

test('cupom ML: /sec/ que resolve para vitrine /social/ de terceiro vira NOSSO link de afiliado (COUPON_LINK_CONVERT on)', async (t) => {
  // Escolha da usuária: converter o cupom de vitrine de terceiro para o NOSSO
  // link de afiliado (createLink), mantendo a mensagem com banner de cupom em
  // vez de descartá-la. (Comissão a validar por clique no celular — ver PR.)
  const prev = process.env.COUPON_LINK_CONVERT
  process.env.COUPON_LINK_CONVERT = 'true'
  t.after(() => { process.env.COUPON_LINK_CONVERT = prev })
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/social/xetdaspromocoes/lists/uuid-1?matt_tool=1&forceInApp=true' }))
  t.mock.method(axios, 'post', async () => ({ status: 200, data: { urls: [{ short_url: 'https://mercadolivre.com/sec/NOSSO123' }] }, headers: {} }))
  const url = 'https://mercadolivre.com/sec/2couponVitrine'
  const result = await convert(url, { tag: '475630078', ssid: 'ssid-valido-1234567890' })
  assert.equal(typeof result, 'object')
  assert.equal(result.linkKind, 'coupon')
  assert.equal(result.url, 'https://mercadolivre.com/sec/NOSSO123')
})

test('cupom ML: /sec/ não-resolvível NÃO chama createLink no código de terceiro (leak-safe) mesmo com COUPON on', async (t) => {
  // Se não escapamos do /sec/ de terceiro (muro anti-bot), gerar NOSSO short link
  // a partir do código alheio creditaria o dono. Então nem tentamos: descarta.
  const prev = process.env.COUPON_LINK_CONVERT
  process.env.COUPON_LINK_CONVERT = 'true'
  t.after(() => { process.env.COUPON_LINK_CONVERT = prev })
  t.mock.method(global, 'fetch', async () => { throw new Error('network') })
  t.mock.method(axios, 'get', async () => ({ data: '<html><body>redirecionando...</body></html>' }))
  let postCalled = false
  t.mock.method(axios, 'post', async () => { postCalled = true; return { status: 200, data: { urls: [{ short_url: 'x' }] }, headers: {} } })
  const url = 'https://mercadolivre.com/sec/9wallCoupon'
  const result = await convert(url, { tag: '475630078', ssid: 'ssid-valido-1234567890' })
  assert.equal(result, null)
  assert.equal(postCalled, false)
})

test('cupom ML: vitrine/perfil rejeitada pelo ML (error_code 111) propaga motivo real, não culpa credencial (RCA staging 2026-07-08)', async (t) => {
  // Reproduz o incidente: link vira landing /social/<handle> (vitrine sem
  // produto), COUPON_LINK_CONVERT tenta gerar NOSSO link de afiliado, e o ML
  // recusa com HTTP 200 + error_code 111 "URL not allowed in affiliates
  // program" (não é 401/403/429 — não é problema de SSID). Antes, isso virava
  // silenciosamente `null` e o painel mostrava "confira as credenciais",
  // mensagem enganosa. Agora sobe um erro com o motivo real.
  const prev = process.env.COUPON_LINK_CONVERT
  process.env.COUPON_LINK_CONVERT = 'true'
  t.after(() => { process.env.COUPON_LINK_CONVERT = prev })
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/social/gatuna' }))
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: {
      status: 200,
      urls: [{ origin_url: 'https://www.mercadolivre.com.br/social/gatuna', message: 'URL not allowed in affiliates program', error_code: 111, status: 200 }],
      total_items: 1,
      total_success: 0,
      total_error: 1,
    },
    headers: {},
  }))
  const url = 'https://www.mercadolivre.com.br/social/gatuna'
  await assert.rejects(
    () => convert(url, { tag: '475630078', ssid: 'ssid-valido-1234567890' }),
    (err) => {
      assert.equal(err.mlFailureType, 'unsupported_url')
      assert.equal(err.mlWarning, 'ml_url_not_supported')
      assert.match(err.message, /não aceita esse link/i)
      assert.match(err.message, /Cadastre o link da SUA vitrine/i)
      return true
    },
  )
})

test('cupom ML: vitrine de terceiro rejeitada (error_code 111) usa a vitrine PRÓPRIA cadastrada como fallback', async (t) => {
  // Mesmo cenário do teste acima, mas agora a usuária tem `vitrineUrl`
  // cadastrado nas credenciais ML (Painel → IDs de afiliada). Em vez de
  // descartar a mensagem, a oferta sai com o link da vitrine da própria
  // afiliada — mantém monetização em vez de simplesmente falhar.
  const prev = process.env.COUPON_LINK_CONVERT
  process.env.COUPON_LINK_CONVERT = 'true'
  t.after(() => { process.env.COUPON_LINK_CONVERT = prev })
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/social/gatuna' }))
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: {
      status: 200,
      urls: [{ origin_url: 'https://www.mercadolivre.com.br/social/gatuna', message: 'URL not allowed in affiliates program', error_code: 111, status: 200 }],
      total_items: 1,
      total_success: 0,
      total_error: 1,
    },
    headers: {},
  }))
  const url = 'https://www.mercadolivre.com.br/social/gatuna'
  const result = await convert(url, {
    tag: '475630078',
    ssid: 'ssid-valido-1234567890',
    vitrineUrl: 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial',
  })
  assert.deepEqual(result, {
    url: 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial',
    linkKind: 'coupon',
    warning: 'ml_vitrine_fallback_used',
  })
})

test('cupom ML: vitrineUrl inválida (não é link do ML) é ignorada — continua propagando o erro real', async (t) => {
  const prev = process.env.COUPON_LINK_CONVERT
  process.env.COUPON_LINK_CONVERT = 'true'
  t.after(() => { process.env.COUPON_LINK_CONVERT = prev })
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/social/gatuna' }))
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { status: 200, urls: [{ message: 'URL not allowed in affiliates program', error_code: 111, status: 200 }] },
    headers: {},
  }))
  const url = 'https://www.mercadolivre.com.br/social/gatuna'
  await assert.rejects(
    () => convert(url, { tag: '475630078', ssid: 'ssid-valido-1234567890', vitrineUrl: 'not-a-url' }),
    (err) => {
      assert.equal(err.mlFailureType, 'unsupported_url')
      return true
    },
  )
})

test('RCA regressão 2026-07-08: link de PRODUTO (meli.la) que resolve ambiguamente para /social/ é descartado silenciosamente, NÃO acusa "vitrine, cadastre a sua"', async (t) => {
  // Reprodução do bug real: um link de produto genuíno (kit de cuecas, loja
  // oficial, cupom MODASEMPRE) compartilhado via meli.la falhou em staging
  // com a mensagem de vitrine — mensagem enganosa, porque o link original
  // NUNCA foi diretamente uma página /social/, só chegou lá via encurtador
  // (rede/anti-bot do VPS, ou loja oficial excluída do programa — motivo
  // desconhecido e irrelevante: sem certeza de que é vitrine, não afirmamos).
  const prev = process.env.COUPON_LINK_CONVERT
  process.env.COUPON_LINK_CONVERT = 'true'
  t.after(() => { process.env.COUPON_LINK_CONVERT = prev })
  // resolve() do meli.la não escapa para um produto — aterrissa numa página
  // /social/ ambígua (não é o link ORIGINAL compartilhado).
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/social/loja' }))
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { status: 200, urls: [{ message: 'URL not allowed in affiliates program', error_code: 111, status: 200 }] },
    headers: {},
  }))
  const url = 'https://meli.la/1Zgxo75'
  const result = await convert(url, { tag: '475630078', ssid: 'ssid-valido-1234567890' })
  assert.equal(result, null)
})

test('RCA regressão 2026-07-08: mesmo cenário ambíguo, mas COM vitrine própria cadastrada — ainda usa o fallback (só a mensagem de culpa que muda, o fallback continua útil)', async (t) => {
  const prev = process.env.COUPON_LINK_CONVERT
  process.env.COUPON_LINK_CONVERT = 'true'
  t.after(() => { process.env.COUPON_LINK_CONVERT = prev })
  t.mock.method(global, 'fetch', async () => ({ url: 'https://www.mercadolivre.com.br/social/loja' }))
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { status: 200, urls: [{ message: 'URL not allowed in affiliates program', error_code: 111, status: 200 }] },
    headers: {},
  }))
  const url = 'https://meli.la/1Zgxo75'
  const result = await convert(url, {
    tag: '475630078',
    ssid: 'ssid-valido-1234567890',
    vitrineUrl: 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial',
  })
  assert.deepEqual(result, {
    url: 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial',
    linkKind: 'coupon',
    warning: 'ml_vitrine_fallback_used',
  })
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

// Casos reais fornecidos pela usuária (canal "gatuna", 2026-07-10), cada um
// com o produto esperado confirmado manualmente. Fixam o comportamento
// correto: link com produto identificável (MLB no path OU wid= no
// fragmento) SEMPRE resolve pro produto real, mesmo vindo de um encurtador
// de campanha (matt_word/matt_tool/reco_*) do mesmo canal que também produz
// links de vitrine pura sem produto (ver testes de vitrine ambígua acima).
// Não fabricar produto de vitrine pura, mas também não tratar TODO link do
// canal como vitrine — a distinção é por conteúdo resolvido, não por canal.
test('gatuna: meli.la que resolve para /p/MLB direto no path (com params de recomendação) extrai o produto certo', async (t) => {
  const resolved = 'https://www.mercadolivre.com.br/t-milk-fps-50-40ml/p/MLB22797411?matt_event_ts=1783693503765&matt_d2id=990f723f-e2ce-44fe-9a93-89f058220cc4&matt_tracing_id=1917ff3b-b6fa-45a8-9326-858786c9668a#polycard_client=recommendations_home_affiliate-profile&reco_backend=item_decorator&reco_client=home_affiliate-profile&matt_tool_id=44711447&reco_item_pos=0&source=affiliate-profile&reco_backend_type=function&reco_id=af225f22-cf5a-4975-a0db-531a64c74be9&tracking_id=bb005a74-3623-450b-96a0-ce857aff9b2f&c_id=/home/card-featured/element&c_uid=00710219-3c37-4d4c-9276-cf0a58ff2e60'
  t.mock.method(global, 'fetch', async () => ({ url: resolved }))
  const clean = await resolveToCleanProductUrl('https://meli.la/2z3F2hV')
  assert.match(clean, /MLB22797411/)

  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { urls: [{ short_url: 'https://mercadolivre.com/sec/bioreProtetor' }] },
    headers: {},
  }))
  const result = await convert('https://meli.la/2z3F2hV', { tag: '475630078', ssid: 'ssid-valido-1234567890' })
  assert.equal(result.linkKind, 'product')
})

test('gatuna: meli.la que resolve para /up/MLBU com wid= (recomendação) extrai o produto certo, não a vitrine', async (t) => {
  const resolved = 'https://www.mercadolivre.com.br/chinelo-masculino-e-feminino-leadcat-20-puma/up/MLBU3823917987?pdp_filters=item_id%3AMLB6420227108&matt_event_ts=1783693536218&matt_d2id=990f723f-e2ce-44fe-9a93-89f058220cc4&matt_tracing_id=9e9f381b-bfad-4e40-8d6b-0ec4e4515e6e#polycard_client=recommendations_home_affiliate-profile&wid=MLB6420227108&sid=recos&reco_backend=item_decorator&reco_client=home_affiliate-profile&matt_tool_id=44711447&reco_item_pos=0&source=affiliate-profile&reco_backend_type=function&reco_id=5cadbf53-66bd-4deb-837b-0e3c9518ffe6&tracking_id=752af55b-f49a-4590-b778-b8edebd5a0ca&c_id=/home/card-featured/element&c_uid=f84bbe16-0baa-442c-86ae-202137a05786'
  t.mock.method(global, 'fetch', async () => ({ url: resolved }))
  const clean = await resolveToCleanProductUrl('https://meli.la/1Jtyg4G')
  assert.equal(clean, 'https://produto.mercadolivre.com.br/MLB6420227108-x-_JM')

  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { urls: [{ short_url: 'https://mercadolivre.com/sec/chinelo' }] },
    headers: {},
  }))
  const result = await convert('https://meli.la/1Jtyg4G', { tag: '475630078', ssid: 'ssid-valido-1234567890' })
  assert.equal(result.linkKind, 'product')
})

test('gatuna: link direto para /social/gatuna/lists (vitrine de verdade, listagem) usa a vitrine cadastrada', async (t) => {
  const url = 'https://www.mercadolivre.com.br/social/gatuna/lists'
  const prev = process.env.COUPON_LINK_CONVERT
  process.env.COUPON_LINK_CONVERT = 'true'
  t.after(() => { process.env.COUPON_LINK_CONVERT = prev })
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { status: 200, urls: [{ message: 'URL not allowed in affiliates program', error_code: 111, status: 200 }] },
    headers: {},
  }))
  const result = await convert(url, {
    tag: '475630078',
    ssid: 'ssid-valido-1234567890',
    vitrineUrl: 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial',
  })
  assert.deepEqual(result, {
    url: 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial',
    linkKind: 'coupon',
    warning: 'ml_vitrine_fallback_used',
  })
})

// ===== Extração do produto destacado (featured) de share /social/?ref= =====
// RCA 2026-07-10: todo meli.la do canal resolve para /social/<handle>?ref=<blob>.
// O ML resolve o `ref` server-side e renderiza o PRODUTO-ALVO como card destacado
// (primeiro polycard, marcado com `card-featured`) + og:title/og:image. HTML
// fiel capturado em produção (estrutura real de "polycards").

// Share de PRODUTO: tem `card-featured` e o 1o polycard traz o product_id certo.
const FEATURED_SHARE_HTML = `<!doctype html><html><head>
<meta property="og:title" content="Bioré Protetor Solar Facial Uv Perfect Milk Fps 50 - 40ml"/>
<meta property="og:image" content="https://http2.mlstatic.com/D_NQ_NP_787057-MLA88338750087_072025-O.webp"/>
</head><body><script>window.__PRELOADED_STATE__={"polycards":[{"unique_id":"7a20dcf319f4ccfd344","metadata":{"id":"MLB4013726737","product_id":"MLB22797411","user_product_id":"MLBU3063760375","url":"www.mercadolivre.com.br/biore-protetor-solar-facial-uv-perfect-milk-fps-50-40ml/p/MLB22797411"},"action_links":[{"id":"show_product","text":"Ir para produto","url":"https://www.mercadolivre.com.br/biore/p/MLB22797411?c_id=/home/card-featured/element"}]},{"unique_id":"rec1","metadata":{"id":"MLB46253773","product_id":"MLB46253773","url":"https://www.mercadolivre.com.br/x/p/MLB46253773?c_id=/home/affiliate-profile-recommendations/element"}}]};</script></body></html>`

// Vitrine/lista genérica: SEM `card-featured`, og:title institucional, só
// recomendações (produto qualquer). NÃO deve fabricar produto.
const LISTS_VITRINE_HTML = `<!doctype html><html><head>
<meta property="og:title" content="Minhas listas de recomendações"/>
</head><body><script>window.__PRELOADED_STATE__={"polycards":[{"unique_id":"z","metadata":{"id":"MLB50829128","product_id":"MLB50829128","url":"https://www.mercadolivre.com.br/y/p/MLB50829128?c_id=/home/affiliate-profile-recommendations/element"}}]};</script></body></html>`

test('extractFeaturedSocialProduct: share de produto (card destacado presente) devolve o product_id do 1o polycard', () => {
  assert.equal(extractFeaturedSocialProduct(FEATURED_SHARE_HTML), 'https://www.mercadolivre.com.br/p/MLB22797411')
})

test('extractFeaturedSocialProduct: vitrine/lista (sem card destacado) devolve null — não fabrica produto de recomendação', () => {
  assert.equal(extractFeaturedSocialProduct(LISTS_VITRINE_HTML), null)
})

test('extractFeaturedSocialProduct: blindagem foto-errada — ignora product_id "chamariz" antes dos polycards, usa o card destacado', () => {
  // Um product_id de um bloco não relacionado (ex.: header/nav/analytics)
  // aparece ANTES do array de polycards. A extração deve pegar o product_id do
  // PRIMEIRO polycard (card destacado = alvo do ref), não o chamariz. Sem essa
  // âncora, sairia a foto do produto errado (o bug histórico).
  const html = `<html><head><meta property="og:title" content="X"/></head><body>
<script>window.__ANALYTICS__={"last_seen":{"product_id":"MLB99999999"}};
window.__PRELOADED_STATE__={"polycards":[{"unique_id":"a","metadata":{"id":"MLB4013726737","product_id":"MLB22797411","url":"https://x/p/MLB22797411?c_id=/home/card-featured/element"}}]};</script>
<a href="/home/card-featured/element">featured</a></body></html>`
  assert.equal(extractFeaturedSocialProduct(html), 'https://www.mercadolivre.com.br/p/MLB22797411')
})

test('gatuna: meli.la que resolve para /social/?ref= COM card destacado extrai o produto certo (Bioré MLB22797411) — RCA 2026-07-10', async (t) => {
  const resolved = 'https://www.mercadolivre.com.br/social/gatuna?matt_word=gatunawhatsapp&matt_tool=44711447&forceInApp=true&ref=BBFoNtlrJiET%2FCrAZSX9QQaxk40NFaPjS'
  // Código único (o resolveCache é módulo-level e persiste entre testes).
  t.mock.method(global, 'fetch', async () => ({ url: resolved }))
  // O ML resolve o ref e serve o HTML com o produto destacado.
  t.mock.method(axios, 'get', async () => ({ data: FEATURED_SHARE_HTML }))
  const clean = await resolveToCleanProductUrl('https://meli.la/BIOREFEAT')
  assert.equal(clean, 'https://www.mercadolivre.com.br/p/MLB22797411')

  // Fluxo completo: convert() gera o link de afiliado do produto certo.
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { urls: [{ short_url: 'https://mercadolivre.com/sec/bioreOK' }] },
    headers: {},
  }))
  const result = await convert('https://meli.la/BIOREFEAT2', { tag: '475630078', ssid: 'ssid-valido-1234567890' })
  assert.equal(result.linkKind, 'product')
})

test('gatuna: meli.la que resolve para /social/?ref= SEM card destacado (vitrine/lista real) usa a vitrine cadastrada — não fabrica produto aleatório', async (t) => {
  const resolved = 'https://www.mercadolivre.com.br/social/gatuna?matt_word=gatunawhatsapp&matt_tool=44711447&forceInApp=true&ref=BESfL2dGO%2Bq85jTd3I'
  t.mock.method(global, 'fetch', async () => ({ url: resolved }))
  // ML serve uma página de listas/vitrine (sem card destacado).
  t.mock.method(axios, 'get', async () => ({ data: LISTS_VITRINE_HTML }))
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { status: 200, urls: [{ message: 'URL not allowed in affiliates program', error_code: 111, status: 200 }] },
    headers: {},
  }))
  const prev = process.env.COUPON_LINK_CONVERT
  process.env.COUPON_LINK_CONVERT = 'true'
  t.after(() => { process.env.COUPON_LINK_CONVERT = prev })
  const result = await convert('https://meli.la/VITRINELIST', {
    tag: '475630078',
    ssid: 'ssid-valido-1234567890',
    vitrineUrl: 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial',
  })
  assert.deepEqual(result, {
    url: 'https://www.mercadolivre.com.br/social/minha-vitrine-oficial',
    linkKind: 'coupon',
    warning: 'ml_vitrine_fallback_used',
  })
})
