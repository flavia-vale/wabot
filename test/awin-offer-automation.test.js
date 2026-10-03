// Promoções Awin como origem das ofertas automáticas: seleção (regra aprovada
// em 2026-09-29), envio sem preço/foto, fila de revisão e rotas.
import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { readFileSync } from 'node:fs'
import db from '../src/db.js'
import {
  AWIN_AUTOMATION_TEMPLATE_KEY,
  awinPromotionToOffer,
  formatAwinValidity,
  selectAwinCandidates,
  awinTitleItemId,
} from '../src/offerAutomation/awinOffers.js'
import { materializeAutomationOffer, runAutomation } from '../src/offerAutomation/dispatcher.js'
import { productDedupKey } from '../src/offerAutomation/shopeeOffers.js'
import { deliverApprovedReviewItems } from '../src/offerAutomation/reviewDeliveryService.js'
import { discoverReviewItems } from '../src/offerAutomation/reviewDiscoveryService.js'
import { offerAutomationRoutes } from '../src/api/routes/offerAutomation.js'

const NOW = new Date('2026-09-28T15:00:00Z')
const hours = (h) => new Date(NOW.getTime() + h * 3_600_000)

function promo(id, advertiserId, endInHours, extra = {}) {
  return {
    id: `row-${id}`, accountId: 'acc1', promotionId: String(id), advertiserId: String(advertiserId), advertiserName: `Loja ${advertiserId}`,
    title: `Promoção ${id}`, description: '', urlTracking: `https://www.awin1.com/cread.php?awinmid=${advertiserId}&awinaffid=1&p=${id}`,
    startDate: hours(-2), endDate: endInHours == null ? null : hours(endInHours), status: 'active', ...extra,
  }
}

test('seleção reveza as lojas e, dentro de cada loja, a que vence antes sai primeiro', () => {
  const list = [promo(1, 'A', 10), promo(2, 'A', 5), promo(3, 'A', 20), promo(4, 'B', 8), promo(5, 'B', 30), promo(6, 'C', null)]
  const picked = selectAwinCandidates(list, { now: NOW, limit: 6 })
  assert.deepEqual(picked.map((p) => p.promotionId), ['2', '4', '6', '1', '5', '3'])
})

test('seleção: nunca menos de 1h para vencer, nunca antes de começar, nunca repetida', () => {
  const list = [promo(1, 'A', 0.5), promo(2, 'A', 5, { startDate: hours(1) }), promo(3, 'A', 5), promo(4, 'A', 6)]
  const picked = selectAwinCandidates(list, { now: NOW, limit: 5, sentItemIds: ['awin:4'] })
  assert.deepEqual(picked.map((p) => p.promotionId), ['3'])
})

test('seleção: filtro de lojas e de palavra (sem acento, todas as palavras)', () => {
  const list = [
    promo(1, '10', 5, { title: 'Notebooks com desconto' }),
    promo(2, '10', 5, { title: 'Monitores', description: 'Frete grátis em monitores gamer' }),
    promo(3, '20', 5, { title: 'Frete gratis em tudo' }),
  ]
  assert.deepEqual(selectAwinCandidates(list, { now: NOW, limit: 5, advertiserIds: ['10'] }).map((p) => p.promotionId), ['1', '2'])
  assert.deepEqual(selectAwinCandidates(list, { now: NOW, limit: 5, keyword: 'FRETE grátis' }).map((p) => p.promotionId).sort(), ['2', '3'])
  assert.deepEqual(selectAwinCandidates(list, { now: NOW, limit: 5, keyword: 'frete monitores', advertiserIds: '["10"]' }).map((p) => p.promotionId), ['2'])
})

test('validade no horário de Brasília', () => {
  assert.equal(formatAwinValidity(new Date('2026-09-29T02:59:59Z')), 'Válida até 28/09 às 23:59')
  assert.equal(formatAwinValidity(null), '')
})

