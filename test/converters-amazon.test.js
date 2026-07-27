import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'
import axios from 'axios'
import { convert, isAmazonShortLink, resolveAmazonShortLink, normalizeAmazonCookie, checkAmazonSession } from '../src/converters/amazon.js'

const CREDS = {
  tag: 'flaviavale-20',
  'ubid-acbbr': 'expired-ubid-1234567890',
  'at-acbbr': 'expired-at-1234567890',
  'x-acbbr': 'expired-x-1234567890',
}

const LONG_URL = 'https://www.amazon.com.br/dp/B09VQ39F41'

function mockAxiosOnce(impl) {
  const original = axios.get
  axios.get = impl
  return () => { axios.get = original }
}

test('Amazon: cookies expirados (4xx) caem para ?tag= longo e sinalizam amazon_cookies_expired', async () => {
  const restore = mockAxiosOnce(async (url) => {
    if (url.includes('sitestripe/getShortUrl')) {
      return { status: 401, data: { error: 'unauthorized' }, headers: {} }
    }
    return { status: 200, request: { res: { responseUrl: LONG_URL } }, config: { url: LONG_URL } }
  })
  try {
    const result = await convert(LONG_URL, CREDS)
    assert.deepEqual(result, { url: `${LONG_URL}?tag=${CREDS.tag}`, linkKind: 'product', warning: 'amazon_cookies_expired' })
  } finally {
    restore()
  }
})

test('Amazon: API 5xx transitória cai para ?tag= longo sem warning (instabilidade do lado deles, não cliente)', async () => {
  const restore = mockAxiosOnce(async (url) => {
    if (url.includes('sitestripe/getShortUrl')) {
      return { status: 503, data: {}, headers: {} }
    }
    return { status: 200, request: { res: { responseUrl: LONG_URL } }, config: { url: LONG_URL } }
  })
  try {
    const result = await convert(LONG_URL, CREDS)
    assert.deepEqual(result, { url: `${LONG_URL}?tag=${CREDS.tag}`, linkKind: 'product', warning: null })
  } finally {
    restore()
  }
})

test('Amazon: shortUrl válido da API é usado quando disponível', async () => {
  const restore = mockAxiosOnce(async (url) => {
    if (url.includes('sitestripe/getShortUrl')) {
      return { status: 200, data: { shortUrl: 'https://amzn.to/abc123' }, headers: {} }
    }
    return { status: 200, request: { res: { responseUrl: LONG_URL } }, config: { url: LONG_URL } }
  })
  try {
    const result = await convert(LONG_URL, CREDS)
    assert.deepEqual(result, { url: 'https://amzn.to/abc123', linkKind: 'product' })
  } finally {
    restore()
  }
})

test('Amazon: ASIN ausente continua devolvendo null (segurança contra link malformado)', async () => {
  const result = await convert('https://www.amazon.com.br/gp/help', CREDS)
  assert.equal(result, null)
})

test('Amazon: short link amzn.la é resolvido (robust-first via fetch) e convertido como amzn.to', async () => {
  const restore = mockAxiosOnce(async (url) => {
    if (url.includes('sitestripe/getShortUrl')) {
      return { status: 200, data: { shortUrl: 'https://amzn.to/abc123' }, headers: {} }
    }
    throw new Error('resolveShortUrl (axios) NÃO deve ser chamado no caminho feliz — robust-first resolve via fetch')
  })
  // O conversor resolve o short link via resolveAmazonShortLink (globalThis.fetch)
  // ANTES do axios — um hit só no encurtador.
  const originalFetch = globalThis.fetch
  let fetchHits = 0
  globalThis.fetch = async (u) => {
    fetchHits++
    return {
      url: u,
      headers: { getSetCookie: () => [], get: (k) => String(k).toLowerCase() === 'location' ? LONG_URL : null },
    }
  }
  try {
    const result = await convert('https://amzn.la/d/abc123', CREDS)
    assert.deepEqual(result, { url: 'https://amzn.to/abc123', linkKind: 'product' })
    assert.equal(fetchHits, 1, 'resolve o short link com um único hit no encurtador')
  } finally {
    restore()
    globalThis.fetch = originalFetch
  }
})

