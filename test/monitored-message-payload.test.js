import test from 'node:test'
import assert from 'node:assert/strict'

import { buildMonitoredMessagePayload, __monitoredPayloadInternals } from '../src/monitoredMessagePayload.js'

test('payload monitorado com imagem não usa externalAdReply e mantém fallback texto', () => {
  const payload = buildMonitoredMessagePayload({
    finalText: 'Oferta convertida https://afiliado.example/produto',
    primaryConvertedUrl: 'https://afiliado.example/produto',
    image: { buffer: Buffer.from('img'), jpegThumbnail: Buffer.from('thumb') },
  })

  assert.equal(payload._route, 'image')
  assert.equal(payload.primary.contextInfo, undefined)
  assert.match(payload.primary.caption, /^https:\/\/afiliado\.example\/produto\n\n/)
  assert.deepEqual(payload.fallbacks, [{ text: 'Oferta convertida https://afiliado.example/produto', linkPreview: null }])
})

test('payload monitorado sem imagem cai para texto puro sem link preview', () => {
  const payload = buildMonitoredMessagePayload({
    finalText: 'Só texto https://afiliado.example/produto',
    primaryConvertedUrl: 'https://afiliado.example/produto',
    image: null,
  })

  assert.deepEqual(payload, {
    _route: 'text',
    primary: { text: 'Só texto https://afiliado.example/produto', linkPreview: null },
    fallbacks: [],
  })
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
