// Conversor de links da SHEIN. Referência direta de implementação:
// `scripts/diag-shein-affiliate-link.mjs` (read-only, já commitado e validado
// ao vivo em 2026-08-18). A lógica de resolução do oneLink, extração de
// identidade, strip de tracking de terceiro e guardas de recusa é portada
// deste módulo, com `fetch` global trocado por `fetchImpl` injetável para
// permitir testes db-free/sem rede.
//
// Estrutura espelha src/converters/shopee.js (resolvedor + conversor no
// mesmo módulo, sem API paga).

import { isSheinHostname } from '../detector.js'

// Página de produto direta: `<slug>-p-<goodsId>.html` (opcionalmente com
// `-cat-<catId>`).
export const SHEIN_PRODUCT_RE = /-p-(\d+)(?:-cat-(\d+))?\.html/i
// oneLink de produto não usa o caminho `-p-<id>.html`: leva o produto no
// query param `goods_id`. As duas formas contam como "achei o produto".
export const SHEIN_GOODS_ID_RE = /[?&]goods_id=(\d+)/i
// Página de captcha do sistema de risco da SHEIN. Responde HTTP 200 e
// descarta o hop anterior — que é onde estão os dados. Nunca seguir para cá.
export const SHEIN_RISK_RE = /\/risk\/(?:challenge|action)/i
// Vitrine genérica do oneLink — landing padrão quando o destino real
// (produto ou cupom específico) não pôde ser determinado. Ver uso em
// `convert()`: sem goods_id e sem nenhum parâmetro de destino restante, é
// tratada como resolução incompleta, não como cupom.
export const SHEIN_ARK_DEFAULT_RE = /\/ark\/default\/?$/i

// Parâmetros de rastro do terceiro que gerou o link. Removidos antes de
// aplicar a identidade da cliente — nunca copiados para a saída.
export const THIRD_PARTY_PARAMS = [
  'url_from', 'koc_id', 'aff_id', 'src_identifier',
  'onelink', 'requestId', 'behaviorId',
]
// + qualquer chave que case /^utm_/i (tratado à parte em stripSheinAffiliateTracking)

// Token opaco do botão "compartilhar" do app. Carrega produto e,
// possivelmente, a atribuição de quem compartilhou — não dá para inspecionar
// nem reescrever com segurança. Presença → recusa dura (FR-014).
export const OPAQUE_SHARE_PARAMS = ['shc', 'link']

// Constantes do programa de afiliados — descrevem o DESTINO, não o cadastro
// da cliente. Garantidas presentes no link final, nunca lidas do cadastro.
export const PROGRAM_PARAMS = { scene: '1', test: '5051', ad_type: 'KOC', campaign: 'goods', campaign_id: '20' }

// Prefixo literal do parâmetro derivado `url_from`.
export const AFFILIATE_URL_FROM_PREFIX = 'affiliate_koc_'

const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'

// Teto de bytes lido do corpo de cada hop, mesmo padrão dos dois conversores
// irmãos que resolvem short link (`src/converters/shopee.js` 512KB,
// `src/converters/amazon.js` 256KB) — sem teto, um hop de terceiro que sirva
// um corpo grande é lido inteiro para a memória dentro do pipeline de
// incoming do bot-worker, que roda sob teto de heap de 384MB
// (`BOT_WORKER_MAX_OLD_SPACE_MB`). Usa o mesmo valor da Shopee: a página do
// oneLink é um interstício pequeno, mas o teto generoso não pesa e evita
// truncar o `<input id="url">` real caso o hop sirva algo maior do que o
// esperado.
const SHORT_LINK_BODY_MAX_BYTES = 512 * 1024

