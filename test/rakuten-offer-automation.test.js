// Promoções Rakuten como origem das ofertas automáticas: seleção (mesma regra
// da Awin), mensagem com cupom e logo, envio, fila de revisão e rotas.
import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import { AWIN_AUTOMATION_TEMPLATE_KEY } from '../src/offerAutomation/awinOffers.js'
import {
  formatRakutenValidity,
  rakutenItemId,
  rakutenPromotionToOffer,
  selectRakutenCandidates,
} from '../src/offerAutomation/rakutenOffers.js'
import { materializeAutomationOffer, runAutomation } from '../src/offerAutomation/dispatcher.js'
import { productDedupKey } from '../src/offerAutomation/shopeeOffers.js'
import { deliverApprovedReviewItems } from '../src/offerAutomation/reviewDeliveryService.js'
import { discoverReviewItems } from '../src/offerAutomation/reviewDiscoveryService.js'
import { offerAutomationRoutes } from '../src/api/routes/offerAutomation.js'

const NOW = new Date('2026-09-30T15:00:00Z')
const hours = (h) => new Date(NOW.getTime() + h * 3_600_000)
const CLICK = (id) => `https://click.linksynergy.com/fs-bin/click?id=AbCdEfGhIjK&offerid=1897539.${id}&type=3&subid=0`

function promo(id, advertiserId, endInHours, extra = {}) {
  return {
    id: `row-${id}`, accountId: 'acc1', promotionId: `1897539.${id}`, advertiserId: String(advertiserId), advertiserName: `Loja ${advertiserId}`,
    title: `Promoção ${id}`, couponCode: null, clickUrl: CLICK(id), logoUrl: `https://merchant.linksynergy.com/fs/logo/lg_${advertiserId}`,
    storeUrl: `https://loja-${advertiserId}.com.br/`, startDate: hours(-2), endDate: endInHours == null ? null : hours(endInHours), status: 'active', ...extra,
  }
}

test('seleção reveza as lojas; dentro da loja a que vence antes; nunca < 1h, antes de começar ou repetida', () => {
  const list = [promo(1, 'A', 10), promo(2, 'A', 5), promo(3, 'B', 8), promo(4, 'B', 0.5), promo(5, 'C', 5, { startDate: hours(1) })]
  assert.deepEqual(selectRakutenCandidates(list, { now: NOW, limit: 5 }).map((p) => p.promotionId), ['1897539.2', '1897539.3', '1897539.1'])
  const sent = [rakutenItemId(promo(2, 'A', 5))]
  assert.deepEqual(selectRakutenCandidates(list, { now: NOW, limit: 5, sentItemIds: sent }).map((p) => p.promotionId), ['1897539.3', '1897539.1'])
})

test('seleção: mesma oferta publicada duas vezes (números diferentes) sai uma vez; filtros de loja e palavra', () => {
  const twin = [promo(1, 'A', 5, { title: 'Tênis com 30% OFF' }), promo(2, 'A', 6, { title: 'Tênis com 30% off' })]
  assert.equal(selectRakutenCandidates(twin, { now: NOW, limit: 5 }).length, 1)
  assert.equal(selectRakutenCandidates(twin, { now: NOW, limit: 5, sentItemIds: [rakutenItemId(twin[1])] }).length, 0)
  const list = [promo(1, '10', 5, { title: 'Chuteiras' }), promo(2, '10', 5, { title: 'Bolas', categories: 'Futebol' }), promo(3, '20', 5, { title: 'Futebol é aqui' })]
  assert.deepEqual(selectRakutenCandidates(list, { now: NOW, limit: 5, advertiserIds: ['10'] }).map((p) => p.promotionId).sort(), ['1897539.1', '1897539.2'])
  assert.deepEqual(selectRakutenCandidates(list, { now: NOW, limit: 5, keyword: 'FUTEBOL' }).map((p) => p.promotionId).sort(), ['1897539.2', '1897539.3'])
})

