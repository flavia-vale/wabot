import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import {
  resolvePreviewCardCanvas,
  PREVIEW_CARD_CANVAS_DEFAULT_PX,
  PREVIEW_CARD_CANVAS_MIN_PX,
  PREVIEW_CARD_CANVAS_MAX_PX,
} from '../src/core/previewCardCanvasPolicy.js'
import { composePreviewCardImage } from '../src/core/previewCardCanvas.js'
import { renderDestinationWatermark } from '../src/core/destinationWatermark.js'

// Foto sintética com textura (foto chapada comprime demais e esconderia
// diferença de qualidade).
async function foto(width, height) {
  const raw = Buffer.alloc(width * height * 3)
  for (let i = 0; i < width * height; i++) {
    const x = i % width
    const y = Math.floor(i / width)
    raw[i * 3] = (x * 7 + y * 3) % 256
    raw[i * 3 + 1] = (x * 3 + y * 11) % 256
    raw[i * 3 + 2] = (x * 13 + y * 5) % 256
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 90 }).toBuffer()
}

test('tela fixa: sem env, ligada e em 1080', () => {
  assert.deepEqual(resolvePreviewCardCanvas({}), { enabled: true, size: PREVIEW_CARD_CANVAS_DEFAULT_PX })
  assert.deepEqual(resolvePreviewCardCanvas(), { enabled: true, size: PREVIEW_CARD_CANVAS_DEFAULT_PX })
})

test('kill switch desliga sem redeploy', () => {
  for (const valor of ['off', 'OFF', 'false', '0', ' off ']) {
    assert.equal(resolvePreviewCardCanvas({ PREVIEW_CARD_CANVAS: valor }).enabled, false, valor)
  }
  for (const valor of ['', 'on', 'true', 'qualquer']) {
    assert.equal(resolvePreviewCardCanvas({ PREVIEW_CARD_CANVAS: valor }).enabled, true, valor)
  }
})

test('tamanho mal preenchido cai no padrão e fora da faixa é grampeado', () => {
  for (const valor of ['', '  ', 'abc', '0', '-10']) {
    assert.equal(resolvePreviewCardCanvas({ PREVIEW_CARD_CANVAS_PX: valor }).size, PREVIEW_CARD_CANVAS_DEFAULT_PX, valor)
  }
  assert.equal(resolvePreviewCardCanvas({ PREVIEW_CARD_CANVAS_PX: '99999' }).size, PREVIEW_CARD_CANVAS_MAX_PX)
  assert.equal(resolvePreviewCardCanvas({ PREVIEW_CARD_CANVAS_PX: '10' }).size, PREVIEW_CARD_CANVAS_MIN_PX)
})

// O defeito relatado: cada oferta saindo com um tamanho de card.
test('fotos de tamanhos e proporções diferentes viram cards do MESMO tamanho', async () => {
  const entradas = [
    [1080, 1080],  // Mercado Livre
    [1500, 1500],  // Amazon _SL1500_
    [720, 720],    // banner de cupom
    [300, 300],    // foto da mensagem de origem (plano B)
    [2000, 600],   // foto larguíssima (saía fatiada no card)
    [400, 1200],   // foto altíssima
    [64, 64],      // miniatura minúscula
  ]
  for (const [w, h] of entradas) {
    const out = await composePreviewCardImage(await foto(w, h))
    assert.ok(out?.main?.length, `${w}x${h} deveria compor`)
    assert.equal(out.width, PREVIEW_CARD_CANVAS_DEFAULT_PX, `${w}x${h} largura`)
    assert.equal(out.height, PREVIEW_CARD_CANVAS_DEFAULT_PX, `${w}x${h} altura`)
    const meta = await sharp(out.main).metadata()
    assert.equal(meta.width, PREVIEW_CARD_CANVAS_DEFAULT_PX)
    assert.equal(meta.height, PREVIEW_CARD_CANVAS_DEFAULT_PX)
    assert.equal(meta.format, 'jpeg')
  }
})

test('a miniatura embutida sai da MESMA imagem composta (mesma proporção do card)', async () => {
  const out = await composePreviewCardImage(await foto(2000, 600))
  const meta = await sharp(out.thumbnail).metadata()
  assert.equal(meta.format, 'jpeg')
  assert.equal(meta.width, meta.height, 'miniatura precisa ter a proporção da tela fixa, não a da foto original')
})

