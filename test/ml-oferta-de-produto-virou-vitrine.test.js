import { test } from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolveToCleanProductUrl, convert, clearMercadoLivreAffiliateCooldownsForTest } from '../src/converters/mercadolivre.js'
import { decideVitrineFallback } from '../src/converters/mlVitrinePolicy.js'
import { resolveCouponTextSignal, shouldUseCouponBrandCard } from '../src/converters/couponBrandCardPolicy.js'

// RCA 2026-09-18 — "oferta de PRODUTO saiu com banner de CUPOM e link da vitrine".
//
// Medição de produção que originou esta suíte:
//   - 5.422 leituras do card destacado deram certo; 773 falharam;
//   - das 773: 242 eram /lists (sem produto, correto), 531 eram páginas que
//     RESPONDERAM e vieram sem o card, e ZERO perderam o `?ref=`;
//   - 17 de 20 dos MESMOS links que falharam resolveram na 1ª tentativa
//     minutos depois, em ~1s → a falha é TEMPORÁRIA;
//   - mesmo assim o robô concluía "é vitrine", publicava a vitrine da cliente
//     no lugar do produto e ainda trocava a foto pelo banner "CUPOM".

const botWorkerSource = readFileSync(
  fileURLToPath(new URL('../src/bot-worker.js', import.meta.url)),
  'utf8',
)

function withCouponLinkConvertOn(t) {
  const prev = process.env.COUPON_LINK_CONVERT
  process.env.COUPON_LINK_CONVERT = 'true'
  t.after(() => {
    if (prev === undefined) delete process.env.COUPON_LINK_CONVERT
    else process.env.COUPON_LINK_CONVERT = prev
  })
}

const SHARE_COM_REF = 'https://www.mercadolivre.com.br/social/xetdaspromocoes?forceInApp=true&ref=BLOB123'
const HTML_SEM_CARD = '<html><body>Perfil do vendedor</body></html>'
const HTML_COM_CARD = `<html><body>card-featured {"polycards":[{"metadata":{"product_id":"MLB72905790"}}]}</body></html>`

// --- 1. A segunda leitura recupera a oferta (o conserto principal) ---

test('página que veio sem o produto é LIDA DE NOVO e a oferta é recuperada', async (t) => {
  let leituras = 0
  t.mock.method(axios, 'get', async () => {
    leituras += 1
    return { data: leituras === 1 ? HTML_SEM_CARD : HTML_COM_CARD }
  })
  const clean = await resolveToCleanProductUrl(SHARE_COM_REF)
  assert.equal(leituras, 2, 'precisa tentar uma segunda vez antes de desistir')
  assert.equal(clean, 'https://www.mercadolivre.com.br/p/MLB72905790')
})

test('produto achado na PRIMEIRA leitura não gasta uma segunda', async (t) => {
  let leituras = 0
  t.mock.method(axios, 'get', async () => {
    leituras += 1
    return { data: HTML_COM_CARD }
  })
  const clean = await resolveToCleanProductUrl(SHARE_COM_REF)
  assert.equal(leituras, 1)
  assert.equal(clean, 'https://www.mercadolivre.com.br/p/MLB72905790')
})

test('vitrine de verdade continua devolvendo null depois de reler (não vira produto inventado)', async (t) => {
  t.mock.method(axios, 'get', async () => ({ data: HTML_SEM_CARD }))
  const clean = await resolveToCleanProductUrl(SHARE_COM_REF)
  assert.equal(clean, null)
})

test('leitura que FALHOU não é repetida (orçamento da mensagem é finito)', async (t) => {
  let leituras = 0
  t.mock.method(axios, 'get', async () => {
    leituras += 1
    throw new Error('timeout of 8000ms exceeded')
  })
  const clean = await resolveToCleanProductUrl(SHARE_COM_REF)
  assert.equal(clean, null)
  assert.equal(leituras, 1, 'erro de rede já consumiu o tempo — insistir derruba a oferta por timeout')
})

// --- 2. Falha de leitura nunca troca o produto pela vitrine ---

test('decideVitrineFallback: leitura falhou → descarta, NUNCA usa a vitrine', () => {
  assert.equal(
    decideVitrineFallback({ failureType: 'unsupported_url', isDirectVitrine: false, hasVitrine: true, socialReadFailed: true }),
    'discard',
  )
  assert.equal(
    decideVitrineFallback({ failureType: 'expired', isDirectVitrine: true, hasVitrine: true, socialReadFailed: true }),
    'discard',
  )
})

