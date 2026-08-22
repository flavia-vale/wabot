import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shortenSheinLink, convert } from '../src/converters/shein.js'
import { convertLink } from '../src/converters/index.js'

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

// ---------------------------------------------------------------------------
// T090 (Phase 18): o oneLink devolvido pela SHEIN precisa ser validado antes
// de publicar — string, URL absoluta, host aprovado por isSheinHost. Reprovar
// devolve `null` (fallback publica o link longo), nunca o valor cru.
// ---------------------------------------------------------------------------

test('T090: oneLink de host fora da SHEIN → null (não publica domínio de terceiro)', async () => {
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: 'tok123', memberId: '12345', appLanguage: 'pt-br' },
    shorten: { code: '0', info: { oneLink: 'https://onelink.shein.com.evil.net/48/x' } },
  })
  const result = await shortenSheinLink(LONG_URL, { tag: '12345', cookie: 'cookie-t090-host-fora' }, { fetchImpl })
  assert.equal(result, null)
})

test('T090: oneLink relativo → null (não publica caminho sem host)', async () => {
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: 'tok123', memberId: '12345', appLanguage: 'pt-br' },
    shorten: { code: '0', info: { oneLink: '/48/abc' } },
  })
  const result = await shortenSheinLink(LONG_URL, { tag: '12345', cookie: 'cookie-t090-relativo' }, { fetchImpl })
  assert.equal(result, null)
})

test('T090: oneLink não-string (objeto) → null, nunca "[object Object]"', async () => {
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: 'tok123', memberId: '12345', appLanguage: 'pt-br' },
    shorten: { code: '0', info: { oneLink: { a: 1 } } },
  })
  const result = await shortenSheinLink(LONG_URL, { tag: '12345', cookie: 'cookie-t090-objeto' }, { fetchImpl })
  assert.equal(result, null)
  assert.notEqual(result, '[object Object]')
})

test('T090: oneLink "javascript:" → null (não é URL http(s) da SHEIN)', async () => {
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: 'tok123', memberId: '12345', appLanguage: 'pt-br' },
    shorten: { code: '0', info: { oneLink: 'javascript:alert(1)' } },
  })
  const result = await shortenSheinLink(LONG_URL, { tag: '12345', cookie: 'cookie-t090-javascript' }, { fetchImpl })
  assert.equal(result, null)
})

test('T090: oneLink legítimo em onelink.shein.com continua publicando (não regride)', async () => {
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: 'tok123', memberId: '12345', appLanguage: 'pt-br' },
    shorten: { code: '0', info: { oneLink: 'https://onelink.shein.com/48/OK' } },
  })
  const result = await shortenSheinLink(LONG_URL, { tag: '12345', cookie: 'cookie-t090-legitimo' }, { fetchImpl })
  assert.equal(result, 'https://onelink.shein.com/48/OK')
})

test('T090: oneLink legítimo com parâmetro ismg_ol continua publicado tal qual, sem reescrever', async () => {
  const oneLinkComIsmgOl = 'https://onelink.shein.com/48/5zdjzeumrua5?ismg_ol=GGkS8InolgI_01_KOC-C'
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: 'tok123', memberId: '12345', appLanguage: 'pt-br' },
    shorten: { code: '0', info: { oneLink: oneLinkComIsmgOl } },
  })
  const result = await shortenSheinLink(LONG_URL, { tag: '12345', cookie: 'cookie-t090-ismg-ol' }, { fetchImpl })
  assert.equal(result, oneLinkComIsmgOl)
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

test('aceita os dois formatos de exportação do Cookie-Editor (Header string e JSON)', async () => {
  // O painel ensina a exportação JSON na Amazon, logo acima da SHEIN na mesma
  // tela. Um cliente que copiar por hábito manda JSON aqui. Sem normalizar, o
  // JSON cru iria como cabeçalho Cookie, a SHEIN responderia como visitante e a
  // oferta sairia com link comprido sem explicar por quê.
  const enviados = []
  const fetchFor = (tag) => async (url, opts) => {
    if (String(url).includes('getSiteInfo')) {
      enviados.push(opts?.headers?.Cookie)
      return { status: 200, json: async () => ({ token: 't', memberId: tag, SiteUID: 'mbr', appLanguage: 'pt-br' }) }
    }
    return { status: 200, json: async () => ({ code: '0', info: { oneLink: 'https://onelink.shein.com/48/X' } }) }
  }

  const headerString = 'sessionID=abc; x=1'
  const jsonExport = JSON.stringify([{ name: 'sessionID', value: 'abc' }, { name: 'x', value: '1' }])

  // Tags distintas para não cair no cache de sessão de uma chamada na outra.
  const a = await shortenSheinLink(LONG_URL, { tag: '1111111111', cookie: headerString }, { fetchImpl: fetchFor('1111111111') })
  const b = await shortenSheinLink(LONG_URL, { tag: '2222222222', cookie: jsonExport }, { fetchImpl: fetchFor('2222222222') })

  assert.ok(a, 'Header string deveria encurtar')
  assert.ok(b, 'exportação JSON deveria encurtar')
  assert.equal(enviados[0], headerString)
  assert.equal(enviados[1], headerString, 'JSON precisa virar o mesmo cabeçalho da Header string')
})

