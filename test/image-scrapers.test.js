import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

import { fetchImageBuffer, fetchProductImage, normalizeImageForWhatsApp } from '../src/converters/imageScrapers.js'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const readFixture = (name) => fs.readFileSync(path.join(fixturesDir, name), 'utf-8')

async function imageBytes({ width = 1200, height = 1200, color = '#ff0000' } = {}) {
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

test('fetchImageBuffer promove URL pequena da Amazon para variante oficial em alta resolucao', async (t) => {
  const originalFetch = globalThis.fetch
  const calls = []
  const valid = await imageBytes({ width: 1200, height: 1200, color: '#1f7a1f' })
  t.after(() => { globalThis.fetch = originalFetch })

  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return imageResponse(valid, String(url))
  }

  const image = await fetchImageBuffer('https://m.media-amazon.com/images/I/91-produto._SX300_.jpg', 'https://www.amazon.com.br/dp/B000000001')

  assert.equal(image?.mimetype, 'image/png')
  assert.deepEqual(calls, ['https://m.media-amazon.com/images/I/91-produto._AC_SL1500_.jpg'])
})

test('fetchImageBuffer rejeita placeholder pequeno da Amazon e tenta proxima variante', async (t) => {
  const originalFetch = globalThis.fetch
  const calls = []
  const tiny = await imageBytes({ width: 40, height: 40, color: '#ffffff' })
  const valid = await imageBytes({ width: 1500, height: 1500, color: '#0044cc' })
  t.after(() => { globalThis.fetch = originalFetch })

  globalThis.fetch = async (url) => {
    calls.push(String(url))
    const bytes = calls.length === 1 ? tiny : valid
    return imageResponse(bytes, String(url))
  }

  const image = await fetchImageBuffer('https://m.media-amazon.com/images/I/91-produto.jpg', 'https://www.amazon.com.br/dp/B000000001')

  assert.equal(image?.mimetype, 'image/png')
  assert.deepEqual(calls, [
    'https://m.media-amazon.com/images/I/91-produto._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/91-produto._SL1500_.jpg',
  ])
})

test('fetchImageBuffer prefere variante hi-res ≥800px e descarta versão pequena como fallback', async (t) => {
  const originalFetch = globalThis.fetch
  const calls = []
  const small = await imageBytes({ width: 500, height: 500, color: '#888' })
  const hires = await imageBytes({ width: 1500, height: 1500, color: '#0044cc' })
  t.after(() => { globalThis.fetch = originalFetch })

  globalThis.fetch = async (url) => {
    const urlStr = String(url)
    calls.push(urlStr)
    // _AC_SL1500_ devolve 500px (CDN trapaceando); _SL1500_ devolve hi-res real.
    return imageResponse(urlStr.includes('_AC_SL1500_') ? small : hires, urlStr)
  }

  const image = await fetchImageBuffer('https://m.media-amazon.com/images/I/91-produto.jpg', 'https://www.amazon.com.br/dp/B0PROD12345')

  assert.equal(image?.width, 1500, `esperava hi-res 1500px, veio ${image?.width}px`)
  assert.equal(image?.height, 1500)
  assert.ok(calls.length >= 2, `só tentou ${calls.length} candidato(s)`)
})

test('extractAmazonImageFromHtml e fetchImageBuffer recuperam imagem limpa quando og:image vem com badge de oferta (fixture real)', async (t) => {
  const originalFetch = globalThis.fetch
  const badgedHtml = readFixture('amazon-badged-og-image.html')
  const hires = await imageBytes({ width: 1500, height: 1500, color: '#ee9900' })
  const calls = []
  t.after(() => { globalThis.fetch = originalFetch })

  globalThis.fetch = async (url) => {
    const urlStr = String(url)
    calls.push(urlStr)
    if (urlStr.startsWith('https://www.amazon.com.br/dp/')) return htmlResponse(badgedHtml, urlStr)
    if (urlStr.includes('amazon-adsystem.com')) return new Response('', { status: 404 })
    return imageResponse(hires, urlStr)
  }

  const productUrl = 'https://www.amazon.com.br/dp/B09VQ39F41'
  const image = await fetchProductImage('amazon', productUrl, {})
  assert.ok(image, 'nenhuma imagem foi extraída do HTML da Amazon')
  assert.match(image, /\/images\/I\/[A-Za-z0-9]+/, `URL inesperada: ${image}`)

  const downloaded = await fetchImageBuffer(image, productUrl)
  assert.ok(downloaded, 'fetchImageBuffer não baixou nada para a Amazon')
  assert.ok(
    Math.max(downloaded.width, downloaded.height) >= 800,
    `esperava ≥800px no maior eixo, veio ${downloaded.width}x${downloaded.height}`,
  )
  const firstImageCall = calls.find((u) => u.includes('m.media-amazon.com'))
  assert.doesNotMatch(firstImageCall || '', /_PIlimited-time-deal|_BO\d|_ZJ/, `tentou baixar URL com badge: ${firstImageCall}`)
})

