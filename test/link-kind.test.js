import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveLinkKind } from '../src/converters/linkKind.js'

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

test('plataforma sem detector (magazineluiza) devolve undefined sem lançar', () => {
  assert.equal(resolveLinkKind('magazineluiza', { url: 'https://www.magazineluiza.com.br/produto/p/123' }), undefined)
})

test('plataforma desconhecida devolve undefined', () => {
  assert.equal(resolveLinkKind('nolink', { url: 'https://example.com' }), undefined)
})