// ---------------------------------------------------------------------------
// T085 — ramo de ACERTO DE CACHE (a sessão memorizada é reaproveitada).
// Cada caso usa um `tag`/cookie próprio (o cache é de escopo de módulo e
// persiste entre casos do mesmo arquivo) para não contaminar os demais —
// exatamente o motivo pelo qual os testes acima usam cookie único por caso.
// ---------------------------------------------------------------------------

test('T085.1 — acerto de cache: duas chamadas com o mesmo tag+cookie fazem getSiteInfo uma vez só', async () => {
  let siteInfoCalls = 0
  const fetchImpl = async (url) => {
    if (String(url).includes('getSiteInfo')) {
      siteInfoCalls++
      return jsonResponse({ SiteUID: 'mbr', token: 'tok-t085-1', memberId: 't085-reuso', appLanguage: 'pt-br' })
    }
    return jsonResponse({ code: '0', info: { oneLink: 'https://onelink.shein.com/48/t085-reuso' } })
  }
  const creds = { tag: 't085-reuso', cookie: 'cookie-t085-reuso' }

  const first = await shortenSheinLink(LONG_URL, creds, { fetchImpl })
  const second = await shortenSheinLink(LONG_URL, creds, { fetchImpl })

  assert.equal(first, 'https://onelink.shein.com/48/t085-reuso')
  assert.equal(second, 'https://onelink.shein.com/48/t085-reuso')
  assert.equal(siteInfoCalls, 1, 'a segunda chamada deveria reaproveitar a sessão em cache, sem consultar getSiteInfo de novo')
})

test('T085.2 — troca de cookie invalida a sessão em cache (o mais importante)', async () => {
  const tag = 't085-troca'
  let siteInfoCalls = 0
  const fetchFor = (memberId) => async (url) => {
    if (String(url).includes('getSiteInfo')) {
      siteInfoCalls++
      return jsonResponse({ SiteUID: 'mbr', token: 'tok', memberId, appLanguage: 'pt-br' })
    }
    return jsonResponse({ code: '0', info: { oneLink: 'https://onelink.shein.com/48/naodeveriapublicar' } })
  }

  // 1ª sessão: cookie A, memberId bate com o tag cadastrado → cunha e cacheia.
  const first = await shortenSheinLink(LONG_URL, { tag, cookie: 'cookie-A' }, { fetchImpl: fetchFor(tag) })
  assert.ok(first, 'a primeira sessão deveria encurtar (identidade bate)')
  assert.equal(siteInfoCalls, 1)

  // 2ª chamada: MESMO tag, cookie B (de outra conta) — a sessão cacheada em
  // cookie A NÃO pode ser reaproveitada para o cookie novo. Prova que a chave
  // de cache inclui o cookie, não só o tag: se a chave fosse só o tag, esta
  // chamada devolveria o oneLink cunhado para cookie A sem tocar a rede, e
  // publicaria a sessão de uma conta para o cookie de outra.
  const second = await shortenSheinLink(LONG_URL, { tag, cookie: 'cookie-B' }, { fetchImpl: fetchFor('99999-outra-conta') })
  assert.equal(second, null, 'sessão de outra conta nunca pode ser servida — nem por reaproveitamento indevido do cache')
  assert.equal(siteInfoCalls, 2, 'a troca de cookie precisa disparar uma nova consulta a getSiteInfo, não reaproveitar a sessão anterior')
})

test('T085.3 — TTL: sessão cunhada expira e a próxima chamada re-cunha', async () => {
  const tag = 't085-ttl'
  const cookie = 'cookie-t085-ttl'
  let siteInfoCalls = 0
  const fetchImpl = async (url) => {
    if (String(url).includes('getSiteInfo')) {
      siteInfoCalls++
      return jsonResponse({ SiteUID: 'mbr', token: 'tok', memberId: tag, appLanguage: 'pt-br' })
    }
    return jsonResponse({ code: '0', info: { oneLink: 'https://onelink.shein.com/48/t085-ttl' } })
  }

  const realNow = Date.now
  try {
    const first = await shortenSheinLink(LONG_URL, { tag, cookie }, { fetchImpl })
    assert.ok(first)
    assert.equal(siteInfoCalls, 1)

    // Ainda dentro do TTL (10min) — cache hit, sem nova consulta.
    Date.now = () => realNow() + 5 * 60 * 1000
    const withinTtl = await shortenSheinLink(LONG_URL, { tag, cookie }, { fetchImpl })
    assert.ok(withinTtl)
    assert.equal(siteInfoCalls, 1)

    // Além do TTL (10min) — a sessão expirou, precisa re-cunhar.
    Date.now = () => realNow() + 11 * 60 * 1000
    const afterTtl = await shortenSheinLink(LONG_URL, { tag, cookie }, { fetchImpl })
    assert.ok(afterTtl)
    assert.equal(siteInfoCalls, 2, 'depois do TTL a sessão precisa ser re-cunhada, não servida do cache')
  } finally {
    Date.now = realNow
  }
})