test('dedup: mesma promoção em contas diferentes são ofertas diferentes; títulos iguais de lojas diferentes também', () => {
  const a = awinPromotionToOffer(promo(1, 'A', 5))
  const b = awinPromotionToOffer({ ...promo(1, 'A', 5), accountId: 'acc2' })
  const c = awinPromotionToOffer({ ...promo(2, 'B', 5), title: 'Promoção 1' })
  assert.notEqual(productDedupKey(a), productDedupKey(b))
  assert.notEqual(productDedupKey(a), productDedupKey(c))
})

test('mensagem com o modelo de promoção: sem preço cru, com loja, validade e link', () => {
  const offer = awinPromotionToOffer(promo(1, 'A', 5, { title: 'SSD em oferta', description: 'Até 35% OFF em SSDs' }))
  const item = materializeAutomationOffer({ templateKey: AWIN_AUTOMATION_TEMPLATE_KEY, keyword: '', destGroupJid: 'g@g.us' }, offer, null)
  assert.match(item.renderedText, /SSD em oferta/)
  assert.match(item.renderedText, /Loja A/)
  assert.match(item.renderedText, /Até 35% OFF em SSDs/)
  assert.match(item.renderedText, /Válida até/)
  assert.match(item.renderedText, /awin1\.com/)
  assert.doesNotMatch(item.renderedText, /\{[a-zçãé_]+\}/i, 'variável vazou crua')
  assert.doesNotMatch(item.renderedText, /R\$/)
  assert.equal(item.priceCents, 0)
  assert.equal(item.imageUrl, null)
  assert.equal(item.productSnapshot.source, 'awin')
})