test('Amazon: amzn.la que não resolve para produto devolve null (sem link malformado)', async () => {
  const restore = mockAxiosOnce(async (url) => {
    // short link resolve para uma landing sem ASIN
    const NO_ASIN = 'https://www.amazon.com.br/gp/bestsellers'
    return { status: 200, request: { res: { responseUrl: NO_ASIN } }, config: { url: NO_ASIN } }
  })
  // O fallback robusto usa globalThis.fetch — estuba para não tocar a rede e
  // também não achar ASIN (interstitial sem URL de produto).
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (u) => ({
    url: u,
    headers: { getSetCookie: () => [], get: () => null },
    text: async () => '<html><body>sem produto</body></html>',
  })
  try {
    const result = await convert('https://amzn.la/x/noasin', CREDS)
    assert.equal(result, null)
  } finally {
    restore()
    globalThis.fetch = originalFetch
  }
})

test('isAmazonShortLink reconhece encurtadores e ignora URL plena de produto', () => {
  assert.equal(isAmazonShortLink('https://amzn.la/ipojO'), true)
  assert.equal(isAmazonShortLink('https://amzn.to/abc'), true)
  assert.equal(isAmazonShortLink('https://link.amazon/B00WDbu4a'), true)
  assert.equal(isAmazonShortLink('https://a.co/d/abc'), true)
  assert.equal(isAmazonShortLink('https://www.amazon.com.br/dp/B09WG452T1'), false)
})

test('resolveAmazonShortLink: segue redirect HTTP até a PDP com ASIN', async () => {
  const PDP = 'https://www.amazon.com.br/dp/B09WG452T1?tag=promobaby07-20'
  const fetchImpl = async (u) => ({
    url: u,
    headers: {
      getSetCookie: () => [],
      get: (k) => (String(k).toLowerCase() === 'location' && u === 'https://amzn.la/ipojO') ? PDP : null,
    },
  })
  const resolved = await resolveAmazonShortLink('https://amzn.la/ipojO', { fetchImpl })
  assert.equal(resolved, PDP)
})

test('resolveAmazonShortLink: extrai destino do corpo quando é interstitial 200 (redirect JS)', async () => {
  const PDP = 'https://www.amazon.com.br/dp/B09WG452T1?tag=x'
  const fetchImpl = async (u) => ({
    url: u,
    headers: { getSetCookie: () => [], get: () => null },
    text: async () => `<html><script>location.replace("${PDP}")</script></html>`,
  })
  const resolved = await resolveAmazonShortLink('https://amzn.la/ipojO', { fetchImpl })
  assert.equal(resolved, PDP)
})


test('resolveAmazonShortLink: retry em Cloudflare challenge antes de desistir do amzn.la', async () => {
  const PDP = 'https://www.amazon.com.br/dp/B09WG452T1?tag=promobaby07-20'
  let calls = 0
  const waits = []
  const fetchImpl = async () => {
    calls++
    if (calls === 1) {
      return {
        status: 403,
        url: 'https://amzn.la/ipojO',
        headers: {
          getSetCookie: () => [],
          get: (k) => String(k).toLowerCase() === 'cf-mitigated' ? 'challenge' : null,
        },
        text: async () => '<html><head><title>Just a moment...</title></head><body>https://challenges.cloudflare.com</body></html>',
      }
    }
    return {
      status: 302,
      url: 'https://amzn.la/ipojO',
      headers: {
        getSetCookie: () => [],
        get: (k) => String(k).toLowerCase() === 'location' ? PDP : null,
      },
    }
  }

  const resolved = await resolveAmazonShortLink('https://amzn.la/ipojO', {
    fetchImpl,
    cloudflareRetryBackoffMs: [0],
    sleepImpl: async (ms) => { waits.push(ms) },
  })

  assert.equal(resolved, PDP)
  assert.equal(calls, 2)
  assert.deepEqual(waits, [])
})

test('resolveAmazonShortLink: URL que já tem ASIN é devolvida sem fetch', async () => {
  let called = false
  const fetchImpl = async () => { called = true; return {} }
  const direct = 'https://www.amazon.com.br/dp/B09WG452T1'
  const resolved = await resolveAmazonShortLink(direct, { fetchImpl })
  assert.equal(resolved, direct)
  assert.equal(called, false, 'URL plena não dispara fetch')
})