// ---------------------------------------------------------------------------
// T086 — cache da RECUSA (código de acesso vencido/de outra conta, ou falha
// de rede) para não refazer a mesma consulta fadada a falhar a cada oferta.
// ---------------------------------------------------------------------------

test('T086.1 — recusa por identidade divergente é memorizada: segunda oferta não chama fetchImpl', async () => {
  const tag = 't086-recusa'
  let siteInfoCalls = 0
  const fetchImpl = async (url) => {
    siteInfoCalls++
    if (String(url).includes('getSiteInfo')) {
      return jsonResponse({ SiteUID: 'mbr', token: 'tok', memberId: '99999-outra-conta', appLanguage: 'pt-br' })
    }
    throw new Error('não deveria chegar ao gerador de link com identidade divergente')
  }
  const creds = { tag, cookie: 'cookie-t086-recusa' }

  const first = await shortenSheinLink(LONG_URL, creds, { fetchImpl })
  assert.equal(first, null)
  assert.equal(siteInfoCalls, 1)

  const second = await shortenSheinLink(LONG_URL, creds, { fetchImpl })
  assert.equal(second, null)
  assert.equal(siteInfoCalls, 1, 'a segunda oferta com o mesmo tag+cookie recusado não deveria tocar a rede de novo')
})

test('T086.2 — trocar o cookie depois de uma recusa memorizada volta a chamar a rede', async () => {
  const tag = 't086-troca-apos-recusa'
  let siteInfoCalls = 0
  const fetchFor = (memberId) => async (url) => {
    if (String(url).includes('getSiteInfo')) {
      siteInfoCalls++
      return jsonResponse({ SiteUID: 'mbr', token: 'tok', memberId, appLanguage: 'pt-br' })
    }
    return jsonResponse({ code: '0', info: { oneLink: 'https://onelink.shein.com/48/t086-troca' } })
  }

  const refused = await shortenSheinLink(LONG_URL, { tag, cookie: 'cookie-velho' }, { fetchImpl: fetchFor('') })
  assert.equal(refused, null)
  assert.equal(siteInfoCalls, 1)

  // Cliente corrigiu o código de acesso (cookie novo) — não deve ficar presa
  // à recusa memorizada até o TTL vencer.
  const fixed = await shortenSheinLink(LONG_URL, { tag, cookie: 'cookie-corrigido' }, { fetchImpl: fetchFor(tag) })
  assert.ok(fixed, 'trocar o cookie deveria permitir nova tentativa imediatamente')
  assert.equal(siteInfoCalls, 2)
})

test('T086.3 — falha de rede no getSiteInfo também é memorizada dentro do TTL', async () => {
  const tag = 't086-falha-rede'
  let siteInfoCalls = 0
  const fetchImpl = async (url) => {
    if (String(url).includes('getSiteInfo')) {
      siteInfoCalls++
      throw new Error('rede fora')
    }
    throw new Error('não deveria chegar ao gerador de link')
  }
  const creds = { tag, cookie: 'cookie-t086-falha-rede' }

  const first = await shortenSheinLink(LONG_URL, creds, { fetchImpl })
  assert.equal(first, null)
  assert.equal(siteInfoCalls, 1)

  const second = await shortenSheinLink(LONG_URL, creds, { fetchImpl })
  assert.equal(second, null)
  assert.equal(siteInfoCalls, 1, 'falha de rede recente não deveria ser retentada a cada oferta')
})

// ---------------------------------------------------------------------------
// T088 — normalização de dígitos nos dois lados da guarda de identidade
// (reusa `normalizeSheinDigits`, a mesma função do caminho de save).
// ---------------------------------------------------------------------------

test('T088.1 — memberId com zero à esquerda ainda bate com o tag sem padding', async () => {
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: 'tok', memberId: '0009876543', appLanguage: 'pt-br' },
    shorten: { code: '0', info: { oneLink: 'https://onelink.shein.com/48/t088-a' } },
  })
  const result = await shortenSheinLink(LONG_URL, { tag: '9876543', cookie: 'cookie-t088-a' }, { fetchImpl })
  assert.equal(result, 'https://onelink.shein.com/48/t088-a')
})

