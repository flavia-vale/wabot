import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const worker = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

test('worker resolve modo e texto a partir do detalhe do destino', () => {
  assert.match(worker, /const postDetail = cfg\.groups\.postDetails\.find\(g => g\.waJid === destJid\)/)
  assert.match(worker, /resolveDestinationImageMode\(postDetail\?\.imageMode\)/)
  assert.match(worker, /postDetail\?\.watermarkText/)
})

test('original com marca renderiza principal e thumbnail e cai para imagem normal em falha', () => {
  assert.match(worker, /await renderDestinationWatermark\(fetched\.buffer, \{ text: watermarkText \}\)/)
  assert.match(worker, /jpegThumbnail: rendered\.thumbnail/)
  assert.match(worker, /Marca d\\?'água falhou; enviando imagem normal/)
  assert.match(worker, /await normalizeImageForWhatsApp\(fetched\.buffer/)
})

test('destino com marca nunca usa relay que bypassaria a composição', () => {
  const relayLine = worker.split('\n').find(line => line.includes('shouldRelayOriginalMediaForImageMode(imageMode)'))
  assert.ok(relayLine)
  assert.match(relayLine, /!useDestinationWatermark/)
})
