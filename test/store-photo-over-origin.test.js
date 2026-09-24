import test from 'node:test'
import assert from 'node:assert/strict'
import { isStorePhotoPreferenceEnabled, shouldPreferStorePhoto } from '../src/core/storePhotoPreference.js'
import { resolveMonitoredImage } from '../src/monitoredImageResolver.js'
import { resolveLinkKind } from '../src/converters/linkKind.js'

// RCA 2026-08-27: as origens que ANEXAM foto própria republicavam a marca
// d'água do concorrente, porque o modo 'original' devolvia a foto da origem
// direto, sem nem tentar a loja. Medido em produção: 348 e 370 imageMessage nas
// duas origens da cliente. As origens que mandam só a miniatura já passavam
// pelo upgrade e por isso foram consertadas antes — a diferença nunca foi de
// conta nem de destino.

test('troca vale quando o link aponta para um produto identificado', () => {
  assert.equal(shouldPreferStorePhoto({ linkKind: 'product', titleOverlap: 'match' }), true)
  // Shopee cai sempre em 'unknown' (fora do guard de scrape); a garantia ali
  // vem do linkKind, que o converter só marca depois de resolver shopId+itemId.
  assert.equal(shouldPreferStorePhoto({ linkKind: 'product', titleOverlap: 'unknown' }), true)
})

test('regressão Magalu: URL /divulgador/oferta ativa a busca da foto oficial', () => {
  const linkKind = resolveLinkKind('magazineluiza', {
    url: 'https://www.magazineluiza.com.br/relogio-gps/divulgador/oferta/ef43k19de1/te/smtw/',
  })
  assert.equal(linkKind, 'product')
  assert.equal(shouldPreferStorePhoto({ linkKind, titleOverlap: 'unknown' }), true)
})

test('nunca troca quando não há produto identificado (evita foto aleatória)', () => {
  assert.equal(shouldPreferStorePhoto({ linkKind: 'coupon', titleOverlap: 'match' }), false)
  assert.equal(shouldPreferStorePhoto({ linkKind: undefined, titleOverlap: 'match' }), false)
  assert.equal(shouldPreferStorePhoto({ linkKind: 'product', isCouponMsg: true }), false)
  assert.equal(shouldPreferStorePhoto({ linkKind: 'product', titleOverlap: 'mismatch' }), false, 'título que não bate = link não é do produto anunciado')
})

test('escape hatch por env volta ao atalho histórico', () => {
  assert.equal(isStorePhotoPreferenceEnabled({}), true, 'ligado por padrão')
  assert.equal(isStorePhotoPreferenceEnabled({ STORE_PHOTO_OVER_ORIGIN: 'false' }), false)
  assert.equal(shouldPreferStorePhoto({ linkKind: 'product', enabled: false }), false)
})

const fotoDaOrigem = { buffer: Buffer.alloc(120_000), mimetype: 'image/jpeg' }
const fotoDaLoja = { buffer: Buffer.alloc(300_000), mimetype: 'image/jpeg' }

test('com preferência ligada, a foto da loja substitui a foto da origem', async () => {
  const trocas = []
  const image = await resolveMonitoredImage({
    mode: 'original',
    target: { platform: 'shopee', url: 'https://s.shopee.com.br/x' },
    downloadOriginalImage: async () => fotoDaOrigem,
    fetchProductImage: async () => 'https://cdn/foto.jpg',
    fetchImageBuffer: async () => fotoDaLoja,
    preferStorePhoto: true,
    onStorePhotoPreferred: info => trocas.push(info),
  })
  assert.equal(image, fotoDaLoja)
  assert.equal(trocas.length, 1)
})

test('loja sem foto NÃO perde a imagem: mantém a foto da origem', async () => {
  const image = await resolveMonitoredImage({
    mode: 'original',
    target: { platform: 'shopee', url: 'https://s.shopee.com.br/x' },
    downloadOriginalImage: async () => fotoDaOrigem,
    fetchProductImage: async () => null,
    fetchImageBuffer: async () => null,
    preferStorePhoto: true,
  })
  assert.equal(image, fotoDaOrigem, 'melhor a foto com marca d\'água do que oferta sem foto')
})

test('sem preferência, o atalho histórico continua valendo (nenhuma chamada à loja)', async () => {
  let consultouLoja = false
  const image = await resolveMonitoredImage({
    mode: 'original',
    target: { platform: 'shopee', url: 'https://s.shopee.com.br/x' },
    downloadOriginalImage: async () => fotoDaOrigem,
    fetchProductImage: async () => { consultouLoja = true; return 'https://cdn/foto.jpg' },
    fetchImageBuffer: async () => fotoDaLoja,
    preferStorePhoto: false,
  })
  assert.equal(image, fotoDaOrigem)
  assert.equal(consultouLoja, false, 'sem preferência não pode custar rede a mais')
})

test('miniatura continua indo pelo caminho de upgrade de sempre', async () => {
  const miniatura = { buffer: Buffer.alloc(500), mimetype: 'image/jpeg' }
  const image = await resolveMonitoredImage({
    mode: 'original',
    target: { platform: 'shopee', url: 'https://s.shopee.com.br/x' },
    downloadOriginalImage: async () => miniatura,
    fetchProductImage: async () => 'https://cdn/foto.jpg',
    fetchImageBuffer: async () => fotoDaLoja,
    preferStorePhoto: false,
  })
  assert.equal(image, fotoDaLoja)
})
