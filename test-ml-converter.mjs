import assert from 'assert/strict'
import axios from 'axios'
import { convert } from './src/converters/mercadolivre.js'

const originalGet = axios.get
const originalPost = axios.post

async function run() {
  try {
    axios.post = async () => ({ data: { urls: [{ short_url: 'https://meli.la/afiliado123' }] } })
    let out = await convert('https://www.mercadolivre.com.br/p/MLB123', { tag: 'TAGX', ssid: 'SSID_OK', csrf: 'CSRF' })
    assert.equal(out, 'https://meli.la/afiliado123')

    // link de outro afiliado -> resolve -> extrai MLB -> usa canônico /p/MLB...
    axios.get = async (url) => {
      if (url === 'https://meli.la/outro') {
        return { data: '<html><script>window.__DATA__={"origin_url":"https:\\/\\/produto.mercadolivre.com.br\\/MLB-4270189813-kit-3-calcas-_JM?ref=x"}</script></html>' }
      }
      return { data: '' }
    }
    axios.post = async (_reqUrl, body) => {
      assert.equal(body.urls[0], 'https://www.mercadolivre.com.br/p/MLB4270189813')
      return { data: { urls: [{ short_url: 'https://meli.la/meu-link' }] } }
    }
    out = await convert('https://meli.la/outro', { tag: 'TAGX', ssid: 'SSID_OK', csrf: 'CSRF' })
    assert.equal(out, 'https://meli.la/meu-link')


    // fallback não deve devolver wrapper /gz/webdevice/config
    axios.post = async () => { throw new Error('401') }
    out = await convert('https://www.mercadolivre.com.br/gz/webdevice/config?go=https%3A%2F%2Fwww.mercadolivre.com.br%2Fp%2FMLB999%3Fref%3Dabc&noscript=true', { tag: 'TAGGO', ssid: 'BAD', csrf: 'CSRF' })
    assert.ok(out.startsWith('https://www.mercadolivre.com.br/p/MLB999'))
    assert.ok(out.includes('partner_id=TAGGO'))

    // fallback
    axios.post = async () => { throw new Error('401') }
    axios.get = originalGet
    out = await convert('https://www.mercadolivre.com.br/p/MLB777?ref=old', { tag: 'TAGFALLBACK', ssid: 'BAD', csrf: 'CSRF' })
    assert.ok(out.includes('partner_id=TAGFALLBACK'))

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
