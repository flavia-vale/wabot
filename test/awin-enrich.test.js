// Link curto + foto das promoções Awin na hora do envio (docs/rca/afiliados-awin.md).
import test from 'node:test'
import assert from 'node:assert/strict'
import db from '../src/db.js'
import { AWIN_ENRICH_RETRY_MS, enrichAwinOffers } from '../src/offerAutomation/awinEnrich.js'
import { awinPromotionToOffer } from '../src/offerAutomation/awinOffers.js'
import { runAutomation } from '../src/offerAutomation/dispatcher.js'
import { AwinHttpError } from '../src/integrations/awin/errors.js'

const NOW = new Date('2026-09-29T15:00:00Z')
const STORE = 'https://www.mizuno.com.br/calcados'
let seq = 0

async function setup({ status = 'ok', url = STORE } = {}) {
  const n = ++seq
  const userId = `awin-enrich-${n}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({ data: { id: userId, name: 'Awin', email: `${userId}@awin-enrich.local`, passwordHash: 'x', plan: 'pro', accessExpiresAt: new Date(Date.now() + 86_400_000) } })
  const account = await db.awinAccount.create({ data: { userId, label: 'Conta', publisherId: '2701264', tokenEncrypted: 'codigo-de-teste', tokenLast4: 'este', tokenFingerprint: 'fp', status } })
  const promotion = await db.awinPromotion.create({ data: { userId, accountId: account.id, promotionId: '51271', advertiserId: '51271', advertiserName: 'Mizuno', title: 'Tênis com até 60% OFF', url, urlTracking: `https://www.awin1.com/cread.php?awinmid=51271&awinaffid=2701264&ued=${encodeURIComponent(STORE)}`, endDate: new Date(Date.now() + 30 * 3_600_000) } })
  return { userId, account, promotion }
}

async function cleanup(userId) {
  await db.offerAutomationSentLog.deleteMany({ where: { userId } })
  await db.offerAutomation.deleteMany({ where: { userId } })
  await db.awinAccount.deleteMany({ where: { userId } })
  await db.user.deleteMany({ where: { id: userId } })
}

function fakes({ shortUrl = 'https://tidd.ly/abc123', image = 'https://img.mizuno.com.br/tenis.jpg', linkError = null } = {}) {
  const calls = { link: [], image: [] }
  return {
    calls,
    client: { generateLink: async (token, publisherId, args) => { calls.link.push({ token, publisherId, ...args }); if (linkError) throw linkError; return { url: 'https://www.awin1.com/x', shortUrl } } },
    fetchImage: async (platform, url) => { calls.image.push({ platform, url }); return image },
  }
}

test('troca o link comprido pelo curto, põe a foto da página da loja e guarda na promoção', async () => {
  const { userId, account, promotion } = await setup()
  try {
    const f = fakes()
    const [offer] = await enrichAwinOffers([awinPromotionToOffer(promotion)], { db, userId, accountId: account.id, client: f.client, fetchImage: f.fetchImage, decrypt: (v) => v, now: NOW })
    assert.equal(offer.offerLink, 'https://tidd.ly/abc123')
    assert.equal(offer.imageUrl, 'https://img.mizuno.com.br/tenis.jpg')
    assert.equal(offer.imageRefererUrl, STORE)
    assert.deepEqual(f.calls.link, [{ token: 'codigo-de-teste', publisherId: '2701264', advertiserId: '51271', destinationUrl: STORE, shorten: true }])
    assert.deepEqual(f.calls.image, [{ platform: null, url: STORE }])
    const row = await db.awinPromotion.findUnique({ where: { id: promotion.id } })
    assert.equal(row.shortUrl, 'https://tidd.ly/abc123')
    assert.equal(row.imageUrl, 'https://img.mizuno.com.br/tenis.jpg')

    // Mesma promoção de novo: nada é buscado outra vez.
    const again = fakes()
    const [cached] = await enrichAwinOffers([awinPromotionToOffer(row)], { db, userId, accountId: account.id, client: again.client, fetchImage: again.fetchImage, decrypt: (v) => v, now: NOW })
    assert.equal(cached.offerLink, 'https://tidd.ly/abc123')
    assert.equal(again.calls.link.length + again.calls.image.length, 0)
  } finally { await cleanup(userId) }
})

