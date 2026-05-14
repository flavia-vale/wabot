import test from 'node:test'
import assert from 'node:assert/strict'

import { fetchImageBuffer, fetchProductImage } from '../src/converters/imageScrapers.js'

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00])

function htmlResponse(html, url = 'https://www.amazon.com.br/dp/B000000001') {
  const response = new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
  Object.defineProperty(response, 'url', { value: url })
  return response
}

function imageResponse(bytes = PNG_BYTES, url = 'https://down-br.img.susercontent.com/file/produto.webp') {
  const response = new Response(bytes, { status: 200, headers: { 'content-type': 'image/png', 'content-length': String(bytes.length) } })
  Object.defineProperty(response, 'url', { value: url })
  return response
}

test('fetchProductImage resolve imagem da Amazon via data-a-dynamic-image quando og:image nao vem no HTML', async (t) => {
  const originalFetch = globalThis.fetch
  const calls = []
  t.after(() => { globalThis.fetch = originalFetch })

  const html = `<html><body>
    <img id="landingImage" data-a-dynamic-image="{&quot;https://m.media-amazon.com/images/I/51-small._SX300_.jpg&quot;:[300,300],&quot;https://m.media-amazon.com/images/I/91-large._AC_SL1500_.jpg&quot;:[1500,1500]}" />
  </body></html>`

  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), ua: opts.headers?.['User-Agent'] })
    return htmlResponse(html)
  }

  const image = await fetchProductImage('amazon', 'https://www.amazon.com.br/dp/B000000001?tag=loja-20', {})

  assert.equal(image, 'https://m.media-amazon.com/images/I/91-large._AC_SL1500_.jpg')
  assert.match(calls[0].ua, /Chrome\/124/)
})

test('fetchImageBuffer troca thumbnail _tn.webp da Shopee pela imagem maior antes de baixar', async (t) => {
  const originalFetch = globalThis.fetch
  const calls = []
  t.after(() => { globalThis.fetch = originalFetch })

  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return imageResponse()
  }

  const image = await fetchImageBuffer('https://down-br.img.susercontent.com/file/br-123_tn.webp', 'https://shopee.com.br/produto-i.1.2')

  assert.equal(image?.mimetype, 'image/png')
  assert.equal(calls[0], 'https://down-br.img.susercontent.com/file/br-123.webp')
})