test('modelo da Shopee numa automação Awin: a linha de preço some em vez de sair vazia', () => {
  const offer = awinPromotionToOffer(promo(1, 'A', 5))
  const item = materializeAutomationOffer({ templateKey: 'automatico_classico', keyword: '' }, offer, null)
  assert.doesNotMatch(item.renderedText, /\{preço/)
  assert.doesNotMatch(item.renderedText, /💰/)
})

// ---- com banco real -------------------------------------------------------

let seq = 0
async function setup({ plan = 'pro' } = {}) {
  const n = ++seq
  const userId = `awin-auto-${n}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({ data: { id: userId, name: 'Awin', email: `${userId}@awin-auto.local`, passwordHash: 'x', plan, accessExpiresAt: new Date(Date.now() + 86_400_000) } })
  const account = await db.awinAccount.create({ data: { userId, label: 'Conta', publisherId: '2701264', tokenEncrypted: 'x', tokenLast4: 'xxxx', tokenFingerprint: 'fp', status: 'ok' } })
  const soon = new Date(Date.now() + 5 * 3_600_000)
  const later = new Date(Date.now() + 30 * 3_600_000)
  await db.awinPromotion.createMany({ data: [
    { userId, accountId: account.id, promotionId: '1', advertiserId: '10', advertiserName: 'Kabum BR', title: 'SSD do dia', urlTracking: 'https://www.awin1.com/cread.php?awinmid=10&awinaffid=2701264&p=1', endDate: soon },
    { userId, accountId: account.id, promotionId: '2', advertiserId: '20', advertiserName: 'Outra Loja', title: 'Frete grátis', urlTracking: 'https://www.awin1.com/cread.php?awinmid=20&awinaffid=2701264&p=2', endDate: later },
  ] })
  return { userId, account }
}

async function cleanup(userId) {
  await db.offerAutomationSentLog.deleteMany({ where: { userId } })
  await db.offerAutomation.deleteMany({ where: { userId } })
  await db.awinAccount.deleteMany({ where: { userId } })
  await db.group.deleteMany({ where: { userId } })
  await db.user.deleteMany({ where: { id: userId } })
}

test('runAutomation com origem Awin envia sem foto, uma loja por vez, e não repete', async () => {
  const { userId, account } = await setup()
  try {
    const automation = await db.offerAutomation.create({ data: { userId, keyword: '', intervalMinutes: 60, offersPerSend: 1, source: 'awin', awinAccountId: account.id, templateKey: AWIN_AUTOMATION_TEMPLATE_KEY, destGroupJid: 'grupo@g.us', useCoupons: true } })
    const sends = []
    const deps = { dbOverride: db, isRunningFn: async () => true, sendBroadcastFn: async (...args) => { sends.push(args) }, fetchOffersFn: async () => { throw new Error('não pode buscar na Shopee') } }

    const first = await runAutomation(automation, deps)
    assert.equal(first.sent, 1)
    assert.match(sends[0][1], /SSD do dia/, 'a que vence antes sai primeiro')
    assert.deepEqual(sends[0][2], ['grupo@g.us'])
    assert.equal(sends[0][3].imageUrl, null)
    assert.equal(sends[0][3].source, 'offerAutomation')

    const second = await runAutomation(await db.offerAutomation.findUnique({ where: { id: automation.id } }), deps)
    assert.equal(second.sent, 1)
    assert.match(sends[1][1], /Frete grátis/)

    const third = await runAutomation(await db.offerAutomation.findUnique({ where: { id: automation.id } }), deps)
    assert.equal(third.skipped, 'all_offers_filtered', 'nada repete')
    assert.equal(sends.length, 2)
  } finally {
    await cleanup(userId)
  }
})

test('runAutomation Awin: conta de outra cliente ou origem desconhecida não envia', async () => {
  const a = await setup()
  const b = await setup()
  try {
    const deps = { dbOverride: db, isRunningFn: async () => true, sendBroadcastFn: async () => { throw new Error('não pode enviar') } }
    const stolen = await runAutomation({ id: 'x', userId: b.userId, source: 'awin', awinAccountId: a.account.id, destGroupJid: 'g@g.us', offersPerSend: 1, sentItemIds: '[]' }, deps)
    assert.equal(stolen.skipped, 'no_awin_account')
    const unknown = await runAutomation({ id: 'x', userId: a.userId, source: 'lomadee', destGroupJid: 'g@g.us', offersPerSend: 1 }, deps)
    assert.equal(unknown.skipped, 'invalid_source')
  } finally {
    await cleanup(a.userId)
    await cleanup(b.userId)
  }
})

test('fila de revisão: item Awin vence junto com a promoção e sai sem enviar se a promoção venceu', async () => {
  const { userId, account } = await setup()
  try {
    const automation = await db.offerAutomation.create({ data: { userId, keyword: '', intervalMinutes: 60, offersPerSend: 2, source: 'awin', awinAccountId: account.id, templateKey: AWIN_AUTOMATION_TEMPLATE_KEY, destGroupJid: 'grupo@g.us', publicationMode: 'review' } })
    const found = await discoverReviewItems(automation, { db })
    assert.equal(found.discovered, 2)
    const items = await db.offerAutomationReviewItem.findMany({ where: { automationId: automation.id }, orderBy: { position: 'asc' } })
    const ssd = items.find((item) => item.renderedText.includes('SSD do dia'))
    const promotion = await db.awinPromotion.findFirst({ where: { accountId: account.id, promotionId: '1' } })
    assert.equal(ssd.expiresAt.getTime(), promotion.endDate.getTime(), 'item vence com a promoção')

    await db.offerAutomationReviewItem.updateMany({ where: { automationId: automation.id }, data: { status: 'approved' } })
    await db.awinPromotion.update({ where: { id: promotion.id }, data: { status: 'expired' } })
    const sends = []
    const result = await deliverApprovedReviewItems(automation, { db, isRunning: async () => true, sendBroadcast: async (...args) => sends.push(args), instagramRuntime: null })
    assert.equal(result.sent, 1)
    assert.equal(sends.length, 1)
    assert.match(sends[0][1], /Frete grátis/)
    const expired = await db.offerAutomationReviewItem.findUnique({ where: { id: ssd.id } })
    assert.equal(expired.status, 'expired')
  } finally {
    await db.offerAutomationReviewItem.deleteMany({ where: { userId } })
    await cleanup(userId)
  }
})

async function buildRoutesApp(userId) {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(offerAutomationRoutes, { prefix: '/api/offer-automations', db })
  return app
}

test('rotas: cria automação Awin sem palavra, só com conta própria, sem Instagram e sem cupom', async () => {
  const a = await setup()
  const b = await setup()
  const app = await buildRoutesApp(a.userId)
  try {
    await db.group.create({ data: { userId: a.userId, waJid: 'meu@g.us', name: 'Meu grupo', role: 'post' } })
    const base = { source: 'awin', destGroupJid: 'meu@g.us', intervalMinutes: 60, offersPerSend: 1 }

    const noAccount = await app.inject({ method: 'POST', url: '/api/offer-automations', payload: base })
    assert.equal(noAccount.statusCode, 400)
    const foreign = await app.inject({ method: 'POST', url: '/api/offer-automations', payload: { ...base, awinAccountId: b.account.id } })
    assert.equal(foreign.statusCode, 400, 'conta Awin de outra cliente')
    const insta = await app.inject({ method: 'POST', url: '/api/offer-automations', payload: { ...base, awinAccountId: a.account.id, instagramDestinationIds: ['d1'] } })
    assert.equal(insta.statusCode, 400)

    const created = await app.inject({ method: 'POST', url: '/api/offer-automations', payload: { ...base, awinAccountId: a.account.id, awinAdvertiserIds: ['10', 'x'], useCoupons: true, minDiscountPct: 30 } })
    assert.equal(created.statusCode, 200)
    const row = JSON.parse(created.body)
    assert.equal(row.source, 'awin')
    assert.equal(row.keyword, '')
    assert.equal(row.templateKey, AWIN_AUTOMATION_TEMPLATE_KEY)
    assert.equal(row.awinAdvertiserIds, '["10"]')
    assert.equal(row.useCoupons, false)
    assert.equal(row.minDiscountPct, 0)

    const switched = await app.inject({ method: 'PUT', url: `/api/offer-automations/${row.id}`, payload: { source: 'shopee' } })
    assert.equal(switched.statusCode, 400, 'origem não muda depois de criada')
    const edited = await app.inject({ method: 'PUT', url: `/api/offer-automations/${row.id}`, payload: { keyword: '', awinAdvertiserIds: [] } })
    assert.equal(edited.statusCode, 200)
    assert.deepEqual(JSON.parse(edited.body).awinAdvertiserIds, [])

    const shopee = await app.inject({ method: 'POST', url: '/api/offer-automations', payload: { destGroupJid: 'meu@g.us', intervalMinutes: 60, offersPerSend: 1 } })
    assert.equal(shopee.statusCode, 400, 'Shopee continua exigindo palavra-chave')
  } finally {
    await app.close()
    await cleanup(a.userId)
    await cleanup(b.userId)
  }
})

// RCA 2026-09-29 (staging): 4 promoções idênticas da Arno com números
// 4118880..4118883 → automação de 3 por envio mandou o mesmo produto 3 vezes.
test('cópias (mesma loja + mesmo título, números diferentes) contam como UMA oferta', () => {
  const copy = (id) => promo(id, '108626', 10, { title: 'Liquidificador Arno Powermax 1400W Vermelho LN63 127V', advertiserName: 'Arno BR' })
  const list = [copy(4118880), copy(4118881), copy(4118882), copy(4118883), promo(5, '108626', 12, { title: 'Batedeira Arno' }), promo(6, '17648', 20, { title: 'Moda infantil' })]
  const picked = selectAwinCandidates(list, { now: NOW, limit: 3 })
  assert.equal(picked.length, 3)
  assert.equal(new Set(picked.map((p) => p.title)).size, 3, 'nada repetido no mesmo envio')
  assert.equal(picked.filter((p) => p.title.startsWith('Liquidificador')).length, 1)
  assert.equal(new Set(picked.map((p) => p.advertiserId)).size, 2, 'continua revezando lojas')
})

test('cópia de uma promoção já enviada não sai depois (formato novo e antigo)', () => {
  const copy = (id) => promo(id, '108626', 10, { title: 'Liquidificador Arno  POWERMAX 1400W' })
  const list = [copy(1), copy(2), copy(3)]
  const [first] = selectAwinCandidates(list, { now: NOW, limit: 1 })
  assert.deepEqual(selectAwinCandidates(list, { now: NOW, limit: 3, sentItemIds: [awinPromotionToOffer(first).itemId] }), [])
  assert.deepEqual(selectAwinCandidates(list, { now: NOW, limit: 3, sentItemIds: ['awin:2'] }), [], 'enviada antes da correção, pelo número')
  const otherStore = promo(9, '999', 10, { title: 'Liquidificador Arno Powermax 1400W' })
  assert.equal(selectAwinCandidates([...list, otherStore], { now: NOW, limit: 3, sentItemIds: ['awin:2'] }).length, 1, 'mesmo título em OUTRA loja é outra oferta')
})

test('runAutomation: 3 por envio com cópias no banco manda 3 ofertas diferentes e não repete depois', async () => {
  const { userId, account } = await setup()
  try {
    const later = new Date(Date.now() + 30 * 3_600_000)
    await db.awinPromotion.createMany({ data: [4118880, 4118881, 4118882, 4118883].map((id) => ({ userId, accountId: account.id, promotionId: String(id), advertiserId: '108626', advertiserName: 'Arno BR', title: 'Liquidificador Arno Powermax', urlTracking: `https://www.awin1.com/cread.php?p=${id}`, endDate: later })) })
    const automation = await db.offerAutomation.create({ data: { userId, keyword: '', intervalMinutes: 60, offersPerSend: 3, source: 'awin', awinAccountId: account.id, templateKey: AWIN_AUTOMATION_TEMPLATE_KEY, destGroupJid: 'grupo@g.us' } })
    const sends = []
    const deps = { dbOverride: db, isRunningFn: async () => true, sendBroadcastFn: async (...args) => { sends.push(args[1]) }, enrichAwinOffersFn: async (offers) => offers }
    const first = await runAutomation(automation, deps)
    assert.equal(first.sent, 3)
    assert.equal(sends.filter((text) => text.includes('Liquidificador Arno Powermax')).length, 1)
    const second = await runAutomation(await db.offerAutomation.findUnique({ where: { id: automation.id } }), deps)
    assert.equal(second.skipped, 'all_offers_filtered', 'as cópias restantes não saem depois')
  } finally {
    await cleanup(userId)
  }
})

