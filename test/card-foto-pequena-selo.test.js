// RCA 2026-09-18 — "agora veio imagem mas extremamente pequena".
//
// Print da cliente: o card do tênis (Magalu, `magazinevoce.com.br`) chegou com
// a foto num quadradinho no centro, cercada por uma ampliação borrada dela
// mesma. Medido no banco da conta: `deliveryKind='card_origem'` com
// `originImageBytes=5539` — ou seja, a foto veio do plano B (a miniatura
// embutida do card da origem), porque a loja devolveu 403.
//
// `prepareWAMessageMedia` grava as dimensões REAIS do buffer que sobe, e o
// WhatsApp desenha o card nesse tamanho. `normalizeImageForWhatsApp` não
// amplia (`withoutEnlargement: true`, de propósito), então a foto chega
// pequena ao upload e o card nasce do tamanho dela.
//
// O teste de pixels abaixo é FUNCIONAL: renderiza imagem de verdade e mede as
// dimensões, em vez de confiar em leitura de código.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'

import {
  resolveCardPhotoMinPx,
  resolveCardPhotoUpscaleTarget,
} from '../src/core/cardPhotoUpscalePolicy.js'
import { upscaleCardPhotoIfTiny } from '../src/core/cardPhoto.js'

const foto = ({ width, height }) => sharp({
  create: { width, height, channels: 3, background: '#2f6fb0' },
}).jpeg().toBuffer()

test('o piso padrão é o mesmo que a casa já usa para "dá para o card grande"', () => {
  // IMAGE_HIRES_MIN_DIMENSION_PX em imageScrapers.js. Não é número por
  // analogia — é a definição que já existia no repositório.
  assert.equal(resolveCardPhotoMinPx({}), 800)
  const scrapers = readFileSync(new URL('../src/converters/imageScrapers.js', import.meta.url), 'utf8')
  assert.match(scrapers, /IMAGE_HIRES_MIN_DIMENSION_PX\s*=\s*Number\(process\.env\.IMAGE_HIRES_MIN_DIMENSION_PX\)\s*\|\|\s*800/)
})

test('`PREVIEW_CARD_MIN_PX=0` desliga e volta ao comportamento do print', () => {
  assert.equal(resolveCardPhotoMinPx({ PREVIEW_CARD_MIN_PX: '0' }), 0)
  assert.equal(resolveCardPhotoUpscaleTarget({ width: 220, height: 220, minPx: 0 }), null)
})

test('valor inválido no .env cai no padrão, nunca muda o formato em silêncio', () => {
  assert.equal(resolveCardPhotoMinPx({ PREVIEW_CARD_MIN_PX: 'grande' }), 800)
  assert.equal(resolveCardPhotoMinPx({ PREVIEW_CARD_MIN_PX: '' }), 800)
  // Grampeado na faixa útil.
  assert.equal(resolveCardPhotoMinPx({ PREVIEW_CARD_MIN_PX: '50' }), 200)
  assert.equal(resolveCardPhotoMinPx({ PREVIEW_CARD_MIN_PX: '9000' }), 1600)
})

test('foto que já preenche o card NÃO é mexida', () => {
  assert.equal(resolveCardPhotoUpscaleTarget({ width: 900, height: 600 }), null)
  assert.equal(resolveCardPhotoUpscaleTarget({ width: 800, height: 800 }), null)
})

test('fail-safe é NÃO ampliar quando a dimensão não é confiável', () => {
  // Sem dimensão, a foto sobe como está — é o comportamento de hoje, e card
  // com selo é melhor que oferta sem foto.
  for (const params of [
    { width: null, height: 300 },
    { width: 300, height: undefined },
    { width: 0, height: 0 },
    { width: -10, height: 300 },
    { width: NaN, height: NaN },
    {},
  ]) {
    assert.equal(resolveCardPhotoUpscaleTarget(params), null)
  }
})

test('a foto pequena do plano B passa a preencher o card (mede os pixels)', async () => {
  const pequena = await foto({ width: 220, height: 220 })
  const { buffer, upscaled } = await upscaleCardPhotoIfTiny(pequena)

  assert.deepEqual(upscaled, { from: 220, to: 800 })
  const meta = await sharp(buffer).metadata()
  assert.equal(Math.max(meta.width, meta.height), 800)
})

test('a proporção é preservada — a foto nunca sai esticada', async () => {
  const retrato = await foto({ width: 200, height: 400 })
  const { buffer, upscaled } = await upscaleCardPhotoIfTiny(retrato)

  assert.equal(upscaled.to, 800)
  const meta = await sharp(buffer).metadata()
  assert.equal(meta.height, 800)
  assert.equal(meta.width, 400)
})

test('foto grande volta byte a byte igual — nenhum reencode à toa', async () => {
  const grande = await foto({ width: 1200, height: 1200 })
  const { buffer, upscaled } = await upscaleCardPhotoIfTiny(grande)

  assert.equal(upscaled, null)
  assert.equal(buffer, grande)
})

test('bytes ilegíveis devolvem o original em vez de derrubar o card', async () => {
  const lixo = Buffer.from('isto nao e uma imagem')
  const { buffer, upscaled } = await upscaleCardPhotoIfTiny(lixo)
  assert.equal(upscaled, null)
  assert.equal(buffer, lixo)

  const vazio = await upscaleCardPhotoIfTiny(Buffer.alloc(0))
  assert.equal(vazio.upscaled, null)
})

test('a ampliação acontece ANTES da marca d\'água e FORA do banner de cupom', () => {
  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

  const iAmpliacao = src.indexOf('upscaleCardPhotoIfTiny(hqSourceBuffer)')
  const iMarca = src.indexOf("MARCA D'ÁGUA NO CARD DE PREVIEW")
  const iUpload = src.indexOf("mediaTypeOverride: 'thumbnail-link'")
  assert.ok(iAmpliacao > 0 && iMarca > 0 && iUpload > 0)

  // `renderDestinationWatermark` desiste de marcar foto pequena demais; se a
  // ampliação for para depois dela, a marca volta a não sair nesses casos.
  assert.ok(iAmpliacao < iMarca, 'ampliação precisa vir antes da marca d\'água')
  // E precisa vir antes do upload, que é quem grava as dimensões no proto.
  assert.ok(iAmpliacao < iUpload, 'ampliação precisa vir antes do upload da thumbnail HQ')

  // O banner de cupom já nasce com tamanho escolhido e não é foto de produto.
  assert.match(src, /if \(hqSourceBuffer && !useCouponBrandCard\) \{/)
})

test('a ampliação NÃO vazou para o envio de foto de corpo inteiro', () => {
  // Decisão de 2026-08-26: miniatura minúscula ampliada em tela cheia vira
  // borrão ilegível. A ampliação vale só dentro do card.
  const scrapers = readFileSync(new URL('../src/converters/imageScrapers.js', import.meta.url), 'utf8')
  assert.match(scrapers, /withoutEnlargement: true/)
  assert.ok(!scrapers.includes('upscaleCardPhotoIfTiny'))

  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.equal(src.split('upscaleCardPhotoIfTiny(').length - 1, 1)
})
