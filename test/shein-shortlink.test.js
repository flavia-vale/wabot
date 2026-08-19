import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shortenSheinLink, convert } from '../src/converters/shein.js'

// ---------------------------------------------------------------------------
// Phase 16 (specs/012-shein-store-support): link curto (oneLink) da SHEIN.
// Caminho CONFIRMADO ao vivo pela cliente — replica exatamente o contrato
// medido em scripts/diag-shein-shortlink.mjs:
//
//   GET  {origin}/api/others/getSiteInfo   -> { SiteUID, token, memberId, appLanguage }
//   POST {origin}/affiliate/api/share/link/from/url -> { code:"0", info:{ oneLink } }
//
// db-free, sem rede: fetchImpl sempre injetado. shortenSheinLink NUNCA lança
// — toda falha degrada para `null`, e quem chama (convert()) publica o link
// longo, que é o comportamento de hoje.
// ---------------------------------------------------------------------------

const LONG_URL = 'https://m.shein.com/br/ark/default?scene=1&test=5051&ad_type=KOC&campaign=goods&campaign_id=20&goods_id=485735309&koc_id=12345&url_from=affiliate_koc_12345'

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  }
}

function makeFetchImpl({ siteInfo, shorten, onCall } = {}) {
  return async (url, init) => {
    onCall?.(url, init)
    if (String(url).includes('getSiteInfo')) {
      if (siteInfo instanceof Error) throw siteInfo
      return jsonResponse(siteInfo)
    }
    if (String(url).includes('share/link/from/url')) {
      if (shorten instanceof Error) throw shorten
      return jsonResponse(shorten)
    }
    throw new Error(`URL inesperada no teste: ${url}`)
  }
}

test('encurta quando há código de acesso e o identificador bate', async () => {
  const calls = []
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: 'tok123', memberId: '12345', appLanguage: 'pt-br' },
    shorten: { code: '0', info: { oneLink: 'https://onelink.shein.com/48/5zdjzeumrua5?ismg_ol=abc' } },
    onCall: (url) => calls.push(url),
  })
  const result = await shortenSheinLink(LONG_URL, { tag: '12345', cookie: 'algum-cookie=valor' }, { fetchImpl })
  assert.equal(result, 'https://onelink.shein.com/48/5zdjzeumrua5?ismg_ol=abc')
  assert.equal(calls.length, 2)
})

test('identificador divergente do cadastro → null (o teste mais importante)', async () => {
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: 'tok123', memberId: '99999', appLanguage: 'pt-br' },
    shorten: { code: '0', info: { oneLink: 'https://onelink.shein.com/48/naodeveriapublicar' } },
  })
  // cookie único por teste: o cache de token (por tag+cookie) não pode
  // reaproveitar a sessão válida cunhada no teste anterior para este mesmo tag.
  const result = await shortenSheinLink(LONG_URL, { tag: '12345', cookie: 'cookie-divergente-1' }, { fetchImpl })
  assert.equal(result, null)
})

test('convert() com identificador divergente publica o link longo, não o oneLink de outra conta', async () => {
  const url = 'https://br.shein.com/vestido-floral-p-485735309.html'
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: 'tok123', memberId: '99999', appLanguage: 'pt-br' },
    shorten: { code: '0', info: { oneLink: 'https://onelink.shein.com/48/naodeveriapublicar' } },
  })
  const result = await convert(url, { tag: '12345', cookie: 'cookie-divergente-2' }, { fetchImpl })
  assert.ok(result)
  assert.equal(result.linkKind, 'product')
  assert.match(result.url, /^https:\/\/br\.shein\.com\//)
  assert.equal(result.url.includes('onelink.shein.com'), false)
})

test('identificador vazio (código de acesso venceu) → link longo', async () => {
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: '', memberId: '', appLanguage: 'pt-br' },
    shorten: { code: '0', info: { oneLink: 'https://onelink.shein.com/48/naodeveriapublicar' } },
  })
  const result = await shortenSheinLink(LONG_URL, { tag: '12345', cookie: 'cookie-vazio-3' }, { fetchImpl })
  assert.equal(result, null)
})

test('code != "0" na resposta do gerador → link longo', async () => {
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: 'tok123', memberId: '12345', appLanguage: 'pt-br' },
    shorten: { code: '100103', msg: 'Unauthorized' },
  })
  const result = await shortenSheinLink(LONG_URL, { tag: '12345', cookie: 'cookie-code-nao-zero' }, { fetchImpl })
  assert.equal(result, null)
})

test('falha de rede no getSiteInfo → null, sem lançar', async () => {
  const fetchImpl = makeFetchImpl({ siteInfo: new Error('rede fora') })
  await assert.doesNotReject(async () => {
    const result = await shortenSheinLink(LONG_URL, { tag: '12345', cookie: 'cookie-falha-siteinfo' }, { fetchImpl })
    assert.equal(result, null)
  })
})

test('falha de rede no gerador de link → null, sem lançar', async () => {
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: 'tok123', memberId: '12345', appLanguage: 'pt-br' },
    shorten: new Error('rede fora'),
  })
  await assert.doesNotReject(async () => {
    const result = await shortenSheinLink(LONG_URL, { tag: '12345', cookie: 'cookie-falha-shorten' }, { fetchImpl })
    assert.equal(result, null)
  })
})

