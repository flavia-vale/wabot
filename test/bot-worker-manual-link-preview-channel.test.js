import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { buildEntitledGroupConfig } from '../src/billing/groupEntitlements.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const botWorkerSource = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')

// RCA 2026-07 ("imagem preta em canal" no imageMode='preview'): buildManualLinkPreview
// subia o thumbnail HQ via prepareWAMessageMedia sem passar `jid`. O Baileys só troca
// para upload raw/plaintext (isJidNewsletter(options.jid)) quando `jid` é o destino —
// sem ele, o thumbnail HQ sempre subia criptografado, e canal (@newsletter) não decifra
// mídia: o card caía pro jpegThumbnail pequeno embutido (borrado/esticado na web) ou nem
// isso (branco no celular). Teste estrutural porque bot-worker.js roda como processo
// próprio e não expõe essas funções para import direto (mesmo padrão de
// bot-worker-retry-cache-wiring.test.js).
test('buildManualLinkPreview aceita destJid e repassa como jid pro upload da thumbnail HQ', () => {
  const fnStart = botWorkerSource.indexOf('async function buildManualLinkPreview(')
  assert.notEqual(fnStart, -1, 'buildManualLinkPreview não encontrada')

  const signatureEnd = botWorkerSource.indexOf(')', fnStart)
  const signature = botWorkerSource.slice(fnStart, signatureEnd)
  assert.match(signature, /\bdestJid\b/, 'assinatura de buildManualLinkPreview precisa aceitar destJid')

  const prepareCallStart = botWorkerSource.indexOf('await prepareWAMessageMedia(', fnStart)
  assert.notEqual(prepareCallStart, -1, 'chamada a prepareWAMessageMedia dentro de buildManualLinkPreview não encontrada')
  const prepareCallEnd = botWorkerSource.indexOf(')', prepareCallStart + 'await prepareWAMessageMedia('.length)
  const prepareCallBlock = botWorkerSource.slice(prepareCallStart, prepareCallEnd)

  assert.match(
    prepareCallBlock,
    /mediaTypeOverride:\s*'thumbnail-link'/,
    'chamada precisa continuar usando mediaTypeOverride thumbnail-link',
  )
  assert.match(
    prepareCallBlock,
    /jid:\s*destJid/,
    'sem jid:destJid, o Baileys nunca detecta canal e sempre sobe a thumbnail HQ criptografada',
  )
})

test('imageMode preview repassa destJid pro buildManualLinkPreview no call site', () => {
  const callSiteStart = botWorkerSource.indexOf("if (imageMode === 'preview')")
  assert.notEqual(callSiteStart, -1, "bloco imageMode === 'preview' não encontrado")

  const callStart = botWorkerSource.indexOf('await buildManualLinkPreview({', callSiteStart)
  assert.notEqual(callStart, -1, 'chamada a buildManualLinkPreview não encontrada no bloco preview')
  const callEnd = botWorkerSource.indexOf('})', callStart)
  const callBlock = botWorkerSource.slice(callStart, callEnd)

  assert.match(
    callBlock,
    /destJid/,
    'call site precisa passar destJid pro buildManualLinkPreview saber o destino real do envio',
  )
})

// specs/001-image-mode-preview-default (US1, AC1-AC3): qualquer que fosse o
// imageMode histórico do grupo ('fetch'/'none'/'preview'), a oferta espelhada
// sempre sai como card de preview clicável. bot-worker.js roda como processo
// próprio (mesma limitação estrutural documentada acima), então validamos o
// contrato em duas camadas: (1) o chokepoint em groupEntitlements.js entrega
// SEMPRE 'preview' no monitorGroup, para os três cenários; (2) o call site do
// bot-worker só toma o ramo de preview (`imageMode === 'preview'`) e o
// `getImage()` (fonte de fetch ativo) só retorna null para 'preview' porque
// 'preview' está no array de curto-circuito — provando que os três cenários
// caem no mesmo ramo de runtime, sem divergência de comportamento.
test('US1: grupo antes em "fetch" sai como preview (chokepoint força imageMode efetivo)', () => {
  const groups = [{ id: 'g1', role: 'monitor', waJid: 'fetch@g.us', kind: 'group', imageMode: 'fetch', imageLinkTarget: 'first', forwardMode: 'LINK_ONLY' }]
  const result = buildEntitledGroupConfig({ groups, groupTargets: [], planSubject: { plan: 'pro' } })
  assert.equal(result.groups.monitor[0].imageMode, 'preview')
})

test('US1: grupo antes em "none" sai como preview (chokepoint força imageMode efetivo)', () => {
  const groups = [{ id: 'g2', role: 'monitor', waJid: 'none@g.us', kind: 'group', imageMode: 'none', imageLinkTarget: 'first', forwardMode: 'LINK_ONLY' }]
  const result = buildEntitledGroupConfig({ groups, groupTargets: [], planSubject: { plan: 'pro' } })
  assert.equal(result.groups.monitor[0].imageMode, 'preview')
})

