import { test } from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import { resolveToCleanProductUrl, convert, isAffiliateRedirectValid } from '../src/converters/mercadolivre.js'

test('link de recomendação com MLB no path resolve para o produto (tracking removido)', async () => {
  const url = 'https://produto.mercadolivre.com.br/MLB-4049246221-secadora-roupas-portatil-_JM?searchVariation=188766696371#polycard_client=recommendations&reco_backend=x&c_id=/home/element'
  const clean = await resolveToCleanProductUrl(url)
  assert.equal(clean, 'https://produto.mercadolivre.com.br/MLB-4049246221-secadora-roupas-portatil-_JM?searchVariation=188766696371')
})

test('link /up/MLBU (recomendação/anúncio) usa wid= do fragmento como produto real', async () => {
  const url = 'https://www.mercadolivre.com.br/centrifuga-de-roupas-bcr15b/up/MLBU3956523918#polycard_client=recommendations_vip-pads-right&wid=MLB4664496065&sid=recos&is_advertising=true'
  const clean = await resolveToCleanProductUrl(url)
  assert.equal(clean, 'https://produto.mercadolivre.com.br/MLB4664496065-x-_JM')
})

test('convert sinaliza warning ml_ssid_expired quando API de afiliado rejeita auth (401)', async (t) => {
  t.mock.method(axios, 'post', async () => ({ status: 401, data: { message: 'unauthorized: sessão expirada' }, headers: {} }))
  const url = 'https://produto.mercadolivre.com.br/MLB-4049246221-secadora-_JM'
  const result = await convert(url, { tag: '475630078', ssid: 'ssid-expirado-1234567890' })
  assert.equal(typeof result, 'object')
  assert.equal(result.warning, 'ml_ssid_expired')
  assert.match(result.url, /partner_id=475630078/)
})

test('isAffiliateRedirectValid: listagem exige MLB idêntico', () => {
  assert.equal(isAffiliateRedirectValid({ finalId: 'MLB123', expectedMlbId: 'MLB123', isCatalog: false }), true)
  assert.equal(isAffiliateRedirectValid({ finalId: 'MLB999', expectedMlbId: 'MLB123', isCatalog: false }), false)
})

test('isAffiliateRedirectValid: sem finalId é sempre inválido', () => {
  assert.equal(isAffiliateRedirectValid({ finalId: null, expectedMlbId: 'MLB123', isCatalog: true }), false)
})

test('isAffiliateRedirectValid: catálogo aceita listagem vencedora confirmada pelo mesmo catalog_product_id', () => {
  assert.equal(isAffiliateRedirectValid({ finalId: 'MLB777', expectedMlbId: 'MLB70009242', isCatalog: true, resolvedCatalogProductId: 'MLB70009242' }), true)
})

test('isAffiliateRedirectValid: catálogo rejeita listagem de catálogo DIFERENTE (confirmado)', () => {
  assert.equal(isAffiliateRedirectValid({ finalId: 'MLB777', expectedMlbId: 'MLB70009242', isCatalog: true, resolvedCatalogProductId: 'MLB000000' }), false)
})

test('isAffiliateRedirectValid: catálogo com confirmação inconclusiva aceita (short veio da URL do catálogo)', () => {
  assert.equal(isAffiliateRedirectValid({ finalId: 'MLB777', expectedMlbId: 'MLB70009242', isCatalog: true, resolvedCatalogProductId: null }), true)
})

test('isAffiliateRedirectValid: catálogo cujo short permanece no mesmo MLB também vale', () => {
  assert.equal(isAffiliateRedirectValid({ finalId: 'MLB70009242', expectedMlbId: 'MLB70009242', isCatalog: true }), true)
})
