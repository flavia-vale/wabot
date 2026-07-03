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

// Teste estrutural (padrão do repo, ver bot-worker-relay-branding.test.js):
// o modo preview PRECISA rotear cupom para o banner de marca e nunca raspar
// a landing de cupom em busca de imagem de produto.
test('bot-worker roteia linkKind=coupon para o banner de marca no preview', () => {
  const botWorkerSource = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(
    botWorkerSource,
    /primary\?\.linkKind === 'coupon'/,
    'preview precisa detectar cupom pelo linkKind da conversão primária',
  )
  assert.match(
    botWorkerSource,
    /await buildStoreBrandCardImage\(primary\?\.platform\)/,
    'cupom usa o banner da marca da loja',
  )
})

// Sem title o cliente WhatsApp NÃO renderiza o card (cards sumiram em
// staging no deploy do PR #1186). O urlInfo manual PRECISA sempre levar
// title (nome da loja), nunca voltar a omiti-lo.
test('bot-worker sempre inclui title (nome da loja) no urlInfo manual do preview', () => {
  const botWorkerSource = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(
    botWorkerSource,
    /title: storePreviewTitle\(primary\?\.platform, matchedText\)/,
    'urlInfo manual precisa de title fixo do nome da loja',
  )
})

// Card pequeno/fino só no Desktop (celular ficava ótimo): a causa era subir o
// jpegThumbnail JÁ REDUZIDO (≤500px) como fonte do upload HQ — o WhatsApp
// grava as dimensões REAIS do buffer upado em thumbnailWidth/Height, e o
// Desktop respeita esse tamanho (ao contrário do Mobile, que estica pra
// preencher o balão). O upload HQ precisa usar um buffer maior
// (hqSourceBuffer, o "main" de normalizeImageForWhatsApp — até 1600px, ou o
// banner 800x420 no caso de cupom), nunca o jpegThumbnail pequeno.
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
