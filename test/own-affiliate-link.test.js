import test from 'node:test'
import assert from 'node:assert/strict'
import { isOwnAffiliateLink } from '../src/converters/ownAffiliateLink.js'

test('Amazon: reconhece o próprio ?tag= e recusa tag de outra pessoa', () => {
  assert.equal(isOwnAffiliateLink('amazon', 'https://www.amazon.com.br/dp/B09VQ39F41?tag=botinho-20', { tag: 'botinho-20' }), true)
  assert.equal(isOwnAffiliateLink('amazon', 'https://www.amazon.com.br/dp/B09VQ39F41?tag=outra-20', { tag: 'botinho-20' }), false)
  assert.equal(isOwnAffiliateLink('amazon', 'https://www.amazon.com.br/dp/B09VQ39F41', { tag: 'botinho-20' }), false)
})

test('Magalu: reconhece o próprio partner_id', () => {
  assert.equal(isOwnAffiliateLink('magazineluiza', 'https://www.magazineluiza.com.br/produto/p/123?partner_id=minhaloja', { tag: 'minhaloja' }), true)
  assert.equal(isOwnAffiliateLink('magazineluiza', 'https://www.magazineluiza.com.br/produto/p/123?partner_id=outraloja', { tag: 'minhaloja' }), false)
})

test('SHEIN: reconhece koc_id e url_from com o mesmo número, ignorando zero à esquerda', () => {
  assert.equal(isOwnAffiliateLink('shein', 'https://m.shein.com/br/produto.html?koc_id=1234567', { tag: '1234567' }), true)
  assert.equal(isOwnAffiliateLink('shein', 'https://m.shein.com/br/produto.html?url_from=affiliate_koc_1234567', { tag: '01234567' }), true)
  assert.equal(isOwnAffiliateLink('shein', 'https://m.shein.com/br/produto.html?koc_id=999', { tag: '1234567' }), false)
})

test('Shopee e AliExpress não têm identificação visível na URL — nunca marca como próprio', () => {
  assert.equal(isOwnAffiliateLink('shopee', 'https://s.shopee.com.br/2g92F2xepl', { appId: '123', secretKey: 'abc' }), false)
  assert.equal(isOwnAffiliateLink('aliexpress', 'https://s.click.aliexpress.com/e/abc', { cookie: 'x=1' }), false)
})

test('sem credencial cadastrada nunca marca como próprio', () => {
  assert.equal(isOwnAffiliateLink('amazon', 'https://www.amazon.com.br/dp/B09VQ39F41?tag=botinho-20', {}), false)
  assert.equal(isOwnAffiliateLink('amazon', 'https://www.amazon.com.br/dp/B09VQ39F41?tag=botinho-20', null), false)
})

test('URL inválida não derruba a checagem', () => {
  assert.equal(isOwnAffiliateLink('amazon', 'não é url', { tag: 'botinho-20' }), false)
})
