import { test } from 'node:test'
import assert from 'node:assert/strict'
import { convert } from '../src/converters/shein.js'

// ---------------------------------------------------------------------------
// Invariantes do contrato (contracts/converter-shein.md). Todos db-free e sem
// rede — `fetchImpl` injetado. O link de terceiro NUNCA pode ser encaminhado,
// nem em pedaço (FR-015).
// ---------------------------------------------------------------------------

function htmlResponse(html, url) {
  return {
    ok: true,
    status: 200,
    url,
    headers: {
      get: (name) => (name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null),
      getSetCookie: () => [],
    },
    text: async () => html,
  }
}

test('produto direto (-p-<id>.html) converte com koc_id/url_from da cliente e linkKind product', async () => {
  const url = 'https://br.shein.com/vestido-floral-p-485735309.html'
  const result = await convert(url, { tag: '12345' })
  assert.ok(result)
  assert.equal(result.linkKind, 'product')
  const out = new URL(result.url)
  assert.equal(out.searchParams.get('koc_id'), '12345')
  assert.equal(out.searchParams.get('url_from'), 'affiliate_koc_12345')
})

test('INV-1: destino de outro afiliado perde a identidade dele e ganha a da cliente, preservando goods_id', async () => {
  const outroAfiliado = 'https://m.shein.com/br/ark/default?onelink=x&requestId=y&scene=1&test=5051&ad_type=KOC&campaign=goods&campaign_id=20&koc_id=OUTRO999&goods_id=485735309&url_from=affiliate_koc_OUTRO999'
  const result = await convert(outroAfiliado, { tag: '12345' })
  assert.ok(result)
  assert.equal(result.linkKind, 'product')
  assert.equal(result.url.includes('OUTRO999'), false)
  const out = new URL(result.url)
  assert.equal(out.searchParams.get('koc_id'), '12345')
  assert.equal(out.searchParams.get('url_from'), 'affiliate_koc_12345')
  assert.equal(out.searchParams.get('goods_id'), '485735309')
})

test('INV-2: shc/link (token opaco de compartilhamento) → null', async () => {
  const url = 'https://api-shein.shein.com/h5/sharejump/appjump?shc=abc123&link=xyz&url_from=GM7999'
  assert.equal(await convert(url, { tag: '12345' }), null)
})

test('INV-3: link que se diz de produto (marcador -p- no caminho) sem goods_id extraível → null', async () => {
  const url = 'https://br.shein.com/vestido-floral-p-XYZ.html'
  assert.equal(await convert(url, { tag: '12345' }), null)
})

test('INV-4: onelink/requestId/behaviorId/utm_* ausentes da saída', async () => {
  const url = 'https://m.shein.com/br/ark/default?onelink=xxx&requestId=yyy&behaviorId=zzz&utm_source=terceiro&goods_id=485735309&koc_id=OUTRO'
  const result = await convert(url, { tag: '12345' })
  assert.ok(result)
  for (const jargao of ['onelink=', 'requestId=', 'behaviorId=', 'utm_source=']) {
    assert.equal(result.url.includes(jargao), false, `não deveria conter ${jargao}`)
  }
})

test('INV-5: fetchImpl que rejeita → null (nunca a URL original)', async () => {
  const fetchImpl = async () => { throw new Error('rede fora') }
  const url = 'https://onelink.shein.com/14/abc'
  const result = await convert(url, { tag: '12345' }, { fetchImpl })
  // sem produto revelado, a resolução degrada para a própria URL de entrada,
  // que não tem goods_id — logo null (falha honesta, não a URL original)
  assert.equal(result, null)
})

test('INV-6: cupom/campanha converte com linkKind coupon sem depender de COUPON_LINK_CONVERT', async () => {
  const previous = process.env.COUPON_LINK_CONVERT
  delete process.env.COUPON_LINK_CONVERT
  try {
    const url = 'https://m.shein.com/br/ark/default?scene=1&campaign=summer-sale'
    const result = await convert(url, { tag: '12345' })
    assert.ok(result)
    assert.equal(result.linkKind, 'coupon')
    assert.equal(new URL(result.url).searchParams.get('koc_id'), '12345')
  } finally {
    if (previous !== undefined) process.env.COUPON_LINK_CONVERT = previous
  }
})

test('sem creds.tag → null', async () => {
  const url = 'https://br.shein.com/vestido-floral-p-485735309.html'
  assert.equal(await convert(url, {}), null)
  assert.equal(await convert(url, { tag: '' }), null)
  assert.equal(await convert(url, null), null)
})

