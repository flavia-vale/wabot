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
  assert.match(worker, /await renderDestinationWatermark\(fetched\.buffer, \{ text: watermarkText, color: watermarkColor \}\)/)
  assert.match(worker, /jpegThumbnail: rendered\.thumbnail/)
  assert.match(worker, /Marca d\\'água falhou; enviando imagem normal/)
  assert.match(worker, /image = await normalizeImageForWhatsApp\(fetched\.buffer, wantMutation \? \{ mutation: \{ groupId: destJid \} \} : \{\}\)/)
})

test('destino com marca nunca usa relay que bypassaria a composição', () => {
  const relayLine = worker.split('\n').find(line => line.includes('shouldRelayOriginalMediaForImageMode(imageMode)') && line.includes('const original'))
  assert.ok(relayLine)
  assert.match(relayLine, /!useDestinationWatermark/)
})

// RCA 2026-08-22: a suspeita nunca comprovada da divergência entre painel e
// grupo era `getImage()` memoizar por MENSAGEM (uma única variável), não por
// destino — o primeiro destino resolvido "vencia" e fixava a imagem pros
// demais. O fix é o cache virar um Map chaveado pelo modo-base efetivo.
test('getImage cacheia por Map chaveado pelo modo efetivo, não por uma variável única', () => {
  assert.match(worker, /const cachedImages = new Map\(\)/)
  assert.doesNotMatch(worker, /let cachedImage\b/, 'a variável única de cache antiga não pode voltar')
  assert.doesNotMatch(worker, /let imageFetched = false/, 'a flag booleana única de cache antiga não pode voltar')

  const getImageStart = worker.indexOf('async function getImage(')
  assert.notEqual(getImageStart, -1, 'getImage não encontrada')
  const getImageEnd = worker.indexOf('\n      }\n', getImageStart)
  const fn = worker.slice(getImageStart, getImageEnd)
  assert.match(fn, /imageMode = 'original'/, 'getImage precisa aceitar o modo por chamada (por destino)')
  assert.match(fn, /cachedImages\.has\(effectiveMode\)/)
  assert.match(fn, /cachedImages\.set\(effectiveMode, resolved\)/)
})

// A mutação anti-fingerprint de canal (IMAGE_MUTATION) não pode ser desligada
// em silêncio só porque o destino também tem marca d'água ligada — achado de
// revisão: o caminho de sucesso da marca aplicava a imagem sem NUNCA passar
// por wantMutation, diferente do caminho sem marca e do catch de falha.
test('a mutação anti-fingerprint continua sendo aplicada quando a marca também está ligada', () => {
  const blockStart = worker.indexOf("if (fetched && useDestinationWatermark && imageMode === 'original')")
  assert.notEqual(blockStart, -1, 'bloco de composição com marca não encontrado')
  const blockEnd = worker.indexOf('\n            } else {\n', blockStart)
  assert.notEqual(blockEnd, -1)
  const block = worker.slice(blockStart, blockEnd)
  assert.match(block, /wantMutation/, 'o caminho de sucesso da marca precisa considerar wantMutation')
  assert.match(block, /normalizeImageForWhatsApp\(rendered\.main, \{ mutation: \{ groupId: destJid \} \}\)/)
})
