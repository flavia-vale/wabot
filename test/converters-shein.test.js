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

// ---------------------------------------------------------------------------
// T077: a rede de segurança do T074 (substring solta "koc" na URL inteira)
// recusava oferta legítima em silêncio — marca real da SHEIN no slug, nome
// de campanha vindo da origem. Corrigido para casar o FORMATO do
// identificador (`affiliate_koc_<dígitos>` e nome de parâmetro contendo
// "koc"), não a substring solta. Estes casos precisam CONVERTER.
// ---------------------------------------------------------------------------

test('T077: produto com marca "Kocotree" (koc) no slug converte normalmente', async () => {
  const url = 'https://br.shein.com/Kocotree-Mochila-Infantil-p-1.html?goods_id=111'
  const result = await convert(url, { tag: '1150365562' })
  assert.ok(result)
  assert.equal(result.linkKind, 'product')
  const out = new URL(result.url)
  assert.equal(out.searchParams.get('koc_id'), '1150365562')
  assert.equal(out.searchParams.get('url_from'), 'affiliate_koc_1150365562')
})

test('T077: produto com "koch" no slug converte normalmente', async () => {
  const url = 'https://br.shein.com/koch-blusa-p-2.html?goods_id=222'
  const result = await convert(url, { tag: '1150365562' })
  assert.ok(result)
  assert.equal(result.linkKind, 'product')
})

test('T077: cupom com "koc" no valor de campaign (kocobeauty) converte normalmente', async () => {
  const url = 'https://m.shein.com/br/ark/default?scene=1&campaign=kocobeauty&goods_id=333'
  const result = await convert(url, { tag: '1150365562' })
  assert.ok(result)
  assert.equal(result.linkKind, 'product')
  assert.equal(new URL(result.url).searchParams.get('campaign'), 'kocobeauty')
})

test('T077: ad_type=KOC repetido na origem converte normalmente', async () => {
  const url = 'https://br.shein.com/a-p-1.html?goods_id=1&ad_type=KOC&ad_type=KOC'
  const result = await convert(url, { tag: '1150365562' })
  assert.ok(result)
})

// Não regredir: os três vazamentos que o T074 fechou continuam recusados
// pela checagem por formato/parâmetro.

test('T077: continua recusando parâmetro de nome desconhecido (partner_koc) com id de terceiro', async () => {
  const url = 'https://br.shein.com/a-p-1.html?goods_id=1&partner_koc=5849195695'
  assert.equal(await convert(url, { tag: '1150365562' }), null)
})

test('T077: continua recusando identificador de terceiro aninhado/URL-encoded', async () => {
  const nested = 'https://x.com/?url_from=affiliate_koc_5849195695'
  const url = `https://br.shein.com/a-p-1.html?goods_id=1&next=${encodeURIComponent(nested)}`
  assert.equal(await convert(url, { tag: '1150365562' }), null)
})

test('T077: continua recusando identificador de terceiro no caminho', async () => {
  const url = 'https://br.shein.com/affiliate_koc_5849195695/a-p-1.html?goods_id=1'
  assert.equal(await convert(url, { tag: '1150365562' }), null)
})

// ---------------------------------------------------------------------------
// T078: formato solto (`koc<separador?><dígitos longos>`) num parâmetro que
// não bate nem a regra (a) `affiliate_koc_<dígitos>` nem a regra (b) (nome do
// parâmetro contendo "koc") vazava o identificador do terceiro — ex.:
// `ad_type=KOC<id>` (ad_type é isento da regra por nome, T063, mas isso não
// isenta o VALOR). A exceção de `ad_type` em si não é a causa (inalcançável
// pela regra por nome) — a lacuna é o formato solto em qualquer parâmetro.
// ---------------------------------------------------------------------------

test('T078: recusa identificador de terceiro em formato solto dentro de ad_type', async () => {
  const url = 'https://br.shein.com/a-p-1.html?goods_id=1&ad_type=KOC5849195695'
  assert.equal(await convert(url, { tag: '1150365562' }), null)
})

test('T078: recusa identificador de terceiro em formato solto num parâmetro de nome desconhecido', async () => {
  const url = 'https://br.shein.com/a-p-1.html?goods_id=1&promo=KOC5849195695'
  assert.equal(await convert(url, { tag: '1150365562' }), null)
})

