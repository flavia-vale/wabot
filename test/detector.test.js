import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectLinks } from '../src/detector.js'

test('detecta produto.mercadolivre.com.br (subdomínio, link de recomendação com #fragment)', () => {
  const text = 'olha essa oferta https://produto.mercadolivre.com.br/MLB-4049246221-secadora-roupas-portatil-110v-mini-eletrica-cortina-pendurar-_JM?searchVariation=188766696371#polycard_client=recommendations_home_navigation-recommendations&reco_backend=x&c_id=/home/element fim'
  const links = detectLinks(text)
  assert.equal(links.length, 1)
  assert.equal(links[0].platform, 'mercadolivre')
  assert.ok(links[0].url.startsWith('https://produto.mercadolivre.com.br/MLB-4049246221'))
})

test('detecta www. e domínio nu de mercadolivre', () => {
  assert.equal(detectLinks('https://www.mercadolivre.com.br/p/MLB123456').length, 1)
  assert.equal(detectLinks('https://mercadolivre.com.br/p/MLB123456').length, 1)
})

test('detecta s.shopee.com.br e shopee.com.br via subdomínio genérico', () => {
  assert.equal(detectLinks('https://s.shopee.com.br/abc123').length, 1)
  assert.equal(detectLinks('https://shopee.com.br/product/1/2').length, 1)
  assert.equal(detectLinks('https://shope.ee/abc').length, 1)
})

test('detecta subdomínios de amazon e magazine', () => {
  assert.equal(detectLinks('https://www.amazon.com.br/dp/B09VQ39F41').length, 1)
  assert.equal(detectLinks('https://amzn.to/abc').length, 1)
  assert.equal(detectLinks('https://www.magazinevoce.com.br/magazinex/p/123').length, 1)
})

test('não casa host colado (notmercadolivre.com.br)', () => {
  assert.equal(detectLinks('https://notmercadolivre.com.br/p/MLB123').length, 0)
})