// RCA 2026-09-29 (2ª rodada, staging): o "repetido" era o MESMO produto em
// 127V e 220V — títulos diferentes, mesma página da loja. E, no empate de
// validade, a ordem pelo número mandava liquidificadores em sequência.
const ARNO = [
  [4118874, 'Liquidificador Arno Powermax 700W Preto LN50 220V', 'https://www.arno.com.br/liquidificador-arno-power-max-700-ln50-preto-2720012726-pai/p'],
  [4118875, 'Liquidificador Arno Powermax 700W Preto LN50 127V', 'https://www.arno.com.br/liquidificador-arno-power-max-700-ln50-preto-2720012726-pai/p'],
  [4118880, 'Liquidificador Arno Powermax 1400W Vermelho LN63 220V', 'https://www.arno.com.br/powermax-vermelho-1400w-ln63-127v_2720018191_pai-1-1/p'],
  [4118881, 'Liquidificador Arno Powermax 1400W Vermelho LN63 127V', 'https://www.arno.com.br/powermax-vermelho-1400w-ln63-127v_2720018191_pai-1-1/p'],
  [4118892, 'LIQ POWERMAX EXTRA 1400W LN87 127V', 'https://www.arno.com.br/liquidificador-power-max-1400w-ln87-2720017891_pai/p'],
  [4118893, 'LIQ POWERMAX EXTRA 1400W LN87 220V', 'https://www.arno.com.br/liquidificador-power-max-1400w-ln87-2720017891_pai/p?utm=x'],
].map(([id, title, url]) => promo(id, '108626', 10, { title, url, advertiserName: 'Arno BR' }))