test('falhou: sai com o link comprido e sem foto, e só tenta de novo depois de 24h', async () => {
  const { userId, account, promotion } = await setup()
  try {
    const f = fakes({ image: null, linkError: new AwinHttpError(400) })
    const base = awinPromotionToOffer(promotion)
    const [offer] = await enrichAwinOffers([base], { db, userId, accountId: account.id, client: f.client, fetchImage: f.fetchImage, decrypt: (v) => v, now: NOW })
    assert.equal(offer.offerLink, base.offerLink)
    assert.equal(offer.imageUrl, null)

    const soon = fakes()
    await enrichAwinOffers([base], { db, userId, accountId: account.id, client: soon.client, fetchImage: soon.fetchImage, decrypt: (v) => v, now: new Date(NOW.getTime() + 3_600_000) })
    assert.equal(soon.calls.link.length + soon.calls.image.length, 0, 'não gasta chamada a cada envio')

    const later = fakes()
    const [retried] = await enrichAwinOffers([base], { db, userId, accountId: account.id, client: later.client, fetchImage: later.fetchImage, decrypt: (v) => v, now: new Date(NOW.getTime() + AWIN_ENRICH_RETRY_MS) })
    assert.equal(retried.offerLink, 'https://tidd.ly/abc123')
  } finally { await cleanup(userId) }
})

test('código recusado: não pede link curto, mas ainda busca a foto', async () => {
  const { userId, account, promotion } = await setup({ status: 'invalid_credential' })
  try {
    const f = fakes()
    const [offer] = await enrichAwinOffers([awinPromotionToOffer(promotion)], { db, userId, accountId: account.id, client: f.client, fetchImage: f.fetchImage, decrypt: (v) => v, now: NOW })
    assert.equal(f.calls.link.length, 0)
    assert.equal(offer.imageUrl, 'https://img.mizuno.com.br/tenis.jpg')
    assert.ok(offer.offerLink.startsWith('https://www.awin1.com/cread.php'))
  } finally { await cleanup(userId) }
})

test('promoção sem página da loja ou de outra cliente não é mexida', async () => {
  const a = await setup({ url: null })
  const b = await setup()
  try {
    const f = fakes()
    const [noUrl] = await enrichAwinOffers([awinPromotionToOffer(a.promotion)], { db, userId: a.userId, accountId: a.account.id, client: f.client, fetchImage: f.fetchImage, decrypt: (v) => v, now: NOW })
    assert.equal(noUrl.imageUrl, null)
    const [foreign] = await enrichAwinOffers([awinPromotionToOffer(b.promotion)], { db, userId: a.userId, accountId: b.account.id, client: f.client, fetchImage: f.fetchImage, decrypt: (v) => v, now: NOW })
    assert.equal(foreign.offerLink, awinPromotionToOffer(b.promotion).offerLink)
    assert.equal(f.calls.link.length + f.calls.image.length, 0)
  } finally {
    await cleanup(a.userId)
    await cleanup(b.userId)
  }
})

test('envio: a mensagem sai com o link curto e a foto; se o enriquecimento quebrar, sai como antes', async () => {
  const { userId, account } = await setup()
  try {
    const automation = await db.offerAutomation.create({ data: { userId, keyword: '', intervalMinutes: 60, offersPerSend: 1, source: 'awin', awinAccountId: account.id, templateKey: 'promocao_awin', destGroupJid: 'g@g.us' } })
    const sends = []
    const base = { dbOverride: db, isRunningFn: async () => true, sendBroadcastFn: async (...args) => { sends.push(args) } }
    const enriched = await runAutomation(automation, { ...base, enrichAwinOffersFn: async (offers) => offers.map((o) => ({ ...o, offerLink: 'https://tidd.ly/abc123', imageUrl: 'https://img/x.jpg', imageRefererUrl: STORE })) })
    assert.equal(enriched.sent, 1)
    assert.match(sends[0][1], /https:\/\/tidd\.ly\/abc123/)
    assert.doesNotMatch(sends[0][1], /cread\.php/)
    assert.equal(sends[0][3].imageUrl, 'https://img/x.jpg')
    assert.equal(sends[0][3].imageRefererUrl, STORE)

    await db.offerAutomation.update({ where: { id: automation.id }, data: { sentItemIds: '[]' } })
    await db.offerAutomationSentLog.deleteMany({ where: { userId } })
    const broken = await runAutomation(await db.offerAutomation.findUnique({ where: { id: automation.id } }), { ...base, enrichAwinOffersFn: async () => { throw new Error('boom') } })
    assert.equal(broken.sent, 1, 'falha no enriquecimento não segura a oferta')
    assert.match(sends[1][1], /cread\.php/)
  } finally { await cleanup(userId) }
})
