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
// A extensão Cookie-Editor exporta em dois formatos, e o painel ensina o JSON
// na Amazon (logo acima da SHEIN na mesma tela). Um cliente que copiar por
// hábito manda JSON aqui — e, sem normalizar, o JSON cru vai como cabeçalho
// Cookie, a SHEIN responde como visitante e a oferta sai com link comprido sem
// explicar por quê. `normalizeAmazonCookie` já resolve os dois formatos e não
// tem nada de específico da Amazon; é reusado em vez de duplicado.
import { normalizeAmazonCookie as normalizeCookieExport } from './amazon.js'
import logger from '../logger.js'

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

// T076: remove zero à esquerda (a SHEIN não usa padding no número de
// afiliada — `0009876543` e `9876543` não são a mesma coisa para o
// parâmetro `url_from` que o conversor monta). Preserva um único "0" caso o
// texto seja só zeros (caso patológico, cai na recusa de comprimento na
// validação de qualquer forma). Mora aqui (em vez de credentialHealth.js,
// que já importa `extractSheinAffiliateId` deste módulo) para T088 poder
// reusar a MESMA função na guarda de identidade sem criar um import
// circular entre os dois arquivos.
export function normalizeSheinDigits(digits) {
  const stripped = String(digits).replace(/^0+/, '')
  return stripped || '0'
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

// Caminho CONFIRMADO ao vivo pela cliente (specs/012-shein-store-support,
// Phase 16 — não é hipótese, replicado de scripts/diag-shein-shortlink.mjs):
//
//   GET  {origin}/api/others/getSiteInfo   header bff-source: shein;pwa
//     -> { SiteUID, token, memberId, appLanguage }
//   POST {origin}/affiliate/api/share/link/from/url
//     headers token, siteuid, language, localcountry:'BR', mi:<memberId>
//     body    { url, language, uid:<memberId> }
//     -> { code:"0", info:{ oneLink } }
const SHEIN_SITE_INFO_URL = 'https://m.shein.com/br/api/others/getSiteInfo'
const SHEIN_SHORTEN_URL = 'https://m.shein.com/br/affiliate/api/share/link/from/url'

// Orçamento TOTAL para as duas chamadas somadas — mesmo espírito do
// `totalTimeoutMs` de `resolveSheinShortLink`: roda dentro do pipeline de
// mensagens, que tem teto de 25s (`MSG_QUEUE_TIMEOUT_MS`). ~6s deixa folga
// generosa para o resto do pipeline mesmo no pior caso.
const SHORTEN_TOTAL_TIMEOUT_MS = 6000

// Cache do token em escopo de MÓDULO, por `tag` — o token traz timestamp de
// emissão embutido (mesma sessão serve por minutos), e cunhar um novo por
// oferta é desperdício de rede/latência. TTL curto de propósito: nada de
// cache "grande" ou de longa duração (política de memória do AGENTS.md) —
// só evita a chamada dupla quando várias ofertas saem em sequência rápida.
// Chave por `tag` + o próprio cookie (para invalidar sozinho se a cliente
// trocar o código de acesso no meio do TTL).
const SHORTEN_TOKEN_CACHE_TTL_MS = 10 * 60 * 1000

// T086: cache da RECUSA (código de acesso vencido/de outra conta, ou falha de
// rede ao consultar a sessão) — sem isso, cada oferta refaz a mesma consulta
// que já falhou, gastando parte do orçamento de 6s e emitindo um
// `logger.warn` por oferta. TTL bem mais curto que o do sucesso: a cliente
// pode recadastrar o código a qualquer momento e não deve ficar presa à
// recusa por muito tempo (mesma chave tag+cookie do cache de sucesso —
// trocar o cookie invalida a entrada negativa do mesmo jeito).
const SHORTEN_NEGATIVE_CACHE_TTL_MS = 2 * 60 * 1000

// T089: os dois Maps são de escopo de MÓDULO e, sem teto, só perdem entrada
// quando o MESMO tag é consultado de novo — no processo da API (que atende
// todas as clientes do painel, não um processo por cliente como o
// bot-worker) as entradas acumulam uma por tag distinto e nunca são
// varridas. Teto pequeno e explícito: ao inserir, se passar do teto, descarta
// a mais antiga (ordem de inserção do Map, mesmo espírito de um LRU simples).
// Entradas são pequenas (um punhado de strings curtas); o ponto é o limite
// existir, não o tamanho exato.
const SHORTEN_CACHE_MAX_ENTRIES = 200
const shortenTokenCache = new Map()
const shortenNegativeCache = new Map()

function setCachedWithCap(map, key, value) {
  // Remove e reinsere para a chave contar como "mais nova" na ordem de
  // inserção do Map (evita descartar uma entrada acabada de atualizar).
  map.delete(key)
  map.set(key, value)
  if (map.size > SHORTEN_CACHE_MAX_ENTRIES) {
    const oldestKey = map.keys().next().value
    if (oldestKey !== undefined) map.delete(oldestKey)
  }
}

function getCachedShortenSession(tag, cookie) {
  const cached = shortenTokenCache.get(tag)
  if (!cached) return null
  if (cached.cookie !== cookie || cached.expiresAt <= Date.now()) {
    shortenTokenCache.delete(tag)
    return null
  }
  return cached
}

// Entrada negativa presente e válida (mesmo cookie, dentro do TTL curto) →
// recusa de cara, sem tocar a rede nem logar de novo (o warn já saiu quando a
// entrada foi criada).
function getCachedShortenRefusal(tag, cookie) {
  const cached = shortenNegativeCache.get(tag)
  if (!cached) return false
  if (cached.cookie !== cookie || cached.expiresAt <= Date.now()) {
    shortenNegativeCache.delete(tag)
    return false
  }
  return true
}

function cacheShortenRefusal(tag, cookie) {
  setCachedWithCap(shortenNegativeCache, tag, { cookie, expiresAt: Date.now() + SHORTEN_NEGATIVE_CACHE_TTL_MS })
}

// Gera o oneLink curto da SHEIN para `longUrl`, usando o código de acesso
// (cookie) cadastrado pela cliente. Retorna a string do oneLink ou `null`.
// NUNCA lança — qualquer falha (rede, prazo, resposta inesperada) degrada
// para `null`, e quem chama publica o link longo (comportamento de hoje).
//
// Guarda de identidade — a parte mais importante: o `memberId` devolvido
// pela sessão da SHEIN PRECISA ser o mesmo número já cadastrado em
// `creds.tag` (confirmado pela cliente: é o mesmo número). `memberId` vazio
// quer dizer código de acesso vencido (sessão de visitante); `memberId`
// diferente do `tag` quer dizer que o cookie colado é de OUTRA conta —
// publicar o oneLink dela pagaria a comissão para ela. Mesmo princípio das
// guardas T074/T077 em `convert()`.
export async function shortenSheinLink(longUrl, creds, { fetchImpl = globalThis.fetch, totalTimeoutMs = SHORTEN_TOTAL_TIMEOUT_MS } = {}) {
  try {
    if (String(process.env.SHEIN_SHORTLINK_ENABLED ?? 'true') === 'false') return null

    // Aceita os DOIS formatos de exportação do Cookie-Editor: "Header string"
    // (`a=1; b=2`) e "JSON" (lista de {name,value}). Ver o comentário do import.
    const cookie = normalizeCookieExport(creds?.cookie).trim()
    if (!cookie) return null
    const tag = String(creds?.tag || '').trim()
    if (!tag) return null

    const deadlineAt = Date.now() + totalTimeoutMs

    // T086: recusa já memorizada para este tag+cookie → nem toca a rede.
    if (getCachedShortenRefusal(tag, cookie)) return null

    let session = getCachedShortenSession(tag, cookie)
    if (!session) {
      const remainingMs = deadlineAt - Date.now()
      if (remainingMs <= 0) return null

      let siteInfoRes
      try {
        siteInfoRes = await fetchImpl(SHEIN_SITE_INFO_URL, {
          signal: AbortSignal.timeout(remainingMs),
          headers: {
            'User-Agent': BROWSER_UA,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'bff-source': 'shein;pwa',
            Cookie: cookie,
          },
        })
      } catch {
        // Falha de rede/prazo: a SHEIN fora do ar não pode custar 6s por
        // oferta — memoriza a recusa com o mesmo TTL curto.
        cacheShortenRefusal(tag, cookie)
        return null
      }

      let info
      try {
        info = await siteInfoRes.json()
      } catch {
        cacheShortenRefusal(tag, cookie)
        return null
      }

      const memberId = String(info?.memberId || '').trim()
      // memberId vazio: código de acesso venceu (sessão de visitante). Não é
      // erro de rede — é a SHEIN dizendo "essa sessão não é de ninguém logado".
      if (!memberId) {
        cacheShortenRefusal(tag, cookie)
        return null
      }
      // Guarda de identidade (a mais importante): nunca publicar oneLink
      // emitido por uma conta diferente da cadastrada. T088: normaliza os
      // dois lados (mesma regra de zero à esquerda que todo caminho de save
      // já aplica ao `tag`) para um `memberId` com padding não virar falso
      // negativo — a guarda continua recusando divergência real.
      if (normalizeSheinDigits(memberId) !== normalizeSheinDigits(tag)) {
        // T086: o warn sai UMA VEZ por entrada negativa (aqui, ao criá-la),
        // não a cada oferta — cache hits acima retornam antes de chegar aqui.
        logger.warn({ tag, memberId }, 'SHEIN: memberId da sessão diverge do ID de afiliada cadastrado — encurtamento recusado')
        cacheShortenRefusal(tag, cookie)
        return null
      }

      session = {
        token: info?.token || '',
        memberId,
        siteUid: info?.SiteUID || 'mbr',
        language: info?.appLanguage || 'pt-br',
        cookie,
        expiresAt: Date.now() + SHORTEN_TOKEN_CACHE_TTL_MS,
      }
      setCachedWithCap(shortenTokenCache, tag, session)
    }

    const remainingMs = deadlineAt - Date.now()
    if (remainingMs <= 0) return null

    let shortenRes
    try {
      shortenRes = await fetchImpl(SHEIN_SHORTEN_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(remainingMs),
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'application/json',
          'Content-Type': 'application/json; charset=utf-8',
          'X-Requested-With': 'XMLHttpRequest',
          token: session.token,
          siteuid: session.siteUid,
          localcountry: 'BR',
          language: session.language,
          mi: session.memberId,
        },
        body: JSON.stringify({ url: String(longUrl), language: session.language, uid: session.memberId }),
      })
    } catch {
      return null
    }

    let data
    try {
      data = await shortenRes.json()
    } catch {
      return null
    }

    if (data?.code !== '0') return null
    const oneLink = data?.info?.oneLink
    if (!oneLink) return null

    // T090: validar o valor antes de publicar. `convert()` gasta guardas
    // caras (resolução de short link, `isSheinHost`, `hasOpaqueShareToken`,
    // varredura de terceiro) para só publicar destino real da SHEIN — não
    // faz sentido substituir esse resultado por uma string crua da resposta
    // remota sem checagem nenhuma. Precisa ser: (1) string de fato (não
    // objeto/número — `oneLink` truthy não-string nunca deveria virar
    // `[object Object]` na mensagem); (2) URL absoluta válida (rejeita
    // caminho relativo tipo `/48/abc`); (3) host aprovado por `isSheinHost`
    // (rejeita `onelink.shein.com.evil.net` e qualquer domínio de fora).
    // Reprovação devolve `null` — mesmo princípio do RCA "o endereço montado
    // por nós nunca pode ser publicado" (AGENTS.md, Mercado Livre): melhor
    // não encurtar do que publicar link quebrado ou de outro domínio como se
    // fosse sucesso. O fallback de sempre publica o link longo.
    // (4) protocolo `https:`. `isSheinHost` olha só o hostname, então
    // `javascript://onelink.shein.com/%0aalert(1)` e `ftp://onelink.shein.com/x`
    // passavam por ela — o host é mesmo da loja, o esquema é que não. Publicar
    // `javascript:` numa mensagem é indefensível mesmo sendo inerte no
    // WhatsApp, e `http:` seria rebaixar a conexão da cliente. O link real vem
    // da API da própria SHEIN por HTTPS: exigir isso não recusa nada legítimo.
    if (typeof oneLink !== 'string') return null
    if (!isSheinHost(oneLink)) return null
    try {
      if (new URL(oneLink).protocol !== 'https:') return null
    } catch {
      return null
    }

    // Devolve como veio — não reescrever nem remover parâmetro (mesma lição
    // do `generateShortLink` da Shopee: o short link só funciona devolvido
    // como-está).
    return oneLink
  } catch {
    return null
  }
}

