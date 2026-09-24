import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const worker = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

test('worker resolve modo e texto a partir do detalhe do destino', () => {
  assert.match(worker, /const postDetail = cfg\.groups\.postDetails\.find\(g => g\.waJid === destJid\)/)
  assert.match(worker, /effectiveDestinationImageMode\(postDetail\?\.imageMode, \{ hasChannelButton: !!channelForward \}\)/)
  assert.match(worker, /postDetail\?\.watermarkText/)
})

test('original com marca renderiza principal e thumbnail e cai para imagem normal em falha', () => {
  assert.match(worker, /await renderDestinationWatermark\(fetched\.buffer, \{ text: watermarkText, color: watermarkColor, size: watermarkSize, position: watermarkPosition \}\)/)
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

// 2026-08-30: o card de preview passou a aceitar marca d'água
// (`preview_watermark`). O card carrega os MESMOS bytes do envio de foto —
// `jpegThumbnail` inline + o buffer que alimenta o `highQualityThumbnail` —,
// então compor a marca ANTES do upload HQ é o que garante que o card pequeno e
// a foto ampliada sejam a mesma imagem marcada.
test('o card de preview compõe a marca antes do upload da miniatura de alta qualidade', () => {
  const composeAt = worker.indexOf("if (jpegThumbnail && watermark?.text)")
  assert.notEqual(composeAt, -1, 'composição da marca no card não encontrada')
  const uploadAt = worker.indexOf('let highQualityThumbnail')
  assert.notEqual(uploadAt, -1)
  assert.ok(composeAt < uploadAt, 'a marca precisa ser composta ANTES do upload da miniatura HQ')

  const block = worker.slice(composeAt, uploadAt)
  assert.match(block, /hqSourceBuffer = rendered\.main/)
  assert.match(block, /jpegThumbnail = rendered\.thumbnail/)
  // Best-effort: marca que falha nunca pode derrubar o card (a alternativa
  // seria a oferta sair como texto pelado).
  assert.match(block, /catch \(err\)/)
  assert.match(block, /card sai com a foto sem marca/)
})

test('os três caminhos que montam o card recebem a marca do destino', () => {
  // Terceiro call site (2026-09-24): reprocessRestartFailures() remonta o
  // card das ofertas perdidas por restart do worker, reusando o mesmo
  // buildManualLinkPreview do envio ao vivo — precisa repassar a marca do
  // destino igual aos outros dois, senão a oferta reenfileirada sai sem
  // marca d'água em silêncio.
  const callSites = worker.split('await buildManualLinkPreview({').length - 1
  assert.equal(callSites, 3, 'esperados exatamente três call sites de buildManualLinkPreview')
  const passandoMarca = worker.split('watermark: useDestinationWatermark ? { text: watermarkText, color: watermarkColor, size: watermarkSize, position: watermarkPosition } : null').length - 1
  assert.equal(passandoMarca, callSites, 'todo caminho que monta o card precisa repassar a marca do destino')
})

test('buildManualLinkPreview aceita a marca por parâmetro (nunca lê o destino direto)', () => {
  const sig = worker.slice(worker.indexOf('async function buildManualLinkPreview('), worker.indexOf('async function buildManualLinkPreview(') + 400)
  assert.match(sig, /watermark = null/)
})

// RCA 2026-08-31: todos os caminhos de marca são best-effort (marca que falha
// nunca derruba a oferta) e todos eram MUDOS. A imagem pequena demais nem log
// tinha — `renderDestinationWatermark` devolve `watermarkApplied:false` em
// silêncio —, e o card sem foto cai no preview automático do WhatsApp, que
// mostra a foto da loja sem a nossa marca. A única forma de descobrir que a
// marca sumiu era a cliente reclamar, que foi o que aconteceu.
test('toda perda de marca vira aviso com nome próprio', () => {
  assert.match(worker, /function reportWatermarkMissing\(/)
  assert.match(worker, /recordOperationalSignal\('watermark_missing'/)

  // Os três renderizadores da marca (card, foto do espelhamento e receita de
  // fila/automáticas) precisam avisar quando ela não foi aplicada.
  const naoAplicada = worker.split('if (!rendered.watermarkApplied)').length - 1
    + worker.split('if (!marcada.watermarkApplied)').length - 1
  assert.equal(naoAplicada, 3, 'todo caminho de marca precisa avisar quando ela não é aplicada')

  // E quando não há foto nenhuma para marcar: a oferta sai, a marca não.
  assert.match(worker, /reportWatermarkMissing\('card:sem_foto'/)
  assert.match(worker, /reportWatermarkMissing\('oferta:sem_foto'/)
})
