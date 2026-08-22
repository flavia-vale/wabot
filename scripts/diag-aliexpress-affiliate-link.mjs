// Probe diagnóstico do ALIEXPRESS (rodar ANTES de implementar a loja).
//
// Responde a ÚNICA pergunta que decide se vale implementar o AliExpress:
// "como a comissão é creditada — por link assinado emitido pela API oficial,
// ou por parâmetro pendurado na URL do produto?"
//
// É a mesma armadilha já documentada no AGENTS.md para o Mercado Livre
// (pendurar `partner_id` em página não-produto NÃO credita) e para a Amazon
// (RCA 2026-07: o link saía bonito e a comissão ia para o vazio por 8 dias).
// Descobrir isso agora custa minutos; descobrir depois custa semanas de
// comissão perdida em silêncio.
//
// Uso:
//   node scripts/diag-aliexpress-affiliate-link.mjs '<SEU link de afiliada>' \
//     ['<link de OUTRO afiliado, do tipo que chega no grupo>'] \
//     [--app-key=... --app-secret=... --tracking-id=...]
//
//   As credenciais da API (quando existirem) também podem vir do ambiente:
//     ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET, ALIEXPRESS_TRACKING_ID
//
// Ex.:
//   node scripts/diag-aliexpress-affiliate-link.mjs 'https://s.click.aliexpress.com/e/_oSEULINK' \
//     'https://s.click.aliexpress.com/e/_oLINKDOUTRO'
//
// Há DOIS caminhos possíveis de conversão, e o script mede os dois:
//   A) API oficial (`aliexpress.affiliate.link.generate`) — o caminho forte, do
//      mesmo formato da Shopee. Exige acesso à API liberado no painel de
//      afiliada; sem isso, esta parte é pulada.
//   B) Transplante de identidade — pegar o que identifica a cliente no link
//      dela e aplicar no endereço do produto do outro afiliado, como é feito
//      hoje na SHEIN e no Magalu. NÃO É PROVADO: é justamente a hipótese que o
//      clique no celular (seção 5) decide.
//
// O script é READ-ONLY: não toca no banco, não envia mensagem, não grava nada.
// Ele resolve o link, mostra quem ganha a comissão hoje, tenta montar o link
// da cliente pela API oficial e confere que nenhum identificador de terceiro
// sobrou. QUEM decide é a cliente, clicando no celular (seção 5).

import crypto from 'crypto'

// ─────────────────────────────────────────────────────────────────────────────
// Constantes medidas ao vivo (2026-08-22, deste servidor)
// ─────────────────────────────────────────────────────────────────────────────

// Endpoint do gateway de APIs da Alibaba usado pelo programa de afiliados.
// Medido: responde 200 e cobra `sign`; com `sign` presente e app_key falso,
// devolve `InvalidAppKey` ANTES de conferir a assinatura — é isso que permite
// separar "credencial errada" de "assinatura errada" na seção 3.
const API_ENDPOINT = 'https://api-sg.aliexpress.com/sync'
const API_METHOD_LINK_GENERATE = 'aliexpress.affiliate.link.generate'

// Página de produto: `/item/<id>.html` (formato atual) ou `/i/<id>.html`
// (formato legado). O id também aparece em query (`productId`/`itemId`).
const AE_ITEM_PATH_RE = /\/(?:item|i)\/(?:[\w-]+\/)?(\d{6,})\.html/i
const AE_ITEM_QUERY_RE = /[?&](?:productId|itemId|product_id)=(\d{6,})/i

// Encurtadores do programa de afiliados.
const AE_SHORT_LINK_RE = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:s\.click\.aliexpress\.com|a\.aliexpress\.com|star\.aliexpress\.com)\//i

// MEDIDO: short link inválido/expirado NÃO dá erro — devolve 302 para
// `https://best.aliexpress.com` (vitrine genérica). É o análogo da armadilha
// `/ark/default` da SHEIN: cair aqui é "a resolução falhou", nunca "é um
// cupom". Publicar isso mandaria a cliente para uma vitrine sem produto.
const AE_FALLBACK_LANDING_RE = /^https?:\/\/(?:[a-z0-9-]+\.)*best\.aliexpress\.[a-z.]+\/?$/i

