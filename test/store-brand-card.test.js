import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'

import { buildStoreBrandCardImage, isBrandCardPlatform, __storeBrandCardInternals } from '../src/converters/storeBrandCard.js'

test('gera banner JPEG por plataforma conhecida com as dimensões do card', async () => {
  for (const platform of Object.keys(__storeBrandCardInternals.BRAND_STYLES)) {
    const buffer = await buildStoreBrandCardImage(platform)
    assert.ok(buffer?.length, `banner de ${platform} deve existir`)
    // magic bytes de JPEG (o inline thumbnail do WA precisa ser JPEG)
    assert.equal(buffer[0], 0xff)
    assert.equal(buffer[1], 0xd8)
    const sharp = (await import('sharp')).default
    const meta = await sharp(buffer).metadata()
    assert.equal(meta.width, __storeBrandCardInternals.WIDTH)
    assert.equal(meta.height, __storeBrandCardInternals.HEIGHT)
    // banner flat tem que ficar MUITO abaixo de qualquer limite de proto
    assert.ok(buffer.length < 150 * 1024, `banner de ${platform} deve ser pequeno (${buffer.length} bytes)`)
  }
})

test('banner tem canvas quadrado (não regredir para landscape — cortava texto no card do Desktop)', () => {
  assert.equal(__storeBrandCardInternals.WIDTH, __storeBrandCardInternals.HEIGHT, 'WIDTH e HEIGHT precisam ser iguais (canvas quadrado)')
})

test('SVG de todas as lojas desenha "CUPOM" + o nome da loja (pedido explícito: evitar confundir com card de produto)', async () => {
  const storeBrandCardSource = readFileSync(new URL('../src/converters/storeBrandCard.js', import.meta.url), 'utf8')
  assert.match(storeBrandCardSource, />CUPOM</, 'SVG precisa desenhar o texto fixo "CUPOM"')
  for (const style of Object.values(__storeBrandCardInternals.BRAND_STYLES)) {
    assert.ok(style.store?.length, 'cada loja precisa de um nome (store) pra desenhar embaixo do rótulo "CUPOM"')
  }
})

test('plataforma desconhecida devolve null sem lançar', async () => {
  assert.equal(await buildStoreBrandCardImage('lojainexistente'), null)
  assert.equal(await buildStoreBrandCardImage(null), null)
  assert.equal(isBrandCardPlatform('amazon'), true)
  assert.equal(isBrandCardPlatform('lojainexistente'), false)
})

test('banner é cacheado por processo (mesma referência de Buffer)', async () => {
  const a = await buildStoreBrandCardImage('amazon')
  const b = await buildStoreBrandCardImage('amazon')
  assert.equal(a, b)
})

test('SVG do banner não contém emoji nem fonte sem fallback genérico (lições do PR #1185)', () => {
  const source = readFileSync(new URL('../src/converters/storeBrandCard.js', import.meta.url), 'utf8')
  assert.ok(!/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(source), 'sem emoji no módulo do banner')
  assert.match(source, /sans-serif/, 'font-family precisa terminar em sans-serif genérico')
})

// ROLLBACK DE PRODUÇÃO (incidente 2026-07, hotfix #1205 em main): o banner de
// cupom estava saindo em textos de PRODUTO (produto compartilhado por short
// link sem ASIN/MLB caía como linkKind:'coupon' e ganhava o banner "Cupom
// Loja" no lugar da foto). Até a classificação ficar robusta, o banner fica
// DESLIGADO por flag — todo card usa a imagem raspada do produto.
// buildStoreBrandCardImage continua no código, só gated. Este teste garante
// que o flag permanece OFF em develop também (consistente com main —
// promover develop→main não pode reativar o banner sem querer).
test('bot-worker mantém o banner de cupom DESLIGADO no preview (rollback de produção)', () => {
  const botWorkerSource = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(
    botWorkerSource,
    /const COUPON_BRAND_CARD_ENABLED = false/,
    'banner de cupom deve permanecer desligado até a classificação ser robusta',
  )
  assert.match(
    botWorkerSource,
    /COUPON_BRAND_CARD_ENABLED && primary\?\.linkKind === 'coupon'/,
    'o ramo do banner de cupom deve estar atrás do flag (desligado)',
  )
})

