import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveSheinShortLink, isSheinShortLink, extractSheinGoodsId } from '../src/converters/shein.js'

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