test('T088.2 — tag com zero à esquerda ainda bate com o memberId sem padding', async () => {
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: 'tok', memberId: '9876543', appLanguage: 'pt-br' },
    shorten: { code: '0', info: { oneLink: 'https://onelink.shein.com/48/t088-b' } },
  })
  const result = await shortenSheinLink(LONG_URL, { tag: '0009876543', cookie: 'cookie-t088-b' }, { fetchImpl })
  assert.equal(result, 'https://onelink.shein.com/48/t088-b')
})

test('T088.3 — divergência real (não é só zero à esquerda) continua recusando', async () => {
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: 'tok', memberId: '1234567', appLanguage: 'pt-br' },
    shorten: { code: '0', info: { oneLink: 'https://onelink.shein.com/48/naodeveriapublicar' } },
  })
  const result = await shortenSheinLink(LONG_URL, { tag: '9876543', cookie: 'cookie-t088-c' }, { fetchImpl })
  assert.equal(result, null)
})

// ---------------------------------------------------------------------------
// T089 — teto de entradas do cache (Map de escopo de módulo sem limite antes).
// ---------------------------------------------------------------------------

test('T089 — passar do teto de entradas descarta a mais antiga, sem quebrar o encurtamento de um tag recente', async () => {
  const siteInfoCallsByTag = new Map()
  const fetchFor = (tag) => async (url) => {
    if (String(url).includes('getSiteInfo')) {
      siteInfoCallsByTag.set(tag, (siteInfoCallsByTag.get(tag) || 0) + 1)
      return jsonResponse({ SiteUID: 'mbr', token: 'tok', memberId: tag, appLanguage: 'pt-br' })
    }
    return jsonResponse({ code: '0', info: { oneLink: `https://onelink.shein.com/48/${tag}` } })
  }
  const callFor = (tag) => shortenSheinLink(LONG_URL, { tag, cookie: `cookie-${tag}` }, { fetchImpl: fetchFor(tag) })

  const firstTag = 't089-cap-primeiro'
  await callFor(firstTag)
  assert.equal(siteInfoCallsByTag.get(firstTag), 1)

  // Insere entradas suficientes para estourar o teto (200) e empurrar a
  // primeira para fora do cache.
  for (let i = 0; i < 200; i++) {
    await callFor(`t089-cap-enchendo-${i}`)
  }

  // A primeira entrada foi descartada: precisa re-cunhar (nova consulta).
  await callFor(firstTag)
  assert.equal(siteInfoCallsByTag.get(firstTag), 2, 'a entrada mais antiga deveria ter sido descartada ao estourar o teto')

  // Uma entrada recém-inserida continua servindo do cache normalmente.
  const recentTag = 't089-cap-enchendo-199'
  await callFor(recentTag) // 2ª chamada para o mesmo tag: deveria ser cache hit
  assert.equal(siteInfoCallsByTag.get(recentTag), 1, 'uma entrada recente não deveria ter sido descartada nem exigir nova consulta')
})

// ---------------------------------------------------------------------------
// T087 — não encurtar quando o chamador descarta o link convertido
// (`shorten: false`, ligado por offerEngine quando keepOriginalLink=true).
// ---------------------------------------------------------------------------

test('T087.1 — convert() com shorten:false não chama o encurtador, publica o link longo', async () => {
  const url = 'https://br.shein.com/vestido-floral-p-485735309.html'
  let shortenerCalled = false
  const fetchImpl = async (u) => {
    if (String(u).includes('getSiteInfo') || String(u).includes('share/link/from/url')) shortenerCalled = true
    throw new Error('não deveria buscar')
  }
  const result = await convert(url, { tag: '12345', cookie: 'cookie-t087-shorten-false' }, { fetchImpl, shorten: false })
  assert.ok(result)
  assert.equal(result.linkKind, 'product')
  assert.match(result.url, /^https:\/\/br\.shein\.com\/vestido-floral-p-485735309\.html\?/)
  assert.equal(result.url.includes('onelink.shein.com'), false)
  assert.equal(shortenerCalled, false)
})

test('T087.2 — a opção shorten:false não afeta o caminho padrão (default continua encurtando)', async () => {
  const url = 'https://br.shein.com/vestido-floral-p-485735309.html'
  const oneLink = 'https://onelink.shein.com/48/t087-default'
  const fetchImpl = makeFetchImpl({
    siteInfo: { SiteUID: 'mbr', token: 'tok', memberId: '12345', appLanguage: 'pt-br' },
    shorten: { code: '0', info: { oneLink } },
  })
  const result = await convert(url, { tag: '12345', cookie: 'cookie-t087-default' }, { fetchImpl })
  assert.ok(result)
  assert.equal(result.url, oneLink, 'sem passar shorten explicitamente, o default continua encurtando (bot-worker não muda)')
})