// Conversão de cupom (COUPON_LINK_CONVERT): link Amazon sem ASIN (oferta/cupom)
// passa a creditar com ?tag= na URL da loja, em vez de ser descartado.
function withCouponConvert(value, fn) {
  const prev = process.env.COUPON_LINK_CONVERT
  if (value === undefined) delete process.env.COUPON_LINK_CONVERT
  else process.env.COUPON_LINK_CONVERT = value
  return Promise.resolve(fn()).finally(() => {
    if (prev === undefined) delete process.env.COUPON_LINK_CONVERT
    else process.env.COUPON_LINK_CONVERT = prev
  })
}

test('Amazon: link sem ASIN com COUPON_LINK_CONVERT=true gera amzn.to quando cookies estão válidos', async () => {
  await withCouponConvert('true', async () => {
    const couponUrl = 'https://www.amazon.com.br/prime?ref=promo'
    const restore = mockAxiosOnce(async (url, options) => {
      assert.ok(url.includes('sitestripe/getShortUrl'))
      assert.equal(options.params.longUrl, `${couponUrl}&tag=${CREDS.tag}`)
      assert.equal(options.params.tag, CREDS.tag)
      return { status: 200, data: { shortUrl: 'https://amzn.to/3O3r9E8' }, headers: {} }
    })
    try {
      const result = await convert(couponUrl, CREDS)
      assert.deepEqual(result, { url: 'https://amzn.to/3O3r9E8', linkKind: 'coupon' })
    } finally {
      restore()
    }
  })
})


test('Amazon: link sem ASIN remove tag antiga antes de gerar amzn.to convertido', async () => {
  await withCouponConvert('true', async () => {
    const couponUrl = 'https://www.amazon.com.br/prime?ref=promo&tag=promobaby07-20'
    const expectedConvertedLongUrl = 'https://www.amazon.com.br/prime?ref=promo&tag=flaviavale-20'
    const restore = mockAxiosOnce(async (url, options) => {
      assert.ok(url.includes('sitestripe/getShortUrl'))
      assert.equal(options.params.longUrl, expectedConvertedLongUrl)
      assert.equal(options.params.tag, CREDS.tag)
      return { status: 200, data: { shortUrl: 'https://amzn.to/converted123' }, headers: {} }
    })
    try {
      const result = await convert(couponUrl, CREDS)
      assert.deepEqual(result, { url: 'https://amzn.to/converted123', linkKind: 'coupon' })
    } finally {
      restore()
    }
  })
})

test('Amazon: link sem ASIN com COUPON_LINK_CONVERT=true cai para ?tag= quando shortlink falha', async () => {
  await withCouponConvert('true', async () => {
    const couponUrl = 'https://www.amazon.com.br/deals?ref=promo'
    const restore = mockAxiosOnce(async (url) => {
      assert.ok(url.includes('sitestripe/getShortUrl'))
      return { status: 401, data: { error: 'unauthorized' }, headers: {} }
    })
    try {
      const result = await convert(couponUrl, CREDS)
      assert.deepEqual(result, { url: `${couponUrl}&tag=${CREDS.tag}`, linkKind: 'coupon', warning: 'amazon_cookies_expired' })
    } finally {
      restore()
    }
  })
})

test('Amazon: link sem ASIN com flag OFF segue descartado (null) — comportamento histórico', async () => {
  await withCouponConvert(undefined, async () => {
    const result = await convert('https://www.amazon.com.br/deals?ref=promo', CREDS)
    assert.equal(result, null)
  })
})

// --- Cookie completo da sessão (RCA 2026-07: 3 cookies insuficientes/expiram) ---

test('normalizeAmazonCookie: header cru é devolvido como está', () => {
  assert.equal(normalizeAmazonCookie('a=1; b=2'), 'a=1; b=2')
})

test('normalizeAmazonCookie: JSON de export (extensão) vira header nome=valor', () => {
  const json = JSON.stringify([
    { name: 'session-id', value: '147-000' },
    { name: 'at-acbbr', value: 'Atza|x' },
  ])
  assert.equal(normalizeAmazonCookie(json), 'session-id=147-000; at-acbbr=Atza|x')
})

test('normalizeAmazonCookie: vazio/invalid degradam com segurança', () => {
  assert.equal(normalizeAmazonCookie(''), '')
  assert.equal(normalizeAmazonCookie(null), '')
  assert.equal(normalizeAmazonCookie('[não é json'), '[não é json')
})

