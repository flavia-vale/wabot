// RCA 2026-09-30: 51 promoções da KaBuM saíram sem foto (leitura da página
// falhou no servidor). Foto passa a vir da consulta pública da KaBuM, em alta.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildKabumImageUrlCandidates, fetchKabumApiImage, KABUM_PRODUCT_API, kabumProductId } from '../src/converters/kabumImage.js'

test('id do produto só de página de produto da KaBuM', () => {
  assert.equal(kabumProductId('https://www.kabum.com.br/produto/931218'), '931218')
  assert.equal(kabumProductId('https://www.kabum.com.br/produto/645897/monitor-aoc?x=1'), '645897')
  assert.equal(kabumProductId('https://www.kabum.com.br/hardware'), null)
  assert.equal(kabumProductId('https://kabum.com.br.golpe.net/produto/1234'), null)
})

test('variantes em 1000px primeiro, original por último (tamanhos medidos)', () => {
  assert.deepEqual(
    buildKabumImageUrlCandidates('https://images.kabum.com.br/produtos/fotos/931218/suporte_1771601065_m.jpg'),
    ['https://images.kabum.com.br/produtos/fotos/931218/suporte_1771601065_gg.jpg', 'https://images.kabum.com.br/produtos/fotos/931218/suporte_1771601065_m.jpg'],
  )
  assert.deepEqual(
    buildKabumImageUrlCandidates('https://images.kabum.com.br/produtos/fotos/sync_mirakl/645897/medium/Monitor_1789579422.jpg'),
    ['https://images.kabum.com.br/produtos/fotos/sync_mirakl/645897/xlarge/Monitor_1789579422.jpg', 'https://images.kabum.com.br/produtos/fotos/sync_mirakl/645897/medium/Monitor_1789579422.jpg'],
  )
})

test('consulta pública: primeira foto; produto indisponível ou erro → null', async () => {
  const calls = []
  const ok = async (url) => { calls.push(url); return { ok: true, json: async () => ({ sucesso: true, fotos: ['https://images8.kabum.com.br/produtos/fotos/931218/a_1_g.jpg', 'https://images8.kabum.com.br/b.jpg'] }) } }
  assert.equal(await fetchKabumApiImage('https://www.kabum.com.br/produto/931218', { fetchFn: ok }), 'https://images8.kabum.com.br/produtos/fotos/931218/a_1_g.jpg')
  assert.deepEqual(calls, [`${KABUM_PRODUCT_API}931218`])
  assert.equal(await fetchKabumApiImage('https://www.kabum.com.br/produto/1', { fetchFn: async () => ({ ok: true, json: async () => ({ sucesso: false }) }) }), null)
  assert.equal(await fetchKabumApiImage('https://www.kabum.com.br/produto/1', { fetchFn: async () => { throw new Error('rede') } }), null)
  assert.equal(await fetchKabumApiImage('https://www.kabum.com.br/produto/1', { fetchFn: async () => ({ ok: true, json: async () => ({ sucesso: true, fotos: ['https://evil.com/x.jpg'] }) }) }), null)
  assert.equal(await fetchKabumApiImage('https://www.cea.com.br/x', { fetchFn: ok }), null)
})

test('fetchProductImage tenta a consulta da KaBuM antes da página; download usa as variantes', () => {
  const src = readFileSync(new URL('../src/converters/imageScrapers.js', import.meta.url), 'utf8')
  const kabum = src.indexOf('if (kabumProductId(productUrl)) {')
  const page = src.indexOf("if (platform === 'shopee') {", kabum)
  assert.ok(kabum > 0 && page > kabum)
  assert.match(src, /if \(isKabumImageUrl\(rawUrl\)\) \{\s*return buildKabumImageUrlCandidates\(rawUrl\)/)
})

import { kabumIsBlocked, KABUM_BLOCK_MS, resetKabumBlock } from '../src/converters/kabumImage.js'

test('R4: KaBuM bloqueou o servidor (403) → nenhuma chamada por 30 min, depois tenta de novo', async () => {
  resetKabumBlock()
  let clock = 1_000_000
  let calls = 0
  const blocked = async () => { calls++; return { ok: false, status: 403, body: { cancel: async () => {} } } }
  const url = 'https://www.kabum.com.br/produto/931218/x'
  assert.equal(await fetchKabumApiImage(url, { fetchFn: blocked, now: () => clock }), null)
  assert.equal(kabumIsBlocked(clock), true)
  assert.equal(await fetchKabumApiImage(url, { fetchFn: blocked, now: () => clock }), null)
  assert.equal(calls, 1, 'bloqueada: não chama de novo')
  clock += KABUM_BLOCK_MS + 1
  const ok = async () => { calls++; return { ok: true, status: 200, json: async () => ({ sucesso: true, fotos: ['https://images8.kabum.com.br/produtos/fotos/1/x_g.jpg'] }) } }
  assert.match(await fetchKabumApiImage(url, { fetchFn: ok, now: () => clock }), /images8\.kabum/)
  assert.equal(calls, 2)
  // 404/500 de UM produto não bloqueia a loja.
  await fetchKabumApiImage(url, { fetchFn: async () => ({ ok: false, status: 500 }), now: () => clock })
  assert.equal(kabumIsBlocked(clock), false)
  resetKabumBlock()
})
