import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  collectSheinProductCandidates,
  consolidateSheinProductEvidence,
  extractSheinGoodsId,
  isSheinOpaqueShareEndpoint,
  isSheinShortLink,
  resolveSheinShortLink,
  SHEIN_CONVERSION_ERROR,
} from '../src/converters/shein.js'

// ---------------------------------------------------------------------------
// Contexto: o oneLink.shein.com não devolve 302 no 1º hop — serve um
// interstício HTML com o destino escondido em `<input id="url" value="...">`.
// A resolução tem que parar ANTES do captcha `/risk/challenge` (que responde
// HTTP 200 e descartaria o hop anterior, onde estão os dados). Medido ao
// vivo em `scripts/diag-shein-affiliate-link.mjs`.
// ---------------------------------------------------------------------------

function redirectResponse(location, url) {
  return {
    ok: false,
    status: 302,
    url,
    headers: {
      get: (name) => (name.toLowerCase() === 'location' ? location : null),
      getSetCookie: () => [],
    },
    text: async () => '',
  }
}

function htmlResponse(html, url, { setCookie = [] } = {}) {
  const bytes = new TextEncoder().encode(html)
  let consumed = false
  return {
    ok: true,
    status: 200,
    url,
    headers: {
      get: (name) => {
        const lower = name.toLowerCase()
        if (lower === 'content-type') return 'text/html; charset=utf-8'
        return null
      },
      getSetCookie: () => setCookie,
    },
    body: { getReader: () => ({
      read: async () => consumed ? { done: true } : (consumed = true, { done: false, value: bytes }),
      cancel: async () => {},
    }) },
    text: async () => html,
  }
}

test('isSheinShortLink reconhece onelink.shein.com e shein.top', () => {
  assert.equal(isSheinShortLink('https://onelink.shein.com/14/4v4p6bpzshsx'), true)
  assert.equal(isSheinShortLink('https://sub.onelink.shein.com/x'), true)
  assert.equal(isSheinShortLink('https://shein.top/x'), true)
  assert.equal(isSheinShortLink('https://br.shein.com/algo-p-123.html'), false)
  assert.equal(isSheinShortLink('https://notonelink.shein.com.evil.com/x'), false)
})

test('resolveSheinShortLink não busca quando a URL já revela o produto', async () => {
  const fetchImpl = async () => { throw new Error('não deveria buscar') }
  const url = 'https://br.shein.com/algo-p-485735309.html'
  assert.equal(await resolveSheinShortLink(url, { fetchImpl }), url)
})

test('1º hop 200 com <input id="url"> segue para o destino', async () => {
  const dest = 'https://m.shein.com/br/ark/default?onelink=x&requestId=y&scene=1&test=5051&ad_type=KOC&campaign=goods&campaign_id=20&koc_id=999&goods_id=485735309&url_from=affiliate_koc_999'
  const interstitial = `<html><body><input id="url" value="${dest}"></body></html>`
  let fetches = 0
  const fetchImpl = async (url) => {
    fetches++
    return htmlResponse(interstitial, url)
  }
  const resolved = await resolveSheinShortLink('https://onelink.shein.com/14/abc', { fetchImpl })
  assert.equal(resolved, dest)
  assert.equal(fetches, 1)
})

test('hop intermediário já com goods_id para ali sem pedir o próximo', async () => {
  const withGoodsId = 'https://m.shein.com/br/ark/default?goods_id=485735309&koc_id=other'
  let fetches = 0
  const fetchImpl = async (url) => {
    fetches++
    if (fetches === 1) return redirectResponse(withGoodsId, url)
    throw new Error('não deveria seguir além do hop com goods_id')
  }
  const resolved = await resolveSheinShortLink('https://onelink.shein.com/14/abc', { fetchImpl })
  assert.equal(resolved, withGoodsId)
  assert.equal(fetches, 1)
})

test('Location apontando para /risk/challenge para no hop anterior', async () => {
  const start = 'https://onelink.shein.com/14/abc'
  const fetchImpl = async (url) => redirectResponse('https://br.shein.com/risk/challenge?x=1', url)
  const resolved = await resolveSheinShortLink(start, { fetchImpl })
  assert.equal(resolved, start)
})

test('corpo HTML cujo único destino é /risk/challenge para no hop anterior', async () => {
  const start = 'https://onelink.shein.com/14/abc'
  const interstitial = '<html><body><input id="url" value="https://br.shein.com/risk/action?x=1"></body></html>'
  const fetchImpl = async (url) => htmlResponse(interstitial, url)
  const resolved = await resolveSheinShortLink(start, { fetchImpl })
  assert.equal(resolved, start)
})