test('fetchProductImage da Amazon recupera data-a-dynamic-image mesmo quando o HTML excede o teto de leitura', async (t) => {
  const originalFetch = globalThis.fetch
  // HTML real do produto, truncado em 340KB (data-a-dynamic-image está em ~320KB).
  // No código antigo IMAGE_HTML_MAX_BYTES=512KB já cortava a página de 1.4MB
  // ANTES desse offset; agora o teto é 2MB e o leitor devolve o que coletou.
  const html = readFixture('amazon-chrome-dynamic.html')
  t.after(() => { globalThis.fetch = originalFetch })

  globalThis.fetch = async (url) => {
    if (String(url).startsWith('https://www.amazon.com.br/dp/')) return htmlResponse(html, String(url))
    return new Response('', { status: 404 })
  }

  const image = await fetchProductImage('amazon', 'https://www.amazon.com.br/dp/B09VQ39F41', {})
  assert.match(image || '', /\/images\/I\/[A-Za-z0-9]+/, `extração falhou: ${image}`)
})

test('Shopee SPA shell (fixture real, FB UA) não tem og:image e cai no fallback de creds', async (t) => {
  const originalFetch = globalThis.fetch
  const spaShell = readFixture('shopee-spa-shell.html')
  let credsFallbackCalled = false
  t.after(() => { globalThis.fetch = originalFetch })

  globalThis.fetch = async (url) => htmlResponse(spaShell, String(url))

  // Sem creds, sem og:image no SSR, sem API pública — tem que devolver null
  // sem travar. O caminho real em produção é a API de afiliado em shopee.js
  // (creds), que é independente desse fluxo.
  const image = await fetchProductImage('shopee', 'https://shopee.com.br/produto-i.88201679.22667077055', {})
  assert.equal(image, null, `Shopee sem creds deveria devolver null, veio ${image}`)
  assert.equal(credsFallbackCalled, false)
})

test('fetchImageBuffer troca thumbnail _tn.webp da Shopee pela imagem maior antes de baixar', async (t) => {
  const originalFetch = globalThis.fetch
  const calls = []
  const valid = await imageBytes({ width: 1200, height: 1200, color: '#ee4d2d' })
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
  const valid = await imageBytes({ width: 1200, height: 1200, color: '#ee4d2d' })
  t.after(() => { globalThis.fetch = originalFetch })

  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return imageResponse(valid, String(url))
  }

  const image = await fetchImageBuffer('https://down-br.img.susercontent.com/file/br-123?x-oss-process=image/resize,w_320', 'https://shopee.com.br/produto-i.1.2')

  assert.equal(image?.mimetype, 'image/png')
  assert.equal(calls[0], 'https://down-br.img.susercontent.com/file/br-123')
})

test('fetchImageBuffer alterna entre os CDNs cf.shopee.com.br e susercontent.com quando o primeiro falha', async (t) => {
  const originalFetch = globalThis.fetch
  const calls = []
  const valid = await imageBytes({ width: 1200, height: 1200, color: '#ee4d2d' })
  t.after(() => { globalThis.fetch = originalFetch })

  globalThis.fetch = async (url) => {
    const urlStr = String(url)
    calls.push(urlStr)
    if (urlStr.includes('cf.shopee.com.br')) {
      return new Response('', { status: 404 })
    }
    return imageResponse(valid, urlStr)
  }

  const image = await fetchImageBuffer('https://cf.shopee.com.br/file/br-abc', 'https://shopee.com.br/produto-i.1.2')

  assert.equal(image?.mimetype, 'image/png')
  assert.ok(calls.some(u => u.includes('down-br.img.susercontent.com/file/br-abc')), `nao tentou CDN alternativo: ${calls.join(', ')}`)
})

