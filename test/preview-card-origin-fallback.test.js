import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'

import { shouldUseOriginPhotoFallback } from '../src/core/previewImageFallbackPolicy.js'

const botWorkerSource = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

// RCA 2026-08-19/21: o card de preview clicável tinha UMA fonte de foto só —
// raspar a página da loja. Com o Mercado Livre barrando o IP do servidor, todo
// link de produto direto saía sem foto, o card era descartado inteiro e a
// oferta virava TEXTO PURO (perdendo a foto E o clique que abre a loja). A
// cascata usa a foto da própria mensagem de origem como plano B.

test('a cascata vem ligada por padrão (sem ela, o modo preview continua quebrado)', () => {
  assert.equal(shouldUseOriginPhotoFallback({}), true)
})

test('escape hatch desliga sem redeploy', () => {
  for (const valor of ['off', 'OFF', 'false', '0', 'no']) {
    assert.equal(shouldUseOriginPhotoFallback({ PREVIEW_CARD_ORIGIN_FALLBACK: valor }), false, valor)
  }
})

test('valor desconhecido não desliga por engano (fail-safe: manter a foto)', () => {
  assert.equal(shouldUseOriginPhotoFallback({ PREVIEW_CARD_ORIGIN_FALLBACK: 'talvez' }), true)
})

// Guardas estruturais: a ordem e o escopo da cascata são a parte que não pode
// regredir, e testá-los de verdade exigiria um socket WhatsApp.

test('a foto da LOJA continua sendo a primeira escolha — a cascata só roda sem jpegThumbnail', () => {
  assert.match(
    botWorkerSource,
    // `allowSmallOriginPhoto` (hotfix 2026-08-26) força a cascata no caminho em
    // que a oferta ia sair como texto pelado; a condição que importa aqui —
    // rodar SÓ quando a loja não entregou foto — continua intacta.
    /if \(!jpegThumbnail && !useCouponBrandCard && typeof fetchOriginPhoto === 'function' && \(allowSmallOriginPhoto \|\| shouldUseOriginPhotoFallback\(\)\)\)/,
    'a cascata precisa ser condicionada a NÃO haver thumbnail da loja (senão rebaixaria toda oferta para a foto do concorrente)',
  )
})

test('a cascata não rouba o lugar do banner de cupom (link de campanha não tem produto)', () => {
  const trecho = botWorkerSource.slice(botWorkerSource.indexOf('PLANO B EM CASCATA'))
  assert.ok(trecho.includes('!useCouponBrandCard'), 'cupom com banner já resolvido não pode cair na cascata')
})

test('o plano B tem sinal PRÓPRIO — não pode ser contado como oferta sem foto', () => {
  assert.match(botWorkerSource, /recordOperationalSignal\('preview_card_origin_fallback'/)
  const analytics = readFileSync(new URL('../src/analytics.js', import.meta.url), 'utf8')
  const signals = readFileSync(new URL('../src/observability/operationalSignals.js', import.meta.url), 'utf8')
  assert.ok(analytics.includes("'ops_preview_card_origin_fallback'"), 'evento precisa estar na allowlist de src/analytics.js')
  assert.ok(signals.includes("preview_card_origin_fallback: 'ops_preview_card_origin_fallback'"), 'sinal precisa estar mapeado em operationalSignals.js')
})

test('a mídia de origem é baixada UMA VEZ por mensagem, não uma vez por destino', () => {
  assert.match(botWorkerSource, /async function getOriginalPhotoOnce\(\)/, 'memo precisa existir (buildPayload roda por destino)')
  assert.match(botWorkerSource, /fetchOriginPhoto: getOriginalPhotoOnce/, 'o call site precisa passar o memo, não o download cru')
})