// Sem title o cliente WhatsApp NÃO renderiza o card (cards sumiram em
// staging no deploy do PR #1186). O urlInfo manual PRECISA sempre levar
// title (nome da loja), nunca voltar a omiti-lo.
test('bot-worker sempre inclui title (nome da loja) no urlInfo manual do preview', () => {
  const botWorkerSource = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(
    botWorkerSource,
    /title: storePreviewTitle\(primary\?\.platform, matchedText, COUPON_BRAND_CARD_ENABLED && primary\?\.linkKind === 'coupon'\)/,
    'urlInfo manual precisa de title fixo do nome da loja',
  )
})

// Card pequeno/fino só no Desktop (celular ficava ótimo): a causa era subir o
// jpegThumbnail JÁ REDUZIDO (≤500px) como fonte do upload HQ — o WhatsApp
// grava as dimensões REAIS do buffer upado em thumbnailWidth/Height, e o
// Desktop respeita esse tamanho (ao contrário do Mobile, que estica pra
// preencher o balão). O upload HQ precisa usar um buffer maior
// (hqSourceBuffer, o "main" de normalizeImageForWhatsApp — até 1600px, ou o
// banner 720x720 no caso de cupom), nunca o jpegThumbnail pequeno.
test('bot-worker sobe imagem em resolução maior (hqSourceBuffer) para o card HQ, não o thumbnail pequeno', () => {
  const botWorkerSource = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(
    botWorkerSource,
    /image: hqSourceBuffer/,
    'upload HQ precisa usar hqSourceBuffer (resolução maior), não jpegThumbnail',
  )
  assert.doesNotMatch(
    botWorkerSource,
    /prepareWAMessageMedia\(\s*\{\s*image:\s*jpegThumbnail/,
    'regressão: upload HQ não pode voltar a usar o jpegThumbnail já reduzido a 500px como fonte',
  )
  assert.match(
    botWorkerSource,
    /hqSourceBuffer = normalized\?\.buffer \|\| jpegThumbnail/,
    'produto: hqSourceBuffer precisa vir do buffer principal (até 1600px), não do thumbnail',
  )
})

// Bug real: mensagem "Cupom mercado livre" apontando pra página de cupons
// (sem MLB/ASIN no link) foi bloqueada com "Bloqueado por segurança" porque
// isCouponAnnouncement (texto) exige um código em CAIXA ALTA visível na
// legenda, que essa mensagem não tinha. O guard de title_mismatch precisa
// também aceitar o sinal vindo da URL (linkKind resolvido por
// resolveLinkKind), não só o sinal de texto.
test('guard de title_mismatch exime mensagem quando primary.linkKind === coupon (não só isCouponMsg)', () => {
  const botWorkerSource = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(
    botWorkerSource,
    /if \(!isCouponMsg && primary\.linkKind !== 'coupon' && titleOverlap === 'mismatch'\)/,
    'condição de bloqueio precisa exigir tanto !isCouponMsg quanto linkKind !== coupon',
  )
})

// amazon.js/mercadolivre.js não marcam linkKind no retorno (só shopee.js
// marca) — sem o backfill via resolveLinkKind, tanto o guard acima quanto o
// banner de cupom (buildManualLinkPreview) nunca veem linkKind='coupon'
// pra esses dois marketplaces.
test('bot-worker preenche linkKind via resolveLinkKind quando o converter não decidiu', () => {
  const botWorkerSource = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(
    botWorkerSource,
    /const linkKind = resolveLinkKind\(platform, \{ url, converted: conversionResult\.url, linkKind: conversionResult\.linkKind \}\)/,
    'linkKind da conversão precisa passar por resolveLinkKind antes de virar primary.linkKind',
  )
})
