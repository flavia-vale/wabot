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

test('payload monitorado em modo preview pode injetar metadados manuais do card', () => {
  const finalText = 'Oferta convertida https://afiliado.example/produto'
  const linkPreview = {
    'canonical-url': 'https://afiliado.example/produto',
    'matched-text': 'https://afiliado.example/produto',
    title: 'Produto em oferta',
    description: 'Por: R$ 62,90',
    jpegThumbnail: Buffer.from('thumb'),
  }
  const payload = buildMonitoredMessagePayload({
    finalText,
    image: null,
    useLinkPreview: true,
    linkPreview,
  })

  assert.equal(payload._route, 'text')
  assert.deepEqual(payload.primary, { text: finalText, linkPreview })
  assert.deepEqual(payload.primarySendOptions, { generateHighQualityLinkPreview: true })
  assert.deepEqual(payload.fallbacks, [])
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