test('cadeia sem fim para em maxHops', async () => {
  let n = 0
  const fetchImpl = async (url) => {
    n++
    return redirectResponse(`${url}/next`, url)
  }
  const resolved = await resolveSheinShortLink('https://onelink.shein.com/14/abc', { fetchImpl, maxHops: 3 })
  assert.equal(n, 3)
  assert.equal(resolved, 'https://onelink.shein.com/14/abc/next/next/next')
})

test('cookies do hop 1 são reenviados no hop 2', async () => {
  const hop2 = 'https://onelink.shein.com/14/hop2'
  const dest = 'https://m.shein.com/br/ark/default?goods_id=485735309'
  const seen = []
  const fetchImpl = async (url, init) => {
    seen.push({ url, cookie: init.headers.Cookie || null })
    if (url === 'https://onelink.shein.com/14/abc') {
      const res = redirectResponse(hop2, url)
      res.headers = {
        get: (name) => (name.toLowerCase() === 'location' ? hop2 : null),
        getSetCookie: () => ['sessionId=abc123; Path=/; HttpOnly'],
      }
      return res
    }
    return redirectResponse(dest, url)
  }
  const resolved = await resolveSheinShortLink('https://onelink.shein.com/14/abc', { fetchImpl })
  assert.equal(resolved, dest)
  assert.equal(seen[0].cookie, null)
  assert.match(seen[1].cookie, /sessionId=abc123/)
})

test('erro de rede degrada para a última URL conhecida (nunca lança)', async () => {
  const start = 'https://onelink.shein.com/14/abc'
  const fetchImpl = async () => { throw new Error('rede fora') }
  assert.equal(await resolveSheinShortLink(start, { fetchImpl }), start)
})

// T065 (review): sem teto, `await res.text()` carrega o corpo INTEIRO do hop
// para memória, dentro do pipeline de incoming do bot-worker (teto de heap
// 384MB). Este teste prova que a leitura para de consumir chunks assim que
// cruza o teto (512KB, mesmo valor de shopee.js), mesmo com um corpo bem
// maior disponível — e que a extração ainda funciona com o que foi lido.
test('corpo HTML maior que o teto de bytes é lido truncado, sem consumir o stream inteiro', async () => {
  const start = 'https://onelink.shein.com/14/abc'
  const dest = 'https://m.shein.com/br/ark/default?goods_id=485735309'
  const encoder = new TextEncoder()
  // O destino fica bem no início do corpo — igual ao interstício real.
  const prefix = `<html><body><input id="url" value="${dest}"></body></html>`
  const fillerChunk = encoder.encode('x'.repeat(100 * 1024)) // 100KB por chunk
  const chunks = [encoder.encode(prefix), ...Array.from({ length: 20 }, () => fillerChunk)] // corpo total ~2MB
  let readCalls = 0
  const res = {
    ok: true,
    status: 200,
    url: start,
    headers: {
      get: (name) => (name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null),
      getSetCookie: () => [],
    },
    body: {
      getReader: () => {
        let i = 0
        return {
          read: async () => {
            readCalls++
            if (i >= chunks.length) return { done: true, value: undefined }
            return { done: false, value: chunks[i++] }
          },
          cancel: async () => {},
        }
      },
    },
    // Se o código caísse de volta em res.text(), este teste acusaria: não é
    // esse o caminho esperado quando body.getReader() está disponível.
    text: async () => { throw new Error('não deveria usar text() quando body.getReader existe') },
  }
  const fetchImpl = async () => res
  const resolved = await resolveSheinShortLink(start, { fetchImpl })
  assert.equal(resolved, dest, 'a extração deve funcionar com o corpo truncado, já que o destino vem no início')
  assert.ok(
    readCalls < chunks.length,
    `esperava parar de ler chunks antes do fim do stream (leu ${readCalls} de ${chunks.length})`,
  )
})