// Parâmetros que aparecem num link de afiliado do AliExpress. Os de IDENTIDADE
// são os candidatos a carregar o crédito da comissão; os demais são rastro da
// sessão de quem gerou o link.
// `aff_trace_key` e `terminal_id` NÃO entram aqui de propósito: eles marcam o
// clique/dispositivo que gerou o link, não a afiliada. Transplantá-los seria
// copiar rastro de sessão sem ganho nenhum de comissão.
const IDENTITY_PARAMS = ['aff_fcid', 'aff_short_key', 'sk', 'af', 'cv', 'cn', 'dp']
const SESSION_PARAMS = ['aff_platform', 'aff_fsk', 'aff_trace_key', 'terminal_id', 'tt', 'shareId', 'businessType', 'templateId', 'spreadType']

const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'

const MAX_HOPS = 8
const TOTAL_TIMEOUT_MS = 15000
// Teto de bytes por corpo lido, mesmo padrão dos conversores irmãos
// (Shopee 512KB, Amazon 256KB): sem teto, um hop de terceiro que sirva um
// corpo grande é lido inteiro para a memória.
const BODY_MAX_BYTES = 512 * 1024

const HTML_REDIRECT_PATTERNS = [
  /<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url=([^"'>\s]+)/i,
  /(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i,
  /<input[^>]+id=["']url["'][^>]+value=["']([^"']+)["']/i,
  /<link[^>]+rel=["']?canonical["']?[^>]+href=["']([^"']+)["']/i,
]

// ─────────────────────────────────────────────────────────────────────────────
// Leitura de link
// ─────────────────────────────────────────────────────────────────────────────

function isShortLink(url) {
  return AE_SHORT_LINK_RE.test(String(url || ''))
}

export function extractItemId(url) {
  const str = String(url || '')
  return str.match(AE_ITEM_PATH_RE)?.[1] || str.match(AE_ITEM_QUERY_RE)?.[1] || null
}

function isFallbackLanding(url) {
  try {
    const u = new URL(String(url))
    return AE_FALLBACK_LANDING_RE.test(`${u.protocol}//${u.host}${u.pathname}`)
  } catch {
    return false
  }
}

function extractRedirectFromHtml(html, baseUrl) {
  for (const re of HTML_REDIRECT_PATTERNS) {
    const m = html.match(re)
    if (m?.[1]) {
      try {
        return new URL(m[1].replace(/&amp;/g, '&'), baseUrl).toString()
      } catch {}
    }
  }
  return null
}

async function readBodyLimited(res) {
  try {
    if (!res?.body?.getReader) {
      const text = await res?.text?.()
      return typeof text === 'string' ? text.slice(0, BODY_MAX_BYTES) : null
    }
    const reader = res.body.getReader()
    const chunks = []
    let received = 0
    while (received < BODY_MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.byteLength
    }
    await reader.cancel().catch(() => {})
    const body = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }
    return new TextDecoder().decode(body)
  } catch {
    return null
  }
}

// Segue redirects MANUALMENTE, com cookie jar. Nunca `redirect: 'follow'`:
// o hop informativo se perde (mesma lição da Shopee e da SHEIN). Orçamento de
// tempo é TOTAL da cadeia, não por salto.
async function resolveChain(startUrl) {
  const hops = []
  let current = String(startUrl)
  const cookieJar = new Map()
  const deadlineAt = Date.now() + TOTAL_TIMEOUT_MS

  for (let i = 0; i < MAX_HOPS; i++) {
    const remainingMs = deadlineAt - Date.now()
    if (remainingMs <= 0) {
      hops.push({ url: current, status: 'PRAZO ESGOTADO' })
      break
    }

    const cookieHeader = [...cookieJar].map(([k, v]) => `${k}=${v}`).join('; ')
    let res
    try {
      res = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(remainingMs),
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      })
    } catch (err) {
      hops.push({ url: current, status: 'ERRO DE REDE', note: err?.message || String(err) })
      break
    }

    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';')
      const idx = pair.indexOf('=')
      if (idx > 0) cookieJar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim())
    }

    hops.push({ url: current, status: res.status })

    if (extractItemId(current)) {
      hops[hops.length - 1].note = 'produto identificado — parando aqui'
      break
    }

    const location = res.headers.get('location')
    if (location) {
      let next
      try {
        next = new URL(location, current).toString()
      } catch {
        break
      }
      if (isFallbackLanding(next)) {
        hops[hops.length - 1].note = 'próximo hop é a vitrine genérica (best.aliexpress.com) — link morto/expirado'
        current = next
        hops.push({ url: current, status: '(vitrine genérica)' })
        break
      }
      current = next
      continue
    }

    if (!String(res.headers.get('content-type') || '').includes('text/html')) break

    const html = await readBodyLimited(res)
    if (!html) break

    const next = extractRedirectFromHtml(html, current)
    if (!next || next === current) {
      hops[hops.length - 1].note = 'fim da cadeia (sem redirect no corpo)'
      break
    }
    current = next
  }

  return { finalUrl: current, hops }
}

function readAffiliateParams(url) {
  const found = {}
  try {
    const u = new URL(url)
    for (const key of [...IDENTITY_PARAMS, ...SESSION_PARAMS]) {
      const value = u.searchParams.get(key)
      if (value) found[key] = value
    }
  } catch {}
  return found
}

// ─────────────────────────────────────────────────────────────────────────────
// API oficial de afiliados
// ─────────────────────────────────────────────────────────────────────────────

// Duas convenções de assinatura circulam para este gateway: a base é a
// concatenação dos parâmetros ordenados por nome, com ou sem o caminho da API
// (`/sync`) na frente. Qual delas vale só se descobre com credencial de
// verdade — por isso o script TENTA AS DUAS e diz qual foi aceita. É medição,
// não suposição.
function signParams(params, appSecret, { withPath }) {
  const base = Object.keys(params).sort().map((k) => k + params[k]).join('')
  const payload = withPath ? `/sync${base}` : base
  return crypto.createHmac('sha256', appSecret).update(payload).digest('hex').toUpperCase()
}

async function generateOfficialLink(sourceUrl, { appKey, appSecret, trackingId }, { withPath }) {
  const params = {
    app_key: appKey,
    method: API_METHOD_LINK_GENERATE,
    sign_method: 'sha256',
    timestamp: String(Date.now()),
    v: '2.0',
    promotion_link_type: '0',
    source_values: sourceUrl,
    tracking_id: trackingId,
  }
  const sign = signParams(params, appSecret, { withPath })
  const qs = new URLSearchParams({ ...params, sign }).toString()

  const res = await fetch(`${API_ENDPOINT}?${qs}`, {
    signal: AbortSignal.timeout(15000),
    headers: { 'User-Agent': BROWSER_UA },
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: `resposta não-JSON (HTTP ${res.status})`, raw: text.slice(0, 300) }
  }

  if (json.error_response) {
    return { ok: false, error: `${json.error_response.code}: ${json.error_response.msg}`, raw: json }
  }

  const result =
    json?.aliexpress_affiliate_link_generate_response?.resp_result ??
    json?.resp_result ??
    null
  if (!result) return { ok: false, error: 'formato de resposta inesperado', raw: json }
  if (Number(result.resp_code) !== 200) {
    return { ok: false, error: `resp_code ${result.resp_code}: ${result.resp_msg}`, raw: json }
  }

  const link =
    result?.result?.promotion_links?.promotion_link?.[0]?.promotion_link ??
    result?.result?.promotion_links?.[0]?.promotion_link ??
    null
  if (!link) return { ok: false, error: 'a API respondeu sem link de promoção', raw: json }
  return { ok: true, link, raw: json }
}

// ─────────────────────────────────────────────────────────────────────────────
// Caminho B — transplante de identidade (hipótese, NÃO provada)
// ─────────────────────────────────────────────────────────────────────────────

// Rastro da SESSÃO de quem gerou o link: nunca é copiado para o link novo.
// (`aff_trace_key` e `terminal_id` identificam o clique/dispositivo de origem,
// não a afiliada; `afSmartRedirect` é comportamento de página.)
const SESSION_ONLY_PARAMS = ['aff_trace_key', 'terminal_id', 'afSmartRedirect', 'tt', 'shareId', 'spreadType', 'templateId', 'businessType']

// Remove de uma URL do AliExpress tudo que identifica um afiliado ou a sessão
// dele, preservando o caminho e os parâmetros que descrevem o DESTINO (sem eles
// a página não sabe qual produto abrir). Pura e idempotente.
export function stripAliexpressAffiliateTracking(url) {
  try {
    const u = new URL(String(url))
    const remove = new Set([...IDENTITY_PARAMS, ...SESSION_PARAMS, ...SESSION_ONLY_PARAMS].map((k) => k.toLowerCase()))
    for (const key of [...u.searchParams.keys()]) {
      if (remove.has(key.toLowerCase()) || /^utm_/i.test(key)) u.searchParams.delete(key)
    }
    // Fragmento também pode carregar identificador escondido — some.
    u.hash = ''
    return u.toString()
  } catch {
    return String(url)
  }
}

// Monta o link da cliente pelo caminho B: endereço do produto do OUTRO
// afiliado, limpo, recebendo só o que identifica ELA no link dela.
// Devolve `null` quando não dá para montar com segurança.
function buildTransplantedLink(productUrl, myIdentityParams) {
  if (!extractItemId(productUrl)) return null
  const mine = Object.entries(myIdentityParams).filter(([key]) => IDENTITY_PARAMS.includes(key))
  if (mine.length === 0) return null
  try {
    const u = new URL(stripAliexpressAffiliateTracking(productUrl))
    for (const [key, value] of mine) u.searchParams.set(key, value)
    return u.toString()
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Saída
// ─────────────────────────────────────────────────────────────────────────────

function line(char = '─') {
  return char.repeat(72)
}

function parseArgs(argv) {
  const out = { positional: [] }
  for (const arg of argv) {
    const m = arg.match(/^--([a-z-]+)=(.*)$/)
    if (m) out[m[1]] = m[2]
    else out.positional.push(arg)
  }
  return out
}

function printHops(hops) {
  for (const [i, hop] of hops.entries()) {
    console.log(`   ${i + 1}. [${hop.status}] ${hop.url}`)
    if (hop.note) console.log(`      ↳ ${hop.note}`)
  }
}

function describeDestination(finalUrl) {
  if (isFallbackLanding(finalUrl)) {
    console.log('\n   ✘ A cadeia terminou na vitrine genérica do AliExpress.')
    console.log('     Isso quer dizer que o link curto está morto/expirado — NÃO é cupom.')
    console.log('     Em produção, esse caso precisa virar falha honesta (nada publicado).')
    return null
  }
  const itemId = extractItemId(finalUrl)
  if (itemId) console.log(`   Produto identificado: ${itemId}`)
  else console.log('   ⚠ Nenhum código de produto na URL final (pode ser cupom/campanha/vitrine).')
  return itemId
}

function printAffiliateParams(params, { emptyHint }) {
  if (Object.keys(params).length === 0) {
    console.log(`   ⚠ Nenhum parâmetro de afiliado encontrado. ${emptyHint}`)
    return
  }
  for (const [key, value] of Object.entries(params)) {
    const isIdentity = IDENTITY_PARAMS.includes(key)
    console.log(`   ${isIdentity ? '✔' : '·'} ${key} = ${value}`)
  }
  console.log('\n   (✔ = provável identificador do afiliado; · = rastro da sessão de quem gerou)')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const myLink = args.positional[0]
  const otherLink = args.positional[1]

  const appKey = args['app-key'] || process.env.ALIEXPRESS_APP_KEY || ''
  const appSecret = args['app-secret'] || process.env.ALIEXPRESS_APP_SECRET || ''
  const trackingId = args['tracking-id'] || process.env.ALIEXPRESS_TRACKING_ID || ''

  if (!myLink) {
    console.error('Falta o SEU link de afiliada do AliExpress.\n')
    console.error("Uso: node scripts/diag-aliexpress-affiliate-link.mjs '<seu link>' \\")
    console.error("       ['<link de outro afiliado>'] [--app-key=... --app-secret=... --tracking-id=...]")
    process.exitCode = 1
    return
  }

  console.log(line('═'))
  console.log('TESTE DE COMISSÃO DO ALIEXPRESS — read-only, nada é enviado nem gravado')
  console.log(line('═'))

  console.log('\n1) RESOLVENDO O SEU LINK DE AFILIADA\n')
  const mine = await resolveChain(myLink)
  printHops(mine.hops)
  console.log(`\n   Chegou em: ${mine.finalUrl}`)
  const myItemId = describeDestination(mine.finalUrl)

  console.log('\n2) O QUE IDENTIFICA VOCÊ NESSE LINK\n')
  const myParams = readAffiliateParams(mine.finalUrl)
  printAffiliateParams(myParams, {
    emptyHint: 'A atribuição pode estar só no cookie do redirecionamento — nesse caso a URL sozinha não carrega o crédito, e o único caminho é a API oficial.',
  })

  let productUrl = null
  let otherParams = {}
  if (otherLink) {
    console.log('\n3) RESOLVENDO O LINK DO OUTRO AFILIADO (o caso real do grupo)\n')
    const other = await resolveChain(otherLink)
    printHops(other.hops)
    console.log(`\n   Chegou em: ${other.finalUrl}`)
    describeDestination(other.finalUrl)
    otherParams = readAffiliateParams(other.finalUrl)
    console.log('\n   Quem ganha a comissão HOJE nesse link:')
    printAffiliateParams(otherParams, { emptyHint: 'Nada na URL — a atribuição dele pode estar no cookie.' })
    productUrl = other.finalUrl
  } else if (myItemId) {
    productUrl = mine.finalUrl
  }

  console.log('\n4) MONTANDO O LINK DA CLIENTE\n')

  console.log('   CAMINHO A — API oficial de afiliados (o caminho forte)\n')
  let apiLink = null
  if (!appKey || !appSecret || !trackingId) {
    console.log('   ⚠ Sem credenciais de API — pulando.')
    console.log('     Onde pegar: portals.aliexpress.com → Ferramentas → API (chave e segredo)')
    console.log('     e Conta → Tracking ID. Se o acesso à API ainda não foi liberado, é preciso')
    console.log('     solicitar por lá (Apply Now) e esperar a aprovação.')
  } else if (!productUrl) {
    console.log('   ⚠ Sem um endereço de produto para enviar à API — passe o link do outro')
    console.log('     afiliado como 2º argumento.')
  } else {
    const itemId = extractItemId(productUrl)
    const sourceUrl = itemId ? `https://www.aliexpress.com/item/${itemId}.html` : stripAliexpressAffiliateTracking(productUrl)
    console.log(`   Origem enviada à API: ${sourceUrl}`)
    for (const withPath of [false, true]) {
      const label = withPath ? 'com /sync na base' : 'sem /sync na base'
      let out
      try {
        out = await generateOfficialLink(sourceUrl, { appKey, appSecret, trackingId }, { withPath })
      } catch (err) {
        out = { ok: false, error: err?.message || String(err) }
      }
      if (out.ok) {
        console.log(`   ✔ assinatura ${label} — ACEITA`)
        apiLink = out.link
        break
      }
      console.log(`   ✘ assinatura ${label} — ${out.error}`)
    }
    if (apiLink) console.log(`\n   LINK GERADO PELA API: ${apiLink}`)
    else console.log('\n   Nenhuma das duas convenções de assinatura foi aceita (ver mensagem acima).')
  }

  console.log('\n   CAMINHO B — transplante de identidade (HIPÓTESE, não provada)\n')
  let transplanted = null
  if (!productUrl) {
    console.log('   ⚠ Sem endereço de produto — passe o link do outro afiliado como 2º argumento.')
  } else {
    transplanted = buildTransplantedLink(productUrl, myParams)
    if (!transplanted) {
      console.log('   ✘ NÃO DÁ PARA MONTAR ESSE LINK COM SEGURANÇA.')
      if (!extractItemId(productUrl)) console.log('     Falta o código do produto na URL final.')
      if (Object.keys(myParams).filter((k) => IDENTITY_PARAMS.includes(k)).length === 0) {
        console.log('     Não há nada na URL do seu link que identifique você — sem isso, só a API.')
      }
    } else {
      console.log(`   ${transplanted}`)
    }
  }

  const candidates = [['A (API)', apiLink], ['B (transplante)', transplanted]].filter(([, v]) => v)
  if (candidates.length && Object.keys(otherParams).length) {
    console.log('\n   Conferência de segurança (invariante do produto: link de terceiro nunca sai):')
    for (const [label, link] of candidates) {
      // Confere TODOS os parâmetros do terceiro (identidade E sessão): a
      // invariante é que nada dele sobrevive, nem em pedaço.
      const leaked = Object.keys(otherParams)
        .filter((key) => String(link).includes(otherParams[key]))
      if (leaked.length === 0) console.log(`   ✔ ${label}: nenhum identificador do outro afiliado sobrou`)
      else console.log(`   ✘ ${label}: VAZOU ${leaked.join(', ')} — não use esse link, a comissão iria para ele`)
    }
  }

  console.log('\n5) COMO CONCLUIR O TESTE (só você pode fazer)\n')
  console.log('   1. Anote quantos cliques o painel do AliExpress mostra HOJE.')
  console.log('   2. No CELULAR, abra o(s) link(s) montado(s) acima. Navegue um pouco.')
  console.log('   3. Espere o painel atualizar (pode levar horas).')
  console.log('   4. Se o clique aparecer → aquele caminho credita, e a loja pode ser')
  console.log('      implementada por ele. Se NÃO aparecer → converter link por esse')
  console.log('      caminho seria trabalhar de graça.')
  console.log('\n   Se os dois caminhos forem testados no mesmo dia, teste UM POR VEZ —')
  console.log('   senão não dá para saber qual deles gerou o clique.')
  console.log('   Faça com o celular fora do WiFi de casa se puder, para não confundir')
  console.log('   com um clique seu anterior.\n')
}

main().catch((err) => {
  console.error('Falhou:', err?.message || err)
  process.exitCode = 1
})