test('127V e 220V do mesmo produto (mesma página da loja) contam como UMA oferta', () => {
  const picked = selectAwinCandidates(ARNO, { now: NOW, limit: 6 })
  assert.equal(picked.length, 3, 'três produtos, não seis')
  const pages = picked.map((p) => new URL(p.url).pathname)
  assert.equal(new Set(pages).size, 3)
})

test('outra voltagem de um produto já enviado não sai depois (formatos novo, do título e antigo)', () => {
  const [lnd50] = ARNO
  const others = (sentItemIds) => selectAwinCandidates(ARNO, { now: NOW, limit: 6, sentItemIds }).map((p) => p.promotionId)
  for (const sentId of [awinPromotionToOffer(lnd50).itemId, awinTitleItemId(lnd50), 'awin:4118874']) {
    const left = others([sentId])
    assert.ok(!left.includes('4118874') && !left.includes('4118875'), `LN50 voltou com ${sentId}`)
    assert.equal(left.length, 2)
  }
})

test('empate de validade: a escolha varia (não segue a ordem do número) e é sempre a mesma', () => {
  const list = Array.from({ length: 12 }, (_, i) => promo(5000 + i, '108626', 10, { title: `Produto ${i}`, url: `https://www.arno.com.br/p${i}/p` }))
  const first = selectAwinCandidates(list, { now: NOW, limit: 3 }).map((p) => p.promotionId)
  const again = selectAwinCandidates([...list].reverse(), { now: NOW, limit: 3 }).map((p) => p.promotionId)
  assert.deepEqual(first, again, 'determinística')
  assert.notDeepEqual(first, ['5000', '5001', '5002'], 'não é a ordem do número')
  // A regra aprovada continua: vence antes, sai antes.
  const urgent = promo(9999, '108626', 3, { title: 'Urgente', url: 'https://www.arno.com.br/urgente/p' })
  assert.equal(selectAwinCandidates([...list, urgent], { now: NOW, limit: 1 })[0].promotionId, '9999')
})

