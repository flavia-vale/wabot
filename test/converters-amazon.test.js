import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'
import axios from 'axios'
import { convert, isAmazonShortLink, resolveAmazonShortLink } from '../src/converters/amazon.js'

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
    assert.deepEqual(result, { url: `${LONG_URL}?tag=${CREDS.tag}`, warning: 'amazon_cookies_expired' })
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
    assert.deepEqual(result, { url: `${LONG_URL}?tag=${CREDS.tag}`, warning: null })
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
    assert.equal(result, 'https://amzn.to/abc123')
  } finally {
    restore()
  }
})

test('Amazon: ASIN ausente continua devolvendo null (segurança contra link malformado)', async () => {
  const result = await convert('https://www.amazon.com.br/gp/help', CREDS)
  assert.equal(result, null)
})

test('Amazon: short link amzn.la é resolvido e convertido como amzn.to', async () => {
  const restore = mockAxiosOnce(async (url, opts) => {
    if (url.includes('sitestripe/getShortUrl')) {
      return { status: 200, data: { shortUrl: 'https://amzn.to/abc123' }, headers: {} }
    }
    // resolveShortUrl segue o redirect do amzn.la até a página do produto
    return { status: 200, request: { res: { responseUrl: LONG_URL } }, config: { url: LONG_URL } }
  })
  try {
    const result = await convert('https://amzn.la/d/abc123', CREDS)
    assert.equal(result, 'https://amzn.to/abc123')
  } finally {
    restore()
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

test('resolveAmazonShortLink: URL que já tem ASIN é devolvida sem fetch', async () => {
  let called = false
  const fetchImpl = async () => { called = true; return {} }
  const direct = 'https://www.amazon.com.br/dp/B09WG452T1'
  const resolved = await resolveAmazonShortLink(direct, { fetchImpl })
  assert.equal(resolved, direct)
  assert.equal(called, false, 'URL plena não dispara fetch')
})
