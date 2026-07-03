import test from 'node:test'
import assert from 'node:assert/strict'

import { buildMonitoredMessagePayload, __monitoredPayloadInternals } from '../src/monitoredMessagePayload.js'

test('payload monitorado com imagem usa imageMessage simples com caption original convertida', () => {
  const finalText = 'Oferta convertida https://afiliado.example/produto'
  const payload = buildMonitoredMessagePayload({
    finalText,
    image: { buffer: Buffer.from('img'), mimetype: 'image/jpeg', jpegThumbnail: Buffer.from('thumb') },
  })

  assert.equal(payload._route, 'image')
  assert.equal(payload.primary.contextInfo, undefined)
  assert.equal(payload.primary.caption, finalText)
  assert.equal(payload.primary.mimetype, 'image/jpeg')
  assert.deepEqual(payload.fallbacks, [{ text: finalText }])
  assert.equal(payload.primarySendOptions, undefined)
})

test('payload monitorado sem imagem cai para texto puro igual ao caminho estável anterior', () => {
  const payload = buildMonitoredMessagePayload({
    finalText: 'Só texto https://afiliado.example/produto',
    image: null,
  })

  assert.equal(payload._route, 'text')
  assert.deepEqual(payload.primary, { text: 'Só texto https://afiliado.example/produto' })
  assert.deepEqual(payload.fallbacks, [])
  assert.equal(payload.primarySendOptions, undefined)
})

test('payload monitorado sem imagem + useLinkPreview pede preview automático do WhatsApp', () => {
  const finalText = 'Oferta convertida https://afiliado.example/produto'
  const payload = buildMonitoredMessagePayload({
    finalText,
    image: null,
    useLinkPreview: true,
  })

  assert.equal(payload._route, 'text')
  assert.deepEqual(payload.primary, { text: finalText })
  assert.deepEqual(payload.primarySendOptions, { generateHighQualityLinkPreview: true })
  assert.deepEqual(payload.fallbacks, [])
})

test('payload monitorado em modo preview injeta linkPreview manual (com thumbnail HQ upada)', () => {
  const finalText = 'Oferta convertida https://afiliado.example/produto'
  const linkPreview = {
    'canonical-url': 'https://afiliado.example/produto',
    'matched-text': 'https://afiliado.example/produto',
    title: 'Produto em oferta',
    description: 'Por: R$ 62,90',
    jpegThumbnail: Buffer.from('thumb'),
    // Resultado de prepareWAMessageMedia (thumbnail-link): é o que faz o
    // WhatsApp renderizar o card GRANDE (thumbnailDirectPath/mediaKey).
    highQualityThumbnail: {
      directPath: '/v/t62.36144-24/abc',
      mediaKey: Buffer.from('key'),
      mediaKeyTimestamp: 1234567890,
      width: 500,
      height: 500,
      fileSha256: Buffer.from('sha'),
      fileEncSha256: Buffer.from('encsha'),
    },
  }
  const payload = buildMonitoredMessagePayload({
    finalText,
    image: null,
    useLinkPreview: true,
    linkPreview,
  })

  assert.equal(payload._route, 'text')
  assert.deepEqual(payload.primary, { text: finalText, linkPreview })
  assert.equal(payload.primary.contextInfo, undefined)
  assert.deepEqual(payload.primarySendOptions, { generateHighQualityLinkPreview: true })
  assert.deepEqual(payload.fallbacks, [])
})

test('rota de texto TAMBÉM rejeita externalAdReply (regressão: a guarda só cobria a rota de imagem)', () => {
  assert.throws(
    () => buildMonitoredMessagePayload({
      finalText: 'Oferta https://afiliado.example/produto',
      image: null,
      useLinkPreview: true,
      linkPreview: {
        'matched-text': 'https://afiliado.example/produto',
        title: 'Produto',
        externalAdReply: { sourceUrl: 'https://example.com' },
      },
    }),
    /externalAdReply causa drop silencioso/,
  )
})

test('guarda não itera bytes de Buffer (thumbnail grande não custa recursão nem falso positivo)', () => {
  const payload = buildMonitoredMessagePayload({
    finalText: 'Oferta https://afiliado.example/produto',
    image: { buffer: Buffer.alloc(64 * 1024), mimetype: 'image/jpeg', jpegThumbnail: Buffer.alloc(32 * 1024) },
  })
  assert.equal(payload._route, 'image')
})

test('guarda rejeita externalAdReply para evitar novo drop silencioso em mensagens monitoradas', () => {
  assert.throws(
    () => __monitoredPayloadInternals.assertNoExternalAdReply({
      image: Buffer.from('img'),
      contextInfo: { externalAdReply: { sourceUrl: 'https://example.com' } },
    }),
    /externalAdReply causa drop silencioso/,
  )
})