test('fetchProductImage da Amazon descarta og:image de logo e usa widget de adsystem como fallback', async (t) => {
  const originalFetch = globalThis.fetch
  const calls = []
  t.after(() => { globalThis.fetch = originalFetch })

  // Página degradada (bot detection): og:image cai em /images/G/ (logo).
  const degradedHtml = `<html><head>
    <meta property="og:image" content="https://m.media-amazon.com/images/G/01/marketing/nav/PT_BR_FlyOut_amazon_logo._CB659972834_.png" />
  </head></html>`

  const widgetHtml = `<html><body><a href="https://www.amazon.com.br/dp/B0XYZ12345">
    <img src="https://m.media-amazon.com/images/I/71PROD._SL500_.jpg" />
  </a></body></html>`

  globalThis.fetch = async (url, opts = {}) => {
    const urlStr = String(url)
    calls.push(urlStr)
    if (urlStr.startsWith('https://www.amazon.com.br/dp/')) return htmlResponse(degradedHtml, urlStr)
    if (urlStr.includes('amazon-adsystem.com')) return htmlResponse(widgetHtml, urlStr)
    return new Response('', { status: 404 })
  }

  const image = await fetchProductImage('amazon', 'https://www.amazon.com.br/dp/B0XYZ12345?tag=loja-20', {})

  assert.equal(image, 'https://m.media-amazon.com/images/I/71PROD._SL500_.jpg')
  assert.ok(calls.some(u => u.includes('amazon-adsystem.com')), `nao tentou widget adsystem: ${calls.join(', ')}`)
})

test('fetchProductImage da Amazon prefere /images/I/ extraido do data-a-dynamic-image quando og:image vem de logo', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })

  const html = `<html><head>
    <meta property="og:image" content="https://m.media-amazon.com/images/G/01/marketing/nav/amazon_logo.png" />
  </head><body>
    <img id="landingImage" data-a-dynamic-image="{&quot;https://m.media-amazon.com/images/I/91-produto._AC_SL1500_.jpg&quot;:[1500,1500]}" />
  </body></html>`

  globalThis.fetch = async () => htmlResponse(html, 'https://www.amazon.com.br/dp/B0PROD12345')

  const image = await fetchProductImage('amazon', 'https://www.amazon.com.br/dp/B0PROD12345', {})

  assert.equal(image, 'https://m.media-amazon.com/images/I/91-produto._AC_SL1500_.jpg')
})

test('fetchProductImage resolve short link Amazon amzn.la antes de buscar imagem', async (t) => {
  const originalFetch = globalThis.fetch
  const calls = []
  t.after(() => { globalThis.fetch = originalFetch })

  const productUrl = 'https://www.amazon.com.br/dp/B0AMZNLA01'
  const imageUrl = 'https://m.media-amazon.com/images/I/91-amznla._AC_SL1500_.jpg'
  const html = `<html><body>
    <img id="landingImage" data-a-dynamic-image="{&quot;${imageUrl}&quot;:[1500,1500]}" />
  </body></html>`

  globalThis.fetch = async (url) => {
    const urlStr = String(url)
    calls.push(urlStr)
    if (urlStr === 'https://amzn.la/img123') return htmlResponse('', productUrl)
    if (urlStr === productUrl) return htmlResponse(html, productUrl)
    throw new Error(`fetch inesperado: ${urlStr}`)
  }

  const image = await fetchProductImage('amazon', 'https://amzn.la/img123', {})

  assert.equal(image, imageUrl)
  assert.deepEqual(calls, ['https://amzn.la/img123', productUrl])
})

