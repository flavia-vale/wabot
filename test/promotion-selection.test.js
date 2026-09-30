// Núcleo comum das promoções (src/offerAutomation/promotionSelection.js):
// mesmas regras da Awin (docs/rca/afiliados-awin.md), agora parametrizáveis
// por origem — prefixo do id e nome dos campos.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PROMOTION_MIN_REMAINING_MS,
  createPromotionSelector,
  formatPromotionValidity,
  hasMinimumTimeLeft,
  normalizedStorePage,
  shortHash,
} from '../src/offerAutomation/promotionSelection.js'
import { awinContentKey, awinItemId, awinLegacyItemId, awinTitleItemId, selectAwinCandidates } from '../src/offerAutomation/awinOffers.js'

const NOW = new Date('2026-09-28T15:00:00Z')
const hours = (h) => new Date(NOW.getTime() + h * 3_600_000)

const selector = createPromotionSelector({ prefix: 'awin' })

function promo(id, advertiserId, endInHours, extra = {}) {
  return {
    id: `row-${id}`, promotionId: String(id), advertiserId: String(advertiserId), advertiserName: `Loja ${advertiserId}`,
    title: `Promoção ${id}`, description: '', startDate: hours(-2), endDate: endInHours == null ? null : hours(endInHours), status: 'active', ...extra,
  }
}

// Outra origem, com outros nomes de campo (formato hipotético, só para provar
// que o núcleo não depende dos nomes da Awin).
const other = createPromotionSelector({
  prefix: 'outra',
  fields: { id: 'code', store: 'shopId', storeName: 'shopName', title: 'name', description: 'text', page: 'link', start: 'beginAt', end: 'finishAt', status: 'state' },
  activeStatus: 'onTime',
})
const asOther = (p) => ({ code: p.promotionId, shopId: p.advertiserId, shopName: p.advertiserName, name: p.title, text: p.description, link: p.url, beginAt: p.startDate, finishAt: p.endDate, state: p.status === 'active' ? 'onTime' : p.status })

const ARNO = [
  [4118874, 'Liquidificador Arno Powermax 700W Preto LN50 220V', 'https://www.arno.com.br/liquidificador-arno-power-max-700-ln50-preto-2720012726-pai/p'],
  [4118875, 'Liquidificador Arno Powermax 700W Preto LN50 127V', 'https://www.arno.com.br/liquidificador-arno-power-max-700-ln50-preto-2720012726-pai/p'],
  [4118880, 'Liquidificador Arno Powermax 1400W Vermelho LN63 220V', 'https://www.arno.com.br/powermax-vermelho-1400w-ln63-127v_2720018191_pai-1-1/p'],
  [4118881, 'Liquidificador Arno Powermax 1400W Vermelho LN63 127V', 'https://www.arno.com.br/powermax-vermelho-1400w-ln63-127v_2720018191_pai-1-1/p'],
  [4118892, 'LIQ POWERMAX EXTRA 1400W LN87 127V', 'https://www.arno.com.br/liquidificador-power-max-1400w-ln87-2720017891_pai/p'],
  [4118893, 'LIQ POWERMAX EXTRA 1400W LN87 220V', 'https://www.arno.com.br/liquidificador-power-max-1400w-ln87-2720017891_pai/p?utm=x'],
].map(([id, title, url]) => promo(id, '108626', 10, { title, url, advertiserName: 'Arno BR' }))

test('formato dos ids igual ao da Awin (página, título e número)', () => {
  const [ln50] = ARNO
  assert.equal(selector.itemId(ln50), `awin:c:108626:u:${shortHash('arno.com.br/liquidificador-arno-power-max-700-ln50-preto-2720012726-pai/p')}`)
  assert.equal(selector.titleItemId(ln50), `awin:c:108626:${shortHash('liquidificador arno powermax 700w preto ln50 220v')}`)
  assert.equal(selector.legacyItemId(ln50), 'awin:4118874')
  const noPage = promo(1, '5', 10, { title: 'Tênis  Ação!' })
  assert.equal(selector.contentKey(noPage), `5:${shortHash('tenis acao')}`, 'sem página, cai no título sem acento')
  for (const p of [...ARNO, noPage]) {
    assert.equal(selector.itemId(p), awinItemId(p))
    assert.equal(selector.titleItemId(p), awinTitleItemId(p))
    assert.equal(selector.legacyItemId(p), awinLegacyItemId(p))
    assert.equal(selector.contentKey(p), awinContentKey(p))
  }
})

test('página da loja: sem www., query, barra final ou maiúsculas; URL inválida = sem página', () => {
  assert.equal(normalizedStorePage('https://WWW.Arno.com.br/P1/p/?utm=x'), 'arno.com.br/p1/p')
  assert.equal(normalizedStorePage('lixo'), null)
  assert.equal(normalizedStorePage(null), null)
})