test('foto nunca é cortada: entra inteira na tela (é o que fatiava o produto)', async () => {
  // Faixa vermelha nas bordas esquerda/direita de uma foto muito larga: se o
  // card cortasse para preencher, as faixas sumiriam.
  const largura = 2000
  const altura = 600
  const raw = Buffer.alloc(largura * altura * 3)
  for (let i = 0; i < largura * altura; i++) {
    const x = i % largura
    const naBorda = x < 40 || x >= largura - 40
    raw[i * 3] = naBorda ? 255 : 10
    raw[i * 3 + 1] = naBorda ? 0 : 10
    raw[i * 3 + 2] = naBorda ? 0 : 10
  }
  const entrada = await sharp(raw, { raw: { width: largura, height: altura, channels: 3 } }).jpeg({ quality: 95 }).toBuffer()
  const out = await composePreviewCardImage(entrada)
  const { data, info } = await sharp(out.main).raw().toBuffer({ resolveWithObject: true })
  const meio = Math.floor(info.height / 2)
  const vermelhoNaLinha = []
  for (let x = 0; x < info.width; x++) {
    const p = (meio * info.width + x) * info.channels
    if (data[p] > 150 && data[p + 1] < 90 && data[p + 2] < 90) vermelhoNaLinha.push(x)
  }
  assert.ok(vermelhoNaLinha.length > 0, 'as bordas da foto precisam continuar visíveis no card')
  assert.ok(vermelhoNaLinha[0] < info.width * 0.15, 'borda esquerda da foto foi cortada')
  assert.ok(vermelhoNaLinha[vermelhoNaLinha.length - 1] > info.width * 0.85, 'borda direita da foto foi cortada')
})

test('a marca d\'água preserva o tamanho da tela fixa', async () => {
  const out = await composePreviewCardImage(await foto(300, 300))
  const marcada = await renderDestinationWatermark(out.main, { text: 'Ofertas da Ana' })
  assert.equal(marcada.width, PREVIEW_CARD_CANVAS_DEFAULT_PX)
  assert.equal(marcada.height, PREVIEW_CARD_CANVAS_DEFAULT_PX)
})

// Fail-safe: a tela fixa é enfeite. Falhar nela nunca pode custar a oferta —
// quem chama cai no caminho histórico quando isto devolve null.
test('entrada inválida ou tela desligada devolve null em vez de lançar', async () => {
  assert.equal(await composePreviewCardImage(Buffer.from('isso não é imagem')), null)
  assert.equal(await composePreviewCardImage(Buffer.alloc(0)), null)
  assert.equal(await composePreviewCardImage(null), null)
  assert.equal(await composePreviewCardImage(await foto(500, 500), { env: { PREVIEW_CARD_CANVAS: 'off' } }), null)
})

test('tamanho por env é respeitado na imagem composta', async () => {
  const out = await composePreviewCardImage(await foto(1500, 1500), { env: { PREVIEW_CARD_CANVAS_PX: '600' } })
  assert.equal(out.width, 600)
  assert.equal(out.height, 600)
})

// Guarda estrutural: os DOIS montadores de card precisam passar pela tela fixa.
// Sem isso, um caminho volta a mandar a foto como veio e os cards voltam a
// divergir de tamanho entre si — que é exatamente o defeito relatado.
test('os dois montadores de card do bot-worker passam pela tela fixa', () => {
  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(src, /import \{ composePreviewCardImage \} from '\.\/core\/previewCardCanvas\.js'/)

  const manual = src.slice(src.indexOf('async function buildManualLinkPreview'), src.indexOf('const STORE_PREVIEW_TITLES'))
  assert.ok(manual.length > 0, 'buildManualLinkPreview precisa existir')
  assert.doesNotMatch(
    manual,
    /await normalizeImageForWhatsApp\(/,
    'o card do espelhamento não pode voltar a mandar a foto crua do normalize — tem que passar por prepararFotoDoCard',
  )
  for (const fonte of ['banner', 'loja', 'origem']) {
    assert.ok(manual.includes(`marcarFonte('${fonte}')`), `fonte ${fonte} sumiu do card`)
  }
  assert.ok((manual.match(/prepararFotoDoCard\(/g) || []).length >= 3, 'as três fontes de foto do card precisam passar pela tela fixa')

  const broadcast = src.slice(src.indexOf('async function buildBroadcastLinkPreview'), src.indexOf('async function buildPayloadFromRecipe'))
  assert.match(broadcast, /prepararFotoDoCard\(hqBuffer\)/, 'o card da fila/automáticas também precisa da preparação e da tela fixa')
})
