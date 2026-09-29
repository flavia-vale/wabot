// Tradutor Awin → registro interno, com o formato REAL medido em 2026-09-29
// (envelope { data, pagination.total }, datas com fuso "+00:00").
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  extractAccounts,
  extractPromotionPage,
  isValidInBrazil,
  parseAwinDate,
  trackingHasPublisher,
  translatePromotion,
} from '../src/integrations/awin/translate.js'

const page = JSON.parse(readFileSync(new URL('./fixtures/awin-promotions-page.json', import.meta.url), 'utf8'))

test('parseAwinDate aceita data com fuso (formato real) e sem fuso (formato da doc, UTC)', () => {
  assert.equal(parseAwinDate('2026-09-29T02:59:59+00:00').toISOString(), '2026-09-29T02:59:59.000Z')
  assert.equal(parseAwinDate('2026-09-29T02:59:59.000').toISOString(), '2026-09-29T02:59:59.000Z')
  assert.equal(parseAwinDate('2026-09-29T02:59:59Z').toISOString(), '2026-09-29T02:59:59.000Z')
  assert.equal(parseAwinDate('2026-09-29T00:00:00-03:00').toISOString(), '2026-09-29T03:00:00.000Z')
  assert.equal(parseAwinDate(''), null)
  assert.equal(parseAwinDate(null), null)
  assert.equal(parseAwinDate('não é data'), null)
})

test('extractPromotionPage lê data + total do envelope real', () => {
  const parsed = extractPromotionPage(page)
  assert.equal(parsed.items.length, 4)
  assert.equal(parsed.total, 4)
  assert.equal(extractPromotionPage({ foo: 1 }), null)
  assert.deepEqual(extractPromotionPage({ data: [] }), { items: [], total: null })
})

test('extractAccounts lê o envelope real { userId, accounts }', () => {
  const accounts = extractAccounts({ userId: 1, accounts: [{ accountId: 2701264, accountName: 'Minha conta', accountType: 'publisher', userRole: 'admin' }, { foo: 1 }] })
  assert.deepEqual(accounts, [{ accountId: '2701264', accountName: 'Minha conta', accountType: 'publisher', userRole: 'admin' }])
  assert.equal(extractAccounts({ nada: true }), null)
})

test('translatePromotion monta o registro e limpa HTML da descrição', () => {
  const result = translatePromotion(page.data[0])
  assert.equal(result.ok, true)
  const record = result.record
  assert.equal(record.promotionId, '910001')
  assert.equal(record.advertiserId, '17729')
  assert.equal(record.advertiserName, 'Kabum BR')
  assert.equal(record.description, 'Até 35% OFF em SSDs selecionados')
  assert.equal(record.endDate.toISOString(), '2026-09-29T02:59:59.000Z')
  assert.ok(record.urlTracking.startsWith('https://www.awin1.com/cread.php'))
})

test('translatePromotion ignora cupom, promoção fora do Brasil e promoção sem link', () => {
  assert.deepEqual(translatePromotion(page.data[2]), { ok: false, reason: 'not_promotion' })
  assert.deepEqual(translatePromotion(page.data[3]), { ok: false, reason: 'not_brazil' })
  assert.deepEqual(translatePromotion({ ...page.data[0], urlTracking: 'javascript:alert(1)' }), { ok: false, reason: 'missing_link' })
  assert.deepEqual(translatePromotion({ ...page.data[0], title: '  ' }), { ok: false, reason: 'missing_title' })
  assert.deepEqual(translatePromotion(null), { ok: false, reason: 'invalid' })
})

test('isValidInBrazil: todas as regiões, lista com BR, sem objeto', () => {
  assert.equal(isValidInBrazil({ all: true }), true)
  assert.equal(isValidInBrazil({ all: false, list: [{ countryCode: 'br' }] }), true)
  assert.equal(isValidInBrazil({ all: false, list: [{ countryCode: 'PT' }] }), false)
  assert.equal(isValidInBrazil(undefined), true)
})

test('trackingHasPublisher confere o ID da cliente no link', () => {
  assert.equal(trackingHasPublisher(page.data[0].urlTracking, '2701264'), true)
  assert.equal(trackingHasPublisher(page.data[0].urlTracking, '999'), false)
})