test('Arno: 127V e 220V da mesma página = uma oferta só', () => {
  const picked = selector.select(ARNO, { now: NOW, limit: 6 })
  assert.equal(picked.length, 3)
  assert.equal(new Set(picked.map((p) => new URL(p.url).pathname)).size, 3)
  assert.deepEqual(picked, selectAwinCandidates(ARNO, { now: NOW, limit: 6 }))
})

test('Arno: outra voltagem de um produto já enviado não sai (três formatos de id)', () => {
  const [ln50] = ARNO
  for (const sentId of [selector.itemId(ln50), selector.titleItemId(ln50), 'awin:4118874']) {
    const left = selector.select(ARNO, { now: NOW, limit: 6, sentItemIds: [sentId] }).map((p) => p.promotionId)
    assert.ok(!left.includes('4118874') && !left.includes('4118875'), `LN50 voltou com ${sentId}`)
    assert.equal(left.length, 2)
  }
})

test('mesma página em OUTRA loja é outra oferta', () => {
  const copy = promo(1, '999', 10, { title: ARNO[0].title, url: ARNO[0].url })
  assert.equal(selector.select([ARNO[0], copy], { now: NOW, limit: 5 }).length, 2)
})

test('revezamento de lojas e, dentro da loja, vence antes primeiro', () => {
  const list = [promo(1, 'A', 30), promo(2, 'A', 5), promo(3, 'A', 10), promo(4, 'B', 8), promo(5, 'B', 20), promo(6, 'C', 50)]
  const picked = selector.select(list, { now: NOW, limit: 6 }).map((p) => p.promotionId)
  assert.deepEqual(picked, ['2', '4', '6', '3', '5', '1'])
})

test('janela: nunca menos de 1h para vencer, nunca antes de começar, só ativa; sem fim = vale', () => {
  const list = [
    promo(1, 'A', 0.99), promo(2, 'A', 1), promo(3, 'A', null),
    promo(4, 'B', 10, { startDate: hours(1) }), promo(5, 'B', 10, { status: 'expired' }),
  ]
  assert.deepEqual(selector.select(list, { now: NOW, limit: 9 }).map((p) => p.promotionId).sort(), ['2', '3'])
  assert.equal(PROMOTION_MIN_REMAINING_MS, 3_600_000)
  assert.equal(hasMinimumTimeLeft(hours(1), { now: NOW }), true)
  assert.equal(hasMinimumTimeLeft(hours(0.99), { now: NOW }), false)
  assert.equal(hasMinimumTimeLeft(null, { now: NOW }), true)
})

test('filtro por loja e por palavra (sem acento, todas as palavras, título ou descrição)', () => {
  const list = [
    promo(1, 'A', 10, { title: 'Promoção de Ação' }),
    promo(2, 'B', 10, { title: 'Tênis', description: 'Coleção ação verão' }),
    promo(3, 'C', 10, { title: 'Ação só no título' }),
  ]
  const ids = (opts) => selector.select(list, { now: NOW, limit: 9, ...opts }).map((p) => p.promotionId).sort()
  assert.deepEqual(ids({ keyword: 'ACAO' }), ['1', '2', '3'])
  assert.deepEqual(ids({ keyword: 'acao verao' }), ['2'])
  assert.deepEqual(ids({ storeIds: ['A', 'C'] }), ['1', '3'])
})

test('empate de validade: desempate pelo hash do número, determinístico', () => {
  const list = Array.from({ length: 12 }, (_, i) => promo(5000 + i, '108626', 10, { title: `Produto ${i}`, url: `https://www.arno.com.br/p${i}/p` }))
  const first = selector.select(list, { now: NOW, limit: 3 }).map((p) => p.promotionId)
  assert.deepEqual(first, selector.select([...list].reverse(), { now: NOW, limit: 3 }).map((p) => p.promotionId))
  assert.notDeepEqual(first, ['5000', '5001', '5002'])
})

test('outra origem com outros campos e prefixo: mesma escolha, id com o prefixo dela', () => {
  const list = [...ARNO, promo(1, '17648', 5, { url: 'https://www.cea.com.br/x' }), promo(2, '17648', 20, { status: 'expired' })]
  const awinPick = selector.select(list, { now: NOW, limit: 9 }).map((p) => p.promotionId)
  const otherPick = other.select(list.map(asOther), { now: NOW, limit: 9 }).map((p) => p.code)
  assert.deepEqual(otherPick, awinPick)
  assert.ok(other.itemId(asOther(ARNO[0])).startsWith('outra:c:108626:u:'))
  assert.equal(other.legacyItemId(asOther(ARNO[0])), 'outra:4118874')
  assert.throws(() => createPromotionSelector({}), /prefix/)
})

test('validade no horário de Brasília', () => {
  assert.equal(formatPromotionValidity('2026-09-30T02:59:00Z'), 'Válida até 29/09 às 23:59')
  assert.equal(formatPromotionValidity(null), '')
})