test('oferta: link de rastreio da Rakuten, logo como foto, cupom na mensagem; validade "indeterminada" não aparece', () => {
  const offer = rakutenPromotionToOffer(promo(1, '43984', 30, { title: 'Cupom de 10% OFF na primeira compra', couponCode: 'BEMVINDO10' }), { now: NOW })
  assert.equal(offer.source, 'rakuten')
  assert.equal(offer.offerLink, CLICK(1))
  assert.equal(offer.imageUrl, 'https://merchant.linksynergy.com/fs/logo/lg_43984')
  assert.equal(offer.imageRefererUrl, 'https://loja-43984.com.br/', 'referer nunca é o link de rastreio')
  assert.match(offer.validity, /^Válida até /)
  assert.equal(formatRakutenValidity(new Date('2029-06-21T03:00:00Z'), NOW), '')

  const item = materializeAutomationOffer({ templateKey: AWIN_AUTOMATION_TEMPLATE_KEY, keyword: '', destGroupJid: 'g@g.us' }, offer, null)
  assert.match(item.renderedText, /Cupom de 10% OFF na primeira compra/)
  assert.match(item.renderedText, /Loja 43984/)
  assert.match(item.renderedText, /Use o cupom: BEMVINDO10/)
  assert.match(item.renderedText, /click\.linksynergy\.com/)
  assert.doesNotMatch(item.renderedText, /\{[a-zçãé_]+\}/i, 'variável vazou crua')
  assert.doesNotMatch(item.renderedText, /R\$/)
  assert.equal(item.priceCents, 0)
  assert.equal(item.imageUrl, offer.imageUrl)
  assert.equal(item.imageRefererUrl, 'https://loja-43984.com.br/')
  assert.equal(item.productSnapshot.source, 'rakuten')
  assert.equal(item.productSnapshot.rakutenPromotionId, 'row-1')
  assert.equal(item.productSnapshot.storeName, 'Loja 43984')

  const other = rakutenPromotionToOffer({ ...promo(1, '43984', 30), accountId: 'acc2' }, { now: NOW })
  assert.notEqual(productDedupKey(offer), productDedupKey(other), 'mesma oferta em contas diferentes')
})

// ---- com banco real -------------------------------------------------------

