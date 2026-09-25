// Cupom por link, compra mínima e desconto máximo (specs/017, decisão da dona
// do produto em 2026-09-25).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import { couponsRoutes } from '../src/api/routes/coupons.js'
import { PATTERNS } from '../src/detector.js'
import {
  COUPON_LINK_DOMAINS,
  isStoreCouponLink,
  chooseCoupon,
  renderCouponText,
  describeCouponConditions,
} from '../src/core/clientCouponPolicy.js'

const NOW = Date.parse('2026-09-25T12:00:00.000Z')
const plain = (s) => String(s).replace(/ /g, ' ')

function coupon(overrides = {}) {
  return {
    id: 'c1',
    kind: 'code',
    code: 'CODE',
    redeemUrl: null,
    platform: 'shopee',
    discountType: 'percent',
    discountValue: 10,
    minPurchaseCents: null,
    maxDiscountCents: null,
    enabled: true,
    validUntil: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

// ---- Domínios do link de resgate ----

test('domínios do link de cupom são os mesmos que o detector reconhece para cada loja', () => {
  assert.deepEqual(Object.keys(COUPON_LINK_DOMAINS).sort(), Object.keys(PATTERNS).sort())
  for (const [platform, domains] of Object.entries(COUPON_LINK_DOMAINS)) {
    for (const domain of domains) {
      const url = `https://${domain}/cupom`
      PATTERNS[platform].lastIndex = 0
      assert.ok(PATTERNS[platform].test(url), `${domain} deveria ser da ${platform} no detector`)
    }
  }
})

test('link de cupom: aceita site e link curto da própria loja; recusa outro site, http e loja trocada', () => {
  assert.equal(isStoreCouponLink('https://shopee.com.br/m/cupom', 'shopee'), true)
  assert.equal(isStoreCouponLink('https://s.shopee.com.br/abc', 'shopee'), true)
  assert.equal(isStoreCouponLink('https://meli.la/xyz', 'mercadolivre'), true)
  assert.equal(isStoreCouponLink('https://amzn.to/xyz', 'amazon'), true)
  assert.equal(isStoreCouponLink('https://shopee.com.br.site-falso.com/x', 'shopee'), false)
  assert.equal(isStoreCouponLink('https://notshopee.com.br/x', 'shopee'), false)
  assert.equal(isStoreCouponLink('https://bit.ly/abc', 'shopee'), false)
  assert.equal(isStoreCouponLink('http://shopee.com.br/x', 'shopee'), false)
  assert.equal(isStoreCouponLink('https://user:pass@shopee.com.br/x', 'shopee'), false)
  assert.equal(isStoreCouponLink('https://shopee.com.br/x', 'amazon'), false)
  assert.equal(isStoreCouponLink('não é link', 'shopee'), false)
})

// ---- Compra mínima e desconto máximo na escolha ----

test('compra mínima: produto abaixo do mínimo não usa o cupom; acima usa', () => {
  const c = coupon({ minPurchaseCents: 7900 })
  assert.equal(chooseCoupon({ coupons: [c], platform: 'shopee', priceCents: 6000, now: NOW }), null)
  const ok = chooseCoupon({ coupons: [c], platform: 'shopee', priceCents: 15000, now: NOW })
  assert.equal(ok.savingsCents, 1500)
  assert.equal(ok.finalPriceCents, 13500)
})

test('compra mínima sem preço lido: usa o cupom e escreve a condição', () => {
  const c = coupon({ code: 'MIN79', minPurchaseCents: 7900 })
  const pick = chooseCoupon({ coupons: [c], platform: 'shopee', priceCents: null, now: NOW })
  assert.equal(pick.coupon.code, 'MIN79')
  const text = plain(renderCouponText({ coupon: pick.coupon, priceCents: null, finalPriceCents: null }))
  assert.equal(text, '🎟️ Use o cupom MIN79 (10% OFF, em compras acima de R$ 79,00)')
})

test('desconto máximo limita a economia do cupom de porcentagem e muda o vencedor', () => {
  const capped = coupon({ id: 'a', code: 'PCT10', maxDiscountCents: 2000 })
  const fixed = coupon({ id: 'b', code: 'FIX30', discountType: 'amount', discountValue: 3000 })
  // 10% de R$ 400 = R$ 40, mas o teto é R$ 20 → o fixo de R$ 30 ganha.
  const pick = chooseCoupon({ coupons: [capped, fixed], platform: 'shopee', priceCents: 40000, now: NOW })
  assert.equal(pick.coupon.code, 'FIX30')
  const alone = chooseCoupon({ coupons: [capped], platform: 'shopee', priceCents: 40000, now: NOW })
  assert.equal(alone.savingsCents, 2000)
  assert.equal(alone.finalPriceCents, 38000)
})

test('condições escritas: porcentagem com teto e mínimo; valor fixo ignora teto', () => {
  assert.equal(
    plain(describeCouponConditions(coupon({ maxDiscountCents: 2000, minPurchaseCents: 7900 }))),
    '10% OFF, até R$ 20,00, em compras acima de R$ 79,00',
  )
  assert.equal(
    plain(describeCouponConditions(coupon({ discountType: 'amount', discountValue: 9000, maxDiscountCents: 2000 }))),
    'R$ 90,00 OFF',
  )
})

// ---- Texto do cupom por link ----

test('cupom por link: com preço mostra quanto paga e o link; sem preço mostra condições e o link', () => {
  const c = coupon({ kind: 'link', code: '', redeemUrl: 'https://s.shopee.com.br/cupom10' })
  assert.equal(
    plain(renderCouponText({ coupon: c, priceCents: 15000, finalPriceCents: 13500 })),
    '🎟️ Resgate o cupom e pague *R$ 135,00* em vez de R$ 150,00 (10% OFF): https://s.shopee.com.br/cupom10',
  )
  assert.equal(
    plain(renderCouponText({ coupon: c, priceCents: null, finalPriceCents: null })),
    '🎟️ Resgate o cupom (10% OFF): https://s.shopee.com.br/cupom10',
  )
})

test('cupom por link com link de outro site nunca sai na mensagem nem é escolhido', () => {
  const bad = coupon({ kind: 'link', code: '', redeemUrl: 'https://bit.ly/golpe' })
  assert.equal(renderCouponText({ coupon: bad, priceCents: null, finalPriceCents: null }), '')
  assert.equal(chooseCoupon({ coupons: [bad], platform: 'shopee', priceCents: 10000, now: NOW }), null)
})

// ---- Rota de cadastro ----

let userCounter = 0
async function buildApp() {
  const n = ++userCounter
  const userId = `user-coupon-link-${n}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({
    data: { id: userId, name: `Link ${n}`, email: `coupon-link-${n}-${Date.now()}@coupon-link-test.local`, passwordHash: 'x', plan: 'pro' },
  })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(couponsRoutes, { prefix: '/api/coupons', reloadConfig: async () => true })
  return { app, userId }
}
async function cleanup(userId) {
  await db.clientCoupon.deleteMany({ where: { userId } })
  await db.user.deleteMany({ where: { id: userId } })
}
const linkPayload = (o = {}) => ({
  kind: 'link',
  redeemUrl: 'https://s.shopee.com.br/cupom10',
  platform: 'shopee',
  discountType: 'percent',
  discountValue: 10,
  ...o,
})

test('rota: cadastra cupom por link com mínimo e teto, sem precisar de código', async () => {
  const { app, userId } = await buildApp()
  try {
    const res = await app.inject({ method: 'POST', url: '/api/coupons', payload: linkPayload({ minPurchaseCents: 7900, maxDiscountCents: 2000 }) })
    assert.equal(res.statusCode, 201, res.body)
    const body = res.json()
    assert.equal(body.kind, 'link')
    assert.equal(body.redeemUrl, 'https://s.shopee.com.br/cupom10')
    assert.equal(body.minPurchaseCents, 7900)
    assert.equal(body.maxDiscountCents, 2000)

    const again = await app.inject({ method: 'POST', url: '/api/coupons', payload: linkPayload() })
    assert.equal(again.statusCode, 201)
    assert.equal(again.json().duplicateWarning, true)
  } finally {
    await app.close()
    await cleanup(userId)
  }
})

test('rota: link de outro site ou sem https é recusado com explicação simples', async () => {
  const { app, userId } = await buildApp()
  try {
    const other = await app.inject({ method: 'POST', url: '/api/coupons', payload: linkPayload({ redeemUrl: 'https://bit.ly/abc' }) })
    assert.equal(other.statusCode, 400)
    assert.equal(other.json().error, 'Este link não é da loja Shopee. Cole o link de resgate que a própria loja te deu.')

    const wrongStore = await app.inject({ method: 'POST', url: '/api/coupons', payload: linkPayload({ platform: 'amazon' }) })
    assert.equal(wrongStore.statusCode, 400)
    assert.match(wrongStore.json().error, /não é da loja Amazon/)

    const http = await app.inject({ method: 'POST', url: '/api/coupons', payload: linkPayload({ redeemUrl: 'http://shopee.com.br/x' }) })
    assert.equal(http.json().error, 'Cole o link completo do cupom, começando com https://.')

    const empty = await app.inject({ method: 'POST', url: '/api/coupons', payload: linkPayload({ redeemUrl: '' }) })
    assert.equal(empty.statusCode, 400)

    const kind = await app.inject({ method: 'POST', url: '/api/coupons', payload: linkPayload({ kind: 'qrcode' }) })
    assert.equal(kind.json().error, 'Escolha como o cupom é usado: com código ou por link.')
  } finally {
    await app.close()
    await cleanup(userId)
  }
})

test('rota: mínimo/teto inválidos recusados; teto some em desconto de valor fixo', async () => {
  const { app, userId } = await buildApp()
  try {
    const min = await app.inject({ method: 'POST', url: '/api/coupons', payload: linkPayload({ minPurchaseCents: -5 }) })
    assert.equal(min.json().error, 'A compra mínima precisa ser um valor maior que zero.')
    const max = await app.inject({ method: 'POST', url: '/api/coupons', payload: linkPayload({ maxDiscountCents: 'abc' }) })
    assert.equal(max.json().error, 'O desconto máximo precisa ser um valor maior que zero.')

    const fixed = await app.inject({
      method: 'POST',
      url: '/api/coupons',
      payload: { code: 'FIX', platform: 'shopee', discountType: 'amount', discountValue: 2000, maxDiscountCents: 500 },
    })
    assert.equal(fixed.statusCode, 201)
    assert.equal(fixed.json().kind, 'code')
    assert.equal(fixed.json().maxDiscountCents, null)
  } finally {
    await app.close()
    await cleanup(userId)
  }
})

test('rota: editar troca cupom de código para link e valida contra o cupom salvo', async () => {
  const { app, userId } = await buildApp()
  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/coupons',
      payload: { code: 'BEMVINDO', platform: 'shopee', discountType: 'percent', discountValue: 10 },
    })
    const id = created.json().id

    const noLink = await app.inject({ method: 'PUT', url: `/api/coupons/${id}`, payload: { kind: 'link' } })
    assert.equal(noLink.statusCode, 400)

    const toLink = await app.inject({ method: 'PUT', url: `/api/coupons/${id}`, payload: { kind: 'link', redeemUrl: 'https://s.shopee.com.br/x' } })
    assert.equal(toLink.statusCode, 200, toLink.body)
    assert.equal(toLink.json().kind, 'link')

    // Trocar só a loja: o link salvo (Shopee) deixa de valer para a Amazon.
    const storeOnly = await app.inject({ method: 'PUT', url: `/api/coupons/${id}`, payload: { platform: 'amazon' } })
    assert.equal(storeOnly.statusCode, 400)
    assert.match(storeOnly.json().error, /não é da loja Amazon/)

    const back = await app.inject({ method: 'PUT', url: `/api/coupons/${id}`, payload: { kind: 'code', code: 'VOLTEI', redeemUrl: '' } })
    assert.equal(back.statusCode, 200)
    assert.equal(back.json().code, 'VOLTEI')
    assert.equal(back.json().redeemUrl, null)
  } finally {
    await app.close()
    await cleanup(userId)
  }
})

// ---- Link opcional no cupom de código (2026-09-25) ----

test('cupom de código com link: linha a mais "Insira o código do cupom aqui"; sem link, só o código', () => {
  const withLink = coupon({ code: 'BEMVINDO10', redeemUrl: 'https://s.shopee.com.br/inserir' })
  assert.equal(
    plain(renderCouponText({ coupon: withLink, priceCents: 15000, finalPriceCents: 13500 })),
    '🎟️ Use o cupom BEMVINDO10 — de R$ 150,00 por *R$ 135,00* com o cupom (10% OFF)\nInsira o código do cupom aqui: https://s.shopee.com.br/inserir',
  )
  assert.equal(
    plain(renderCouponText({ coupon: coupon({ code: 'BEMVINDO10' }), priceCents: null, finalPriceCents: null })),
    '🎟️ Use o cupom BEMVINDO10 (10% OFF)',
  )
  // Link de outro site nunca sai: fica só o código.
  const bad = coupon({ code: 'BEMVINDO10', redeemUrl: 'https://bit.ly/golpe' })
  assert.equal(plain(renderCouponText({ coupon: bad, priceCents: null, finalPriceCents: null })), '🎟️ Use o cupom BEMVINDO10 (10% OFF)')
})

test('rota: cupom de código aceita link opcional da loja e recusa link de outro site', async () => {
  const { app, userId } = await buildApp()
  try {
    const base = { kind: 'code', code: 'BEMVINDO', platform: 'shopee', discountType: 'percent', discountValue: 10 }
    const noLink = await app.inject({ method: 'POST', url: '/api/coupons', payload: base })
    assert.equal(noLink.statusCode, 201)
    assert.equal(noLink.json().redeemUrl, null)

    const withLink = await app.inject({ method: 'POST', url: '/api/coupons', payload: { ...base, code: 'OUTRO', redeemUrl: 'https://s.shopee.com.br/inserir' } })
    assert.equal(withLink.statusCode, 201, withLink.body)
    assert.equal(withLink.json().kind, 'code')
    assert.equal(withLink.json().redeemUrl, 'https://s.shopee.com.br/inserir')

    const bad = await app.inject({ method: 'POST', url: '/api/coupons', payload: { ...base, redeemUrl: 'https://bit.ly/abc' } })
    assert.equal(bad.statusCode, 400)
    assert.match(bad.json().error, /não é da loja Shopee/)

    const cleared = await app.inject({ method: 'PUT', url: `/api/coupons/${withLink.json().id}`, payload: { redeemUrl: '' } })
    assert.equal(cleared.statusCode, 200)
    assert.equal(cleared.json().redeemUrl, null)
  } finally {
    await app.close()
    await cleanup(userId)
  }
})