test('fetchProductImage resolve short link meli.la do Mercado Livre antes de buscar imagem (regressão: texto do produto A com imagem do produto B)', async (t) => {
  const originalFetch = globalThis.fetch
  const calls = []
  t.after(() => { globalThis.fetch = originalFetch })

  const shortUrl = 'https://meli.la/1asTUog'
  const productUrl = 'https://produto.mercadolivre.com.br/MLB-1234567890-copo-termico-inox-887ml-_JM'
  const cupImageUrl = 'https://http2.mlstatic.com/D_NQ_NP_copo-termico.jpg'
  const html = `<html><head>
    <meta property="og:image" content="${cupImageUrl}" />
  </head></html>`

  globalThis.fetch = async (url) => {
    const urlStr = String(url)
    calls.push(urlStr)
    // Short link resolve() segue redirect e devolve a URL final do produto —
    // NUNCA a landing intermediária (que teria og:image de outro produto).
    if (urlStr === shortUrl) return htmlResponse('', productUrl)
    if (urlStr === productUrl) return htmlResponse(html, productUrl)
    throw new Error(`fetch inesperado: ${urlStr}`)
  }

  const image = await fetchProductImage('mercadolivre', shortUrl, {})

  assert.equal(image, cupImageUrl)
  assert.deepEqual(calls, [shortUrl, productUrl])
})

test('fetchProductImage retorna null (não raspa a landing crua) quando o short link do Mercado Livre não confirma o produto (regressão: texto do produto A com imagem do produto B via vitrine/social)', async (t) => {
  const originalFetch = globalThis.fetch
  const calls = []
  t.after(() => { globalThis.fetch = originalFetch })

  // Short link que resolve para uma vitrine /social/ SEM ?ref= — sem card
  // destacado extraível, resolveToCleanProductUrl devolve null de propósito
  // (produto não confirmado). Antes do fix, resolveMercadoLivreImage caía no
  // fallback `|| url` e raspava a landing crua em busca de og:image — pegando
  // a imagem de um produto aleatório da vitrine/carrossel, não o anunciado.
  const shortUrl = 'https://meli.la/social-landing-test'
  const socialUrl = 'https://www.mercadolivre.com.br/social/algumavendedora'
  const wrongProductImage = 'https://http2.mlstatic.com/D_NQ_NP_produto-errado.jpg'
  const landingHtml = `<html><head>
    <meta property="og:image" content="${wrongProductImage}" />
  </head></html>`

  globalThis.fetch = async (url) => {
    const urlStr = String(url)
    calls.push(urlStr)
    if (urlStr === shortUrl) return htmlResponse('', socialUrl)
    // Não deveria ser chamado — se for, o fix regrediu e voltou a raspar a landing.
    if (urlStr === socialUrl) return htmlResponse(landingHtml, socialUrl)
    throw new Error(`fetch inesperado: ${urlStr}`)
  }

  const image = await fetchProductImage('mercadolivre', shortUrl, {})

  assert.equal(image, null)
  assert.deepEqual(calls, [shortUrl])
})

// RCA "imagens muito pequenas" (filas/broadcast): a Baileys só calcula
// width/height de um imageMessage quando NÃO recebe jpegThumbnail pronto
// (Utils/messages.js:132-162 do @whiskeysockets/baileys) — como o app SEMPRE
// pré-gera o thumbnail aqui (para não depender do sharp interno da lib), o
// proto saía sem width/height e o WhatsApp renderizava a foto pequena.
// normalizeImageForWhatsApp precisa devolver as dimensões do buffer FINAL
// para o chamador poder repassá-las explicitamente no payload de envio.
test('normalizeImageForWhatsApp devolve width/height do buffer principal (sem mutation)', async () => {
  const src = await imageBytes({ width: 2000, height: 1000 })
  const result = await normalizeImageForWhatsApp(src)

  assert.ok(result)
  const meta = await sharp(result.buffer).metadata()
  assert.equal(result.width, meta.width)
  assert.equal(result.height, meta.height)
  // Resize "inside" 1600x1600 preservando aspect ratio 2:1 -> 1600x800.
  assert.equal(result.width, 1600)
  assert.equal(result.height, 800)
})

test('normalizeImageForWhatsApp devolve width/height do buffer principal (com mutation)', async () => {
  const src = await imageBytes({ width: 1500, height: 1500 })
  const result = await normalizeImageForWhatsApp(src, { mutation: { groupId: 'grupo-1', date: '2026-07-20' } })

  assert.ok(result)
  const meta = await sharp(result.buffer).metadata()
  assert.equal(result.width, meta.width)
  assert.equal(result.height, meta.height)
})

test('normalizeImageForWhatsApp não amplia imagem pequena e devolve as dimensões reais dela', async () => {
  const src = await imageBytes({ width: 300, height: 200 })
  const result = await normalizeImageForWhatsApp(src)

  assert.ok(result)
  assert.equal(result.width, 300)
  assert.equal(result.height, 200)
})
