/* De quem era o link colado na tela "Testar conversão" (2026-09-26).
 * Casos reais: meli.la e s.shopee da própria cliente eram chamados de
 * "não era seu"; amzn.divulgador.link de outra afiliada precisa dizer que não
 * era dela. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { DONO_DO_LINK, affiliateIdFromUrl, judgePastedLinkOwnership } from '../src/converters/pastedLinkOwnership.js'

test('ML: conversão devolveu o mesmo meli.la → o link já era dela', () => {
  const dono = judgePastedLinkOwnership({
    platform: 'mercadolivre',
    originalUrl: 'https://meli.la/331tUL8',
    convertedUrl: 'https://meli.la/331tUL8',
    creds: { tag: 'minha' },
  })
  assert.equal(dono, DONO_DO_LINK.PROPRIO)
})

test('Shopee: mesmo an_<id> no destino do colado e do convertido → dela', () => {
  const dono = judgePastedLinkOwnership({
    platform: 'shopee',
    originalUrl: 'https://s.shopee.com.br/4Vd4qRX3cP',
    convertedUrl: 'https://s.shopee.com.br/7VGiCRzkpk',
    sourceUrl: 'https://shopee.com.br/product/1/2?utm_medium=affiliates&utm_source=an_18300000001',
    convertedTargetUrl: 'https://shopee.com.br/product/1/2?utm_source=an_18300000001&utm_medium=affiliates',
  })
  assert.equal(dono, DONO_DO_LINK.PROPRIO)
})

test('Shopee: an_<id> diferente → não era dela', () => {
  const dono = judgePastedLinkOwnership({
    platform: 'shopee',
    originalUrl: 'https://s.shopee.com.br/aaa',
    convertedUrl: 'https://s.shopee.com.br/bbb',
    sourceUrl: 'https://shopee.com.br/opaanlp/1/2?utm_source=an_18399999999',
    convertedTargetUrl: 'https://shopee.com.br/product/1/2?utm_source=an_18300000001',
  })
  assert.equal(dono, DONO_DO_LINK.OUTRO)
})

test('Shopee: sem conseguir ler o destino do convertido → desconhecido', () => {
  const dono = judgePastedLinkOwnership({
    platform: 'shopee',
    originalUrl: 'https://s.shopee.com.br/aaa',
    convertedUrl: 'https://s.shopee.com.br/bbb',
    sourceUrl: 'https://shopee.com.br/opaanlp/1/2?utm_source=an_18399999999',
    convertedTargetUrl: null,
  })
  assert.equal(dono, DONO_DO_LINK.DESCONHECIDO)
})

test('Amazon: encurtador de terceiro com tag de outra pessoa → não era dela', () => {
  const dono = judgePastedLinkOwnership({
    platform: 'amazon',
    originalUrl: 'https://amzn.divulgador.link/rzAOrEeg',
    convertedUrl: 'https://www.amazon.com.br/dp/B09VMDMNZD?tag=fafaciane-20',
    sourceUrl: 'https://www.amazon.com.br/dp/B09VMDMNZD?tag=outra-20',
    creds: { tag: 'fafaciane-20' },
  })
  assert.equal(dono, DONO_DO_LINK.OUTRO)
})

test('Amazon: encurtador com a tag dela → dela', () => {
  const dono = judgePastedLinkOwnership({
    platform: 'amazon',
    originalUrl: 'https://amzn.to/xyz',
    convertedUrl: 'https://amzn.to/abc',
    sourceUrl: 'https://www.amazon.com.br/dp/B09VMDMNZD?tag=fafaciane-20&th=1',
    creds: { tag: 'fafaciane-20' },
  })
  assert.equal(dono, DONO_DO_LINK.PROPRIO)
})

test('sem identificação nenhuma no link colado → desconhecido (não afirma)', () => {
  const dono = judgePastedLinkOwnership({
    platform: 'mercadolivre',
    originalUrl: 'https://meli.la/aaa',
    convertedUrl: 'https://meli.la/bbb',
    creds: { tag: 'minha' },
  })
  assert.equal(dono, DONO_DO_LINK.DESCONHECIDO)
})

test('ID de afiliada da Shopee também é lido de dentro de URL codificada', () => {
  const url = 'https://shopee.com.br/verify/traffic?next=https%3A%2F%2Fshopee.com.br%2Fproduct%2F1%2F2%3Futm_source%3Dan_18311112222'
  assert.equal(affiliateIdFromUrl('shopee', url), '18311112222')
})
