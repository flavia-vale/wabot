import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldUseCouponBrandCard } from '../src/converters/couponBrandCardPolicy.js'
import { buildStoreBrandCardImage } from '../src/converters/storeBrandCard.js'
import { decideSkipActiveFetchForCoupon } from '../src/monitoredImageResolver.js'

const SUPPORTED_PLATFORMS = ['amazon', 'shopee', 'mercadolivre', 'magazineluiza', 'shein']

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

// REGRESSÃO (2026-07): produto Ryzen com "CUPOM: PRESENTE" por short link ML
// (mercadolivre.com/sec/XXXX) saiu com o banner "CUPOM Mercado Livre" no lugar
// da foto. Causa: o sinal de texto do banner usava isCouponMsg cru, que dispara
// para QUALQUER produto que só carrega um código de cupom. O fix passou a
// derivar o couponTextSignal de couponSkipActiveFetch (decideSkipActiveFetchForCoupon):
// quando o título raspado bate com o caption (titleOverlap='match'), é produto →
// skip=false → couponTextSignal=false → SEM banner (foto do produto).
test('shouldUseCouponBrandCard: CRÍTICO — produto + código de cupom por short link (titleOverlap=match) NÃO recebe banner', () => {
  // Passo 1: a estratégia de imagem reconhece que é produto (título bate).
  const couponSkipActiveFetch = decideSkipActiveFetchForCoupon({
    isCouponMsg: true, // "...Ryzen 5 5500... CUPOM: PRESENTE" casa isCouponAnnouncement
    hasProductLink: true, // mercadolivre.com/sec/1Psi79H
    titleOverlap: 'match', // og:title raspado ("Processador Ryzen...") bate com o caption
    looksGeneric: false, // não é cupom store-wide
  })
  assert.equal(couponSkipActiveFetch, false, 'produto + cupom não deve pular o fetch da foto')

  // Passo 2: o sinal de texto do banner deriva de couponSkipActiveFetch (fix).
  const couponTextSignal = couponSkipActiveFetch || false /* sem warning de vitrine ML */
  assert.equal(
    shouldUseCouponBrandCard({
      enabled: true,
      platform: 'mercadolivre',
      linkKind: 'coupon', // short link /sec/ esconde o MLB
      couponTextSignal,
      resolvedUrl: 'https://mercadolivre.com/sec/1Psi79H',
    }),
    false,
    'produto por short link com código de cupom deve sair com FOTO, nunca com banner',
  )
})

// Contraprova: cupom GENÉRICO store-wide (link resolve p/ produto aleatório) —
// aí o banner É o certo, e o sinal derivado continua verdadeiro.
test('shouldUseCouponBrandCard: cupom genérico store-wide (skip=true) mantém o banner', () => {
  const couponSkipActiveFetch = decideSkipActiveFetchForCoupon({
    isCouponMsg: true,
    hasProductLink: true,
    titleOverlap: 'unknown', // short link de cupom não resolve og:title
    looksGeneric: true, // "em compras a partir de", "qualquer produto", etc.
  })
  assert.equal(couponSkipActiveFetch, true)
  assert.equal(
    shouldUseCouponBrandCard({
      enabled: true,
      platform: 'mercadolivre',
      linkKind: 'coupon',
      couponTextSignal: couponSkipActiveFetch,
      resolvedUrl: 'https://mercadolivre.com/sec/cupomGenerico',
    }),
    true,
  )
})

// specs/012-shein-store-support (US4/T045): cupom/campanha da SHEIN aciona o
// mesmo tratamento visual das outras lojas, sem depender de COUPON_LINK_CONVERT
// (que governa só a conversão do link — já coberto por INV-6 em
// converters-shein.test.js — não o banner, que tem seu próprio gate
// COUPON_BRAND_CARD_ENABLED, independente).
test('shouldUseCouponBrandCard: banner "CUPOM SHEIN" acionado sem COUPON_LINK_CONVERT setado', () => {
  const previous = process.env.COUPON_LINK_CONVERT
  delete process.env.COUPON_LINK_CONVERT
  try {
    assert.equal(
      shouldUseCouponBrandCard({
        enabled: true,
        platform: 'shein',
        linkKind: 'coupon',
        couponTextSignal: true,
        resolvedUrl: 'https://m.shein.com/br/ark/default?scene=1&campaign=summer',
      }),
      true,
    )
  } finally {
    if (previous !== undefined) process.env.COUPON_LINK_CONVERT = previous
  }
})

test('shouldUseCouponBrandCard: reusa BRAND_STYLES.shein (preto/branco) para o banner de cupom', async () => {
  const banner = await buildStoreBrandCardImage('shein')
  assert.ok(banner?.length)
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