test('decideVitrineFallback: sem falha de leitura, o comportamento histórico é preservado', () => {
  assert.equal(
    decideVitrineFallback({ failureType: 'unsupported_url', isDirectVitrine: true, hasVitrine: true }),
    'use_vitrine',
  )
  assert.equal(
    decideVitrineFallback({ failureType: 'unsupported_url', isDirectVitrine: true, hasVitrine: false }),
    'missing_vitrine',
  )
  assert.equal(
    decideVitrineFallback({ failureType: 'unsupported_url', isDirectVitrine: false, hasVitrine: false }),
    'discard',
  )
})

test('convert(): página ilegível NÃO publica a vitrine da cliente no lugar do produto', async (t) => {
  withCouponLinkConvertOn(t)
  clearMercadoLivreAffiliateCooldownsForTest()
  // resolve() do convertMlCouponWithoutProduct não pode bater na rede real.
  t.mock.method(global, 'fetch', async () => ({ url: SHARE_COM_REF }))
  t.mock.method(axios, 'get', async () => { throw new Error('socket hang up') })
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { status: 200, urls: [{ message: 'URL not allowed in affiliates program', error_code: 111, status: 200 }] },
    headers: {},
  }))
  const result = await convert(SHARE_COM_REF, {
    tag: '475630078',
    ssid: 'ssid-valido-1234567890',
    vitrineUrl: 'https://www.mercadolivre.com.br/social/minha-vitrine',
  })
  assert.equal(result, null, 'melhor não enviar do que enviar a oferta com o link errado')
})

test('convert(): vitrine LIDA e confirmada sem produto continua caindo na vitrine cadastrada', async (t) => {
  withCouponLinkConvertOn(t)
  clearMercadoLivreAffiliateCooldownsForTest()
  t.mock.method(global, 'fetch', async () => ({ url: SHARE_COM_REF }))
  t.mock.method(axios, 'get', async () => ({ data: HTML_SEM_CARD }))
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { status: 200, urls: [{ message: 'URL not allowed in affiliates program', error_code: 111, status: 200 }] },
    headers: {},
  }))
  const result = await convert(SHARE_COM_REF, {
    tag: '475630078',
    ssid: 'ssid-valido-1234567890',
    vitrineUrl: 'https://www.mercadolivre.com.br/social/minha-vitrine',
  })
  assert.equal(result?.url, 'https://www.mercadolivre.com.br/social/minha-vitrine')
  assert.equal(result?.warning, 'ml_vitrine_fallback_used')
})

// --- 3. Banner de cupom só com vitrine CONFIRMADA ---

test('banner NÃO dispara quando a vitrine veio de encurtador (o caso do perfume)', () => {
  const sinal = resolveCouponTextSignal({
    couponSkipActiveFetch: false,
    warning: 'ml_vitrine_fallback_used',
    vitrineConfirmed: false,
  })
  assert.equal(sinal, false)
  assert.equal(
    shouldUseCouponBrandCard({
      enabled: true,
      platform: 'mercadolivre',
      linkKind: 'coupon',
      couponTextSignal: sinal,
      resolvedUrl: 'https://meli.la/26dnpTx',
    }),
    false,
  )
})

test('banner dispara quando o link compartilhado JÁ era uma vitrine /social/', () => {
  assert.equal(
    resolveCouponTextSignal({
      couponSkipActiveFetch: false,
      warning: 'ml_vitrine_fallback_used',
      vitrineConfirmed: true,
    }),
    true,
  )
})

test('cupom reconhecido pelo TEXTO segue ligando o banner (não regride o caminho legítimo)', () => {
  assert.equal(
    resolveCouponTextSignal({ couponSkipActiveFetch: true, warning: null, vitrineConfirmed: false }),
    true,
  )
})

test('aviso desconhecido não liga o banner', () => {
  assert.equal(
    resolveCouponTextSignal({ couponSkipActiveFetch: false, warning: 'ml_ssid_expired', vitrineConfirmed: true }),
    false,
  )
  assert.equal(resolveCouponTextSignal(), false)
})

// --- 4. Guardas estruturais ---

test('bot-worker não volta a tratar falha de conversão como sinal de cupom', () => {
  assert.ok(
    !/couponSkipActiveFetch\s*\|\|\s*primary\?\.warning\s*===\s*'ml_vitrine_fallback_used'/.test(botWorkerSource),
    'o OR cru com ml_vitrine_fallback_used derruba as três blindagens de uma vez — usar resolveCouponTextSignal',
  )
  assert.ok(
    botWorkerSource.includes('resolveCouponTextSignal'),
    'o sinal de texto do banner precisa sair do módulo puro, num lugar só',
  )
})