test('T078: não regride — Kocotree no slug continua convertendo normalmente', async () => {
  const url = 'https://br.shein.com/Kocotree-Mochila-Infantil-p-1.html?goods_id=111'
  const result = await convert(url, { tag: '1150365562' })
  assert.ok(result)
  assert.equal(result.linkKind, 'product')
})

test('T078: não regride — koch no slug continua convertendo normalmente', async () => {
  const url = 'https://br.shein.com/koch-blusa-p-2.html?goods_id=222'
  const result = await convert(url, { tag: '1150365562' })
  assert.ok(result)
})

test('T078: não regride — campaign=kocobeauty continua convertendo normalmente', async () => {
  const url = 'https://m.shein.com/br/ark/default?scene=1&campaign=kocobeauty&goods_id=333'
  const result = await convert(url, { tag: '1150365562' })
  assert.ok(result)
  assert.equal(new URL(result.url).searchParams.get('campaign'), 'kocobeauty')
})

test('T078: não regride — ad_type=KOC legítimo (sem dígitos) continua convertendo normalmente', async () => {
  const url = 'https://br.shein.com/a-p-1.html?goods_id=1&ad_type=KOC&ad_type=KOC'
  const result = await convert(url, { tag: '1150365562' })
  assert.ok(result)
})

test('T078: não regride — ad_type=CUSTOM preservado (T063) continua convertendo normalmente', async () => {
  const url = 'https://m.shein.com/br/ark/default?goods_id=485735309&campaign=summer-sale&ad_type=CUSTOM'
  const result = await convert(url, { tag: '1150365562' })
  assert.ok(result)
  assert.equal(new URL(result.url).searchParams.get('ad_type'), 'CUSTOM')
})

// ---------------------------------------------------------------------------
// T079: a decodificação da rede de segurança era uma passada única
// (`decodeOnce`), então um identificador de terceiro com encoding DUPLO
// (`%255F` → `%5F` → `_`) escapava da checagem. Agora decodifica
// repetidamente até estabilizar, com teto de iterações e tolerância a
// sequência inválida (nunca lança).
// ---------------------------------------------------------------------------

test('T079: recusa identificador de terceiro com encoding duplo (%255F)', async () => {
  const url = 'https://br.shein.com/a-p-1.html?goods_id=1&next=affiliate%255Fkoc%255F5849195695'
  assert.equal(await convert(url, { tag: '1150365562' }), null)
})

test('T079: não regride — encoding simples (%5F) continua recusando', async () => {
  const url = 'https://br.shein.com/a-p-1.html?goods_id=1&next=affiliate%5Fkoc%5F5849195695'
  assert.equal(await convert(url, { tag: '1150365562' }), null)
})

test('T079: não regride — encoding simples (%3D) continua recusando', async () => {
  const nested = 'https://x.com/?url_from=affiliate_koc_5849195695'
  const url = `https://br.shein.com/a-p-1.html?goods_id=1&next=${encodeURIComponent(nested)}`
  assert.equal(await convert(url, { tag: '1150365562' }), null)
})

test('T079: entrada com sequência de encoding inválida (%zz) não lança e segue o caminho normal', async () => {
  const url = 'https://br.shein.com/vestido-floral-p-485735309.html?goods_id=1&weird=%zz'
  const result = await convert(url, { tag: '1150365562' })
  assert.ok(result)
  assert.equal(result.linkKind, 'product')
})

