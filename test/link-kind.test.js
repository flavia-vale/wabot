import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveLinkKind, urlHasProductId } from '../src/converters/linkKind.js'

test('respeita linkKind já decidido pelo converter (shopee.js)', () => {
  assert.equal(resolveLinkKind('shopee', { url: 'https://s.shopee.com.br/x', linkKind: 'coupon' }), 'coupon')
  assert.equal(resolveLinkKind('shopee', { url: 'https://s.shopee.com.br/x', linkKind: 'product' }), 'product')
})

test('amazon: URL com ASIN classifica como product', () => {
  assert.equal(
    resolveLinkKind('amazon', { url: 'https://www.amazon.com.br/dp/B09VQ39F41', converted: 'https://amzn.to/abc123' }),
    'product',
  )
})

test('amazon: link de cupom/campanha sem ASIN classifica como coupon', () => {
  assert.equal(
    resolveLinkKind('amazon', { url: 'https://www.amazon.com.br/primeday', converted: 'https://www.amazon.com.br/primeday?tag=x-20' }),
    'coupon',
  )
})

test('mercadolivre: URL com MLB classifica como product', () => {
  assert.equal(
    resolveLinkKind('mercadolivre', { url: 'https://produto.mercadolivre.com.br/MLB4060932335-x' }),
    'product',
  )
})

test('mercadolivre: página de cupons (sem MLB) classifica como coupon — bug real corrigido', () => {
  assert.equal(
    resolveLinkKind('mercadolivre', {
      url: 'https://www.mercadolivre.com.br/cupons?source_page=mperfil#nav-header',
      converted: 'https://www.mercadolivre.com.br/cupons?source_page=mperfil#nav-header',
    }),
    'coupon',
  )
})

test('amazon/ML: linkKind explícito do converter é respeitado mesmo quando url/converted são short links sem ASIN/MLB (bug real: produto virava cupom)', () => {
  // amzn.to/meli.la nunca expõem ASIN/MLB no texto — sem o converter
  // informar linkKind='product' diretamente, o fallback regex classificaria
  // errado como 'coupon' mesmo sendo um produto de verdade.
  assert.equal(
    resolveLinkKind('amazon', { url: 'https://amzn.to/4gipdUe', converted: 'https://amzn.to/4gipdUe', linkKind: 'product' }),
    'product',
  )
  assert.equal(
    resolveLinkKind('mercadolivre', { url: 'https://meli.la/1fyQi7e', converted: 'https://meli.la/1fyQi7e', linkKind: 'product' }),
    'product',
  )
})

// specs/012-shein-store-support (A3): defesa em profundidade — o conversor já
// devolve linkKind explícito, que tem precedência (testado acima). Este
// fallback regex só entra quando o converter não cooperou.
test('shein: goods_id ou -p-<id> classifica como product', () => {
  assert.equal(resolveLinkKind('shein', { url: 'https://br.shein.com/vestido-p-485735309.html' }), 'product')
  assert.equal(resolveLinkKind('shein', { url: 'https://m.shein.com/br/ark/default?goods_id=485735309' }), 'product')
})

test('shein: sem goods_id/-p- classifica como coupon', () => {
  assert.equal(resolveLinkKind('shein', { url: 'https://m.shein.com/br/ark/default?scene=1&campaign=summer' }), 'coupon')
})

test('plataforma sem detector (magazineluiza) devolve undefined sem lançar', () => {
  assert.equal(resolveLinkKind('magazineluiza', { url: 'https://www.magazineluiza.com.br/produto/p/123' }), undefined)
})

test('plataforma desconhecida devolve undefined', () => {
  assert.equal(resolveLinkKind('nolink', { url: 'https://example.com' }), undefined)
})

// urlHasProductId (T001, FR-010): export novo reusado pela blindagem tripla
// do banner de marca (couponBrandCardPolicy.js). resolveLinkKind permanece
// byte-a-byte inalterado — este export só LÊ os mesmos detectores.
test('urlHasProductId: amazon com ASIN em /dp/ e /gp/product/ retorna true', () => {
  assert.equal(urlHasProductId('amazon', 'https://www.amazon.com.br/dp/B09VQ39F41'), true)
  assert.equal(urlHasProductId('amazon', 'https://www.amazon.com.br/gp/product/B09VQ39F41'), true)
})

test('urlHasProductId: mercadolivre com MLB retorna true', () => {
  assert.equal(urlHasProductId('mercadolivre', 'https://produto.mercadolivre.com.br/MLB4060932335-x'), true)
})

test('urlHasProductId: short link sem ID (amzn.to, meli.la) retorna false', () => {
  assert.equal(urlHasProductId('amazon', 'https://amzn.to/4gipdUe'), false)
  assert.equal(urlHasProductId('mercadolivre', 'https://meli.la/1fyQi7e'), false)
})

test('urlHasProductId: plataforma sem detector ou URL ausente retorna false sem lançar', () => {
  assert.equal(urlHasProductId('shopee', 'https://s.shopee.com.br/x'), false)
  assert.equal(urlHasProductId('amazon', undefined), false)
  assert.equal(urlHasProductId(undefined, undefined), false)
})
