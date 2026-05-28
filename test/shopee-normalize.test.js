import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeShopeeUrl } from '../src/converters/shopee.js'

test('normalizeShopeeUrl reescreve /opaanlp/{shopId}/{itemId} (formato afiliado de campanha) para /product/', () => {
  const input = 'https://shopee.com.br/opaanlp/1606886796/23299192042?__mobile__=1&gads_t_sig=abc&utm_medium=affiliates&utm_source=an_18367340588'
  assert.equal(normalizeShopeeUrl(input), 'https://shopee.com.br/product/1606886796/23299192042')
})

test('normalizeShopeeUrl reescreve URL slug-i.{shopId}.{itemId} para /product/', () => {
  const input = 'https://shopee.com.br/produto-bonito-i.1234.5678?sp_atk=xyz'
  assert.equal(normalizeShopeeUrl(input), 'https://shopee.com.br/product/1234/5678')
})

test('normalizeShopeeUrl preserva /product/ canônico já limpo', () => {
  const input = 'https://shopee.com.br/product/1234/5678'
  assert.equal(normalizeShopeeUrl(input), 'https://shopee.com.br/product/1234/5678')
})

test('normalizeShopeeUrl deixa URLs sem (shopId,itemId) intactas (ex: página de cupom)', () => {
  const input = 'https://shopee.com.br/m/cupom-de-desconto?utm_medium=affiliates'
  assert.equal(normalizeShopeeUrl(input), input)
})

test('normalizeShopeeUrl não toca em hostnames de terceiros', () => {
  const input = 'https://example.com/opaanlp/1/2'
  assert.equal(normalizeShopeeUrl(input), input)
})

test('normalizeShopeeUrl tolera URL inválida e devolve o input', () => {
  assert.equal(normalizeShopeeUrl('not a url'), 'not a url')
})
