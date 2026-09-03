import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import {
  resolveInlineThumbnailSpec,
  INLINE_THUMBNAIL_DEFAULT_PX,
  INLINE_THUMBNAIL_MIN_PX,
  INLINE_THUMBNAIL_CEILING_PX,
} from '../src/core/inlineThumbnailPolicy.js'
import { buildInlineThumbnail } from '../src/core/inlineThumbnail.js'

test('sem env, mantém o comportamento histórico (500px q80)', () => {
  assert.deepEqual(resolveInlineThumbnailSpec({}), { maxPx: INLINE_THUMBNAIL_DEFAULT_PX, quality: 80 })
  assert.deepEqual(resolveInlineThumbnailSpec(), { maxPx: INLINE_THUMBNAIL_DEFAULT_PX, quality: 80 })
})

test('env mal preenchida nunca deixa a oferta sem miniatura — cai no histórico', () => {
  for (const valor of ['', '  ', 'abc', '0', '-100', 'null']) {
    assert.equal(resolveInlineThumbnailSpec({ INLINE_THUMBNAIL_MAX_PX: valor }).maxPx, INLINE_THUMBNAIL_DEFAULT_PX, valor)
  }
})

test('valor fora da faixa é grampeado, não rejeitado', () => {
  assert.equal(resolveInlineThumbnailSpec({ INLINE_THUMBNAIL_MAX_PX: '9999' }).maxPx, INLINE_THUMBNAIL_CEILING_PX)
  assert.equal(resolveInlineThumbnailSpec({ INLINE_THUMBNAIL_MAX_PX: '8' }).maxPx, INLINE_THUMBNAIL_MIN_PX)
})

test('miniatura menor usa qualidade menor (é ela que responde pelos bytes)', () => {
  assert.equal(resolveInlineThumbnailSpec({ INLINE_THUMBNAIL_MAX_PX: '160' }).quality, 65)
  assert.equal(resolveInlineThumbnailSpec({ INLINE_THUMBNAIL_MAX_PX: '400' }).quality, 80)
})

// Imagem sintética com textura: o pior caso de compressão (foto de catálogo com
// fundo branco liso comprime muito melhor e esconderia a diferença).
async function fotoTexturizada(lado = 1200) {
  const raw = Buffer.alloc(lado * lado * 3)
  for (let i = 0; i < lado * lado; i++) {
    const x = i % lado
    const y = Math.floor(i / lado)
    raw[i * 3] = (Math.sin(x / 7) * 60 + 128 + ((x * y) % 37)) & 255
    raw[i * 3 + 1] = (Math.cos(y / 5) * 70 + 120 + ((x + y) % 53)) & 255
    raw[i * 3 + 2] = (x ^ y) % 256
  }
  return sharp(raw, { raw: { width: lado, height: lado, channels: 3 } }).jpeg({ quality: 92 }).toBuffer()
}

test('a env encolhe de verdade a miniatura embutida (medido, não deduzido)', async () => {
  const origem = await fotoTexturizada()
  const anterior = process.env.INLINE_THUMBNAIL_MAX_PX
  try {
    delete process.env.INLINE_THUMBNAIL_MAX_PX
    const historica = await buildInlineThumbnail(origem)
    process.env.INLINE_THUMBNAIL_MAX_PX = '160'
    const reduzida = await buildInlineThumbnail(origem)

    const metaHistorica = await sharp(historica).metadata()
    const metaReduzida = await sharp(reduzida).metadata()
    assert.equal(metaHistorica.width, 500)
    assert.equal(metaReduzida.width, 160)
    // O ponto da mudança: caber onde hoje não cabe. Na foto texturizada a
    // versão histórica passa de 50 KB; a reduzida tem que ficar em poucos KB.
    assert.ok(historica.length > 30_000, `histórica ${historica.length} B`)
    assert.ok(reduzida.length < 12_000, `reduzida ${reduzida.length} B`)
  } finally {
    if (anterior === undefined) delete process.env.INLINE_THUMBNAIL_MAX_PX
    else process.env.INLINE_THUMBNAIL_MAX_PX = anterior
  }
})

test('a miniatura embutida tem UM gerador só — ninguém volta a fixar 500 por fora', () => {
  const arquivos = [
    'src/converters/imageScrapers.js',
    'src/core/destinationWatermark.js',
    'src/bot-worker.js',
  ]
  for (const arquivo of arquivos) {
    const fonte = readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8')
    const resizesDeThumb = fonte.match(/resize\(\{\s*width:\s*500,\s*height:\s*500/g) || []
    assert.equal(resizesDeThumb.length, 0, `${arquivo} voltou a gerar miniatura de 500px por fora de buildInlineThumbnail`)
  }
})