// oneLink não devolve 302: serve uma página-interstício que redireciona por
// JS. O destino real fica num `<input id="url">` escondido — por isso esse
// padrão vem PRIMEIRO na lista (é o padrão real medido em produção).
const HTML_REDIRECT_PATTERNS = [
  /<input[^>]+id=["']url["'][^>]+value=["']([^"']+)["']/i,
  /<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url=([^"'>\s]+)/i,
  /(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i,
  /<link[^>]+rel=["']?canonical["']?[^>]+href=["']([^"']+)["']/i,
]

// Guarda de host: o destino final (pós-resolução de redirect) precisa ser um
// domínio real da SHEIN. Reusa `isSheinHostname` de src/detector.js — mesma
// lista canônica do detector, sem duplicar. Validação ANCORADA (host igual ao
// domínio, ou subdomínio dele com separador de ponto) — nunca o regex de
// extração de texto (`PATTERNS.shein`, que termina em `[^\s]*` de propósito
// para capturar o link inteiro em texto corrido). Usar o extrator aqui era
// exatamente o furo do T070: `shein.com.evil.net` "começa com" `shein.com`
// como substring e passava. Sem esta guarda ancorada, uma cadeia de
// redirecionamento que sai do domínio da SHEIN seria publicada com os
// parâmetros de rastro do terceiro intactos (vazamento de comissão).
export function isSheinHost(url) {
  try {
    const hostname = new URL(String(url)).hostname
    return isSheinHostname(hostname)
  } catch {
    return false
  }
}

export function isSheinShortLink(url) {
  return /^https?:\/\/(?:[a-z0-9-]+\.)*(?:onelink\.shein\.com|shein\.top)\//i.test(String(url || ''))
}

// Extrai o número de afiliada de uma URL da SHEIN que já expõe o identificador
// (via `koc_id=<n>` ou `url_from=affiliate_koc_<n>`). Mesma regra usada
// offline por `sanitizeCredentialBody` (src/credentialHealth.js) para um link
// de afiliada já expandido, e reusada por T075 (rota de save) depois de
// resolver um oneLink pela rede — um único lugar para as duas chamadas não
// divergirem. Devolve `null` quando a URL é inválida ou não expõe nenhum dos
// dois formatos.
export function extractSheinAffiliateId(url) {
  try {
    const u = new URL(String(url))
    const kocId = u.searchParams.get('koc_id')
    if (kocId && /^\d+$/.test(kocId)) return kocId
    const urlFrom = u.searchParams.get('url_from') || ''
    const fromKoc = urlFrom.match(/^affiliate_koc_(\d+)$/)
    if (fromKoc) return fromKoc[1]
    return null
  } catch {
    return null
  }
}

export function extractSheinGoodsId(url) {
  const str = String(url || '')
  return str.match(SHEIN_PRODUCT_RE)?.[1] || str.match(SHEIN_GOODS_ID_RE)?.[1] || null
}

function hasProductId(url) {
  return extractSheinGoodsId(url) != null
}

export function hasOpaqueShareToken(url) {
  try {
    const u = new URL(String(url))
    // Presença, não valor: `?shc=`/`?link=` vazios ainda são o token do botão
    // "compartilhar" do app — `searchParams.get` (truthy) deixava passar string
    // vazia, que é falsy em JS.
    return OPAQUE_SHARE_PARAMS.some((key) => u.searchParams.has(key))
  } catch {
    return false
  }
}

// Remove THIRD_PARTY_PARAMS e toda chave utm_*. Preserva caminho, goods_id e
// todos os demais parâmetros de destino. URL inválida devolve a entrada
// inalterada.
export function stripSheinAffiliateTracking(url) {
  try {
    const u = new URL(String(url))
    const thirdPartyLower = new Set(THIRD_PARTY_PARAMS.map((key) => key.toLowerCase()))
    for (const key of [...u.searchParams.keys()]) {
      if (thirdPartyLower.has(key.toLowerCase()) || /^utm_/i.test(key)) {
        u.searchParams.delete(key)
      }
    }
    // T073: fragmento nunca carrega informação de destino que a gente
    // precise, e a SHEIN roda no navegador (pode ler `location.hash`) — não
    // vale o risco de deixar um identificador de terceiro passar escondido
    // no fragmento até o servidor de análise (mesmo sem ir ao servidor HTTP).
    u.hash = ''
    return u.toString()
  } catch {
    return String(url)
  }
}

// Lê o corpo até SHORT_LINK_BODY_MAX_BYTES e devolve o que foi coletado até
// lá (nunca `null` por causa do teto — só por erro real de leitura). Mesmo
// contrato de `readBodyLimited` em shopee.js/amazon.js.
async function readBodyLimited(res) {
  try {
    if (!res?.body?.getReader) {
      const text = await res?.text?.()
      return typeof text === 'string' ? text.slice(0, SHORT_LINK_BODY_MAX_BYTES) : null
    }
    const reader = res.body.getReader()
    const chunks = []
    let received = 0
    while (received < SHORT_LINK_BODY_MAX_BYTES) {
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

// Segue redirects MANUALMENTE, com cookie jar, e devolve a URL do hop mais
// informativo. Nunca usa `redirect: 'follow'` — perderia o hop com os dados.
// Nunca lança: falha de rede/prazo esgotado degrada para "não resolveu"
// (convert() decide) — nunca escapa como exceção.
//
// `totalTimeoutMs` é um ORÇAMENTO TOTAL para a cadeia inteira (não por hop):
// antes, `timeoutMs` era aplicado a CADA hop (até 8s × maxHops=6 = 48s de
// pior caso), acima do `MSG_QUEUE_TIMEOUT_MS` (25s) do pipeline de incoming
// — uma cadeia lenta estourava o timeout da MENSAGEM INTEIRA em vez de só
// essa conversão falhar. Default 8000ms alinhado ao alvo declarado em
// plan.md ("≤ 8s com no máximo 6 hops"). Cada hop recebe como timeout o que
// resta do orçamento (nunca o valor cheio de novo).
export async function resolveSheinShortLink(
  url,
  { totalTimeoutMs = 8000, maxHops = 6, fetchImpl = globalThis.fetch } = {},
) {
  let current = String(url)
  const cookieJar = new Map()
  const deadlineAt = Date.now() + totalTimeoutMs

  for (let i = 0; i < maxHops; i++) {
    // 1. A URL atual já revela o produto — para aqui.
    if (hasProductId(current)) break

    // 2. Orçamento total esgotado — última URL conhecida, sem novo hop.
    const remainingMs = deadlineAt - Date.now()
    if (remainingMs <= 0) break

    const cookieHeader = [...cookieJar].map(([k, v]) => `${k}=${v}`).join('; ')
    let res
    try {
      res = await fetchImpl(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(remainingMs),
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      })
    } catch {
      // erro de rede/timeout → última URL conhecida
      break
    }

    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';')
      const idx = pair.indexOf('=')
      if (idx > 0) cookieJar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim())
    }

    const location = res.headers.get('location')
    if (location) {
      let next
      try {
        next = new URL(location, current).toString()
      } catch {
        break
      }
      // Não entrar no captcha: o hop atual é o mais informativo que teremos.
      if (SHEIN_RISK_RE.test(next)) break
      current = next
      continue
    }

    if (!String(res.headers.get('content-type') || '').includes('text/html')) break

    const html = await readBodyLimited(res)
    if (!html) break

    const next = extractRedirectFromHtml(html, current)
    if (!next || next === current) break
    if (SHEIN_RISK_RE.test(next)) break
    current = next
  }

  return current
}

// Converte um link da SHEIN aplicando a identidade da cliente. Retorna
// `{ url, linkKind }` ou `null`. Nunca lança.
// Terceiro parâmetro (`{ fetchImpl }`) é injeção de teste — em produção usa o
// `fetch` global, como as outras lojas (padrão de `resolveSheinShortLink`).
export async function convert(url, creds, { fetchImpl = globalThis.fetch } = {}) {
  try {
    const tag = String(creds?.tag || '').trim()
    if (!tag) return null

    let resolved = String(url)
    if (isSheinShortLink(resolved)) {
      resolved = await resolveSheinShortLink(resolved, { fetchImpl })
      // Resolução falhou (rede/timeout/captcha no 1º hop) e nunca saiu do
      // domínio de short link: o próprio código do short link (`/14/abc`) é
      // rastro de sessão de quem gerou — publicar isso vazaria a identidade
      // dele, mesmo sem query params. Falha honesta em vez de link de
      // terceiro (INV-5).
      if (isSheinShortLink(resolved)) return null
    }

    // Guarda de host: depois de resolver e ANTES de aplicar a identidade da
    // cliente, recusar qualquer destino que não seja domínio real da SHEIN —
    // um redirect que escapou do domínio nunca pode receber koc_id/url_from
    // dela nem ser publicado com o rastro do terceiro intacto.
    if (!isSheinHost(resolved)) return null

    if (hasOpaqueShareToken(resolved)) return null

    const stripped = stripSheinAffiliateTracking(resolved)

    let u
    try {
      u = new URL(stripped)
    } catch {
      return null
    }

    // Vitrine genérica do oneLink (`/ark/default`) sem goods_id E sem NENHUM
    // parâmetro de destino restante (depois do strip de tracking): não é um
    // cupom/campanha legítimo, é a resolução não tendo concluído — o `<input
    // id="url">` não revelou nada além da própria página-padrão. Cupom real
    // carrega ao menos um parâmetro de destino (ex.: `campaign=<algo>`) além
    // do boilerplate; publicar essa vitrine vazia como "cupom" seria mentir
    // sobre o que o link realmente é. Não afeta INV-6 (cupom/campanha
    // legítimos sempre chegam com pelo menos um parâmetro de destino).
    if (SHEIN_ARK_DEFAULT_RE.test(u.pathname) && !extractSheinGoodsId(stripped) && [...u.searchParams.keys()].length === 0) {
      return null
    }

    u.searchParams.set('koc_id', tag)
    u.searchParams.set('url_from', AFFILIATE_URL_FROM_PREFIX + tag)
    for (const [key, value] of Object.entries(PROGRAM_PARAMS)) {
      if (!u.searchParams.has(key)) u.searchParams.set(key, value)
    }

    const finalUrl = u.toString()

    // T074: rede de segurança final. Mesmo que um parâmetro de nome
    // desconhecido, aninhado/URL-encoded ou colado no caminho escape de
    // THIRD_PARTY_PARAMS, o formato do programa de afiliados da SHEIN sempre
    // carrega o marcador "koc" (Key Opinion Consumer — ver
    // AFFILIATE_URL_FROM_PREFIX). As únicas ocorrências LEGÍTIMAS são as que
    // nós mesmos escrevemos (`koc_id=<tag>`, `url_from=affiliate_koc_<tag>`)
    // mais o que já veio do próprio link de origem em `ad_type` (T063:
    // preservado como veio, pode ou não conter "KOC"). Contamos as
    // ocorrências reais contra o esperado; qualquer ocorrência a mais é
    // identificador de outro afiliado, seja qual for o nome do parâmetro —
    // preferimos recusar a tentar limpar.
    const countKoc = (str) => (String(str).match(/koc/gi) || []).length
    const expectedKocOccurrences =
      countKoc(`koc_id=${tag}`) + countKoc(`${AFFILIATE_URL_FROM_PREFIX}${tag}`) + countKoc(u.searchParams.get('ad_type'))
    if (countKoc(finalUrl) > expectedKocOccurrences) return null

    const goodsId = extractSheinGoodsId(finalUrl)
    // Marca de "isto deveria ser um produto" mais frouxa que SHEIN_PRODUCT_RE
    // (que exige o id em dígitos): o marcador `-p-` no caminho aparece em toda
    // página de produto da SHEIN, com ou sem id capturável. Se o marcador
    // existe mas a extração não achou o id (URL corrompida/truncada), é
    // melhor recusar do que publicar link de produto sem produto.
    const looksLikeProductPath = (() => {
      try { return /-p-/i.test(new URL(finalUrl).pathname) } catch { return false }
    })()
    if (!goodsId && looksLikeProductPath) return null

    const linkKind = goodsId ? 'product' : 'coupon'

    return { url: finalUrl, linkKind }
  } catch {
    return null
  }
}