test('Amazon: cookie completo é encaminhado inteiro ao SiteStripe (não só os 3 nomeados)', async () => {
  const fullCookie = 'session-id=147; session-token=tok; at-acbbr=Atza|x; ubid-acbbr=u; x-acbbr=q'
  let sentCookie = null
  const restore = mockAxiosOnce(async (url, options) => {
    if (url.includes('sitestripe/getShortUrl')) {
      sentCookie = options.headers.Cookie
      return { status: 200, data: { shortUrl: 'https://amzn.to/full1' }, headers: {} }
    }
    return { status: 200, request: { res: { responseUrl: LONG_URL } }, config: { url: LONG_URL } }
  })
  try {
    const result = await convert(LONG_URL, { tag: 'x-20', cookie: fullCookie })
    assert.deepEqual(result, { url: 'https://amzn.to/full1', linkKind: 'product' })
    assert.equal(sentCookie, fullCookie, 'a sessão completa é enviada, incluindo session-token')
  } finally {
    restore()
  }
})

test('Amazon: cookie completo em JSON é normalizado no header Cookie', async () => {
  const json = JSON.stringify([
    { name: 'session-id', value: '147' },
    { name: 'session-token', value: 'tok' },
    { name: 'at-acbbr', value: 'Atza|x' },
  ])
  let sentCookie = null
  const restore = mockAxiosOnce(async (url, options) => {
    if (url.includes('sitestripe/getShortUrl')) {
      sentCookie = options.headers.Cookie
      return { status: 200, data: { shortUrl: 'https://amzn.to/full2' }, headers: {} }
    }
    return { status: 200, request: { res: { responseUrl: LONG_URL } }, config: { url: LONG_URL } }
  })
  try {
    await convert(LONG_URL, { tag: 'x-20', cookie: json })
    assert.equal(sentCookie, 'session-id=147; session-token=tok; at-acbbr=Atza|x')
  } finally {
    restore()
  }
})

test('checkAmazonSession: sem cookie devolve no_cookie', async () => {
  const r = await checkAmazonSession({ tag: 'x-20' })
  assert.deepEqual(r, { configured: false, alive: null, reason: 'no_cookie' })
})

test('checkAmazonSession: shortUrl gerado => alive', async () => {
  const restore = mockAxiosOnce(async () => ({ status: 200, data: { shortUrl: 'https://amzn.to/ok' }, headers: {} }))
  try {
    const r = await checkAmazonSession(CREDS)
    assert.deepEqual(r, { configured: true, alive: true, reason: 'ok' })
  } finally {
    restore()
  }
})

test('checkAmazonSession: parede "Acessar Amazon" (200 HTML) => alive:false expired', async () => {
  const restore = mockAxiosOnce(async () => ({
    status: 200,
    data: '<!doctype html><html><head><title>Acessar Amazon</title></head><body>ap/signin</body></html>',
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  }))
  try {
    const r = await checkAmazonSession(CREDS)
    assert.deepEqual(r, { configured: true, alive: false, reason: 'expired' })
  } finally {
    restore()
  }
})

test('checkAmazonSession: 5xx transitório => indeterminado (não alarma falso-expired)', async () => {
  const restore = mockAxiosOnce(async () => ({ status: 503, data: {}, headers: {} }))
  try {
    const r = await checkAmazonSession(CREDS)
    assert.deepEqual(r, { configured: true, alive: null, reason: 'network_error' })
  } finally {
    restore()
  }
})

// --- credentialPatch em checkAmazonSession (001-amazon-cookie-expiry) ---
// A sondagem do painel roda getShortUrl de verdade, que ROTACIONA o cookie da
// sessão. Sem devolver o credentialPatch, a rota do painel (sem __onCredentialPatch)
// descartava a rotação e a próxima chamada reenviava o token velho — sessão morre
// cedo. checkAmazonSession agora repassa o credentialPatch que createAmazonShortLink
// devolve, para a rota persistir.