test('resolve oneLink de terceiro (via input#url) e converte preservando goods_id', async () => {
  const outroAfiliado = 'https://m.shein.com/br/ark/default?goods_id=999888&koc_id=OUTRO&url_from=affiliate_koc_OUTRO'
  const interstitial = `<html><body><input id="url" value="${outroAfiliado}"></body></html>`
  const fetchImpl = async (url) => htmlResponse(interstitial, url)
  const result = await convert('https://onelink.shein.com/14/abc', { tag: 'MINHA' }, { fetchImpl })
  assert.ok(result)
  assert.equal(result.linkKind, 'product')
  assert.equal(result.url.includes('OUTRO'), false)
  const out = new URL(result.url)
  assert.equal(out.searchParams.get('koc_id'), 'MINHA')
  assert.equal(out.searchParams.get('goods_id'), '999888')
})

test('T061: cadeia de redirect que sai do domínio SHEIN é recusada, mesmo com goods_id no destino', async () => {
  // Simula um oneLink cujo redirect (Location) escapa para um domínio de
  // terceiro que embute os mesmos query params — se a guarda de host não
  // existisse, isso seria publicado com o rastro do terceiro intacto.
  const redirectResponse = (location) => ({
    ok: true,
    status: 302,
    url: 'https://onelink.shein.com/14/abc',
    headers: {
      get: (name) => (name.toLowerCase() === 'location' ? location : null),
      getSetCookie: () => [],
    },
    text: async () => '',
  })
  const fetchImpl = async () =>
    redirectResponse('https://tracker-terceiro.example.com/x?goods_id=485735309&koc_id=OUTRO&url_from=affiliate_koc_OUTRO')
  const result = await convert('https://onelink.shein.com/14/abc', { tag: '12345' }, { fetchImpl })
  assert.equal(result, null)
})

test('T061: link direto de host que não é SHEIN nunca converte (guarda de host)', async () => {
  const result = await convert('https://not-shein.com/vestido-p-123.html', { tag: '12345' })
  assert.equal(result, null)
})

test('T070: link direto de domínio sósia (shein.com.<atacante>) nunca converte', async () => {
  const result = await convert('https://shein.com.evil.net/x-p-123.html?goods_id=123', { tag: '999' })
  assert.equal(result, null)
})

test('T070: cadeia de redirect que termina em domínio sósia (shein.company.io) nunca converte', async () => {
  const redirectResponse = (location) => ({
    ok: true,
    status: 302,
    url: 'https://onelink.shein.com/14/abc',
    headers: {
      get: (name) => (name.toLowerCase() === 'location' ? location : null),
      getSetCookie: () => [],
    },
    text: async () => '',
  })
  const fetchImpl = async () =>
    redirectResponse('https://shein.company.io/x-p-123.html?goods_id=123&koc_id=OUTRO&url_from=affiliate_koc_OUTRO')
  const result = await convert('https://onelink.shein.com/14/abc', { tag: '12345' }, { fetchImpl })
  assert.equal(result, null)
})

test('T062: landing genérica do oneLink (/ark/default) sem goods_id e sem nenhum parâmetro de destino → null', async () => {
  const url = 'https://m.shein.com/br/ark/default'
  assert.equal(await convert(url, { tag: '12345' }), null)
})

test('T062: landing genérica do oneLink só com rastro (onelink/requestId), sem goods_id → null', async () => {
  const url = 'https://m.shein.com/br/ark/default?onelink=x&requestId=y'
  assert.equal(await convert(url, { tag: '12345' }), null)
})

test('T062: não regride cupom/campanha legítimo (INV-6) mesmo com o novo filtro de /ark/default', async () => {
  const url = 'https://m.shein.com/br/ark/default?scene=1&campaign=summer-sale'
  const result = await convert(url, { tag: '12345' })
  assert.ok(result)
  assert.equal(result.linkKind, 'coupon')
})

test('T063: campaign/campaign_id/ad_type/scene/test do link de origem chegam intactos (não mascarados pelo re-preenchimento dos padrões)', async () => {
  const url =
    'https://m.shein.com/br/ark/default?goods_id=485735309&campaign=summer-sale&campaign_id=999&ad_type=CUSTOM&scene=9&test=123'
  const result = await convert(url, { tag: '12345' })
  assert.ok(result)
  const out = new URL(result.url)
  assert.equal(out.searchParams.get('campaign'), 'summer-sale')
  assert.equal(out.searchParams.get('campaign_id'), '999')
  assert.equal(out.searchParams.get('ad_type'), 'CUSTOM')
  assert.equal(out.searchParams.get('scene'), '9')
  assert.equal(out.searchParams.get('test'), '123')
})

