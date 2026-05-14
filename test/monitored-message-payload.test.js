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

test('payload monitorado com useLinkPreview pede preview automático do WhatsApp no texto', () => {
  const finalText = 'Oferta convertida https://afiliado.example/produto'
  const payload = buildMonitoredMessagePayload({
    finalText,
    image: null,
    useLinkPreview: true,
  })

  assert.equal(payload._route, 'text')
  assert.deepEqual(payload.primary, { text: finalText })
  assert.deepEqual(payload.primarySendOptions, { generateHighQualityLinkPreview: true })
})

test('payload monitorado com imagem + useLinkPreview aplica preview apenas no fallback de texto', () => {
  const finalText = 'Oferta convertida https://afiliado.example/produto'
  const payload = buildMonitoredMessagePayload({
    finalText,
    image: { buffer: Buffer.from('img'), mimetype: 'image/jpeg' },
    useLinkPreview: true,
  })

  assert.equal(payload._route, 'image')
  assert.equal(payload.primarySendOptions, undefined)
  assert.deepEqual(payload.fallbackSendOptions, [{ generateHighQualityLinkPreview: true }])
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
