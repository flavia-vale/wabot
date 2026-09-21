import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { downloadHighQualityLinkPreview } from '../src/core/linkPreviewThumbnail.js'

test('baixa a thumbnail HQ quando o proto traz directPath e mediaKey', async () => {
  const esperado = Buffer.alloc(80_000, 1)
  const message = { key: { id: 'msg-1' }, message: { extendedTextMessage: {} } }
  const extendedTextMessage = {
    jpegThumbnail: Buffer.alloc(545),
    thumbnailDirectPath: '/mms/image/abc',
    mediaKey: Buffer.alloc(32, 2),
  }
  let chamada

  const result = await downloadHighQualityLinkPreview({
    message,
    extendedTextMessage,
    downloadMediaMessage: async (...args) => { chamada = args; return esperado },
    logger: { info() {} },
    reuploadRequest() {},
  })

  assert.equal(result, esperado)
  assert.equal(chamada[0], message)
  assert.equal(chamada[1], 'buffer')
})

test('sem ponteiro HQ não toca na rede e deixa o chamador usar o inline', async () => {
  let chamadas = 0
  const result = await downloadHighQualityLinkPreview({
    message: {},
    extendedTextMessage: { jpegThumbnail: Buffer.alloc(545) },
    downloadMediaMessage: async () => { chamadas++; return Buffer.alloc(10) },
  })
  assert.equal(result, null)
  assert.equal(chamadas, 0)
})

test('falha do download HQ degrada para null sem perder a oferta', async () => {
  const result = await downloadHighQualityLinkPreview({
    message: {},
    extendedTextMessage: { thumbnailDirectPath: '/mms/image/abc', mediaKey: Buffer.alloc(32) },
    downloadMediaMessage: async () => { throw new Error('CDN fora') },
  })
  assert.equal(result, null)
})

test('bot-worker tenta HQ antes do jpegThumbnail inline', () => {
  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  const start = src.indexOf('async function downloadOriginalImage()')
  const end = src.indexOf('// Pre-fetch da imagem', start)
  const fn = src.slice(start, end)
  assert.ok(fn.indexOf('downloadHighQualityLinkPreview({') > 0)
  assert.ok(fn.indexOf('downloadHighQualityLinkPreview({') < fn.indexOf('const thumb = ext?.jpegThumbnail'))
})
