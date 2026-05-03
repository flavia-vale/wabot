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
      if (url === 'https://meli.la/meu-link') {
        const err = new Error('302')
        err.response = { headers: { location: 'https://www.mercadolivre.com.br/p/MLB4270189813' } }
        throw err
      }
      return { data: '' }
    }
    axios.post = async (_reqUrl, body) => {
      assert.equal(body.urls[0], 'https://www.mercadolivre.com.br/p/MLB4270189813')
      return { data: { urls: [{ short_url: 'https://meli.la/meu-link' }] } }
    }
    out = await convert('https://meli.la/outro', { tag: 'TAGX', ssid: 'SSID_OK', csrf: 'CSRF' })
    assert.equal(out, 'https://meli.la/meu-link')

    // fallback
    axios.post = async () => { throw new Error('401') }
    axios.get = originalGet
    out = await convert('https://www.mercadolivre.com.br/p/MLB777?ref=old', { tag: 'TAGFALLBACK', ssid: 'BAD', csrf: 'CSRF' })
    assert.ok(out.includes('partner_id=TAGFALLBACK'))

    // resolve-only: não converte para afiliado, só devolve URL limpa do produto
    axios.post = async () => { throw new Error('não deveria chamar createLink') }
    axios.get = async (url) => {
      if (url === 'https://meli.la/resolve-only') {
        return { data: '<html><link rel="canonical" href="https://produto.mercadolivre.com.br/MLB-9999999999-teste-_JM?ref=abc&utm=x"></html>' }
      }
      return { data: '' }
    }
    out = await convert('https://meli.la/resolve-only', { resolveOnly: true })
    assert.equal(out, 'https://produto.mercadolivre.com.br/MLB-9999999999-teste-_JM?utm=x')

    // resolve-only: decodifica wrapper /gz/webdevice/config?go=...
    const wrapped = 'https://www.mercadolivre.com.br/gz/webdevice/config?go=https%3A%2F%2Fproduto.mercadolivre.com.br%2FMLB-1234567890-produto-_JM%3Fmatt_word%3Dabc%26ref%3Dxyz'
    out = await convert(wrapped, { resolveOnly: true })
    assert.equal(out, 'https://produto.mercadolivre.com.br/MLB-1234567890-produto-_JM')

    // resolve-only: social landing deve extrair link de produto real da página
    axios.get = async (url) => {
      if (url === 'https://www.mercadolivre.com.br/social/oreidapromobr') {
        return { data: '<html><script>window.__DATA__={"target":"https:\\/\\/produto.mercadolivre.com.br\\/MLB-8888888888-nome-_JM?ref=abc"}</script></html>' }
      }
      return { data: '' }
    }
    out = await convert('https://www.mercadolivre.com.br/social/oreidapromobr', { resolveOnly: true })
    assert.equal(out, 'https://produto.mercadolivre.com.br/MLB-8888888888-nome-_JM')

    // resolve-only: remove params matt_* e amp;* vindos de HTML entities
    out = await convert('https://produto.mercadolivre.com.br/MLB-6420129610-tv-_JM?matt_event_ts=1&amp%3Bmatt_d2id=&amp%3Bmatt_tracing_id=abc', { resolveOnly: true })
    assert.equal(out, 'https://produto.mercadolivre.com.br/MLB-6420129610-tv-_JM')

    // fallback: também deve limpar matt_* escapado antes de injetar partner_id
    axios.post = async () => { throw new Error('401') }
    out = await convert('https://produto.mercadolivre.com.br/MLB-6420129610-tv-_JM?matt_event_ts=1&amp%3Bmatt_d2id=&amp%3Bmatt_tracing_id=abc', { tag: 'TAGX', ssid: 'BAD' })
    assert.equal(out, 'https://produto.mercadolivre.com.br/MLB-6420129610-tv-_JM?partner_id=TAGX')

    console.log('OK: 8 cenários de conversão/resolve ML passaram')
  } finally {
    axios.get = originalGet
    axios.post = originalPost
  }
}

run().catch((err) => {
  console.error('FAIL:', err.message)
  process.exit(1)
})
