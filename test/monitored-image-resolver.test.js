import test from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveMonitoredImage,
  isLikelyJpegThumbnail,
  MONITORED_THUMBNAIL_BYTES_THRESHOLD,
} from '../src/monitoredImageResolver.js'

function silentLogger() {
  return { info: () => {}, warn: () => {} }
}

function buf(size, byte = 0xab) {
  return Buffer.alloc(size, byte)
}

const FULL_IMAGE = { buffer: buf(200_000), mimetype: 'image/jpeg' }
const THUMBNAIL_IMAGE = { buffer: buf(6_000), mimetype: 'image/jpeg' }
const HIRES_FROM_MARKET = { buffer: buf(150_000), mimetype: 'image/jpeg' }

test('isLikelyJpegThumbnail detecta jpegThumbnail pequeno do link preview', () => {
  assert.equal(isLikelyJpegThumbnail(THUMBNAIL_IMAGE), true)
  assert.equal(isLikelyJpegThumbnail(FULL_IMAGE), false)
  assert.equal(isLikelyJpegThumbnail(null), false)
  assert.equal(isLikelyJpegThumbnail({ buffer: null, mimetype: 'image/jpeg' }), false)
  assert.equal(isLikelyJpegThumbnail({ buffer: buf(MONITORED_THUMBNAIL_BYTES_THRESHOLD), mimetype: 'image/jpeg' }), false)
})

test('mode=original com imageMessage cheio usa a imagem direto e NÃO chama fetch ativo', async () => {
  let fetchProductImageCalls = 0
  let fetchImageBufferCalls = 0
  const result = await resolveMonitoredImage({
    mode: 'original',
    target: { platform: 'shopee', url: 'https://shopee.com.br/p/123' },
    credentials: {},
    downloadOriginalImage: async () => FULL_IMAGE,
    fetchProductImage: async () => { fetchProductImageCalls++; return null },
    fetchImageBuffer: async () => { fetchImageBufferCalls++; return null },
    logger: silentLogger(),
  })
  assert.equal(result, FULL_IMAGE)
  assert.equal(fetchProductImageCalls, 0, 'não deve chamar fetchProductImage quando imagem cheia já está disponível')
  assert.equal(fetchImageBufferCalls, 0)
})

test('mode=original com só jpegThumbnail faz upgrade ativo via marketplace (Shopee)', async () => {
  const target = { platform: 'shopee', url: 'https://shopee.com.br/p/123' }
  const result = await resolveMonitoredImage({
    mode: 'original',
    target,
    credentials: { shopee: { appId: 'x', secret: 'y' } },
    downloadOriginalImage: async () => THUMBNAIL_IMAGE,
    fetchProductImage: async (platform, url) => {
      assert.equal(platform, 'shopee')
      assert.equal(url, target.url)
      return 'https://cf.shopee.com.br/file/produto-hd.jpg'
    },
    fetchImageBuffer: async (imageUrl, referer) => {
      assert.equal(imageUrl, 'https://cf.shopee.com.br/file/produto-hd.jpg')
      assert.equal(referer, target.url)
      return HIRES_FROM_MARKET
    },
    logger: silentLogger(),
  })
  assert.equal(result, HIRES_FROM_MARKET, 'deve retornar imagem alta-resolução do marketplace, não a thumbnail pixelada')
})

test('mode=original faz upgrade ativo para Mercado Livre também', async () => {
  const target = { platform: 'mercadolivre', url: 'https://produto.mercadolivre.com.br/MLB-123' }
  const result = await resolveMonitoredImage({
    mode: 'original',
    target,
    credentials: {},
    downloadOriginalImage: async () => THUMBNAIL_IMAGE,
    fetchProductImage: async (platform) => {
      assert.equal(platform, 'mercadolivre')
      return 'https://http2.mlstatic.com/D_NQ_NP_123-MLB.jpg'
    },
    fetchImageBuffer: async () => HIRES_FROM_MARKET,
    logger: silentLogger(),
  })
  assert.equal(result, HIRES_FROM_MARKET)
})

test('mode=original cai para jpegThumbnail quando upgrade ativo falha (fetchProductImage retorna null)', async () => {
  const result = await resolveMonitoredImage({
    mode: 'original',
    target: { platform: 'amazon', url: 'https://amazon.com.br/dp/B0' },
    credentials: {},
    downloadOriginalImage: async () => THUMBNAIL_IMAGE,
    fetchProductImage: async () => null,
    fetchImageBuffer: async () => null,
    logger: silentLogger(),
  })
  assert.equal(result, THUMBNAIL_IMAGE, 'fallback: thumbnail é melhor que nenhuma imagem')
})