test('T079: não regride — link legítimo do T077 continua convertendo após a decodificação repetida', async () => {
  const url = 'https://br.shein.com/Kocotree-Mochila-Infantil-p-1.html?goods_id=111'
  const result = await convert(url, { tag: '1150365562' })
  assert.ok(result)
  assert.equal(result.linkKind, 'product')
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

// ---------------------------------------------------------------------------
// T084 (Phase 16, specs/012-shein-store-support): guarda de não-regressão.
// As guardas T072-T079 não podem mudar de comportamento com o encurtamento
// LIGADO (cookie presente). Para isolar "o encurtamento tentou e falhou" de
// "a guarda continua recusando", usamos um fetchImpl que sempre falha na
// primeira chamada da SHEIN (getSiteInfo) — assim shortenSheinLink() sempre
// degrada para `null` e o resultado de convert() é sempre o link longo
// (idêntico ao caminho sem cookie), permitindo reaplicar exatamente as
// mesmas asserções das guardas.
// ---------------------------------------------------------------------------

function fetchImplComEncurtadorFalhando() {
  // getSiteInfo falha de rede → shortenSheinLink() degrada para null em
  // qualquer chamada, sem nunca chegar ao gerador de link.
  return async (url) => {
    if (String(url).includes('shein.com/br/api/others/getSiteInfo')) throw new Error('rede fora (teste)')
    throw new Error(`URL inesperada no teste: ${url}`)
  }
}

test('T084: com cookie presente (encurtamento ligado), guardas de identidade de terceiro continuam recusando', async () => {
  const creds = { tag: '1150365562', cookie: 'algum-cookie=valor' }
  const fetchImpl = fetchImplComEncurtadorFalhando()

  const url1 = 'https://br.shein.com/a-p-1.html?goods_id=1&partner_koc=5849195695'
  assert.equal(await convert(url1, creds, { fetchImpl }), null)

  const url2 = 'https://br.shein.com/affiliate_koc_5849195695/a-p-1.html?goods_id=1'
  assert.equal(await convert(url2, creds, { fetchImpl }), null)

  const url3 = 'https://br.shein.com/a-p-1.html?goods_id=1&ad_type=KOC5849195695'
  assert.equal(await convert(url3, creds, { fetchImpl }), null)
})

test('T084: com cookie presente (encurtamento ligado), guarda de host ancorado continua recusando', async () => {
  const creds = { tag: '999', cookie: 'algum-cookie=valor' }
  const fetchImpl = fetchImplComEncurtadorFalhando()
  const result = await convert('https://shein.com.evil.net/x-p-123.html?goods_id=123', creds, { fetchImpl })
  assert.equal(result, null)
})

test('T084: com cookie presente (encurtamento ligado), token opaco (shc/link) continua recusando', async () => {
  const creds = { tag: '12345', cookie: 'algum-cookie=valor' }
  const fetchImpl = fetchImplComEncurtadorFalhando()
  const url = 'https://api-shein.shein.com/h5/sharejump/appjump?shc=abc123&link=xyz&url_from=GM7999'
  assert.equal(await convert(url, creds, { fetchImpl }), null)
})

test('T084: com cookie presente (encurtamento ligado), link legítimo continua convertendo com koc_id/url_from da cliente (encurtador falhou → link longo)', async () => {
  const creds = { tag: '1150365562', cookie: 'algum-cookie=valor' }
  const fetchImpl = fetchImplComEncurtadorFalhando()
  const url = 'https://br.shein.com/Kocotree-Mochila-Infantil-p-1.html?goods_id=111'
  const result = await convert(url, creds, { fetchImpl })
  assert.ok(result)
  assert.equal(result.linkKind, 'product')
  const out = new URL(result.url)
  assert.equal(out.searchParams.get('koc_id'), '1150365562')
  assert.equal(out.searchParams.get('url_from'), 'affiliate_koc_1150365562')
  // encurtador falhou → publica o link longo, não um oneLink
  assert.equal(result.url.includes('onelink.shein.com'), false)
})

test('T084: com cookie presente (encurtamento ligado), landing genérica /ark/default sem destino continua null', async () => {
  const creds = { tag: '12345', cookie: 'algum-cookie=valor' }
  const fetchImpl = fetchImplComEncurtadorFalhando()
  const url = 'https://m.shein.com/br/ark/default'
  assert.equal(await convert(url, creds, { fetchImpl }), null)
})

test('T084: as outras quatro lojas seguem intocadas pela mudança do Phase 16 (SHEIN)', async () => {
  const { convert: convertML } = await import('../src/converters/mercadolivre.js')
  const { convert: convertAmazon } = await import('../src/converters/amazon.js')
  const { convert: convertShopee } = await import('../src/converters/shopee.js')
  const { convert: convertMagalu } = await import('../src/converters/magazineluiza.js')

  assert.equal(typeof convertML, 'function')
  assert.equal(typeof convertAmazon, 'function')
  assert.equal(typeof convertShopee, 'function')
  assert.equal(typeof convertMagalu, 'function')

  // Magazine Luiza não depende de rede/credencial de sessão — smoke test
  // simples de que o converter segue funcionando sem qualquer interferência
  // do módulo shein.js (módulos são independentes; nenhum import cruzado).
  const magaluResult = await convertMagalu('https://www.magazinevoce.com.br/magazinealguem/produto/p/123/', { tag: 'minhatag' })
  assert.ok(magaluResult)
})