// T066 (review): antes, `timeoutMs` era aplicado a CADA hop (8s × maxHops=6 =
// até 48s de pior caso), acima do MSG_QUEUE_TIMEOUT_MS (25s) do incoming —
// uma cadeia lenta perdia a MENSAGEM INTEIRA como timeout:incoming. Agora
// `totalTimeoutMs` é um orçamento compartilhado entre todos os hops.
test('orçamento TOTAL da resolução é respeitado mesmo com hops individualmente rápidos', async () => {
  const start = 'https://onelink.shein.com/14/abc'
  let fetches = 0
  const fetchImpl = async (url) => {
    fetches++
    await new Promise((resolve) => setTimeout(resolve, 20))
    return redirectResponse(`${url}/next`, url)
  }
  const startedAt = Date.now()
  const resolved = await resolveSheinShortLink(start, { fetchImpl, totalTimeoutMs: 45, maxHops: 6 })
  const elapsedMs = Date.now() - startedAt
  assert.ok(
    fetches < 6,
    `deveria parar antes de completar os 6 hops de 20ms cada (parou em ${fetches} chamadas)`,
  )
  assert.ok(
    elapsedMs < 6 * 20 + 40,
    `tempo total (${elapsedMs}ms) não pode se aproximar do pior caso por-hop (6 × 20ms+)`,
  )
  assert.equal(typeof resolved, 'string')
})

test('estouro do prazo total via AbortSignal nunca lança — degrada para a última URL conhecida', async () => {
  const start = 'https://onelink.shein.com/14/abc'
  const fetchImpl = async (url, init) => new Promise((resolve, reject) => {
    // Timer só para manter o event loop vivo até o abort disparar — o timer
    // interno de AbortSignal.timeout() não é `ref`'d por si só.
    const keepAlive = setTimeout(() => {}, 1000)
    init.signal.addEventListener('abort', () => {
      clearTimeout(keepAlive)
      reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))
    })
  })
  const resolved = await resolveSheinShortLink(start, { fetchImpl, totalTimeoutMs: 20, maxHops: 3 })
  assert.equal(resolved, start)
})

test('extractSheinGoodsId cobre caminho -p-<id>.html e query goods_id', () => {
  assert.equal(extractSheinGoodsId('https://br.shein.com/algo-p-485735309.html'), '485735309')
  assert.equal(extractSheinGoodsId('https://br.shein.com/algo-p-485735309-cat-123.html'), '485735309')
  assert.equal(extractSheinGoodsId('https://m.shein.com/br/ark/default?goods_id=1234'), '1234')
  assert.equal(extractSheinGoodsId('https://m.shein.com/br/ark/default'), null)
})

test('endpoint opaco exige protocolo, host e caminho exatos e rejeita credenciais', () => {
  assert.equal(isSheinOpaqueShareEndpoint('https://api-shein.shein.com/h5/sharejump/appjump?shc=x'), true)
  for (const value of [
    'http://api-shein.shein.com/h5/sharejump/appjump',
    'https://user:pass@api-shein.shein.com/h5/sharejump/appjump',
    'https://x.api-shein.shein.com/h5/sharejump/appjump',
    'https://api-shein.shein.com.evil.test/h5/sharejump/appjump',
    'https://api-shein.shein.com/h5/sharejump/appjump/extra',
  ]) assert.equal(isSheinOpaqueShareEndpoint(value), false, value)
})

test('extração estática aceita só produto HTTPS oficial sem credenciais', () => {
  const body = `
    <link rel="canonical" href="https://br.shein.com/item-p-123456.html?utm_source=x">
    <a href="/br/ark/default?goods_id=123456">ok</a>
    <a href="http://br.shein.com/item-p-9.html">http</a>
    <a href="https://shein.com.evil.test/item-p-8.html">evil</a>
    <a href="https://u:p@br.shein.com/item-p-7.html">creds</a>
  `
  const candidates = collectSheinProductCandidates(body, 'https://api-shein.shein.com/h5/sharejump/appjump')
  assert.deepEqual(new Set(candidates.map(x => x.goodsId)), new Set(['123456']))
})

test('prova deduplica mesmo produto e falha fechado para zero ou ambiguidade', () => {
  const one = { goodsId: '123456', url: 'https://br.shein.com/item-p-123456.html' }
  const same = { goodsId: '123456', url: 'https://m.shein.com/br/ark/default?goods_id=123456' }
  assert.deepEqual(consolidateSheinProductEvidence([one, same]), { status: 'resolved', goodsId: '123456', url: one.url })
  assert.deepEqual(consolidateSheinProductEvidence([]), { status: 'unproven' })
  assert.deepEqual(consolidateSheinProductEvidence([one, { goodsId: '9', url: 'https://br.shein.com/x-p-9.html' }]), { status: 'unproven' })
})

