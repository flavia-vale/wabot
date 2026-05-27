import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'
import axios from 'axios'
import { convert } from '../src/converters/amazon.js'

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