test('T064: shc/link vazios (?shc=&link=) também são recusados (presença, não valor)', async () => {
  const url = 'https://api-shein.shein.com/h5/sharejump/appjump?shc=&link=&url_from=GM7999'
  assert.equal(await convert(url, { tag: '12345' }), null)
})

// ---------------------------------------------------------------------------
// Phase 12: Caça adversarial (sondagem manual). Identificador de OUTRO
// afiliado chega à saída em seis formas diferentes (T072-T074).
// ---------------------------------------------------------------------------

test('T072: remoção de url_from é insensível a maiúsculas (URL_FROM sobrevivia)', async () => {
  const url = 'https://br.shein.com/a-p-1.html?goods_id=1&URL_FROM=affiliate_koc_5849195695'
  const result = await convert(url, { tag: '1150365562' })
  assert.ok(result)
  const out = new URL(result.url)
  assert.equal(out.searchParams.has('URL_FROM'), false)
  assert.equal(out.searchParams.get('url_from'), 'affiliate_koc_1150365562')
  assert.equal(result.url.includes('5849195695'), false)
})

test('T072: remoção de koc_id é insensível a maiúsculas (KOC_ID sobrevivia)', async () => {
  const url = 'https://br.shein.com/a-p-1.html?goods_id=1&KOC_ID=5849195695'
  const result = await convert(url, { tag: '1150365562' })
  assert.ok(result)
  const out = new URL(result.url)
  assert.equal(out.searchParams.has('KOC_ID'), false)
  assert.equal(out.searchParams.get('koc_id'), '1150365562')
  assert.equal(result.url.includes('5849195695'), false)
})

test('T073: fragmento é descartado na saída de convert()', async () => {
  const url = 'https://br.shein.com/a-p-1.html?goods_id=1#url_from=affiliate_koc_5849195695'
  const result = await convert(url, { tag: '1150365562' })
  assert.ok(result)
  assert.equal(result.url.includes('#'), false)
  assert.equal(result.url.includes('5849195695'), false)
})

test('T074: parâmetro de nome desconhecido (partner_koc) com identificador de terceiro → null', async () => {
  const url = 'https://br.shein.com/a-p-1.html?goods_id=1&partner_koc=5849195695'
  assert.equal(await convert(url, { tag: '1150365562' }), null)
})

test('T074: identificador de terceiro aninhado/URL-encoded (next=...url_from=affiliate_koc_<id>) → null', async () => {
  const nested = 'https://x.com/?url_from=affiliate_koc_5849195695'
  const url = `https://br.shein.com/a-p-1.html?goods_id=1&next=${encodeURIComponent(nested)}`
  assert.equal(await convert(url, { tag: '1150365562' }), null)
})

test('T074: identificador de terceiro no caminho (/affiliate_koc_<id>/) → null', async () => {
  const url = 'https://br.shein.com/affiliate_koc_5849195695/a-p-1.html?goods_id=1'
  assert.equal(await convert(url, { tag: '1150365562' }), null)
})

test('T074: não regride link legítimo — koc_id e url_from da própria cliente aparecem 2x sem disparar a rede de segurança', async () => {
  const url = 'https://br.shein.com/vestido-floral-p-485735309.html'
  const result = await convert(url, { tag: '1150365562' })
  assert.ok(result)
  assert.equal(result.linkKind, 'product')
  const out = new URL(result.url)
  assert.equal(out.searchParams.get('koc_id'), '1150365562')
  assert.equal(out.searchParams.get('url_from'), 'affiliate_koc_1150365562')
})

test('T074: não regride ad_type customizado do link de origem (T063) mesmo contendo letras', async () => {
  const url =
    'https://m.shein.com/br/ark/default?goods_id=485735309&campaign=summer-sale&ad_type=CUSTOM'
  const result = await convert(url, { tag: '1150365562' })
  assert.ok(result)
  assert.equal(new URL(result.url).searchParams.get('ad_type'), 'CUSTOM')
})

test('garante PROGRAM_PARAMS ausentes no destino', async () => {
  const url = 'https://br.shein.com/vestido-floral-p-485735309.html'
  const result = await convert(url, { tag: '12345' })
  const out = new URL(result.url)
  assert.equal(out.searchParams.get('scene'), '1')
  assert.equal(out.searchParams.get('test'), '5051')
  assert.equal(out.searchParams.get('ad_type'), 'KOC')
  assert.equal(out.searchParams.get('campaign'), 'goods')
  assert.equal(out.searchParams.get('campaign_id'), '20')
})