test('US1: grupo já em "preview" mantém comportamento idêntico (sem regressão)', () => {
  const groups = [{ id: 'g3', role: 'monitor', waJid: 'preview@g.us', kind: 'group', imageMode: 'preview', imageLinkTarget: 'first', forwardMode: 'LINK_ONLY' }]
  const result = buildEntitledGroupConfig({ groups, groupTargets: [], planSubject: { plan: 'pro' } })
  assert.equal(result.groups.monitor[0].imageMode, 'preview')
})

test('US1: getImage() no bot-worker retorna null (curto-circuito) para o imageMode efetivo preview', () => {
  // Prova estrutural de que, com o chokepoint sempre entregando 'preview',
  // o único ramo executável em runtime é o curto-circuito que pula o fetch
  // ativo de imagem — o restante da função (resolveMonitoredImage) fica
  // dormente (FR-006).
  const shortCircuitStart = botWorkerSource.indexOf("if (!monitorGroup || ['none', 'preview'].includes(monitorGroup.imageMode)) return null")
  assert.notEqual(shortCircuitStart, -1, 'curto-circuito de getImage() não encontrado — não remover FR-006')
})

test('US1: buildPayload só executa o ramo de link preview quando imageMode === preview', () => {
  const callSiteStart = botWorkerSource.indexOf("if (imageMode === 'preview')")
  assert.notEqual(callSiteStart, -1, "ramo imageMode === 'preview' precisa existir e ser o caminho de runtime único hoje")
})

// specs/008-coupon-brand-banner (T011) — blindagem crítica de não-regressão
// #1205/#1208: produto Amazon/ML compartilhado por short link (sem ASIN/MLB,
// texto sem sinal de cupom) precisa continuar montando o card com a FOTO do
// produto (fetchProductImage), nunca com o banner de marca — mesmo com
// COUPON_BRAND_CARD_ENABLED=true. bot-worker.js roda como processo próprio
// (não expõe buildManualLinkPreview para import direto — mesma limitação
// estrutural documentada acima), então a prova é por inspeção do wiring: (1)
// useCouponBrandCard é a ÚNICA porta de entrada do ramo do banner — não há
// nenhum outro caminho de código que monte o banner; (2) o ramo `else if
// (primary?.platform)` (fetch de imagem real via fetchProductImage) só roda
// quando useCouponBrandCard é false — exatamente o caso de produto por short
// link, cujo shouldUseCouponBrandCard() (test/coupon-brand-card-policy.test.js,
// caso CRÍTICO) devolve false por falta de couponTextSignal.
test('T011: ramo do banner é gated por useCouponBrandCard; produto real cai no fetch de foto (fetchProductImage), nunca no banner', () => {
  const fnStart = botWorkerSource.indexOf('async function buildManualLinkPreview(')
  assert.notEqual(fnStart, -1, 'buildManualLinkPreview não encontrada')
  const fnEnd = botWorkerSource.indexOf('\nfunction storePreviewTitle', fnStart)
  assert.notEqual(fnEnd, -1, 'fim de buildManualLinkPreview (storePreviewTitle) não encontrado')
  const fnBody = botWorkerSource.slice(fnStart, fnEnd)

  assert.match(
    fnBody,
    /const useCouponBrandCard = shouldUseCouponBrandCard\(\{[\s\S]*?\}\)/,
    'decisão do banner precisa vir exclusivamente de shouldUseCouponBrandCard',
  )
  assert.match(
    fnBody,
    /if \(useCouponBrandCard\) \{/,
    'ramo do banner precisa ser gated só por useCouponBrandCard',
  )
  assert.match(
    fnBody,
    /\} else if \(primary\?\.platform\) \{[\s\S]*?fetchProductImage\(/,
    'quando useCouponBrandCard é false, precisa cair no fetch da foto real do produto (fetchProductImage)',
  )
})

test('T011: couponTextSignal é calculado no call site a partir de isCouponMsg / warning de vitrine ML, sem detector novo', () => {
  const callSiteStart = botWorkerSource.indexOf("if (imageMode === 'preview')")
  assert.notEqual(callSiteStart, -1, "bloco imageMode === 'preview' não encontrado")
  const callStart = botWorkerSource.indexOf('await buildManualLinkPreview({', callSiteStart)
  const preamble = botWorkerSource.slice(callSiteStart, callStart)

  assert.match(
    preamble,
    /const couponTextSignal = isCouponMsg \|\| primary\?\.warning === 'ml_vitrine_fallback_used'/,
    'couponTextSignal precisa reusar isCouponMsg e o warning ml_vitrine_fallback_used, sem criar detector novo',
  )

  const callEnd = botWorkerSource.indexOf('})', callStart)
  const callBlock = botWorkerSource.slice(callStart, callEnd)
  assert.match(callBlock, /couponTextSignal/, 'call site precisa passar couponTextSignal pro buildManualLinkPreview')
})
