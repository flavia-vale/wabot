import assert from 'assert/strict'
import axios from 'axios'
import { convert } from './src/converters/mercadolivre.js'

const originalGet = axios.get
const originalPost = axios.post

async function run() {
  try {
    // Cenário 1: URL direta + ssid válido => retorna meli.la da API
    axios.post = async () => ({ data: { urls: [{ created: true, short_url: 'https://meli.la/afiliado123' }] } })
    let out = await convert('https://www.mercadolivre.com.br/p/MLB123', { tag: 'TAGX', ssid: 'SSID_OK', csrf: 'CSRF' })
    assert.equal(out, 'https://meli.la/afiliado123')

    // Cenário 2: meli.la de outro afiliado com redirects em cadeia => resolve e reafilia
    let getCalls = 0
    axios.get = async (url) => {
      getCalls++
      if (url === 'https://meli.la/outro') {
        const err = new Error('redirect')
        err.response = { headers: { location: 'https://mluvem.com/r1' } }
        throw err
      }
      if (url === 'https://mluvem.com/r1') {
        const err = new Error('redirect')
        err.response = { headers: { location: 'https://www.mercadolivre.com.br/kit-travesseiro/p/MLB43954645?reco_id=abc#polycard_client=x' } }
    let out = await convert('https://www.mercadolivre.com.br/p/MLB123', { tag: 'TAGX', ssid: 'SSID_OK' })
    assert.equal(out, 'https://meli.la/afiliado123')

    // Cenário 2: meli.la com redirects em cadeia => resolve e retorna afiliado API
    let getCalls = 0
    axios.get = async (url) => {
      getCalls++
      if (url === 'https://meli.la/abc') {
        const err = new Error('redirect')
        err.response = { headers: { location: 'https://mluvem.com/xyz' } }
        throw err
      }
      if (url === 'https://mluvem.com/xyz') {
        const err = new Error('redirect')
        err.response = { headers: { location: 'https://www.mercadolivre.com.br/p/MLB999' } }
        throw err
      }
      throw new Error(`URL inesperada no mock: ${url}`)
    }
    axios.post = async (reqUrl, body) => {
      assert.equal(reqUrl.includes('/affiliate-program/api/v2/affiliates/createLink'), true)
      assert.equal(body.urls[0].includes('reco_id='), false)
      assert.equal(body.urls[0].includes('#'), false)
      return { data: { urls: [{ created: true, short_url: 'https://meli.la/meu-link' }] } }
    }
    out = await convert('https://meli.la/outro', { tag: 'TAGX', ssid: 'SSID_OK', csrf: 'CSRF' })
    assert.equal(out, 'https://meli.la/meu-link')
    assert.equal(getCalls, 3)

    // Cenário 3: meli.la com página intermediária 200 (sem 3xx) => extrai canonical e reafilia
    axios.get = async (url) => {
      if (url === 'https://meli.la/html') {
        return { data: '<html><head><link rel="canonical" href="https://www.mercadolivre.com.br/p/MLB555?reco_id=xyz"></head></html>' }
      }
      return { data: '' }
    }
    axios.post = async (_reqUrl, body) => {
      assert.equal(body.urls[0].includes('reco_id='), false)
      return { data: { urls: [{ short_url: 'https://meli.la/reafiliado555' }] } }
    }
    out = await convert('https://meli.la/html', { tag: 'TAGX', ssid: 'SSID_OK', csrf: 'CSRF' })
    assert.equal(out, 'https://meli.la/reafiliado555')

    // Cenário 4: API falha nas 2 tentativas => fallback partner_id
    axios.post = async () => { throw new Error('401') }
    axios.get = originalGet
    out = await convert('https://www.mercadolivre.com.br/p/MLB777?ref=old', { tag: 'TAGFALLBACK', ssid: 'BAD', csrf: 'CSRF' })
    assert.ok(out.includes('partner_id=TAGFALLBACK'))
    assert.ok(!out.includes('ref=old'))

    console.log('OK: 4 cenários de conversão ML passaram')
    // Cenário 3: API falha nas 2 tentativas => fallback partner_id
    axios.post = async () => { throw new Error('401') }
    axios.get = originalGet
    out = await convert('https://www.mercadolivre.com.br/p/MLB777?ref=old', { tag: 'TAGFALLBACK', ssid: 'BAD', csrf: 'CSRF' })
    axios.post = async () => ({ data: { urls: [{ created: true, short_url: 'https://meli.la/final999' }] } })
    out = await convert('https://meli.la/abc', { tag: 'TAGX', ssid: 'SSID_OK' })
    assert.equal(out, 'https://meli.la/final999')
    assert.equal(getCalls, 2)

    // Cenário 3: API falha (ssid inválido) => fallback partner_id
    axios.post = async () => { throw new Error('401') }
    axios.get = originalGet
    out = await convert('https://www.mercadolivre.com.br/p/MLB777?ref=old', { tag: 'TAGFALLBACK', ssid: 'BAD' })
    assert.ok(out.includes('partner_id=TAGFALLBACK'))
    assert.ok(!out.includes('ref=old'))

    console.log('OK: 3 cenários de conversão ML passaram')
  } finally {
    axios.get = originalGet
    axios.post = originalPost
  }
}

run().catch((err) => {
  console.error('FAIL:', err.message)
  process.exit(1)
})
