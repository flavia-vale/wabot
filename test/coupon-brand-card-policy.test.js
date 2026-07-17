import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldUseCouponBrandCard } from '../src/converters/couponBrandCardPolicy.js'
import { buildStoreBrandCardImage } from '../src/converters/storeBrandCard.js'

const SUPPORTED_PLATFORMS = ['amazon', 'shopee', 'mercadolivre', 'magazineluiza']

// US1 (T005) — cupom de loja suportada, com sinal de texto e URL sem ID de
// produto: banner precisa aparecer para as 4 lojas (FR-001/FR-002/FR-007).
test('shouldUseCouponBrandCard: cupom de loja suportada com sinal de texto e URL sem ID retorna true', () => {
  for (const platform of SUPPORTED_PLATFORMS) {
    assert.equal(
      shouldUseCouponBrandCard({
        enabled: true,
        platform,
        linkKind: 'coupon',
        couponTextSignal: true,
        resolvedUrl: `https://exemplo-cupom.${platform}.com.br/promo`,
      }),
      true,
      `${platform} deveria receber o banner de cupom`,
    )
  }
})

// US2 (T007) — vitrine ML: mesmo gate, sinal de texto vindo do warning
// ml_vitrine_fallback_used (não de isCouponAnnouncement).
test('shouldUseCouponBrandCard: vitrine ML (sinal via ml_vitrine_fallback_used) retorna true', () => {
  assert.equal(
    shouldUseCouponBrandCard({
      enabled: true,
      platform: 'mercadolivre',
      linkKind: 'coupon',
      couponTextSignal: true, // isCouponMsg || warning === 'ml_vitrine_fallback_used'
      resolvedUrl: 'https://www.mercadolivre.com.br/ofertas',
    }),
    true,
  )
})

test('shouldUseCouponBrandCard: banner de cupom e de vitrine ML usam a MESMA imagem (sem variação visual)', async () => {
  const cupomDecision = shouldUseCouponBrandCard({
    enabled: true,
    platform: 'mercadolivre',
    linkKind: 'coupon',
    couponTextSignal: true,
    resolvedUrl: 'https://www.mercadolivre.com.br/cupons',
  })
  const vitrineDecision = shouldUseCouponBrandCard({
    enabled: true,
    platform: 'mercadolivre',
    linkKind: 'coupon',
    couponTextSignal: true,
    resolvedUrl: 'https://www.mercadolivre.com.br/ofertas',
  })
  assert.equal(cupomDecision, true)
  assert.equal(vitrineDecision, true)
  const cupomBanner = await buildStoreBrandCardImage('mercadolivre')
  const vitrineBanner = await buildStoreBrandCardImage('mercadolivre')
  assert.equal(cupomBanner, vitrineBanner, 'mesma chamada de buildStoreBrandCardImage — sem visual diferente entre cupom e vitrine')
})

// US3 (T010) — blindagem crítica de não-regressão #1205/#1208.
test('shouldUseCouponBrandCard: CRÍTICO — produto Amazon/ML por short link (linkKind=coupon mas sem sinal de texto) retorna false', () => {
  // amzn.to/meli.la não resolvidos: sem ASIN/MLB na URL, resolveLinkKind
  // classifica como 'coupon', mas o texto NÃO confirma cupom — produto real.
  assert.equal(
    shouldUseCouponBrandCard({
      enabled: true,
      platform: 'amazon',
      linkKind: 'coupon',
      couponTextSignal: false,
      resolvedUrl: 'https://amzn.to/4gipdUe',
    }),
    false,
  )
  assert.equal(
    shouldUseCouponBrandCard({
      enabled: true,
      platform: 'mercadolivre',
      linkKind: 'coupon',
      couponTextSignal: false,
      resolvedUrl: 'https://meli.la/1fyQi7e',
    }),
    false,
  )
})

test('shouldUseCouponBrandCard: CRÍTICO — URL com ASIN ou MLB é sempre tratada como produto, mesmo com sinal de texto', () => {
  assert.equal(
    shouldUseCouponBrandCard({
      enabled: true,
      platform: 'amazon',
      linkKind: 'coupon',
      couponTextSignal: true,
      resolvedUrl: 'https://www.amazon.com.br/dp/B09VQ39F41',
    }),
    false,
  )
  assert.equal(
    shouldUseCouponBrandCard({
      enabled: true,
      platform: 'mercadolivre',
      linkKind: 'coupon',
      couponTextSignal: true,
      resolvedUrl: 'https://produto.mercadolivre.com.br/MLB4060932335-x',
    }),
    false,
  )
})

test('shouldUseCouponBrandCard: linkKind diferente de coupon retorna false', () => {
  assert.equal(
    shouldUseCouponBrandCard({
      enabled: true,
      platform: 'amazon',
      linkKind: 'product',
      couponTextSignal: true,
      resolvedUrl: 'https://amzn.to/x',
    }),
    false,
  )
})

test('shouldUseCouponBrandCard: plataforma não suportada pelo banner retorna false', () => {
  assert.equal(
    shouldUseCouponBrandCard({
      enabled: true,
      platform: 'aliexpress',
      linkKind: 'coupon',
      couponTextSignal: true,
      resolvedUrl: 'https://aliexpress.com/promo',
    }),
    false,
  )
})

// T015 — edge case FR-005: feature desligada sempre vence, mesmo com as
// demais condições verdadeiras.
test('shouldUseCouponBrandCard: enabled=false (ou qualquer valor != true) retorna sempre false', () => {
  const baseTrueConditions = {
    platform: 'amazon',
    linkKind: 'coupon',
    couponTextSignal: true,
    resolvedUrl: 'https://amazon.com.br/promo-sem-asin',
  }
  assert.equal(shouldUseCouponBrandCard({ ...baseTrueConditions, enabled: false }), false)
  assert.equal(shouldUseCouponBrandCard({ ...baseTrueConditions, enabled: undefined }), false)
  assert.equal(shouldUseCouponBrandCard({ ...baseTrueConditions, enabled: 'true' }), false, 'precisa ser boolean true, não string')
})

test('shouldUseCouponBrandCard: entradas ausentes/undefined nunca lançam, sempre retornam false', () => {
  assert.equal(shouldUseCouponBrandCard(), false)
  assert.equal(shouldUseCouponBrandCard({}), false)
  assert.equal(shouldUseCouponBrandCard({ enabled: true }), false)
})