test('checkAmazonSession: devolve credentialPatch quando a Amazon rotaciona o cookie', async () => {
  const restore = mockAxiosOnce(async () => ({
    status: 200,
    data: { shortUrl: 'https://amzn.to/rot-session' },
    headers: { 'set-cookie': ['session-token=tokNOVO; Path=/; Secure'] },
  }))
  try {
    const r = await checkAmazonSession({ tag: 'x-20', cookie: 'session-token=tokVelho' })
    assert.equal(r.configured, true)
    assert.equal(r.alive, true)
    assert.equal(r.reason, 'ok')
    assert.match(r.credentialPatch.cookie, /session-token=tokNOVO/)
  } finally {
    restore()
  }
})

test('checkAmazonSession: sem Set-Cookie não devolve credentialPatch', async () => {
  const restore = mockAxiosOnce(async () => ({ status: 200, data: { shortUrl: 'https://amzn.to/no-patch' }, headers: {} }))
  try {
    const r = await checkAmazonSession(CREDS)
    assert.deepEqual(r, { configured: true, alive: true, reason: 'ok' })
    assert.equal('credentialPatch' in r, false)
  } finally {
    restore()
  }
})

test('checkAmazonSession: Set-Cookie sem mudança não devolve credentialPatch', async () => {
  const restore = mockAxiosOnce(async () => ({
    status: 200,
    data: { shortUrl: 'https://amzn.to/unchanged' },
    headers: { 'set-cookie': ['at-acbbr=expired-at-1234567890; Path=/'] },
  }))
  try {
    const r = await checkAmazonSession(CREDS)
    assert.equal('credentialPatch' in r, false)
  } finally {
    restore()
  }
})

test('checkAmazonSession: Set-Cookie só com diretiva de limpeza (valor vazio) não devolve credentialPatch (não regressivo)', async () => {
  const restore = mockAxiosOnce(async () => ({
    status: 200,
    data: { shortUrl: 'https://amzn.to/clean-only' },
    headers: { 'set-cookie': ['session-token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT'] },
  }))
  try {
    const r = await checkAmazonSession({ tag: 'x-20', cookie: 'session-token=tokVelho' })
    assert.equal('credentialPatch' in r, false)
  } finally {
    restore()
  }
})

// --- Rotação de cookie (mantém a sessão viva; RCA: cookie completo morre em ~3h) ---

test('buildAmazonCredentialPatchFromSetCookie: mescla Set-Cookie rotacionado sobre o enviado', async () => {
  const { buildAmazonCredentialPatchFromSetCookie } = await import('../src/converters/amazon.js')
  const sent = 'session-id=1; at-acbbr=velho; session-token=tokVelho'
  const patch = buildAmazonCredentialPatchFromSetCookie(sent, {
    'set-cookie': ['session-token=tokNOVO; Path=/; Secure', 'at-acbbr=atNOVO; Path=/'],
  })
  assert.ok(patch)
  assert.match(patch.cookie, /session-token=tokNOVO/)
  assert.match(patch.cookie, /at-acbbr=atNOVO/)
  assert.match(patch.cookie, /session-id=1/, 'preserva os cookies não rotacionados')
})

test('buildAmazonCredentialPatchFromSetCookie: sem Set-Cookie ou sem mudança devolve null', async () => {
  const { buildAmazonCredentialPatchFromSetCookie } = await import('../src/converters/amazon.js')
  assert.equal(buildAmazonCredentialPatchFromSetCookie('a=1', {}), null)
  assert.equal(buildAmazonCredentialPatchFromSetCookie('a=1', { 'set-cookie': ['a=1; Path=/'] }), null)
})

test('buildAmazonCredentialPatchFromSetCookie: ignora diretiva de limpeza (value vazio)', async () => {
  const { buildAmazonCredentialPatchFromSetCookie } = await import('../src/converters/amazon.js')
  assert.equal(buildAmazonCredentialPatchFromSetCookie('a=1', { 'set-cookie': ['a=; Expires=Thu, 01 Jan 1970'] }), null)
})

