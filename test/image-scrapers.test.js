import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'

import { fetchImageBuffer, fetchProductImage } from '../src/converters/imageScrapers.js'

async function imageBytes({ width = 256, height = 256, color = '#ff0000' } = {}) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  }).png().toBuffer()
}

function htmlResponse(html, url = 'https://www.amazon.com.br/dp/B000000001') {
  const response = new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
  Object.defineProperty(response, 'url', { value: url })
  return response
}

function imageResponse(bytes, url = 'https://down-br.img.susercontent.com/file/produto.webp') {
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

test('fetchImageBuffer baixa primeiro a URL extraida da Amazon e so usa variante sem sufixo como fallback', async (t) => {
  const originalFetch = globalThis.fetch
  const calls = []
  const valid = await imageBytes({ color: '#1f7a1f' })
  t.after(() => { globalThis.fetch = originalFetch })

  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return imageResponse(valid, String(url))
  }

  const image = await fetchImageBuffer('https://m.media-amazon.com/images/I/91-produto._AC_SL1500_.jpg', 'https://www.amazon.com.br/dp/B000000001')

  assert.equal(image?.mimetype, 'image/png')
  assert.deepEqual(calls, ['https://m.media-amazon.com/images/I/91-produto._AC_SL1500_.jpg'])
})

test('fetchImageBuffer rejeita placeholder branco/pequeno da Amazon e tenta fallback', async (t) => {
  const originalFetch = globalThis.fetch
  const calls = []
  const blank = await imageBytes({ color: '#ffffff' })
  const valid = await imageBytes({ color: '#0044cc' })
  t.after(() => { globalThis.fetch = originalFetch })

  globalThis.fetch = async (url) => {
    calls.push(String(url))
    const bytes = calls.length === 1 ? blank : valid
    return imageResponse(bytes, String(url))
  }

  const image = await fetchImageBuffer('https://m.media-amazon.com/images/I/91-produto._AC_SL1500_.jpg', 'https://www.amazon.com.br/dp/B000000001')

  assert.equal(image?.mimetype, 'image/png')
  assert.deepEqual(calls, [
    'https://m.media-amazon.com/images/I/91-produto._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/91-produto.jpg',
  ])
})

test('fetchImageBuffer troca thumbnail _tn.webp da Shopee pela imagem maior antes de baixar', async (t) => {
  const originalFetch = globalThis.fetch
  const calls = []
  const valid = await imageBytes({ color: '#ee4d2d' })
  t.after(() => { globalThis.fetch = originalFetch })

  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return imageResponse(valid, String(url))
  }

  const image = await fetchImageBuffer('https://down-br.img.susercontent.com/file/br-123_tn.webp', 'https://shopee.com.br/produto-i.1.2')

  assert.equal(image?.mimetype, 'image/png')
  assert.equal(calls[0], 'https://down-br.img.susercontent.com/file/br-123.webp')
})

test('fetchImageBuffer remove query de resize da Shopee antes de baixar', async (t) => {
  const originalFetch = globalThis.fetch
  const calls = []
  const valid = await imageBytes({ color: '#ee4d2d' })
  t.after(() => { globalThis.fetch = originalFetch })

  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return imageResponse(valid, String(url))
  }

  const image = await fetchImageBuffer('https://down-br.img.susercontent.com/file/br-123?x-oss-process=image/resize,w_320', 'https://shopee.com.br/produto-i.1.2')

  assert.equal(image?.mimetype, 'image/png')
  assert.equal(calls[0], 'https://down-br.img.susercontent.com/file/br-123')
})