// ---------- revisão crítica 2026-09-30: revezamento e memória ----------
import { AWIN_SENT_IDS_CAP, awinContentKey as contentKeyF, awinItemId as itemIdF, pruneAwinSentIds, selectAwinCandidates as selectF, storeLastSentOrder } from '../src/offerAutomation/awinOffers.js'

function promoF(id, advertiserId, name, hoursToEnd, url = `https://loja${advertiserId}.com.br/p/${id}`, title = `Promo ${id}`) {
  return { id: `row-${id}`, promotionId: String(id), advertiserId: String(advertiserId), advertiserName: name, title, url, urlTracking: url, status: 'active', endDate: new Date(Date.parse('2026-09-30T12:00:00Z') + hoursToEnd * 3_600_000) }
}
const NOW_F = new Date('2026-09-30T12:00:00Z')

test('F5: revezamento entre execuções — com 1 por envio, a loja que saiu por último vai para o fim da fila', () => {
  // KaBuM sempre vence antes; antes da correção, ela abria TODA execução.
  const all = [promoF(1, 17729, 'Kabum', 5), promoF(2, 17729, 'Kabum', 6), promoF(3, 17648, 'C&A', 50), promoF(4, 32675, 'PUMA', 80)]
  const sent = []
  const order = []
  for (let run = 0; run < 3; run++) {
    const [picked] = selectF(all, { sentItemIds: sent, now: NOW_F, limit: 1 })
    order.push(picked.advertiserName)
    sent.push(itemIdF(picked))
  }
  assert.deepEqual(order, ['Kabum', 'C&A', 'PUMA'])
  const [fourth] = selectF(all, { sentItemIds: sent, now: NOW_F, limit: 1 })
  assert.equal(fourth.advertiserName, 'Kabum', 'volta para a loja que saiu há mais tempo')
  assert.deepEqual([...storeLastSentOrder(sent).entries()], [['17729', 0], ['17648', 1], ['32675', 2]])
})

