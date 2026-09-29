// Promoções Awin como origem das ofertas automáticas: seleção (regra aprovada
// em 2026-09-29), envio sem preço/foto, fila de revisão e rotas.
import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import {
  AWIN_AUTOMATION_TEMPLATE_KEY,
  awinPromotionToOffer,
  formatAwinValidity,
  selectAwinCandidates,
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
