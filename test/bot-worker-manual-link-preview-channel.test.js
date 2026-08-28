import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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
  const callSiteStart = botWorkerSource.indexOf("if (imageMode === 'preview' && !channelForward)")
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

// 2026-08-28: o modo deixou de pertencer à origem e passou ao destino.
//
// Exceção (fix "Ver canal" não aparece em oferta automática): quando o
// destino tem `channelForward` (Group.channelButtonJid) configurado, o ramo
// de preview é pulado e getImage() busca imagem mesmo assim
// (forceOriginalForChannelButton) — só assim o botão nativo "Ver canal"
// (mídia-only, src/core/channelSend.js) tem um corpo de mídia pra anexar.
// Ver testes dedicados abaixo.
test('getImage pula o fetch ativo quando o destino escolhe preview', () => {
  assert.match(botWorkerSource, /const skipFetch = !forceOriginalForChannelButton && baseMode === 'preview'/)
})

test('US1: buildPayload só executa o ramo de link preview quando imageMode === preview e não há channelForward', () => {
  const callSiteStart = botWorkerSource.indexOf("if (imageMode === 'preview' && !channelForward)")
  assert.notEqual(callSiteStart, -1, "ramo imageMode === 'preview' precisa existir e ser o caminho de runtime único hoje (exceto quando o destino pediu o botão Ver canal)")
})

// Fix "Ver canal não funciona para todos os tipos de envio": destino com
// channelForward configurado precisa pular o ramo de texto/preview (sem
// mídia) e forçar a busca de imagem, senão o botão nativo nunca tem um
// corpo de mídia pra anexar (injectChannelForwardIntoPayload é mídia-only).
test('buildPayload pula o ramo de preview e getImage força fetch quando channelForward está setado', () => {
  const previewGuardStart = botWorkerSource.indexOf("if (imageMode === 'preview' && !channelForward)")
  assert.notEqual(previewGuardStart, -1, 'guarda de preview precisa excluir destinos com channelForward')

  const wantImageStart = botWorkerSource.indexOf('if (wantImage || channelForward)')
  assert.notEqual(wantImageStart, -1, 'busca de imagem precisa rodar também quando channelForward está setado, mesmo com wantImage=false')

  const getImageCallStart = botWorkerSource.indexOf('await getImage({ forceOriginalForChannelButton: !!channelForward, imageMode })')
  assert.notEqual(getImageCallStart, -1, 'getImage precisa ser chamado com forceOriginalForChannelButton para o destino com botão')

  const fallbackStart = botWorkerSource.indexOf("if ((imageMode === 'original' || channelForward) && !image)")
  assert.notEqual(fallbackStart, -1, 'sem imagem disponível, destino com channelForward precisa cair no fallback de link preview automático (useLinkPreview) em vez de texto pelado')
})

test('getImage trata forceOriginalForChannelButton como original quando o destino usa preview', () => {
  const fnStart = botWorkerSource.indexOf("async function getImage({ forceOriginalForChannelButton = false, imageMode = 'original' } = {}) {")
  assert.notEqual(fnStart, -1, 'assinatura de getImage precisa aceitar forceOriginalForChannelButton')

  const fnEnd = botWorkerSource.indexOf('\n      }\n', fnStart)
  const fnBody = botWorkerSource.slice(fnStart, fnEnd)
  assert.match(
    fnBody,
    /const effectiveMode = forceOriginalForChannelButton && baseMode === 'preview' \? 'original' : baseMode/,
    "forceOriginalForChannelButton precisa mapear pra mode:'original' no resolveMonitoredImage",
  )
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

test('T011: couponTextSignal é calculado no call site a partir de couponSkipActiveFetch / warning de vitrine ML, sem detector novo', () => {
  const callSiteStart = botWorkerSource.indexOf("if (imageMode === 'preview' && !channelForward)")
  assert.notEqual(callSiteStart, -1, "bloco imageMode === 'preview' não encontrado")
  const callStart = botWorkerSource.indexOf('await buildManualLinkPreview({', callSiteStart)
  const preamble = botWorkerSource.slice(callSiteStart, callStart)

  // Fix 2026-07: o sinal deriva de couponSkipActiveFetch (a MESMA decisão
  // produto-vs-cupom já computada para a estratégia de imagem), NÃO de
  // isCouponMsg cru — que dava banner em produto que só carrega código de
  // cupom (regressão do Ryzen por short link ML). Continua sem detector novo.
  assert.match(
    preamble,
    /const couponTextSignal = couponSkipActiveFetch \|\| primary\?\.warning === 'ml_vitrine_fallback_used'/,
    'couponTextSignal precisa reusar couponSkipActiveFetch e o warning ml_vitrine_fallback_used, sem criar detector novo',
  )

  const callEnd = botWorkerSource.indexOf('})', callStart)
  const callBlock = botWorkerSource.slice(callStart, callEnd)
  assert.match(callBlock, /couponTextSignal/, 'call site precisa passar couponTextSignal pro buildManualLinkPreview')
})
