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
