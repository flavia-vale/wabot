// RCA 2026-09-16 — "Criar oferta" com link da Shopee saía SEM IMAGEM.
//
// A rota usava `offer.finalUrl` cru como fonte da foto. `finalUrl` é onde o
// fetch de HTML TERMINOU e, na Shopee, ele termina com frequência numa parede
// anti-bot (`/unsupported.html`, `verify/traffic`) que perde (shopId, itemId).
// Sem os ids a foto é impossível — medido ao vivo: a MESMA URL com ids devolve
// foto, e a parede devolve `null` em todas as fontes.
//
// O caminho de TÍTULO/PREÇO já se protegia disso desde sempre
// (`shopeeApiSourceUrl` em productInfoScraper.js). Era essa assimetria que
// fazia a oferta chegar com título e preço e sem imagem.

import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { linkConversionRoutes } from '../src/api/routes/linkConversion.js'
import {
  pickOfferImageSourceUrl,
  isDeadEndImageSourceUrl,
  identifiesProduct,
} from '../src/core/offerImageSource.js'

const PRODUTO = 'https://shopee.com.br/KIT-TERERE-i.1750300958.23499408546'
const CANONICA = 'https://shopee.com.br/product/1750300958/23499408546'
const PAREDE = 'https://shopee.com.br/unsupported.html?next=%2F'

test('a parede anti-bot da Shopee é reconhecida como beco sem saída', () => {
  assert.equal(isDeadEndImageSourceUrl(PAREDE), true)
  assert.equal(isDeadEndImageSourceUrl('https://www.mercadolivre.com.br/gz/account-verification'), true)
  assert.equal(isDeadEndImageSourceUrl(PRODUTO), false)
  assert.equal(isDeadEndImageSourceUrl(''), false)
})

test('só a URL com (shopId, itemId) identifica o produto da Shopee', () => {
  assert.equal(identifiesProduct('shopee', PRODUTO), true)
  assert.equal(identifiesProduct('shopee', CANONICA), true)
  assert.equal(identifiesProduct('shopee', PAREDE), false)
  // verify/traffic carrega a URL do produto codificada — continua servindo
  assert.equal(
    identifiesProduct('shopee', 'https://shopee.com.br/verify/traffic?next=https%3A%2F%2Fshopee.com.br%2Fproduct%2F1750300958%2F23499408546'),
    true,
  )
})

test('Shopee: prefere a URL com ids mesmo quando finalUrl é a parede anti-bot', () => {
  const escolhida = pickOfferImageSourceUrl({
    platform: 'shopee',
    candidates: [PAREDE, CANONICA, 'https://s.shopee.com.br/abc123', PRODUTO],
  })
  assert.equal(escolhida, CANONICA)
})

test('fora da Shopee a ordem histórica é preservada (finalUrl primeiro)', () => {
  const escolhida = pickOfferImageSourceUrl({
    platform: 'amazon',
    candidates: [
      'https://www.amazon.com.br/dp/B09VQ39F41?tag=x-20',
      'https://www.amazon.com.br/dp/B09VQ39F41',
      'https://amzn.to/abc',
    ],
  })
  assert.equal(escolhida, 'https://www.amazon.com.br/dp/B09VQ39F41?tag=x-20')
})

test('sem candidato utilizável devolve o primeiro (fail-safe: tentar > desistir)', () => {
  assert.equal(pickOfferImageSourceUrl({ platform: 'shopee', candidates: [PAREDE] }), PAREDE)
  assert.equal(pickOfferImageSourceUrl({ platform: 'shopee', candidates: [] }), null)
  assert.equal(pickOfferImageSourceUrl(), null)
})

async function buildApp({ fetchProductInfo, fetchProductImage, converter }) {
  const app = Fastify()
  app.decorate('authenticate', async (req) => { req.user = { sub: 'user-1' } })
  await app.register(linkConversionRoutes, {
    prefix: '/api/link-conversion',
    converter,
    fetchProductInfo,
    fetchProductImage,
    findCredentials: async () => ([
      { platform: 'shopee', data: JSON.stringify({ appId: '123456', secretKey: 'secret-key-very-long' }) },
    ]),
  })
  await app.ready()
  return app
}

test('a rota busca a foto pela URL com ids, não pela parede anti-bot', async (t) => {
  const chamadas = []
  const app = await buildApp({
    converter: async () => 'https://s.shopee.com.br/novoCode',
    // reproduz o mundo real: o fetch de HTML terminou na parede, mas a URL
    // resolvida do short link preserva o produto
    fetchProductInfo: async () => ({
      title: 'Kit Tereré Black',
      oldPrice: '',
      newPrice: '245,67',
      finalUrl: PAREDE,
      resolvedUrl: CANONICA,
    }),
    fetchProductImage: async (platform, url) => {
      chamadas.push({ platform, url })
      return url === CANONICA ? 'https://down-br.img.susercontent.com/file/abc' : null
    },
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({
    method: 'POST',
    url: '/api/link-conversion/scrape-offer',
    payload: { url: PRODUTO },
  })

  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(chamadas.length, 1)
  assert.equal(chamadas[0].platform, 'shopee')
  assert.equal(chamadas[0].url, CANONICA)
  assert.equal(body.imageUrl, 'https://down-br.img.susercontent.com/file/abc')
  assert.equal(body.imageRefererUrl, CANONICA)
  // título e preço seguem intactos
  assert.equal(body.title, 'Kit Tereré Black')
  assert.equal(body.newPrice, '245,67')
})

test('sem resolvedUrl, o link colado pela cliente ainda resgata a foto', async (t) => {
  const chamadas = []
  const app = await buildApp({
    converter: async () => 'https://s.shopee.com.br/novoCode',
    fetchProductInfo: async () => ({ title: 'Kit', oldPrice: '', newPrice: '10,00', finalUrl: PAREDE }),
    fetchProductImage: async (platform, url) => {
      chamadas.push(url)
      return url === PRODUTO ? 'https://down-br.img.susercontent.com/file/zzz' : null
    },
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({
    method: 'POST',
    url: '/api/link-conversion/scrape-offer',
    payload: { url: PRODUTO },
  })

  assert.equal(res.json().imageUrl, 'https://down-br.img.susercontent.com/file/zzz')
  assert.deepEqual(chamadas, [PRODUTO])
})
