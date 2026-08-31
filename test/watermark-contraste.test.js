import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'

import { renderDestinationWatermark, WATERMARK_COLORS, WATERMARK_STROKE_COLORS } from '../src/core/destinationWatermark.js'

// RCA 2026-08-31: a cliente trocou o destino para "card de preview com marca
// d'água" e relatou que a oferta chegava SEM marca. A marca estava sendo
// composta — só que branca, a 50%, sobre a foto OFICIAL DA LOJA, que em
// Amazon/Mercado Livre/Shopee é fundo branco liso por padrão de catálogo. O
// resultado não era "marca fraca": era pixel por pixel a imagem original.
//
// (No modo "foto que veio na oferta" o mesmo branco aparecia, porque ali a
// imagem é o print colorido da mensagem monitorada — por isso o problema só
// surgiu ao mudar para o card.)
async function fundo(cor) {
  return sharp({ create: { width: 900, height: 900, channels: 3, background: cor } }).jpeg({ quality: 95 }).toBuffer()
}

// Quanto a imagem deixou de ser lisa. Fundo chapado tem desvio 0; qualquer
// marca visível sobe esse número. É a medida mais direta de "dá pra ver".
async function variacao(buffer) {
  const stats = await sharp(buffer).stats()
  return stats.channels[0].stdev
}

test('marca branca continua visível sobre foto de fundo branco (foto de catálogo)', async () => {
  const entrada = await fundo('#ffffff')
  assert.ok(await variacao(entrada) < 0.5, 'o fundo de teste precisa ser liso')

  const marcada = await renderDestinationWatermark(entrada, { text: 'ACHADINHOS DA ANA', color: 'white' })
  assert.equal(marcada.watermarkApplied, true)
  assert.ok(await variacao(marcada.main) > 5, 'marca branca sumiu na foto branca')
  assert.ok(await variacao(marcada.thumbnail) > 5, 'a miniatura do card também precisa mostrar a marca')
})

test('marca preta continua visível sobre foto escura', async () => {
  const marcada = await renderDestinationWatermark(await fundo('#111111'), { text: 'OFERTAS DA ANA', color: 'black' })
  assert.ok(await variacao(marcada.main) > 5, 'marca preta sumiu na foto escura')
})

test('em foto colorida as duas cores continuam aparecendo', async () => {
  for (const color of ['white', 'black']) {
    const marcada = await renderDestinationWatermark(await fundo('#3b82f6'), { text: 'ANA INDICA', color })
    assert.ok(await variacao(marcada.main) > 5, `marca ${color} sumiu na foto colorida`)
  }
})

test('o contorno é sempre a cor oposta à do texto', () => {
  assert.equal(WATERMARK_STROKE_COLORS.white, WATERMARK_COLORS.black)
  assert.equal(WATERMARK_STROKE_COLORS.black, WATERMARK_COLORS.white)
})