// Converte um link da SHEIN aplicando a identidade da cliente. Retorna
// `{ url, linkKind }` ou `null`. Nunca lança.
// Terceiro parâmetro (`{ fetchImpl }`) é injeção de teste — em produção usa o
// `fetch` global, como as outras lojas (padrão de `resolveSheinShortLink`).
// `shorten` (default `true`): T087 — o painel "Criar oferta" roda a
// conversão só para tentar extrair título/preço e DESCARTA o link
// convertido (`keepOriginalLink: true`), então encurtar ali é 2 idas à rede
// à toa dentro de um request síncrono que a cliente espera na tela, e o
// oneLink sem slug `-p-<id>` piora o fallback de título por URL
// (`extractTitleFromUrl`). `offerEngine.buildScrapedOffer` liga
// `shorten: false` só nesse caminho; o espelhamento (bot-worker), que
// PRECISA do link curto, não passa a opção e mantém o default.
export async function convert(url, creds, { fetchImpl = globalThis.fetch, shorten = true } = {}) {
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

    // T077: rede de segurança final. O T074 contava toda ocorrência da
    // substring solta "koc" (case-insensitive) na URL final INTEIRA —
    // caminho incluso — contra um esperado de três. Isso estourava com
    // texto livre absolutamente legítimo que a gente não controla: o slug
    // da SHEIN é o nome do produto (`Kocotree-Mochila-Infantil`, marca real
    // da loja; `koch-blusa`) e o valor de `campaign` vem da origem
    // (`kocobeauty`) — nenhum dos dois é identificador de afiliado, mas
    // ambos contêm "koc" e faziam a oferta ser descartada em silêncio
    // (nada publicado, comissão perdida, sem nada no log). Hoje casamos o
    // FORMATO do identificador de verdade, não a substring solta:
    //
    //   (a) o padrão que nós mesmos escrevemos, `affiliate_koc_<dígitos>`,
    //       em qualquer lugar da URL final — caminho incluso (onde um
    //       terceiro pode colar o identificador dele, ex.:
    //       `/affiliate_koc_<id>/a-p-1.html`) — decodificado uma vez para
    //       pegar o caso aninhado/URL-encoded
    //       (`next=...url_from%3Daffiliate_koc_<id>`). A(s) própria(s)
    //       ocorrência(s) que nós escrevemos (`url_from=affiliate_koc_<tag>`)
    //       tem o id da cliente e não dispara nada.
    //   (b) o valor de qualquer parâmetro cujo NOME contenha "koc" — fora de
    //       `koc_id`/`url_from` (os dois que nós mesmos escrevemos) e
    //       `ad_type` (preservado como veio da origem, T063) — pega o caso
    //       de nome de parâmetro desconhecido carregando o id de terceiro
    //       cru (`partner_koc=<id>`, sem o formato `affiliate_koc_`).
    //
    // Qualquer identificador achado que não seja o da própria cliente →
    // recusa (preferimos recusar a tentar limpar, mesma filosofia do T074).
    //
    // T079: decodificação ITERATIVA (não mais uma passada única). Um
    // identificador de terceiro pode chegar com encoding duplicado
    // (`%255F` → `%5F` → `_`), e uma única `decodeURIComponent` não
    // desmancha as duas camadas. Decodifica até o valor estabilizar (ou até
    // o teto de iterações, para não abrir trabalho ilimitado em entrada
    // hostil); uma sequência inválida (`%zz`) para o laço e usa o último
    // valor válido, sem nunca lançar.
    const MAX_KOC_DECODE_ITERATIONS = 5
    const decodeRepeated = (str) => {
      let current = String(str)
      for (let i = 0; i < MAX_KOC_DECODE_ITERATIONS; i++) {
        let next
        try {
          next = decodeURIComponent(current)
        } catch {
          break
        }
        if (next === current) break
        current = next
      }
      return current
    }
    // T078: além do padrão exato `affiliate_koc_<dígitos>` (regra a) e do
    // valor de parâmetro por NOME contendo "koc" (regra b), um identificador
    // de terceiro em FORMATO SOLTO (`koc`, separador opcional, dígitos
    // longos — o id real da SHEIN tem ~10) pode aparecer dentro do valor de
    // QUALQUER parâmetro preservado, com um nome que não bate nem (a) nem
    // (b) — ex.: `ad_type=KOC5849195695` (ad_type é isento da regra por
    // nome, T063, mas isso não isenta o VALOR de carregar um id de
    // terceiro). Regra (c) varre a URL final decodificada por esse formato,
    // sem depender do nome do parâmetro. Ela NÃO confunde texto livre
    // legítimo porque exige dígitos longos GRUDADOS em "koc" (com no máximo
    // um separador): "Kocotree"/"koch"/"kocobeauty" têm letra logo após o
    // "koc", não dígito, e por isso nunca casam.
    const decodedFinalUrl = decodeRepeated(finalUrl)
    for (const match of decodedFinalUrl.matchAll(/affiliate_koc_(\d+)/gi)) {
      if (match[1] !== tag) return null
    }
    for (const match of decodedFinalUrl.matchAll(/koc[-_]?(\d{6,})/gi)) {
      if (match[1] !== tag) return null
    }
    const EXEMPT_KOC_PARAMS = new Set(['koc_id', 'url_from', 'ad_type'])
    for (const [key, value] of u.searchParams) {
      if (EXEMPT_KOC_PARAMS.has(key.toLowerCase())) continue
      if (/koc/i.test(key) && decodeRepeated(value) !== tag) return null
    }

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

    // T082: o encurtamento acontece DEPOIS de todas as guardas acima (host
    // ancorado, token opaco, `/ark/default` sem goods_id, rede de segurança
    // de identificador de terceiro) — não reordenar. `finalUrl` já é o link
    // longo pronto, com a identidade da cliente aplicada; o encurtamento só
    // troca a forma final, nunca o destino/identidade. Sem `creds.cookie`,
    // `shortenSheinLink` nem tenta (devolve `null` de cara) — o opt-in de
    // verdade é a própria existência do código de acesso cadastrado.
    // Kill-switch `SHEIN_SHORTLINK_ENABLED` (default ligado) corta em
    // produção sem redeploy. Qualquer falha do encurtador (`null`) publica o
    // link longo — o fallback é o comportamento de hoje, já validado.
    if (shorten) {
      const shortLink = await shortenSheinLink(finalUrl, creds, { fetchImpl })
      if (shortLink) return { url: shortLink, linkKind }
    }

    return { url: finalUrl, linkKind }
  } catch {
    return null
  }
}
