// Revisão 2026-09-30: a logo da loja na Awin (120×60) caía no piso de 120 px
// do download e a oferta automática voltava a sair só com texto. Imagem
// pequena agora vira um quadro branco de 800 px.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { fetchImageBuffer, fetchSmallImageAsCard } from '../src/converters/imageScrapers.js'

async function withFetch(buffer, fn) {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(buffer, { status: 200, headers: { 'content-type': 'image/png', 'content-length': String(buffer.length) } })
  try { return await fn() } finally { globalThis.fetch = original }
}

test('logo 120×60: download normal recusa, quadro 800×800 aceita', async () => {
  const logo = await sharp({ create: { width: 120, height: 60, channels: 3, background: '#ff0000' } }).png().toBuffer()
  await withFetch(logo, async () => {
    assert.equal(await fetchImageBuffer('https://ui.awin.com/images/upload/merchant/profile/17729.png'), null)
    const card = await fetchSmallImageAsCard('https://ui.awin.com/images/upload/merchant/profile/17729.png')
    assert.equal(card.width, 800)
    const meta = await sharp(card.buffer).metadata()
    assert.deepEqual([meta.width, meta.height, meta.format], [800, 800, 'jpeg'])
  })
})

test('imagem minúscula (< 32 px) continua recusada', async () => {
  const tiny = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#000' } }).png().toBuffer()
  await withFetch(tiny, async () => {
    assert.equal(await fetchSmallImageAsCard('https://ui.awin.com/images/upload/merchant/profile/1.png'), null)
  })
})

test('oferta automática tenta o quadro antes de sair só com texto', () => {
  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  const download = src.indexOf('let fetched = await fetchImageBuffer(recipe.imageUrl, recipe.refererUrl)')
  const card = src.indexOf('await fetchSmallImageAsCard(recipe.imageUrl, recipe.refererUrl)')
  assert.ok(download > 0 && card > download)
})

test('R5: quadro só para logo de loja da Awin/Rakuten — foto de produto que falhou fica como antes (nem baixa de novo)', async () => {
  const logo = await sharp({ create: { width: 120, height: 60, channels: 3, background: '#ff0000' } }).png().toBuffer()
  let downloads = 0
  const original = globalThis.fetch
  globalThis.fetch = async () => { downloads++; return new Response(logo, { status: 200, headers: { 'content-type': 'image/png' } }) }
  try {
    assert.equal(await fetchSmallImageAsCard('https://down-br.img.susercontent.com/file/abc'), null)
    assert.equal(await fetchSmallImageAsCard('https://http2.mlstatic.com/D_x.jpg'), null)
    assert.equal(downloads, 0)
    assert.ok(await fetchSmallImageAsCard('https://merchant.linksynergy.com/fs/logo/lg_43984'))
    assert.equal(downloads, 1)
  } finally {
    globalThis.fetch = original
  }
})
