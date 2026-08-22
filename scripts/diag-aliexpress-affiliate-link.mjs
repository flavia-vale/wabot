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
//   node scripts/diag-aliexpress-affiliate-link.mjs '<link que chegou no grupo>' \
//     [--app-key=... --app-secret=... --tracking-id=...]
//
//   As credenciais também podem vir do ambiente:
//     ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET, ALIEXPRESS_TRACKING_ID
//
// Ex.:
//   node scripts/diag-aliexpress-affiliate-link.mjs 'https://s.click.aliexpress.com/e/_oABC123'
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
const IDENTITY_PARAMS = ['aff_fcid', 'aff_short_key', 'aff_trace_key', 'sk', 'af', 'cv', 'cn', 'dp']
const SESSION_PARAMS = ['aff_platform', 'aff_fsk', 'terminal_id', 'tt', 'shareId', 'businessType', 'templateId', 'spreadType']

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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const inputUrl = args.positional[0]

  const appKey = args['app-key'] || process.env.ALIEXPRESS_APP_KEY || ''
  const appSecret = args['app-secret'] || process.env.ALIEXPRESS_APP_SECRET || ''
  const trackingId = args['tracking-id'] || process.env.ALIEXPRESS_TRACKING_ID || ''

  if (!inputUrl) {
    console.error('Falta o link do AliExpress para diagnosticar.\n')
    console.error("Uso: node scripts/diag-aliexpress-affiliate-link.mjs '<link>' \\")
    console.error('       [--app-key=... --app-secret=... --tracking-id=...]')
    process.exitCode = 1
    return
  }

  console.log(line('═'))
  console.log('TESTE DE COMISSÃO DO ALIEXPRESS — read-only, nada é enviado nem gravado')
  console.log(line('═'))

  console.log('\n1) RESOLVENDO O LINK QUE CHEGOU\n')
  if (!isShortLink(inputUrl) && !extractItemId(inputUrl)) {
    console.log('   (não é link curto conhecido nem tem produto na URL — resolvendo assim mesmo)')
  }
  const { finalUrl, hops } = await resolveChain(inputUrl)
  for (const [i, hop] of hops.entries()) {
    console.log(`   ${i + 1}. [${hop.status}] ${hop.url}`)
    if (hop.note) console.log(`      ↳ ${hop.note}`)
  }
  console.log(`\n   Chegou em: ${finalUrl}`)

  const itemId = extractItemId(finalUrl)
  if (isFallbackLanding(finalUrl)) {
    console.log('\n   ✘ A cadeia terminou na vitrine genérica do AliExpress.')
    console.log('     Isso quer dizer que o link curto está morto/expirado — NÃO é cupom.')
    console.log('     Em produção, esse caso precisa virar falha honesta (nada publicado).')
  } else if (itemId) {
    console.log(`   Produto identificado: ${itemId}`)
  } else {
    console.log('   ⚠ Nenhum código de produto na URL final (pode ser cupom/campanha/vitrine).')
  }

  console.log('\n2) QUEM GANHA A COMISSÃO HOJE NESSE LINK\n')
  const originParams = readAffiliateParams(finalUrl)
  if (Object.keys(originParams).length === 0) {
    console.log('   ⚠ Nenhum parâmetro de afiliado encontrado na URL final.')
    console.log('     Ou o link não é de afiliado, ou a atribuição ficou só no cookie')
    console.log('     do redirecionamento — nesse caso a URL sozinha não carrega o crédito.')
  } else {
    for (const [key, value] of Object.entries(originParams)) {
      const isIdentity = IDENTITY_PARAMS.includes(key)
      console.log(`   ${isIdentity ? '✔' : '·'} ${key} = ${value}`)
    }
    console.log('\n   (✔ = provável identificador do afiliado; · = rastro da sessão de quem gerou)')
  }

  console.log('\n3) MONTANDO O LINK DA CLIENTE PELA API OFICIAL\n')
  if (!appKey || !appSecret || !trackingId) {
    console.log('   ⚠ Sem credenciais — pulando.')
    console.log('     Passe --app-key, --app-secret e --tracking-id (ou as variáveis')
    console.log('     ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET / ALIEXPRESS_TRACKING_ID)')
    console.log('     para o script chamar a API de verdade e mostrar o link gerado.')
    console.log('\n     Onde pegar: portals.aliexpress.com → Ferramentas → API (chave e')
    console.log('     segredo do aplicativo) e Conta → Tracking ID.')
  } else {
    // A URL mandada para a API é a do produto SEM o rastro do terceiro: o
    // objetivo é a API assinar um link novo, não reetiquetar o link dele.
    let sourceUrl = finalUrl
    if (itemId) sourceUrl = `https://www.aliexpress.com/item/${itemId}.html`

    console.log(`   Origem enviada à API: ${sourceUrl}`)

    let success = null
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
        success = out
        break
      }
      console.log(`   ✘ assinatura ${label} — ${out.error}`)
    }

    if (success) {
      console.log('\n   LINK MONTADO PELA API (é este que precisa ser provado no celular):')
      console.log(`   ${success.link}`)

      const leaked = IDENTITY_PARAMS
        .filter((key) => originParams[key])
        .filter((key) => String(success.link).includes(originParams[key]))
      console.log('\n   Conferência de segurança:')
      if (leaked.length === 0) {
        console.log('   ✔ nenhum identificador do outro afiliado sobrou no link novo')
      } else {
        console.log(`   ✘ VAZOU identificador do outro afiliado: ${leaked.join(', ')}`)
        console.log('     Não use esse link — a comissão iria para ele.')
      }
    } else {
      console.log('\n   Nenhuma das duas convenções de assinatura foi aceita.')
      console.log('   Se o erro foi de credencial (chave/segredo/tracking), confira os dados.')
      console.log('   Se foi de assinatura, é a convenção da base que precisa ser ajustada —')
      console.log('   e é exatamente por isso que este teste roda ANTES de escrever o conversor.')
    }
  }

  console.log('\n4) O QUE ISSO JÁ DECIDE\n')
  console.log('   • API respondeu com link → a conversão pode ser feita como na Shopee')
  console.log('     (chave + segredo + tracking cadastrados pela cliente, link assinado).')
  console.log('   • API recusou por credencial → a cliente precisa liberar o acesso à API')
  console.log('     no painel de afiliada dela antes de qualquer implementação.')
  console.log('   • Vitrine genérica no fim da cadeia → link morto; nunca publicar.')

  console.log('\n5) COMO CONCLUIR O TESTE (só a cliente pode fazer)\n')
  console.log('   1. Anote quantos cliques o painel do AliExpress mostra HOJE.')
  console.log('   2. No CELULAR, abra o link montado por nós. Navegue um pouco.')
  console.log('   3. Espere o painel atualizar (pode levar horas).')
  console.log('   4. Se o clique aparecer → a conversão automática funciona e a loja')
  console.log('      pode ser implementada como as outras.')
  console.log('      Se NÃO aparecer → converter link sozinho seria trabalhar de graça.')
  console.log('\n   Faça o teste com o celular fora do WiFi de casa se puder — assim')
  console.log('   você não confunde com um clique seu anterior.\n')
}

main().catch((err) => {
  console.error('Falhou:', err?.message || err)
  process.exitCode = 1
})
