import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'

import { DEFAULT_STORY_TEMPLATE, STORY_HEIGHT, STORY_WIDTH, normalizeStoryTemplate, renderInstagramStory, storyTemplateHash } from '../src/instagram/rendering/index.js'

async function productImage() {
  return sharp({ create: { width: 700, height: 500, channels: 3, background: '#2d6a4f' } }).png().toBuffer()
}

const offer = {
  offerKey: 'test:1', title: 'Cafeteira elétrica premium para sua cozinha',
  oldPriceCents: 15990, priceCents: 9990, couponCode: 'CAFE20', callToAction: 'Link na bio',
}

test('renderiza Story JPEG sRGB em 1080x1920 e abaixo de 8 MB', async () => {
  const result = await renderInstagramStory({ offer, productImage: await productImage() })
  const metadata = await sharp(result.buffer).metadata()
  assert.equal(result.width, STORY_WIDTH)
  assert.equal(result.height, STORY_HEIGHT)
  assert.equal(metadata.format, 'jpeg')
  assert.equal(metadata.space, 'srgb')
  assert.ok(result.byteSize < 8 * 1024 * 1024)
  assert.match(result.contentHash, /^[a-f0-9]{64}$/)
  assert.equal(result.templateHash, storyTemplateHash(DEFAULT_STORY_TEMPLATE))
})

test('renderização é determinística para oferta e versão iguais', async () => {
  const image = await productImage()
  const first = await renderInstagramStory({ offer, productImage: image })
  const second = await renderInstagramStory({ offer, productImage: image })
  assert.equal(first.contentHash, second.contentHash)
})

test('template recusa versão incompatível, cor inválida e layout fora do canvas', () => {
  assert.throws(() => normalizeStoryTemplate({ ...DEFAULT_STORY_TEMPLATE, schemaVersion: 2 }), /incompatível/)
  assert.throws(() => normalizeStoryTemplate({ ...DEFAULT_STORY_TEMPLATE, accent: 'red' }), /hexadecimal/)
  assert.throws(() => normalizeStoryTemplate({ ...DEFAULT_STORY_TEMPLATE, product: { ...DEFAULT_STORY_TEMPLATE.product, left: 900 } }), /canvas/)
})

test('renderizador limita tamanho de entrada e qualidade', async () => {
  await assert.rejects(renderInstagramStory({ offer, productImage: Buffer.alloc(15 * 1024 * 1024 + 1) }), /15 MB/)
  await assert.rejects(renderInstagramStory({ offer, productImage: await productImage(), quality: 20 }), /quality/)
})