test('F8: promoções diferentes que apontam para a PÁGINA INICIAL da loja não se bloqueiam', () => {
  const a = promoF(10, 17729, 'Kabum', 5, 'https://www.kabum.com.br/', 'Semana do gamer')
  const b = promoF(11, 17729, 'Kabum', 6, 'https://www.kabum.com.br', 'Frete grátis no app')
  assert.notEqual(contentKeyF(a), contentKeyF(b))
  const picked = selectF([a, b], { sentItemIds: [itemIdF(a)], now: NOW_F, limit: 5 })
  assert.deepEqual(picked.map((p) => p.promotionId), ['11'])
  // Mesma página de produto continua sendo UMA oferta (RCA das variantes 127V/220V).
  assert.equal(contentKeyF(promoF(20, 1, 'X', 5, 'https://x.com.br/p/1', 'A 127V')), contentKeyF(promoF(21, 1, 'X', 5, 'https://x.com.br/p/1', 'A 220V')))
})

test('F7: memória do que saiu é podada pelo que ainda está ativo; ids da Shopee ficam; teto de segurança', () => {
  const alive = promoF(1, 17729, 'Kabum', 5)
  const gone = promoF(2, 17729, 'Kabum', 5)
  const kept = pruneAwinSentIds(['12345', itemIdF(alive), itemIdF(gone), 'awin:999'], [alive])
  assert.deepEqual(kept, ['12345', itemIdF(alive)])
  const many = Array.from({ length: AWIN_SENT_IDS_CAP + 10 }, (_, i) => `shopee-${i}`)
  assert.equal(pruneAwinSentIds(many, []).length, AWIN_SENT_IDS_CAP)
})

test('F6/F7: disparador usa a memória podada e teto maior para promoções', () => {
  const src = readFileSync(new URL('../src/offerAutomation/dispatcher.js', import.meta.url), 'utf8')
  assert.match(src, /if \(Array\.isArray\(loaded\.sentItemIds\)\) sentItemIds = loaded\.sentItemIds/)
  assert.match(src, /addSentIds\(sentItemIds, sentIds, source === 'shopee' \? 200 : AWIN_SENT_IDS_CAP\)/)
  const offers = readFileSync(new URL('../src/offerAutomation/awinOffers.js', import.meta.url), 'utf8')
  assert.match(offers, /distinct: \['advertiserId'\]/, 'carga por loja: nenhuma loja fica de fora por teto global')
})

test('R1: promoção vencida por instabilidade da Awin que volta a valer NÃO sai de novo', async () => {
  const { userId, account } = await setup()
  try {
    const automation = await db.offerAutomation.create({ data: { userId, keyword: '', intervalMinutes: 60, offersPerSend: 1, source: 'awin', awinAccountId: account.id, templateKey: AWIN_AUTOMATION_TEMPLATE_KEY, destGroupJid: 'grupo@g.us', useCoupons: true } })
    const sends = []
    const deps = { dbOverride: db, isRunningFn: async () => true, sendBroadcastFn: async (...args) => { sends.push(args) } }
    const reload = () => db.offerAutomation.findUnique({ where: { id: automation.id } })
    assert.equal((await runAutomation(automation, deps)).sent, 1)
    assert.match(sends[0][1], /SSD do dia/)
    // A Awin "some" com a enviada por uma leitura; a outra sai nesse meio tempo.
    await db.awinPromotion.updateMany({ where: { accountId: account.id, promotionId: '1' }, data: { status: 'expired', expiredAt: new Date() } })
    assert.equal((await runAutomation(await reload(), deps)).sent, 1)
    // A enviada volta a valer, passadas as 24 h da trava por grupo.
    await db.awinPromotion.updateMany({ where: { accountId: account.id }, data: { status: 'active', expiredAt: null } })
    await db.offerAutomationSentLog.deleteMany({ where: { userId } })
    const again = await runAutomation(await reload(), deps)
    assert.equal(again.skipped, 'all_offers_filtered', 'a que já saiu não sai de novo')
    assert.equal(sends.length, 2)
  } finally {
    await cleanup(userId)
  }
})
