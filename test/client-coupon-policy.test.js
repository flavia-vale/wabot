import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  chooseCoupon,
  renderCouponText,
  applyCouponToken,
  parseOfferPriceToCents,
  formatBrl,
} from '../src/core/clientCouponPolicy.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NOW = Date.parse('2026-09-19T12:00:00.000Z')

function coupon(overrides = {}) {
  return {
    id: 'c1',
    code: 'CODE',
    platform: 'shopee',
    discountType: 'percent',
    discountValue: 10,
    enabled: true,
    validUntil: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

// ---- Guarda estrutural do módulo (SC-007) ----

test('guarda estrutural: não importa db/Prisma/fetch/Redis/Baileys/dashboard, nenhuma função async, sem Date.now()', () => {
  const fullSource = readFileSync(join(__dirname, '../src/core/clientCouponPolicy.js'), 'utf8')
  // Remove linhas de comentário (// ...) antes de checar imports/chamadas —
  // o próprio cabeçalho do módulo CITA essas palavras em prosa (explicando a
  // proibição), o que faria a varredura ingênua acusar a si mesma.
  const source = fullSource.replace(/^\s*\/\/.*$/gm, '')
  const importLines = fullSource.split('\n').filter((line) => /^\s*import\b/.test(line)).join('\n')
  assert.doesNotMatch(importLines, /\/db\.js['"]/, 'não pode importar db.js')
  assert.doesNotMatch(importLines, /@prisma\/client/, 'não pode importar Prisma')
  assert.doesNotMatch(importLines, /ioredis/i, 'não pode importar Redis')
  assert.doesNotMatch(importLines, /baileys/i, 'não pode importar Baileys')
  assert.doesNotMatch(importLines, /dashboard\//, 'não pode importar nada de dashboard/')
  assert.doesNotMatch(source, /\bfetch\(/, 'não pode chamar fetch')
  assert.doesNotMatch(source, /export\s+async\s+function/, 'nenhuma função exportada pode ser async')
  assert.doesNotMatch(source, /Date\.now\(\)/, 'não pode ler Date.now() internamente — o instante entra por parâmetro')
})

// ---- chooseCoupon ----

test('chooseCoupon: comparação percentual x fixo — R$ 300 escolhe 10% (economiza mais que R$20)', () => {
  const coupons = [
    coupon({ id: 'pct', discountType: 'percent', discountValue: 10, createdAt: '2026-09-01T00:00:00.000Z' }),
    coupon({ id: 'amt', discountType: 'amount', discountValue: 2000, createdAt: '2026-09-05T00:00:00.000Z' }),
  ]
  const result = chooseCoupon({ coupons, platform: 'shopee', priceCents: 30000, now: NOW })
  assert.equal(result.coupon.id, 'pct')
  assert.equal(result.savingsCents, 3000)
  assert.equal(result.finalPriceCents, 27000)
})

test('chooseCoupon: comparação percentual x fixo — R$ 100 escolhe R$20 (economiza mais que 10%)', () => {
  const coupons = [
    coupon({ id: 'pct', discountType: 'percent', discountValue: 10, createdAt: '2026-09-01T00:00:00.000Z' }),
    coupon({ id: 'amt', discountType: 'amount', discountValue: 2000, createdAt: '2026-09-05T00:00:00.000Z' }),
  ]
  const result = chooseCoupon({ coupons, platform: 'shopee', priceCents: 10000, now: NOW })
  assert.equal(result.coupon.id, 'amt')
  assert.equal(result.savingsCents, 2000)
  assert.equal(result.finalPriceCents, 8000)
})

test('chooseCoupon: empate resolvido pelo createdAt mais recente', () => {
  const coupons = [
    coupon({ id: 'old', discountType: 'amount', discountValue: 1000, createdAt: '2026-09-01T00:00:00.000Z' }),
    coupon({ id: 'new', discountType: 'amount', discountValue: 1000, createdAt: '2026-09-10T00:00:00.000Z' }),
  ]
  const result = chooseCoupon({ coupons, platform: 'shopee', priceCents: 10000, now: NOW })
  assert.equal(result.coupon.id, 'new')
})

test('chooseCoupon: cupom vencido é ignorado', () => {
  const coupons = [coupon({ validUntil: '2026-01-01T00:00:00.000Z' })]
  const result = chooseCoupon({ coupons, platform: 'shopee', priceCents: 10000, now: NOW })
  assert.equal(result, null)
})

test('chooseCoupon: cupom com validade futura vale', () => {
  const coupons = [coupon({ validUntil: '2027-01-01T00:00:00.000Z' })]
  const result = chooseCoupon({ coupons, platform: 'shopee', priceCents: 10000, now: NOW })
  assert.ok(result)
  assert.equal(result.coupon.id, 'c1')
})

test('chooseCoupon: cupom desligado é ignorado', () => {
  const coupons = [coupon({ enabled: false })]
  const result = chooseCoupon({ coupons, platform: 'shopee', priceCents: 10000, now: NOW })
  assert.equal(result, null)
})

test('chooseCoupon: loja diferente é ignorada', () => {
  const coupons = [coupon({ platform: 'amazon' })]
  const result = chooseCoupon({ coupons, platform: 'shopee', priceCents: 10000, now: NOW })
  assert.equal(result, null)
})

test('chooseCoupon: loja desconhecida devolve null', () => {
  const coupons = [coupon({ platform: 'shopee' })]
  const result = chooseCoupon({ coupons, platform: 'loja_que_nao_existe', priceCents: 10000, now: NOW })
  assert.equal(result, null)
})

test('chooseCoupon: preço ausente cai na ordem fixa — maior percent primeiro', () => {
  const coupons = [
    coupon({ id: 'amt-alto', discountType: 'amount', discountValue: 99999, createdAt: '2026-09-01T00:00:00.000Z' }),
    coupon({ id: 'pct-baixo', discountType: 'percent', discountValue: 5, createdAt: '2026-09-01T00:00:00.000Z' }),
  ]
  const result = chooseCoupon({ coupons, platform: 'shopee', priceCents: null, now: NOW })
  assert.equal(result.coupon.id, 'pct-baixo')
  assert.equal(result.savingsCents, null)
})

test('chooseCoupon: sem percent, ordem fixa cai para maior amount', () => {
  const coupons = [
    coupon({ id: 'amt-baixo', discountType: 'amount', discountValue: 1000, createdAt: '2026-09-01T00:00:00.000Z' }),
    coupon({ id: 'amt-alto', discountType: 'amount', discountValue: 5000, createdAt: '2026-09-01T00:00:00.000Z' }),
  ]
  const result = chooseCoupon({ coupons, platform: 'shopee', priceCents: 0, now: NOW })
  assert.equal(result.coupon.id, 'amt-alto')
})

test('chooseCoupon: sem percent nem amount diferentes, cai pra createdAt mais recente', () => {
  const coupons = [
    coupon({ id: 'a', discountType: 'amount', discountValue: 1000, createdAt: '2026-09-01T00:00:00.000Z' }),
    coupon({ id: 'b', discountType: 'amount', discountValue: 1000, createdAt: '2026-09-15T00:00:00.000Z' }),
  ]
  const result = chooseCoupon({ coupons, platform: 'shopee', priceCents: NaN, now: NOW })
  assert.equal(result.coupon.id, 'b')
})

test('chooseCoupon: teto do valor em reais (FR-009) — amount maior que o preço não pode economizar mais que o preço', () => {
  const coupons = [coupon({ discountType: 'amount', discountValue: 100000 })]
  const result = chooseCoupon({ coupons, platform: 'shopee', priceCents: 5000, now: NOW })
  assert.equal(result.savingsCents, 5000)
  assert.equal(result.finalPriceCents, null) // preço final <= 0 vira null (FR-018c)
})

test('chooseCoupon: finalPriceCents nulo quando desconto >= preço (percent 100%)', () => {
  const coupons = [coupon({ discountType: 'percent', discountValue: 100 })]
  const result = chooseCoupon({ coupons, platform: 'shopee', priceCents: 5000, now: NOW })
  assert.equal(result.finalPriceCents, null)
})

test('chooseCoupon: arredondamento de centavo (33% de R$ 19,99)', () => {
  const coupons = [coupon({ discountType: 'percent', discountValue: 33 })]
  const result = chooseCoupon({ coupons, platform: 'shopee', priceCents: 1999, now: NOW })
  // 1999 * 33 / 100 = 659.67 -> arredonda para 660
  assert.equal(result.savingsCents, 660)
  assert.equal(result.finalPriceCents, 1339)
})

test('chooseCoupon: entrada malformada não lança — coupons não é array', () => {
  assert.doesNotThrow(() => chooseCoupon({ coupons: 'nao-e-array', platform: 'shopee', priceCents: 1000, now: NOW }))
  assert.equal(chooseCoupon({ coupons: 'nao-e-array', platform: 'shopee', priceCents: 1000, now: NOW }), null)
})

test('chooseCoupon: entrada malformada não lança — cupom sem discountType, valor não numérico', () => {
  const coupons = [
    { id: 'sem-tipo', platform: 'shopee', enabled: true, discountValue: 10 },
    { id: 'valor-invalido', platform: 'shopee', enabled: true, discountType: 'percent', discountValue: 'dez' },
    null,
    undefined,
    'string-solta',
    coupon({ id: 'valido', discountValue: 15 }),
  ]
  const result = chooseCoupon({ coupons, platform: 'shopee', priceCents: 10000, now: NOW })
  assert.ok(result)
  assert.equal(result.coupon.id, 'valido')
})

test('chooseCoupon: lista vazia devolve null', () => {
  assert.equal(chooseCoupon({ coupons: [], platform: 'shopee', priceCents: 10000, now: NOW }), null)
})

// ---- formatBrl ----

test('formatBrl formata em reais com vírgula decimal', () => {
  assert.equal(formatBrl(30000), 'R$ 300,00')
  assert.equal(formatBrl(0), 'R$ 0,00')
})

// ---- renderCouponText ----

test('renderCouponText: preço e final conhecidos traz "com o cupom"', () => {
  const text = renderCouponText({ coupon: coupon({ code: 'BEMVINDO10' }), priceCents: 30000, finalPriceCents: 27000 })
  assert.match(text, /com o cupom/)
  assert.match(text, /BEMVINDO10/)
  assert.match(text, /R\$\D?300,00/)
  assert.match(text, /R\$\D?270,00/)
})

test('renderCouponText: sem final confiável, cupom percent', () => {
  const text = renderCouponText({ coupon: coupon({ code: 'BEMVINDO10', discountType: 'percent', discountValue: 10 }), priceCents: null, finalPriceCents: null })
  assert.equal(text, '🎟️ Use o cupom BEMVINDO10 (10% OFF)')
})

test('renderCouponText: sem final confiável, cupom amount', () => {
  const text = renderCouponText({ coupon: coupon({ code: 'TOP50', discountType: 'amount', discountValue: 5000 }), priceCents: null, finalPriceCents: null })
  assert.match(text, /TOP50/)
  assert.match(text, /OFF/)
  assert.match(text, /R\$\D?50,00/)
})

test('renderCouponText: cupom nulo devolve string vazia', () => {
  assert.equal(renderCouponText({ coupon: null }), '')
})

// ---- applyCouponToken ----

test('applyCouponToken: substitui token único', () => {
  const result = applyCouponToken('Oferta!\n{cupom}\nCompre já', '🎟️ Use o cupom X')
  assert.match(result, /🎟️ Use o cupom X/)
  assert.doesNotMatch(result, /\{cupom\}/)
})

test('applyCouponToken: token repetido substituído em todas as posições', () => {
  const result = applyCouponToken('{cupom} e de novo {cupom}', 'CUPOM-X')
  const matches = result.match(/CUPOM-X/g) || []
  assert.equal(matches.length, 2)
})

test('applyCouponToken: sem cupom aplicável não deixa lacuna/emoji solto/asterisco órfão', () => {
  const result = applyCouponToken('Título\n{cupom}\nRodapé', '')
  assert.doesNotMatch(result, /\{cupom\}/)
  assert.doesNotMatch(result, /\n{3,}/)
  assert.equal(result, 'Título\nRodapé')
})

test('applyCouponToken: texto sem token nenhum não é afetado', () => {
  const result = applyCouponToken('Texto qualquer sem token', 'algo')
  assert.equal(result, 'Texto qualquer sem token')
})

// ---- parseOfferPriceToCents ----

test('parseOfferPriceToCents: converte "R$ 1.299,90"', () => {
  assert.equal(parseOfferPriceToCents('R$ 1.299,90'), 129990)
})

test('parseOfferPriceToCents: vazio devolve null', () => {
  assert.equal(parseOfferPriceToCents(''), null)
  assert.equal(parseOfferPriceToCents(null), null)
  assert.equal(parseOfferPriceToCents(undefined), null)
})

test('parseOfferPriceToCents: faixa de preço devolve null', () => {
  assert.equal(parseOfferPriceToCents('R$ 50,00 a R$ 100,00'), null)
})

test('parseOfferPriceToCents: "a partir de" devolve null', () => {
  assert.equal(parseOfferPriceToCents('A partir de R$ 29,90'), null)
})

test('parseOfferPriceToCents: número <= 0 devolve null', () => {
  assert.equal(parseOfferPriceToCents('R$ 0,00'), null)
})
