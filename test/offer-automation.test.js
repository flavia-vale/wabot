import test, { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { filterOffers, buildOffersQuery, buildOfferCandidateLimit, dedupeOffersByProduct, productDedupKey } from '../src/offerAutomation/shopeeOffers.js'

test('filterOffers: remove offers below minDiscountPct', () => {
  const offers = [
    { itemId: '1', priceDiscountRate: 5, originPrice: 1000, priceMin: 950 },
    { itemId: '2', priceDiscountRate: 25, originPrice: 1000, priceMin: 750 },
    { itemId: '3', priceDiscountRate: 0, originPrice: 1000, priceMin: 1000 },
  ]
  const result = filterOffers(offers, { minDiscountPct: 10, excludeItemIds: [] })
  assert.deepEqual(result.map(o => o.itemId), ['2'])
})

test('filterOffers: excludes already-sent itemIds', () => {
  const offers = [
    { itemId: '1', priceDiscountRate: 30, originPrice: 1000, priceMin: 700 },
    { itemId: '2', priceDiscountRate: 30, originPrice: 1000, priceMin: 700 },
  ]
  const result = filterOffers(offers, { minDiscountPct: 0, excludeItemIds: ['1'] })
  assert.deepEqual(result.map(o => o.itemId), ['2'])
})

test('filterOffers: exclui produto com priceDiscountRate = 0 (originPrice não existe na API)', () => {
  const offers = [
    { itemId: '1', priceDiscountRate: 0, priceMin: 500 },
    { itemId: '2', priceDiscountRate: 0, priceMin: 800 },
  ]
  const result = filterOffers(offers, { minDiscountPct: 0, excludeItemIds: [] })
  assert.deepEqual(result.map(o => o.itemId), [])
})

test('buildOffersQuery: generates valid GraphQL string', () => {
  const q = buildOffersQuery({ keyword: 'festa', page: 1, limit: 10 })
  assert.ok(q.includes('productOfferV2'))
  assert.ok(q.includes('keyword: "festa"'))
  assert.ok(q.includes('page: 1'))
  assert.ok(q.includes('limit: 10'))
  assert.ok(q.includes('offerLink'))
  assert.ok(q.includes('priceDiscountRate'))
})

test('buildOffersQuery: includes isAMSOffer when true', () => {
  const q = buildOffersQuery({ keyword: 'festa', page: 1, limit: 10, isAMSOffer: true })
  assert.ok(q.includes('isAMSOffer: true'))
})

test('buildOffersQuery: includes isKeySeller when true', () => {
  const q = buildOffersQuery({ keyword: 'festa', page: 1, limit: 10, isKeySeller: true })
  assert.ok(q.includes('isKeySeller: true'))
})

test('buildOffersQuery: uses custom sortType', () => {
  const q = buildOffersQuery({ keyword: 'festa', page: 1, limit: 10, sortType: 5 })
  assert.ok(q.includes('sortType: 5'))
})

test('buildOffersQuery: usa lista ampla por padrão para evitar no_offers_found falso', () => {
  const q = buildOffersQuery({ keyword: 'festa', page: 1, limit: 10 })
  assert.ok(q.includes('listType: 1'))
  assert.ok(!q.includes('listType: 2'))
})

test('buildOfferCandidateLimit: busca candidatos suficientes para filtrar descontos e deduplicados', () => {
  assert.equal(buildOfferCandidateLimit(1), 20)
  assert.equal(buildOfferCandidateLimit(3), 30)
  assert.equal(buildOfferCandidateLimit(5), 50)
  assert.equal(buildOfferCandidateLimit(50), 50)
})

test('productDedupKey: normaliza nome (case/espaços) e cai em itemId quando sem nome', () => {
  assert.equal(productDedupKey({ productName: '  Balão  Metalizado   Estrela ' }), 'balão metalizado estrela')
  assert.equal(productDedupKey({ productName: 'BALÃO metalizado estrela' }), 'balão metalizado estrela')
  assert.equal(productDedupKey({ itemId: '42' }), 'item:42')
})

test('dedupeOffersByProduct: colapsa mesmo produto com itemIds diferentes mantendo o primeiro', () => {
  const offers = [
    { itemId: '1', productName: 'Kit Decoração Balão', priceMin: 7157 },
    { itemId: '2', productName: 'Kit Decoração Balão', priceMin: 7320 },
    { itemId: '3', productName: 'Painel Festa', priceMin: 3000 },
  ]
  const result = dedupeOffersByProduct(offers)
  assert.deepEqual(result.map(o => o.itemId), ['1', '3'])
})

import { formatOfferMessage, runAutomation, searchOffersPreview } from '../src/offerAutomation/dispatcher.js'

test('searchOffersPreview: roda a busca sem enviar e retorna funil + ofertas', async () => {
  const calls = []
  const fetchOffersFn = async (args) => {
    calls.push(args)
    return { rawCount: 20, offers: [
      { itemId: '1', productName: 'Fone X', priceMin: 99, priceDiscountRate: 30, offerLink: 'l1' },
      { itemId: '2', productName: 'Fone X', priceMin: 95, priceDiscountRate: 35, offerLink: 'l2' },
      { itemId: '3', productName: 'Caixa Som', priceMin: 199, priceDiscountRate: 20, offerLink: 'l3' },
    ] }
  }
  const result = await searchOffersPreview({
    params: { keyword: 'fone', offersPerSend: 2, minDiscountPct: 10, sortType: 5, listType: 0, page: 1, isKeySeller: true },
    creds: { appId: 'a', secretKey: 's' },
    fetchOffersFn,
  })

  // não envia nada (sem sendBroadcast); apenas busca
  assert.equal(result.rawCount, 20)
  assert.equal(result.afterDiscountFilter, 3)
  assert.equal(result.afterProductDedupe, 2) // "Fone X" colapsa
  assert.equal(result.offers.length, 2)
  // parâmetros escolhidos são ecoados, inclusive listType e o candidateLimit
  assert.equal(result.params.sortType, 5)
  assert.equal(result.params.listType, 0)
  assert.equal(result.params.isKeySeller, true)
  assert.equal(result.params.candidateLimit, 20) // offersPerSend 2 -> max(20,20)
  // os parâmetros chegaram ao fetch (não exclui itens; preview é leitura pura)
  assert.equal(calls[0].sortType, 5)
  assert.equal(calls[0].listType, 0)
  assert.deepEqual(calls[0].excludeItemIds, [])
})

test('searchOffersPreview: prioritizeAMS concatena AMS + regular sem enviar', async () => {
  const seen = []
  const fetchOffersFn = async (args) => {
    seen.push(args.isAMSOffer)
    return args.isAMSOffer
      ? { rawCount: 5, offers: [{ itemId: '10', productName: 'AMS', priceMin: 50, priceDiscountRate: 40, offerLink: 'a' }] }
      : { rawCount: 7, offers: [{ itemId: '20', productName: 'Reg', priceMin: 60, priceDiscountRate: 25, offerLink: 'b' }] }
  }
  const result = await searchOffersPreview({
    params: { keyword: 'x', offersPerSend: 2, minDiscountPct: 0, prioritizeAMS: true },
    creds: { appId: 'a', secretKey: 's' },
    fetchOffersFn,
  })
  assert.deepEqual(seen, [true, false])
  assert.equal(result.afterProductDedupe, 2)
})

test('formatOfferMessage: includes product name and price', () => {
  const offer = {
    productName: 'Balão Metalizado Estrela',
    priceMin: 1990000,
    originPrice: 3500000,
    priceDiscountRate: 43,
    offerLink: 'https://shope.ee/abc123',
    sales: 1250,
    ratingStar: 4.8,
  }
  const msg = formatOfferMessage(offer, 'decoração de festas')
  assert.ok(msg.includes('Balão Metalizado Estrela'))
  assert.ok(msg.includes('43%'))
  assert.ok(msg.includes('https://shope.ee/abc123'))
  assert.ok(msg.includes('R$'))
})

test('formatOfferMessage: handles missing originPrice gracefully', () => {
  const offer = {
    productName: 'Kit Festa Junina',
    priceMin: 2500000,
    originPrice: 0,
    priceDiscountRate: 0,
    offerLink: 'https://shope.ee/xyz456',
    sales: 80,
    ratingStar: 4.2,
  }
  const msg = formatOfferMessage(offer, 'festa')
  assert.ok(msg.includes('Kit Festa Junina'))
  assert.ok(msg.includes('https://shope.ee/xyz456'))
})

function baseAutomation(overrides = {}) {
  return {
    id: 'auto-x', userId: 'user-x', keyword: 'festa', minDiscountPct: 20,
    offersPerSend: 1, destGroupJid: 'grupo@g.us', sentItemIds: '[]',
    sortType: 2, prioritizeAMS: false, isKeySeller: false, ...overrides,
  }
}

const credOk = {
  credential: { findUnique: async () => ({ data: JSON.stringify({ appId: 'a', secretKey: 's' }) }) },
  botConfig: { findUnique: async () => ({ copyVariationPoolJson: '{}' }) },
  offerAutomation: { update: async () => ({}) },
  offerAutomationSentLog: { findMany: async () => [], create: async () => ({}), createMany: async () => ({}), deleteMany: async () => ({}) },
}

test('runAutomation: distingue all_offers_filtered de no_offers_found', async () => {
  const filtered = await runAutomation(baseAutomation(), {
    dbOverride: credOk,
    isRunningFn: () => true,
    fetchOffersFn: async () => ({ rawCount: 12, offers: [] }),
  })
  assert.deepEqual(filtered, { skipped: 'all_offers_filtered' })

  const empty = await runAutomation(baseAutomation(), {
    dbOverride: credOk,
    isRunningFn: () => true,
    fetchOffersFn: async () => ({ rawCount: 0, offers: [] }),
  })
  assert.deepEqual(empty, { skipped: 'no_offers_found' })
})

test('runAutomation: rotaciona a página — usa a página salva e avança no envio bem-sucedido', async () => {
  const updates = []
  let fetchedPage
  const dbOverride = {
    credential: { findUnique: async () => ({ data: JSON.stringify({ appId: 'a', secretKey: 's' }) }) },
    botConfig: { findUnique: async () => ({ copyVariationPoolJson: '{}' }) },
    offerAutomation: { update: async ({ data }) => { updates.push(data); return {} } },
    offerAutomationSentLog: { findMany: async () => [], createMany: async () => ({}), deleteMany: async () => ({}) },
  }
  const result = await runAutomation(baseAutomation({ page: 3, minDiscountPct: 0 }), {
    dbOverride,
    isRunningFn: () => true,
    fetchOffersFn: async ({ page }) => {
      fetchedPage = page
      return { rawCount: 1, offers: [{ itemId: '1', productName: 'Flor', priceMin: 10, priceDiscountRate: 20, offerLink: 'https://s.pe/1' }] }
    },
    sendBroadcastFn: async () => ({ queued: 1 }),
  })
  assert.deepEqual(result, { sent: 1 })
  assert.equal(fetchedPage, 3, 'busca deve usar a página salva')
  assert.equal(updates[0].page, 4, 'envio bem-sucedido avança a página')
})

test('runAutomation: avança a página mesmo quando tudo é filtrado (não fica preso na mesma página)', async () => {
  const updates = []
  let fetchedPage
  const dbOverride = {
    credential: { findUnique: async () => ({ data: JSON.stringify({ appId: 'a', secretKey: 's' }) }) },
    botConfig: { findUnique: async () => ({ copyVariationPoolJson: '{}' }) },
    offerAutomation: { update: async ({ data }) => { updates.push(data); return {} } },
    offerAutomationSentLog: { findMany: async () => [], createMany: async () => ({}), deleteMany: async () => ({}) },
  }
  const result = await runAutomation(baseAutomation({ page: 2 }), {
    dbOverride,
    isRunningFn: () => true,
    fetchOffersFn: async ({ page }) => { fetchedPage = page; return { rawCount: 8, offers: [] } },
  })
  assert.deepEqual(result, { skipped: 'all_offers_filtered' })
  assert.equal(fetchedPage, 2)
  assert.equal(updates[0].page, 3, 'mesmo sem enviar, avança a página para o próximo disparo')
})

test('runAutomation: volta para a página 1 quando a página atual esgota (rawCount 0)', async () => {
  const updates = []
  const dbOverride = {
    credential: { findUnique: async () => ({ data: JSON.stringify({ appId: 'a', secretKey: 's' }) }) },
    botConfig: { findUnique: async () => ({ copyVariationPoolJson: '{}' }) },
    offerAutomation: { update: async ({ data }) => { updates.push(data); return {} } },
    offerAutomationSentLog: { findMany: async () => [], createMany: async () => ({}), deleteMany: async () => ({}) },
  }
  const result = await runAutomation(baseAutomation({ page: 7 }), {
    dbOverride,
    isRunningFn: () => true,
    fetchOffersFn: async () => ({ rawCount: 0, offers: [] }),
  })
  assert.deepEqual(result, { skipped: 'no_offers_found' })
  assert.equal(updates[0].page, 1, 'página vazia faz a rotação voltar para 1')
})

test('runAutomation: curto-circuita quando isRunning é assíncrono (modo remote) e devolve false', async () => {
  // Regressão: no modo remote isRunning devolve Promise. Sem await, `!Promise`
  // era sempre false e o guard era ignorado — seguia pro sendBroadcast e
  // falhava com "Bot não está rodando" a cada tick do cron (flood de log/CPU).
  let sent = false
  const result = await runAutomation(baseAutomation(), {
    dbOverride: credOk,
    isRunningFn: async () => false,
    sendBroadcastFn: async () => { sent = true },
    fetchOffersFn: async () => { throw new Error('não deveria buscar ofertas com bot parado') },
  })
  assert.deepEqual(result, { skipped: 'bot_not_running' })
  assert.equal(sent, false, 'não pode tentar enviar com o bot parado')
})

test('runAutomation: surfa erro real da API Shopee em vez de mascarar', async () => {
  const result = await runAutomation(baseAutomation(), {
    dbOverride: credOk,
    isRunningFn: () => true,
    fetchOffersFn: async () => { throw new Error('shopee_api_error: 90309999 invalid signature') },
  })
  assert.deepEqual(result, { error: 'shopee_api_error: 90309999 invalid signature' })
})

import Fastify from 'fastify'
import { offerAutomationRoutes } from '../src/api/routes/offerAutomation.js'

function buildApp(dbMock) {
  const app = Fastify()
  app.decorate('authenticate', async (req) => { req.user = { sub: 'user-1' } })
  // destGroupJid agora é validado contra os grupos de destino do tenant
  if (!dbMock.group) dbMock.group = { findMany: async () => [{ waJid: '123@g.us' }, { waJid: 'grupo@g.us' }] }
  // quota de automações por tenant
  if (dbMock.offerAutomation && !dbMock.offerAutomation.count) dbMock.offerAutomation.count = async () => 0
  // rotas de escrita exigem plano com canUseOfferAutomations (Pro/Trial ativo)
  if (!dbMock.user) dbMock.user = { findUnique: async () => ({ plan: 'pro', accessExpiresAt: null }) }
  app.register(offerAutomationRoutes, { prefix: '/api/offer-automations', db: dbMock })
  return app
}

test('GET /api/offer-automations: returns user automations', async () => {
  const fakeList = [
    { id: 'a1', userId: 'user-1', keyword: 'festa', intervalMinutes: 120,
      offersPerSend: 2, minDiscountPct: 20, enabled: true, destGroupJid: '123@g.us',
      destGroupName: 'Grupo Festas', lastSentAt: null, sentItemIds: '[]',
      createdAt: new Date(), updatedAt: new Date() },
  ]
  const dbMock = {
    offerAutomation: {
      findMany: async ({ where }) => where.userId === 'user-1' ? fakeList : [],
    },
  }
  const app = buildApp(dbMock)
  const res = await app.inject({ method: 'GET', url: '/api/offer-automations' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.length, 1)
  assert.equal(body[0].keyword, 'festa')
})

test('POST /api/offer-automations: creates automation', async () => {
  let created = null
  const dbMock = {
    offerAutomation: {
      create: async ({ data }) => { created = data; return { id: 'new-1', ...data } },
    },
  }
  const app = buildApp(dbMock)
  const res = await app.inject({
    method: 'POST',
    url: '/api/offer-automations',
    payload: {
      destGroupJid: '123@g.us',
      destGroupName: 'Grupo Festas',
      keyword: 'decoração festa',
      intervalMinutes: 240,
      offersPerSend: 1,
      minDiscountPct: 20,
    },
  })
  assert.equal(res.statusCode, 200)
  assert.equal(created.keyword, 'decoração festa')
  assert.equal(created.userId, 'user-1')
})

test('POST /api/offer-automations: rejects missing keyword', async () => {
  const dbMock = { offerAutomation: {} }
  const app = buildApp(dbMock)
  const res = await app.inject({
    method: 'POST',
    url: '/api/offer-automations',
    payload: { destGroupJid: '123@g.us', destGroupName: 'G', intervalMinutes: 60, offersPerSend: 1, minDiscountPct: 0 },
  })
  assert.equal(res.statusCode, 400)
})

test('DELETE /api/offer-automations/:id: deletes owned automation', async () => {
  const dbMock = {
    offerAutomation: {
      findFirst: async () => ({ id: 'a1', userId: 'user-1' }),
      delete: async () => ({ id: 'a1' }),
    },
  }
  const app = buildApp(dbMock)
  const res = await app.inject({ method: 'DELETE', url: '/api/offer-automations/a1' })
  assert.equal(res.statusCode, 200)
})

test('runAutomation: envia imagem do anúncio junto com a oferta automática', async () => {
  const sent = []
  const updates = []
  const automation = {
    id: 'auto-img',
    userId: 'user-img',
    keyword: 'fone bluetooth',
    minDiscountPct: 10,
    offersPerSend: 1,
    destGroupJid: 'grupo@g.us',
    sentItemIds: '[]',
    sortType: 2,
    prioritizeAMS: false,
    isKeySeller: false,
  }

  const dbOverride = {
    credential: {
      findUnique: async () => ({ data: JSON.stringify({ appId: 'app', secretKey: 'secret' }) }),
    },
    botConfig: {
      findUnique: async () => ({ copyVariationPoolJson: '{}' }),
    },
    offerAutomation: {
      update: async ({ data }) => { updates.push(data); return { ...automation, ...data } },
    },
    offerAutomationSentLog: { findMany: async () => [], create: async () => ({}), createMany: async () => ({}), deleteMany: async () => ({}) },
  }

  const result = await runAutomation(automation, {
    dbOverride,
    isRunningFn: () => true,
    fetchOffersFn: async () => ({ rawCount: 1, offers: [{
      itemId: '42',
      productName: 'Fone Bluetooth',
      priceMin: 990000,
      originPrice: 1990000,
      priceDiscountRate: 50,
      offerLink: 'https://shope.ee/oferta42',
      imageUrl: 'https://down-br.img.susercontent.com/file/anuncio42',
    }] }),
    sendBroadcastFn: async (...args) => { sent.push(args); return { queued: 1 } },
  })

  assert.deepEqual(result, { sent: 1 })
  assert.equal(sent.length, 1)
  assert.equal(sent[0][0], 'user-img')
  assert.deepEqual(sent[0][2], ['grupo@g.us'])
  assert.deepEqual(sent[0][3], {
    imageUrl: 'https://down-br.img.susercontent.com/file/anuncio42',
    imageRefererUrl: 'https://shope.ee/oferta42',
    source: 'offerAutomation',
  })
  assert.deepEqual(updates[0].sentItemIds, JSON.stringify(['42']))
})

test('runAutomation: não envia o mesmo produto duas vezes quando a Shopee repete sob itemIds diferentes', async () => {
  const sent = []
  const updates = []
  const automation = baseAutomation({
    id: 'auto-dup', userId: 'user-dup', minDiscountPct: 0, offersPerSend: 2,
  })
  const dbOverride = {
    credential: { findUnique: async () => ({ data: JSON.stringify({ appId: 'a', secretKey: 's' }) }) },
    botConfig: { findUnique: async () => ({ copyVariationPoolJson: '{}' }) },
    offerAutomation: { update: async ({ data }) => { updates.push(data); return {} } },
    offerAutomationSentLog: { findMany: async () => [], create: async () => ({}), createMany: async () => ({}), deleteMany: async () => ({}) },
  }

  const result = await runAutomation(automation, {
    dbOverride,
    isRunningFn: () => true,
    fetchOffersFn: async () => ({ rawCount: 2, offers: [
      { itemId: '100', productName: 'Decoração Aniversário Balão', priceMin: 7157, priceDiscountRate: 47, offerLink: 'https://s.shopee.com.br/a' },
      { itemId: '200', productName: 'Decoração Aniversário Balão', priceMin: 7320, priceDiscountRate: 37, offerLink: 'https://s.shopee.com.br/b' },
    ] }),
    sendBroadcastFn: async (...args) => { sent.push(args) },
  })

  assert.deepEqual(result, { sent: 1 })
  assert.equal(sent.length, 1)
  // grava o itemId efetivamente enviado para dedup futura
  assert.deepEqual(JSON.parse(updates[0].sentItemIds), ['100'])
})

test('runAutomation: dedup cruzada por grupo — mesmo produto a preço NOVO passa (relâmpago da tarde)', async () => {
  const sent = []
  const created = []
  const automation = baseAutomation({ id: 'auto-cross', userId: 'user-cross', minDiscountPct: 0, offersPerSend: 2 })
  const dbOverride = {
    credential: { findUnique: async () => ({ data: JSON.stringify({ appId: 'a', secretKey: 's' }) }) },
    botConfig: { findUnique: async () => ({ copyVariationPoolJson: '{}' }) },
    offerAutomation: { update: async () => ({}) },
    offerAutomationSentLog: {
      // Outra automação já enviou "Fritadeira Air Fryer" a 199,90 (19990 cents) ao mesmo grupo hoje.
      findMany: async () => [{ productKey: 'fritadeira air fryer', priceCents: 19990 }],
      create: async ({ data }) => { created.push(data) },
      createMany: async ({ data }) => { created.push(...data) },
      deleteMany: async () => ({}),
    },
  }

  const result = await runAutomation(automation, {
    dbOverride,
    isRunningFn: () => true,
    fetchOffersFn: async () => ({ rawCount: 1, offers: [
      // mesmo produto, preço DIFERENTE → passa (oferta nova de fato)
      { itemId: '200', productName: 'Fritadeira Air Fryer', priceMin: 179.90, priceDiscountRate: 40, offerLink: 'https://s.shopee.com.br/b' },
    ] }),
    sendBroadcastFn: async (...args) => { sent.push(args) },
  })

  assert.deepEqual(result, { sent: 1 })
  assert.equal(sent.length, 1)
  // o que passou foi o de preço novo (17990 cents) e foi registrado no log cruzado
  assert.equal(created.length, 1)
  assert.equal(created[0].priceCents, 17990)
  assert.equal(created[0].destGroupJid, 'grupo@g.us')
})

test('runAutomation: dedup cruzada — mesmo produto/preço já enviado ao grupo no dia → all_offers_filtered', async () => {
  const automation = baseAutomation({ id: 'auto-cross2', userId: 'user-cross2', minDiscountPct: 0, offersPerSend: 2 })
  const dbOverride = {
    credential: { findUnique: async () => ({ data: JSON.stringify({ appId: 'a', secretKey: 's' }) }) },
    botConfig: { findUnique: async () => ({ copyVariationPoolJson: '{}' }) },
    offerAutomation: { update: async () => ({}) },
    offerAutomationSentLog: {
      findMany: async () => [{ productKey: 'kit churrasco', priceCents: 9990 }],
      create: async () => ({}),
      createMany: async () => ({}),
      deleteMany: async () => ({}),
    },
  }
  const result = await runAutomation(automation, {
    dbOverride,
    isRunningFn: () => true,
    fetchOffersFn: async () => ({ rawCount: 1, offers: [
      { itemId: '300', productName: 'Kit Churrasco', priceMin: 99.90, priceDiscountRate: 25, offerLink: 'https://s.shopee.com.br/c' },
    ] }),
    sendBroadcastFn: async () => {},
  })
  assert.deepEqual(result, { skipped: 'all_offers_filtered' })
})

test('runAutomation: falha pontual num item do lote não aborta os demais nem descarta o progresso já feito', async () => {
  const sent = []
  const updates = []
  const created = []
  const automation = baseAutomation({
    id: 'auto-partial-fail', userId: 'user-partial-fail', minDiscountPct: 0, offersPerSend: 3,
  })
  const dbOverride = {
    credential: { findUnique: async () => ({ data: JSON.stringify({ appId: 'a', secretKey: 's' }) }) },
    botConfig: { findUnique: async () => ({ copyVariationPoolJson: '{}' }) },
    offerAutomation: { update: async ({ data }) => { updates.push(data); return {} } },
    offerAutomationSentLog: {
      findMany: async () => [],
      createMany: async ({ data }) => { created.push(...data) },
      deleteMany: async () => ({}),
    },
  }

  const result = await runAutomation(automation, {
    dbOverride,
    isRunningFn: () => true,
    fetchOffersFn: async () => ({ rawCount: 3, offers: [
      { itemId: '1', productName: 'Produto A', priceMin: 1000, priceDiscountRate: 30, offerLink: 'https://s.shopee.com.br/a' },
      { itemId: '2', productName: 'Produto B', priceMin: 2000, priceDiscountRate: 30, offerLink: 'https://s.shopee.com.br/b' },
      { itemId: '3', productName: 'Produto C', priceMin: 3000, priceDiscountRate: 30, offerLink: 'https://s.shopee.com.br/c' },
    ] }),
    // Item do meio falha (ex.: timeout de IPC pro worker) — os outros dois
    // precisam sair mesmo assim, e o progresso (sentItemIds/log cruzado) do
    // item 1 (já enviado ANTES da falha) não pode ser perdido.
    sendBroadcastFn: async (userId, text, jids) => {
      if (jids[0] === 'grupo@g.us' && text.includes('Produto B')) throw new Error('Timeout ao enviar mensagem')
      sent.push(text)
    },
  })

  assert.equal(result.sent, 2)
  assert.equal(result.failed, 1)
  assert.equal(result.failures[0].itemId, '2')
  assert.equal(sent.length, 2)
  assert.deepEqual(JSON.parse(updates[0].sentItemIds), ['1', '3'])
  assert.deepEqual(created.map(c => c.itemId), ['1', '3'])
})

describe('runAutomation — prioritizeAMS', () => {
  const baseCreds = { appId: 'a', secretKey: 's' }

  function makeDb() {
    return {
      credential: { findUnique: async () => ({ data: JSON.stringify(baseCreds) }) },
      offerAutomation: { update: async () => {} },
      botConfig: { findUnique: async () => null },
      offerAutomationSentLog: { findMany: async () => [], create: async () => ({}), createMany: async () => ({}), deleteMany: async () => ({}) },
    }
  }

  it('faz uma única busca quando prioritizeAMS=false', async () => {
    let fetchCount = 0
    const fakeOffer = { itemId: '1', productName: 'Prod', priceMin: '10', priceDiscountRate: '20', offerLink: 'https://s.pe/1' }
    const mockFetch = async () => { fetchCount++; return { offers: [fakeOffer], rawCount: 1 } }
    const automation = {
      id: 'a1', userId: 'u1', keyword: 'test', minDiscountPct: 0,
      offersPerSend: 1, excludeItemIds: [], sortType: 2,
      isKeySeller: false, prioritizeAMS: false,
      destGroupJid: 'g1@g.us', sentItemIds: '[]',
    }
    await runAutomation(automation, {
      fetchOffersFn: mockFetch,
      sendBroadcastFn: async () => {},
      isRunningFn: () => true,
      dbOverride: makeDb(),
    })
    assert.equal(fetchCount, 1)
  })

  it('faz duas buscas quando prioritizeAMS=true', async () => {
    let fetchCount = 0
    const amsOffer = { itemId: '1', productName: 'AMS', priceMin: '10', priceDiscountRate: '20', offerLink: 'https://s.pe/1' }
    const regOffer = { itemId: '2', productName: 'Reg', priceMin: '10', priceDiscountRate: '20', offerLink: 'https://s.pe/2' }
    const mockFetch = async ({ isAMSOffer }) => { fetchCount++; return { offers: isAMSOffer ? [amsOffer] : [regOffer], rawCount: 1 } }
    const automation = {
      id: 'a2', userId: 'u1', keyword: 'test', minDiscountPct: 0,
      offersPerSend: 2, excludeItemIds: [], sortType: 2,
      isKeySeller: false, prioritizeAMS: true,
      destGroupJid: 'g1@g.us', sentItemIds: '[]',
    }
    const sent = []
    await runAutomation(automation, {
      fetchOffersFn: mockFetch,
      sendBroadcastFn: async (uid, text) => { sent.push(text) },
      isRunningFn: () => true,
      dbOverride: makeDb(),
    })
    assert.equal(fetchCount, 2)
    assert.equal(sent.length, 2)
    assert.ok(sent[0].includes('AMS'), 'primeiro enviado deve ser o AMS')
    assert.ok(sent[1].includes('Reg'), 'segundo enviado deve ser o Regular')
  })

  it('exclui ids AMS do segundo fetch quando prioritizeAMS=true', async () => {
    let secondFetchExcludes = []
    const amsOffer = { itemId: '99', productName: 'AMS', priceMin: '10', priceDiscountRate: '20', offerLink: 'https://s.pe/99' }
    const mockFetch = async ({ isAMSOffer, excludeItemIds }) => {
      if (!isAMSOffer) secondFetchExcludes = excludeItemIds
      return { offers: isAMSOffer ? [amsOffer] : [], rawCount: isAMSOffer ? 1 : 0 }
    }
    const automation = {
      id: 'a3', userId: 'u1', keyword: 'test', minDiscountPct: 0,
      offersPerSend: 2, excludeItemIds: [], sortType: 2,
      isKeySeller: false, prioritizeAMS: true,
      destGroupJid: 'g1@g.us', sentItemIds: '[]',
    }
    await runAutomation(automation, {
      fetchOffersFn: mockFetch,
      sendBroadcastFn: async () => {},
      isRunningFn: () => true,
      dbOverride: makeDb(),
    })
    assert.ok(secondFetchExcludes.includes('99'), 'segundo fetch deve excluir itemId do AMS')
  })
})

test('runAutomation: usa templateKey selecionado em mobileTemplatesJson', async () => {
  const automation = {
    id: 'auto-template', userId: 'user-template', keyword: 'festa', minDiscountPct: 0,
    offersPerSend: 1, destGroupJid: 'grupo@g.us', sentItemIds: '[]', intervalMinutes: 60,
    sortType: 2, prioritizeAMS: false, isKeySeller: false, templateKey: 'tpl_custom',
  }
  const sent = []
  const dbMock = {
    credential: { findUnique: async () => ({ data: JSON.stringify({ appId: 'app', secretKey: 'secret' }) }) },
    botConfig: { findUnique: async () => ({
      mobileTemplatesJson: JSON.stringify({ overrides: {}, custom: [{ key: 'tpl_custom', name: 'Meu modelo', body: '🔥 {produto}\n{preço}\n{desconto}\n{rating}\n{vendas}\n{link}' }] }),
      copyVariationPoolJson: JSON.stringify({ greetings: [''], ctas: [''], trailers: [''] }),
      brandingGroupLink: '',
      couponLink: '',
    }) },
    offerAutomation: { update: async () => ({}) },
    offerAutomationSentLog: { findMany: async () => [], create: async () => ({}), createMany: async () => ({}), deleteMany: async () => ({}) },
  }

  const result = await runAutomation(automation, {
    dbOverride: dbMock,
    isRunningFn: () => true,
    fetchOffersFn: async () => ({ rawCount: 1, offers: [{
      itemId: '42', productName: 'Balão metalizado', priceMin: '19.9', priceDiscountRate: '20',
      offerLink: 'https://shope.ee/balao', ratingStar: 4.7, sales: 1200, imageUrl: 'https://img.test/balao.jpg',
    }] }),
    sendBroadcastFn: async (_userId, text) => sent.push(text),
  })

  assert.deepEqual(result, { sent: 1 })
  assert.match(sent[0], /🔥 Balão metalizado/)
  assert.match(sent[0], /R\$/)
  assert.match(sent[0], /-20% OFF/)
  assert.match(sent[0], /⭐ 4\.7/)
  assert.match(sent[0], /1\.200\+ vendidos/)
  assert.match(sent[0], /https:\/\/shope\.ee\/balao/)
})

test('runAutomation: sem templateKey cai no Automático clássico', async () => {
  const automation = {
    id: 'auto-default-template', userId: 'user-template', keyword: 'festa', minDiscountPct: 0,
    offersPerSend: 1, destGroupJid: 'grupo@g.us', sentItemIds: '[]', intervalMinutes: 60,
    sortType: 2, prioritizeAMS: false, isKeySeller: false,
  }
  const sent = []
  const dbMock = {
    credential: { findUnique: async () => ({ data: JSON.stringify({ appId: 'app', secretKey: 'secret' }) }) },
    botConfig: { findUnique: async () => ({
      mobileTemplatesJson: '{}',
      copyVariationPoolJson: JSON.stringify({ greetings: [''], ctas: [''], trailers: [''] }),
      brandingGroupLink: '',
      couponLink: '',
    }) },
    offerAutomation: { update: async () => ({}) },
    offerAutomationSentLog: { findMany: async () => [], create: async () => ({}), createMany: async () => ({}), deleteMany: async () => ({}) },
  }

  await runAutomation(automation, {
    dbOverride: dbMock,
    isRunningFn: () => true,
    fetchOffersFn: async () => ({ rawCount: 1, offers: [{
      itemId: '99', productName: 'Kit festa', priceMin: '50', priceDiscountRate: '10',
      offerLink: 'https://shope.ee/kit', ratingStar: null, sales: null,
    }] }),
    sendBroadcastFn: async (_userId, text) => sent.push(text),
  })

  assert.match(sent[0], /🏷️ \*Kit festa\*/)
  assert.match(sent[0], /👉 https:\/\/shope\.ee\/kit/)
})

test('POST /api/offer-automations: persists templateKey', async () => {
  let createdData
  const dbMock = {
    offerAutomation: {
      create: async ({ data }) => { createdData = data; return { id: 'a1', ...data } },
    },
  }
  const app = buildApp(dbMock)
  const res = await app.inject({
    method: 'POST',
    url: '/api/offer-automations',
    payload: {
      destGroupJid: '123@g.us', destGroupName: 'Grupo', keyword: 'festa',
      intervalMinutes: 60, offersPerSend: 1, minDiscountPct: 0, templateKey: 'automatico_classico',
    },
  })

  assert.equal(res.statusCode, 200)
  assert.equal(createdData.templateKey, 'automatico_classico')
})

test('PUT /api/offer-automations/:id: updates templateKey', async () => {
  let updatedData
  const dbMock = {
    offerAutomation: {
      findFirst: async () => ({ id: 'a1', userId: 'user-1' }),
      update: async ({ data }) => { updatedData = data; return { id: 'a1', ...data } },
    },
  }
  const app = buildApp(dbMock)
  const res = await app.inject({ method: 'PUT', url: '/api/offer-automations/a1', payload: { templateKey: 'tpl_custom' } })

  assert.equal(res.statusCode, 200)
  assert.equal(updatedData.templateKey, 'tpl_custom')
})

test('POST /api/offer-automations: rejects invalid templateKey characters', async () => {
  const dbMock = { offerAutomation: { create: async () => ({}) } }
  const app = buildApp(dbMock)
  const res = await app.inject({
    method: 'POST',
    url: '/api/offer-automations',
    payload: {
      destGroupJid: '123@g.us', keyword: 'festa', intervalMinutes: 60, offersPerSend: 1,
      templateKey: '../bad',
    },
  })

  assert.equal(res.statusCode, 400)
  assert.match(JSON.parse(res.body).error, /template/i)
})


test('runAutomation: template pode usar ganchos, CTAs e links globais como variáveis', async () => {
  const automation = {
    id: 'auto-vars', userId: 'user-vars', keyword: 'festa', minDiscountPct: 0,
    offersPerSend: 1, destGroupJid: 'grupo@g.us', sentItemIds: '[]', intervalMinutes: 60,
    sortType: 2, prioritizeAMS: false, isKeySeller: false, templateKey: 'tpl_vars',
  }
  const sent = []
  const dbMock = {
    credential: { findUnique: async () => ({ data: JSON.stringify({ appId: 'app', secretKey: 'secret' }) }) },
    botConfig: { findUnique: async () => ({
      mobileTemplatesJson: JSON.stringify({ overrides: {}, custom: [{ key: 'tpl_vars', name: 'Com variáveis', body: '{{gancho}}\n{produto}\n{{cta}}\n{{grupoLink}}\n{{cupomLink}}\n{{convitegrupo}}\n{link}' }] }),
      copyVariationPoolJson: JSON.stringify({ greetings: ['GANCHO'], ctas: ['CTA'], trailers: ['CONVITE'] }),
      brandingGroupLink: 'https://chat.whatsapp.com/grupo',
      couponLink: 'https://cupom.test/oferta',
    }) },
    offerAutomation: { update: async () => ({}) },
    offerAutomationSentLog: { findMany: async () => [], create: async () => ({}), createMany: async () => ({}), deleteMany: async () => ({}) },
  }

  await runAutomation(automation, {
    dbOverride: dbMock,
    isRunningFn: () => true,
    fetchOffersFn: async () => ({ rawCount: 1, offers: [{
      itemId: '55', productName: 'Painel festa', priceMin: '30', priceDiscountRate: '15', offerLink: 'https://shope.ee/painel',
    }] }),
    sendBroadcastFn: async (_userId, text) => sent.push(text),
  })

  assert.match(sent[0], /GANCHO/)
  assert.match(sent[0], /CTA/)
  assert.match(sent[0], /CONVITE/)
  assert.match(sent[0], /https:\/\/chat\.whatsapp\.com\/grupo/)
  assert.match(sent[0], /https:\/\/cupom\.test\/oferta/)
  assert.doesNotMatch(sent[0], /\{\{gancho\}\}|\{\{cta\}\}|\{\{convitegrupo\}\}|\{\{grupoLink\}\}|\{\{cupomLink\}\}/)
})