test('cadeia opaca usa os mesmos hops/cookies e só retorna produto provado', async () => {
  const start = 'https://onelink.shein.com/50/synthetic?shc=synthetic'
  const opaque = 'https://api-shein.shein.com/h5/sharejump/appjump?shc=synthetic&link=synthetic'
  const product = 'https://m.shein.com/br/ark/default?goods_id=123456'
  const seen = []
  const fetchImpl = async (url, init) => {
    seen.push({ url, cookie: init.headers.Cookie || null })
    if (url === start) return htmlResponse(`<input id="url" value="${opaque}">`, url, { setCookie: ['session=synthetic; Path=/'] })
    return htmlResponse(`<script type="application/json">{"canonical":"${product}"}</script>`, url)
  }
  const result = await resolveSheinShortLink(start, { fetchImpl, returnDetails: true })
  assert.equal(result.url, product)
  assert.equal(result.evidence.goodsId, '123456')
  assert.equal(result.errorCode, null)
  assert.equal(seen.length, 2)
  assert.match(seen[1].cookie, /session=synthetic/)
})

test('endpoint opaco sem prova retorna classificação segura, nunca intermediário como prova', async () => {
  const start = 'https://onelink.shein.com/50/synthetic'
  const opaque = 'https://api-shein.shein.com/h5/sharejump/appjump?shc=synthetic&link=synthetic'
  const fetchImpl = async (url) => htmlResponse(
    url === start ? `<input id="url" value="${opaque}">` : '<html>sem produto</html>',
    url,
  )
  const result = await resolveSheinShortLink(start, { fetchImpl, returnDetails: true })
  assert.equal(result.errorCode, SHEIN_CONVERSION_ERROR.OPAQUE_PRODUCT_UNPROVEN)
  assert.equal(result.evidence?.status, 'unproven')
})

function opaqueStartResponse(start, opaque) {
  return htmlResponse(`<input id="url" value="${opaque}">`, start)
}

test('corpo opaco truncado falha fechado mesmo com candidato antes de 512 KiB', async () => {
  const start = 'https://onelink.shein.com/50/body-limit'
  const opaque = 'https://api-shein.shein.com/h5/sharejump/appjump?shc=x&link=y'
  const encoder = new TextEncoder()
  const prefix = encoder.encode('https://m.shein.com/br/ark/default?goods_id=123456\n')
  const chunks = [prefix, ...Array.from({ length: 7 }, () => encoder.encode('x'.repeat(100 * 1024)))]
  const fetchImpl = async (url) => {
    if (url === start) return opaqueStartResponse(start, opaque)
    return {
      ...htmlResponse('', opaque),
      body: { getReader: () => ({
        read: async () => chunks.length ? { done: false, value: chunks.shift() } : { done: true },
        cancel: async () => {},
      }) },
    }
  }
  const result = await resolveSheinShortLink(start, { fetchImpl, returnDetails: true })
  assert.equal(result.errorCode, SHEIN_CONVERSION_ERROR.RESOLUTION_TRANSIENT)
  assert.equal(result.evidence, null)
})

test('ciclo e esgotamento de hops são transitórios e nunca viram prova', async () => {
  const start = 'https://onelink.shein.com/50/cycle'
  const hop = 'https://onelink.shein.com/50/hop'
  const cycleFetch = async url => redirectResponse(url === start ? hop : start, url)
  const cycle = await resolveSheinShortLink(start, { fetchImpl: cycleFetch, returnDetails: true })
  assert.equal(cycle.errorCode, SHEIN_CONVERSION_ERROR.RESOLUTION_TRANSIENT)
  assert.equal(cycle.evidence, null)

  const hopsFetch = async url => redirectResponse(`${url}/next`, url)
  const hops = await resolveSheinShortLink(start, { fetchImpl: hopsFetch, maxHops: 6, returnDetails: true })
  assert.equal(hops.errorCode, SHEIN_CONVERSION_ERROR.RESOLUTION_TRANSIENT)
  assert.equal(hops.evidence, null)
})

test('deadline no caminho opaco é transitório e não publica evidência parcial', async () => {
  const start = 'https://onelink.shein.com/50/deadline'
  const fetchImpl = async (_url, init) => new Promise((_resolve, reject) => {
    const keepAlive = setTimeout(() => {}, 100)
    init.signal.addEventListener('abort', () => {
      clearTimeout(keepAlive)
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    })
  })
  const result = await resolveSheinShortLink(start, { fetchImpl, totalTimeoutMs: 10, returnDetails: true })
  assert.equal(result.errorCode, SHEIN_CONVERSION_ERROR.RESOLUTION_TRANSIENT)
  assert.equal(result.evidence, null)
})