let seq = 0
async function setup() {
  const userId = `rk-auto-${++seq}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({ data: { id: userId, name: 'Rakuten', email: `${userId}@rk-auto.local`, passwordHash: 'x', plan: 'pro', accessExpiresAt: new Date(Date.now() + 86_400_000) } })
  const account = await db.rakutenAccount.create({ data: { userId, label: 'Conta', sid: '4640819', clientIdEncrypted: 'x', clientIdLast4: 'xxxx', clientSecretEncrypted: 'y', clientSecretLast4: 'yyyy', credentialFingerprint: 'fp', status: 'ok' } })
  const soon = new Date(Date.now() + 5 * 3_600_000)
  const later = new Date(Date.now() + 30 * 3_600_000)
  await db.rakutenPromotion.createMany({ data: [
    { userId, accountId: account.id, promotionId: '1897539.1', advertiserId: '43984', advertiserName: 'Netshoes WL', title: 'Asics com 5% OFF', clickUrl: CLICK(1), logoUrl: 'https://merchant.linksynergy.com/fs/logo/lg_43984', storeUrl: 'https://www.netshoes.com.br/', endDate: soon },
    { userId, accountId: account.id, promotionId: '1897539.2', advertiserId: '54198', advertiserName: 'Cruzeiro Store', title: 'Camisa oficial', couponCode: 'RAPOSA10', clickUrl: CLICK(2), endDate: later },
  ] })
  return { userId, account }
}

async function cleanup(userId) {
  await db.offerAutomationReviewItem.deleteMany({ where: { userId } })
  await db.offerAutomationSentLog.deleteMany({ where: { userId } })
  await db.offerAutomation.deleteMany({ where: { userId } })
  await db.rakutenAccount.deleteMany({ where: { userId } })
  await db.group.deleteMany({ where: { userId } })
  await db.user.deleteMany({ where: { id: userId } })
}

test('runAutomation Rakuten: não chama a Shopee, envia com logo e link, uma loja por vez, não repete', async () => {
  const { userId, account } = await setup()
  try {
    const automation = await db.offerAutomation.create({ data: { userId, keyword: '', intervalMinutes: 60, offersPerSend: 1, source: 'rakuten', rakutenAccountId: account.id, templateKey: AWIN_AUTOMATION_TEMPLATE_KEY, destGroupJid: 'grupo@g.us', useCoupons: true } })
    const sends = []
    const deps = { dbOverride: db, isRunningFn: async () => true, sendBroadcastFn: async (...args) => { sends.push(args) }, fetchOffersFn: async () => { throw new Error('não pode buscar na Shopee') }, enrichAwinOffersFn: async () => { throw new Error('não é Awin') } }
    const first = await runAutomation(automation, deps)
    assert.equal(first.sent, 1)
    assert.match(sends[0][1], /Asics com 5% OFF/)
    assert.match(sends[0][1], /click\.linksynergy\.com\/fs-bin\/click\?id=AbCdEfGhIjK&offerid=1897539\.1/)
    assert.equal(sends[0][3].imageUrl, 'https://merchant.linksynergy.com/fs/logo/lg_43984')
    assert.equal(sends[0][3].imageRefererUrl, 'https://www.netshoes.com.br/')

    const second = await runAutomation(await db.offerAutomation.findUnique({ where: { id: automation.id } }), deps)
    assert.equal(second.sent, 1)
    assert.match(sends[1][1], /Use o cupom: RAPOSA10/)
    assert.doesNotMatch(sends[1][1], /\{cupom\}/)

    const third = await runAutomation(await db.offerAutomation.findUnique({ where: { id: automation.id } }), deps)
    assert.equal(third.skipped, 'all_offers_filtered')
    assert.equal(sends.length, 2)
  } finally {
    await cleanup(userId)
  }
})

test('runAutomation Rakuten: conta de outra cliente não envia; sem promoções avisa', async () => {
  const a = await setup()
  const b = await setup()
  try {
    const deps = { dbOverride: db, isRunningFn: async () => true, sendBroadcastFn: async () => { throw new Error('não pode enviar') } }
    const stolen = await runAutomation({ id: 'x', userId: b.userId, source: 'rakuten', rakutenAccountId: a.account.id, destGroupJid: 'g@g.us', offersPerSend: 1, sentItemIds: '[]' }, deps)
    assert.equal(stolen.skipped, 'no_rakuten_account')
    await db.rakutenPromotion.updateMany({ where: { userId: a.userId }, data: { status: 'expired' } })
    const empty = await runAutomation({ id: 'x', userId: a.userId, source: 'rakuten', rakutenAccountId: a.account.id, destGroupJid: 'g@g.us', offersPerSend: 1, sentItemIds: '[]' }, deps)
    assert.equal(empty.skipped, 'no_rakuten_promotions')
  } finally {
    await cleanup(a.userId)
    await cleanup(b.userId)
  }
})

test('fila de revisão Rakuten: item vence com a promoção e sai sem enviar se a promoção venceu', async () => {
  const { userId, account } = await setup()
  try {
    const automation = await db.offerAutomation.create({ data: { userId, keyword: '', intervalMinutes: 60, offersPerSend: 2, source: 'rakuten', rakutenAccountId: account.id, templateKey: AWIN_AUTOMATION_TEMPLATE_KEY, destGroupJid: 'grupo@g.us', publicationMode: 'review' } })
    const found = await discoverReviewItems(automation, { db })
    assert.equal(found.discovered, 2)
    const items = await db.offerAutomationReviewItem.findMany({ where: { automationId: automation.id } })
    const asics = items.find((item) => item.renderedText.includes('Asics'))
    const promotion = await db.rakutenPromotion.findFirst({ where: { accountId: account.id, promotionId: '1897539.1' } })
    assert.equal(asics.expiresAt.getTime(), promotion.endDate.getTime())
    assert.equal(asics.imageUrl, 'https://merchant.linksynergy.com/fs/logo/lg_43984')

    await db.offerAutomationReviewItem.updateMany({ where: { automationId: automation.id }, data: { status: 'approved' } })
    await db.rakutenPromotion.update({ where: { id: promotion.id }, data: { status: 'expired' } })
    const sends = []
    const result = await deliverApprovedReviewItems(automation, { db, isRunning: async () => true, sendBroadcast: async (...args) => sends.push(args), instagramRuntime: null })
    assert.equal(result.sent, 1)
    assert.match(sends[0][1], /Camisa oficial/)
    assert.equal((await db.offerAutomationReviewItem.findUnique({ where: { id: asics.id } })).status, 'expired')
  } finally {
    await cleanup(userId)
  }
})

test('rotas: automação Rakuten sem palavra, só com conta própria, sem Instagram, sem cupom da cliente, origem fixa', async () => {
  const a = await setup()
  const b = await setup()
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: a.userId } })
  await app.register(offerAutomationRoutes, { prefix: '/api/offer-automations', db })
  try {
    await db.group.create({ data: { userId: a.userId, waJid: 'meu@g.us', name: 'Meu grupo', role: 'post' } })
    const base = { source: 'rakuten', destGroupJid: 'meu@g.us', intervalMinutes: 60, offersPerSend: 1 }
    assert.equal((await app.inject({ method: 'POST', url: '/api/offer-automations', payload: base })).statusCode, 400)
    assert.equal((await app.inject({ method: 'POST', url: '/api/offer-automations', payload: { ...base, rakutenAccountId: b.account.id } })).statusCode, 400)
    assert.equal((await app.inject({ method: 'POST', url: '/api/offer-automations', payload: { ...base, rakutenAccountId: a.account.id, instagramDestinationIds: ['d1'] } })).statusCode, 400)

    const created = await app.inject({ method: 'POST', url: '/api/offer-automations', payload: { ...base, rakutenAccountId: a.account.id, rakutenAdvertiserIds: ['43984', 'x'], useCoupons: true, minDiscountPct: 30 } })
    assert.equal(created.statusCode, 200)
    const row = JSON.parse(created.body)
    assert.equal(row.source, 'rakuten')
    assert.equal(row.keyword, '')
    assert.equal(row.templateKey, AWIN_AUTOMATION_TEMPLATE_KEY)
    assert.equal(row.rakutenAdvertiserIds, '["43984"]')
    assert.equal(row.useCoupons, false)
    assert.equal(row.minDiscountPct, 0)
    assert.equal(row.awinAccountId, null)

    assert.equal((await app.inject({ method: 'PUT', url: `/api/offer-automations/${row.id}`, payload: { source: 'awin' } })).statusCode, 400)
    assert.equal((await app.inject({ method: 'PUT', url: `/api/offer-automations/${row.id}`, payload: { rakutenAccountId: b.account.id } })).statusCode, 400)
    const edited = await app.inject({ method: 'PUT', url: `/api/offer-automations/${row.id}`, payload: { keyword: '', rakutenAdvertiserIds: [] } })
    assert.equal(edited.statusCode, 200)
    assert.deepEqual(JSON.parse(edited.body).rakutenAdvertiserIds, [])

    const list = JSON.parse((await app.inject({ method: 'GET', url: '/api/offer-automations' })).body)
    assert.deepEqual(list.find((item) => item.id === row.id).rakutenAdvertiserIds, [])
  } finally {
    await app.close()
    await cleanup(a.userId)
    await cleanup(b.userId)
  }
})