test('mode=original cai para jpegThumbnail quando fetchImageBuffer falha (CDN bloqueado, etc.)', async () => {
  const result = await resolveMonitoredImage({
    mode: 'original',
    target: { platform: 'shopee', url: 'https://shopee.com.br/p/123' },
    credentials: {},
    downloadOriginalImage: async () => THUMBNAIL_IMAGE,
    fetchProductImage: async () => 'https://cf.shopee.com.br/file/produto.jpg',
    fetchImageBuffer: async () => null,
    logger: silentLogger(),
  })
  assert.equal(result, THUMBNAIL_IMAGE)
})

test('mode=original retorna null quando nem thumbnail nem fetch ativo dão resultado', async () => {
  const result = await resolveMonitoredImage({
    mode: 'original',
    target: { platform: 'shopee', url: 'https://shopee.com.br/p/123' },
    credentials: {},
    downloadOriginalImage: async () => null,
    fetchProductImage: async () => null,
    fetchImageBuffer: async () => null,
    logger: silentLogger(),
  })
  assert.equal(result, null, 'sem nada disponível, retorna null para o caller decidir entre linkPreview/texto puro')
})

test('mode=original sem target ainda assim retorna thumbnail quando disponível', async () => {
  const result = await resolveMonitoredImage({
    mode: 'original',
    target: null,
    credentials: {},
    downloadOriginalImage: async () => THUMBNAIL_IMAGE,
    fetchProductImage: async () => { throw new Error('não deveria ser chamado sem target') },
    fetchImageBuffer: async () => { throw new Error('não deveria ser chamado sem target') },
    logger: silentLogger(),
  })
  assert.equal(result, THUMBNAIL_IMAGE)
})

test('mode=original engole exceção do fetchProductImage e cai para thumbnail', async () => {
  const warned = []
  const result = await resolveMonitoredImage({
    mode: 'original',
    target: { platform: 'shopee', url: 'https://shopee.com.br/p/123' },
    credentials: {},
    downloadOriginalImage: async () => THUMBNAIL_IMAGE,
    fetchProductImage: async () => { throw new Error('timeout no marketplace') },
    fetchImageBuffer: async () => null,
    logger: { info: () => {}, warn: (m) => warned.push(m) },
  })
  assert.equal(result, THUMBNAIL_IMAGE)
  assert.equal(warned.length, 1)
  assert.match(warned[0].err, /timeout/)
})

test('mode=fetch prioriza imagem do marketplace sem nem baixar original', async () => {
  let downloadCalls = 0
  const result = await resolveMonitoredImage({
    mode: 'fetch',
    target: { platform: 'amazon', url: 'https://amazon.com.br/dp/B0' },
    credentials: {},
    downloadOriginalImage: async () => { downloadCalls++; return THUMBNAIL_IMAGE },
    fetchProductImage: async () => 'https://m.media-amazon.com/images/I/x._SL1500_.jpg',
    fetchImageBuffer: async () => HIRES_FROM_MARKET,
    logger: silentLogger(),
  })
  assert.equal(result, HIRES_FROM_MARKET)
  assert.equal(downloadCalls, 0, 'modo fetch não deve baixar original quando marketplace já entregou imagem')
})

test('mode=fetch com fallbackToOriginal cai para downloadOriginalImage quando marketplace falha', async () => {
  const result = await resolveMonitoredImage({
    mode: 'fetch',
    target: { platform: 'shopee', url: 'https://shopee.com.br/p/123' },
    credentials: {},
    downloadOriginalImage: async () => THUMBNAIL_IMAGE,
    fetchProductImage: async () => null,
    fetchImageBuffer: async () => null,
    fallbackToOriginal: true,
    logger: silentLogger(),
  })
  assert.equal(result, THUMBNAIL_IMAGE)
})

test('mode=fetch com fallbackToOriginal=false retorna null quando marketplace falha', async () => {
  let downloadCalls = 0
  const result = await resolveMonitoredImage({
    mode: 'fetch',
    target: { platform: 'shopee', url: 'https://shopee.com.br/p/123' },
    credentials: {},
    downloadOriginalImage: async () => { downloadCalls++; return THUMBNAIL_IMAGE },
    fetchProductImage: async () => null,
    fetchImageBuffer: async () => null,
    fallbackToOriginal: false,
    logger: silentLogger(),
  })
  assert.equal(result, null)
  assert.equal(downloadCalls, 0)
})

test('mode=none ou desconhecido retorna null sem chamar nada', async () => {
  let calls = 0
  const result = await resolveMonitoredImage({
    mode: 'none',
    target: { platform: 'shopee', url: 'x' },
    credentials: {},
    downloadOriginalImage: async () => { calls++; return THUMBNAIL_IMAGE },
    fetchProductImage: async () => { calls++; return null },
    fetchImageBuffer: async () => { calls++; return null },
    logger: silentLogger(),
  })
  assert.equal(result, null)
  assert.equal(calls, 0)
})