test('Amazon: sucesso persiste cookies rotacionados via __onCredentialPatch', async () => {
  let patched = null
  const creds = {
    tag: 'x-20',
    cookie: 'session-id=1; at-acbbr=velho; session-token=tokVelho',
    __onCredentialPatch: async (platform, patch) => { patched = { platform, patch } },
  }
  const restore = mockAxiosOnce(async (url) => {
    if (url.includes('sitestripe/getShortUrl')) {
      return {
        status: 200,
        data: { shortUrl: 'https://amzn.to/rot1' },
        headers: { 'set-cookie': ['session-token=tokNOVO; Path=/; Secure'] },
      }
    }
    return { status: 200, request: { res: { responseUrl: LONG_URL } }, config: { url: LONG_URL } }
  })
  try {
    const result = await convert(LONG_URL, creds)
    assert.deepEqual(result, { url: 'https://amzn.to/rot1', linkKind: 'product' })
    assert.ok(patched, '__onCredentialPatch foi chamado')
    assert.equal(patched.platform, 'amazon')
    assert.match(patched.patch.cookie, /session-token=tokNOVO/)
  } finally {
    restore()
  }
})

test('Amazon: sem __onCredentialPatch (ex.: offerEngine) a rotação é no-op silencioso', async () => {
  const restore = mockAxiosOnce(async (url) => {
    if (url.includes('sitestripe/getShortUrl')) {
      return { status: 200, data: { shortUrl: 'https://amzn.to/rot2' }, headers: { 'set-cookie': ['session-token=novo'] } }
    }
    return { status: 200, request: { res: { responseUrl: LONG_URL } }, config: { url: LONG_URL } }
  })
  try {
    const result = await convert(LONG_URL, { tag: 'x-20', cookie: 'session-token=velho' })
    assert.deepEqual(result, { url: 'https://amzn.to/rot2', linkKind: 'product' })
  } finally {
    restore()
  }
})

// RCA 2026-07 — zero cliques na Amazon entre 16 e 23/07.
//
// O caminho de PRODUTO mandava ao getShortUrl a `longUrl` crua vinda de
// `buildLongUrl` (`.../dp/ASIN`, SEM `?tag=`), confiando só no query param
// `tag=` da chamada para creditar. O SiteStripe encurta a `longUrl` como
// recebeu: o amzn.to nascia sem tag, a oferta saía, era clicada, e nenhum
// clique era creditado. Enquanto a sessão do SiteStripe esteve viva
// (13-23/07) TODOS os links saíram como amzn.to e os cliques zeraram; assim
// que o cookie expirou e o fallback `?tag=` voltou (24/07), os cliques
// voltaram no mesmo dia. O caminho de cupom já embutia a tag — só o de
// produto não embutia.
//
// Estes dois testes travam a regressão: a tag precisa estar DENTRO da
// `longUrl` enviada, e o fallback não pode duplicar `?tag=`.
test('Amazon: produto embute ?tag= na longUrl mandada ao getShortUrl (senão o amzn.to nasce sem tag)', async () => {
  let seenLongUrl = null
  const restore = mockAxiosOnce(async (url, options) => {
    if (url.includes('sitestripe/getShortUrl')) {
      seenLongUrl = options.params.longUrl
      assert.equal(options.params.tag, CREDS.tag)
      return { status: 200, data: { shortUrl: 'https://amzn.to/3taggedOK' }, headers: {} }
    }
    return { status: 200, request: { res: { responseUrl: LONG_URL } }, config: { url: LONG_URL } }
  })
  try {
    const result = await convert(LONG_URL, CREDS)
    assert.deepEqual(result, { url: 'https://amzn.to/3taggedOK', linkKind: 'product' })
    assert.equal(
      seenLongUrl,
      `${LONG_URL}?tag=${CREDS.tag}`,
      'a longUrl enviada ao SiteStripe precisa carregar ?tag= — sem isso o amzn.to gerado não credita clique nenhum',
    )
  } finally {
    restore()
  }
})

test('Amazon: fallback de produto não duplica ?tag= depois de a longUrl já ter a tag', async () => {
  const restore = mockAxiosOnce(async (url) => {
    if (url.includes('sitestripe/getShortUrl')) {
      return { status: 401, data: { error: 'unauthorized' }, headers: {} }
    }
    return { status: 200, request: { res: { responseUrl: LONG_URL } }, config: { url: LONG_URL } }
  })
  try {
    const result = await convert(LONG_URL, CREDS)
    assert.equal(result.url, `${LONG_URL}?tag=${CREDS.tag}`)
    assert.equal((result.url.match(/[?&]tag=/g) || []).length, 1, 'só pode haver um ?tag= na URL final')
  } finally {
    restore()
  }
})
