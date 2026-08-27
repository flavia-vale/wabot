import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_MIN_PUBLISHABLE_IMAGE_BYTES,
  isPublishableFallbackImage,
  resolveMinPublishableImageBytes,
} from '../src/core/thumbnailQualityPolicy.js'
import { resolveMonitoredImage } from '../src/monitoredImageResolver.js'

// Hotfix 2026-08-26: o piso entrou em 3000 e derrubou a imagem de oferta
// legítima — a cliente passou a receber texto pelado, pior que foto ruim.
// O piso é rede contra o borrão extremo, não critério de qualidade.
test('piso padrão só barra o borrão extremo, não miniatura mediana', () => {
  assert.equal(DEFAULT_MIN_PUBLISHABLE_IMAGE_BYTES, 800)
  assert.equal(isPublishableFallbackImage({ buffer: Buffer.alloc(1_200) }).publish, true)
  assert.equal(isPublishableFallbackImage({ buffer: Buffer.alloc(2_500) }).publish, true)
})

test('miniatura de 457 bytes (caso real do Cooktop) não é publicável', () => {
  const v = isPublishableFallbackImage({ buffer: Buffer.alloc(457), mimetype: 'image/jpeg' })
  assert.equal(v.publish, false)
  assert.equal(v.bytes, 457)
})

test('miniatura razoável continua sendo publicada', () => {
  const v = isPublishableFallbackImage({ buffer: Buffer.alloc(8687), mimetype: 'image/jpeg' })
  assert.equal(v.publish, true)
})

test('piso configurável por env, com escape hatch em 0', () => {
  assert.equal(resolveMinPublishableImageBytes({}), DEFAULT_MIN_PUBLISHABLE_IMAGE_BYTES)
  assert.equal(resolveMinPublishableImageBytes({ MONITORED_MIN_IMAGE_BYTES: '9000' }), 9000)
  assert.equal(resolveMinPublishableImageBytes({ MONITORED_MIN_IMAGE_BYTES: 'abc' }), DEFAULT_MIN_PUBLISHABLE_IMAGE_BYTES)
  assert.equal(resolveMinPublishableImageBytes({ MONITORED_MIN_IMAGE_BYTES: '0' }), 0)
  const v = isPublishableFallbackImage({ buffer: Buffer.alloc(457) }, 0)
  assert.equal(v.publish, true, 'piso 0 volta ao comportamento histórico')
})

test('modo original: upgrade falhou e só há miniatura minúscula → sem imagem', async () => {
  const dropped = []
  const image = await resolveMonitoredImage({
    mode: 'original',
    target: { platform: 'shopee', url: 'https://s.shopee.com.br/x' },
    downloadOriginalImage: async () => ({ buffer: Buffer.alloc(457), mimetype: 'image/jpeg' }),
    fetchProductImage: async () => null,
    fetchImageBuffer: async () => null,
    onThumbnailDropped: info => dropped.push(info),
  })
  assert.equal(image, null)
  assert.equal(dropped.length, 1)
  assert.equal(dropped[0].bytes, 457)
})

test('modo original: imagem cheia da origem continua passando direto', async () => {
  const full = { buffer: Buffer.alloc(120_000), mimetype: 'image/jpeg' }
  const image = await resolveMonitoredImage({
    mode: 'original',
    target: { platform: 'shopee', url: 'https://s.shopee.com.br/x' },
    downloadOriginalImage: async () => full,
    fetchProductImage: async () => null,
    fetchImageBuffer: async () => null,
  })
  assert.equal(image, full)
})

test('modo original: upgrade hi-res tem prioridade sobre a miniatura', async () => {
  const hires = { buffer: Buffer.alloc(200_000), mimetype: 'image/jpeg' }
  const image = await resolveMonitoredImage({
    mode: 'original',
    target: { platform: 'shopee', url: 'https://s.shopee.com.br/x' },
    downloadOriginalImage: async () => ({ buffer: Buffer.alloc(457), mimetype: 'image/jpeg' }),
    fetchProductImage: async () => 'https://cdn/img.jpg',
    fetchImageBuffer: async () => hires,
  })
  assert.equal(image, hires)
})