test('estouro de prazo (totalTimeoutMs esgotado) → null, sem lançar', async () => {
  const fetchImpl = async (url, init) => new Promise((resolve, reject) => {
    const keepAlive = setTimeout(() => {}, 1000)
    init.signal.addEventListener('abort', () => {
      clearTimeout(keepAlive)
      reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))
    })
  })
  const result = await shortenSheinLink(LONG_URL, { tag: '12345', cookie: 'cookie-timeout' }, { fetchImpl, totalTimeoutMs: 5 })
  assert.equal(result, null)
})

test('sem código de acesso (cookie) → o gerador nem é chamado', async () => {
  let called = false
  const fetchImpl = async () => { called = true; throw new Error('não deveria buscar') }
  const result = await shortenSheinLink(LONG_URL, { tag: '12345' }, { fetchImpl })
  assert.equal(result, null)
  assert.equal(called, false)
})

test('convert() sem cookie: encurtador nem é chamado, publica o link longo (comportamento de hoje)', async () => {
  const url = 'https://br.shein.com/vestido-floral-p-485735309.html'
  let shortenerCalled = false
  const fetchImpl = async (u) => {
    if (String(u).includes('getSiteInfo') || String(u).includes('share/link/from/url')) shortenerCalled = true
    throw new Error('não deveria buscar')
  }
  const result = await convert(url, { tag: '12345' }, { fetchImpl })
  assert.ok(result)
  assert.match(result.url, /^https:\/\/br\.shein\.com\/vestido-floral-p-485735309\.html\?/)
  assert.equal(result.url.includes('onelink.shein.com'), false)
  assert.equal(shortenerCalled, false)
})

test('kill-switch SHEIN_SHORTLINK_ENABLED=false: não chama a rede', async () => {
  const previous = process.env.SHEIN_SHORTLINK_ENABLED
  process.env.SHEIN_SHORTLINK_ENABLED = 'false'
  try {
    let called = false
    const fetchImpl = async () => { called = true; throw new Error('não deveria buscar') }
    const result = await shortenSheinLink(LONG_URL, { tag: '12345', cookie: 'algum-cookie=valor' }, { fetchImpl })
    assert.equal(result, null)
    assert.equal(called, false)
  } finally {
    if (previous === undefined) delete process.env.SHEIN_SHORTLINK_ENABLED
    else process.env.SHEIN_SHORTLINK_ENABLED = previous
  }
})

test('kill-switch desligado dentro de convert(): publica o link longo', async () => {
  const previous = process.env.SHEIN_SHORTLINK_ENABLED
  process.env.SHEIN_SHORTLINK_ENABLED = 'false'
  try {
    const url = 'https://br.shein.com/vestido-floral-p-485735309.html'
    const fetchImpl = async () => { throw new Error('não deveria buscar') }
    const result = await convert(url, { tag: '12345', cookie: 'algum-cookie=valor' }, { fetchImpl })
    assert.ok(result)
    assert.match(result.url, /^https:\/\/br\.shein\.com\/vestido-floral-p-485735309\.html\?/)
    assert.equal(result.url.includes('onelink.shein.com'), false)
  } finally {
    if (previous === undefined) delete process.env.SHEIN_SHORTLINK_ENABLED
    else process.env.SHEIN_SHORTLINK_ENABLED = previous
  }
})

test('oneLink publicado exatamente como a SHEIN devolveu, com os parâmetros dela', async () => {
  const oneLinkComParametros = 'https://onelink.shein.com/48/5zdjzeumrua5?ismg_ol=GGkS8InolgI_01_KOC-C'
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: 'tok123', memberId: '12345', appLanguage: 'pt-br' },
    shorten: { code: '0', info: { oneLink: oneLinkComParametros } },
  })
  const result = await shortenSheinLink(LONG_URL, { tag: '12345', cookie: 'cookie-onelink-exato' }, { fetchImpl })
  assert.equal(result, oneLinkComParametros)
})

test('convert() com cookie e identificador batendo publica o oneLink curto', async () => {
  const url = 'https://br.shein.com/vestido-floral-p-485735309.html'
  const oneLinkComParametros = 'https://onelink.shein.com/48/5zdjzeumrua5?ismg_ol=GGkS8InolgI_01_KOC-C'
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: 'tok123', memberId: '12345', appLanguage: 'pt-br' },
    shorten: { code: '0', info: { oneLink: oneLinkComParametros } },
  })
  const result = await convert(url, { tag: '12345', cookie: 'cookie-convert-onelink' }, { fetchImpl })
  assert.ok(result)
  assert.equal(result.linkKind, 'product')
  assert.equal(result.url, oneLinkComParametros)
})

test('resposta sem oneLink no info (code 0 mas sem link) → null', async () => {
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: 'tok123', memberId: '12345', appLanguage: 'pt-br' },
    shorten: { code: '0', info: {} },
  })
  const result = await shortenSheinLink(LONG_URL, { tag: '12345', cookie: 'cookie-sem-onelink' }, { fetchImpl })
  assert.equal(result, null)
})