test('redirect inseguro nunca recebe fetch e não vira fallback', async () => {
  for (const unsafe of [
    'http://m.shein.com/br/ark/default?goods_id=1',
    'https://user:pass@m.shein.com/br/ark/default?goods_id=1',
    'https://shein.com.evil.test/item-p-1.html',
  ]) {
    let calls = 0
    const fetchImpl = async url => {
      calls++
      if (calls > 1) throw new Error(`destino inseguro recebeu fetch: ${url}`)
      return redirectResponse(unsafe, url)
    }
    const result = await resolveSheinShortLink('https://onelink.shein.com/50/unsafe', { fetchImpl, returnDetails: true })
    assert.equal(calls, 1)
    assert.equal(result.errorCode, SHEIN_CONVERSION_ERROR.OPAQUE_PRODUCT_UNPROVEN)
    assert.equal(result.evidence, null)
  }
})

test('HTML opaco ambíguo ou só com candidatos inseguros não comprova produto', async () => {
  const start = 'https://onelink.shein.com/50/adversarial'
  const opaque = 'https://api-shein.shein.com/h5/sharejump/appjump?shc=x&link=y'
  for (const html of [
    '<a href="https://m.shein.com/a-p-1.html"></a><a href="https://br.shein.com/b-p-2.html"></a>',
    '<a href="http://m.shein.com/a-p-1.html"></a><a href="https://evil.test/b-p-1.html"></a><a href="https://u:p@m.shein.com/c-p-1.html"></a>',
  ]) {
    const fetchImpl = async url => url === start ? opaqueStartResponse(start, opaque) : htmlResponse(html, opaque)
    const result = await resolveSheinShortLink(start, { fetchImpl, returnDetails: true })
    assert.equal(result.errorCode, SHEIN_CONVERSION_ERROR.OPAQUE_PRODUCT_UNPROVEN)
    assert.notEqual(result.evidence?.status, 'resolved')
  }
})

test('endpoint opaco sem Web Stream recusa antes de materializar res.text()', async () => {
  const opaque = 'https://api-shein.shein.com/h5/sharejump/appjump?shc=x&link=y'
  let textCalls = 0
  const fetchImpl = async () => ({
    status: 200,
    headers: { get: name => name.toLowerCase() === 'content-type' ? 'text/html' : null, getSetCookie: () => [] },
    text: async () => {
      textCalls++
      return `https://m.shein.com/a-p-123456.html${'x'.repeat(2 * 1024 * 1024)}`
    },
  })
  const result = await resolveSheinShortLink(opaque, { fetchImpl, returnDetails: true })
  assert.equal(textCalls, 0)
  assert.equal(result.errorCode, SHEIN_CONVERSION_ERROR.RESOLUTION_TRANSIENT)
  assert.equal(result.evidence, null)
})

test('todas as respostas opacas sem prova recebem classificação explícita', async () => {
  const opaque = 'https://api-shein.shein.com/h5/sharejump/appjump?shc=x&link=y'
  const response = ({ status = 200, contentType = 'text/html', location = null, html = '' }) => {
    const res = htmlResponse(html, opaque)
    res.status = status
    res.headers.get = name => {
      if (name.toLowerCase() === 'content-type') return contentType
      if (name.toLowerCase() === 'location') return location
      return null
    }
    return res
  }
  const cases = [
    [response({ status: 503 }), SHEIN_CONVERSION_ERROR.RESOLUTION_TRANSIENT],
    [response({ status: 429 }), SHEIN_CONVERSION_ERROR.RESOLUTION_TRANSIENT],
    [response({ status: 404 }), SHEIN_CONVERSION_ERROR.OPAQUE_PRODUCT_UNPROVEN],
    [response({ contentType: 'application/json', html: '{}' }), SHEIN_CONVERSION_ERROR.OPAQUE_PRODUCT_UNPROVEN],
    [response({ location: 'http://[malformed' }), SHEIN_CONVERSION_ERROR.OPAQUE_PRODUCT_UNPROVEN],
    [response({ location: 'https://br.shein.com/risk/challenge' }), SHEIN_CONVERSION_ERROR.OPAQUE_PRODUCT_UNPROVEN],
  ]
  for (const [res, expected] of cases) {
    const result = await resolveSheinShortLink(opaque, { fetchImpl: async () => res, returnDetails: true })
    assert.equal(result.errorCode, expected)
    assert.equal(result.evidence, null)
  }
})
