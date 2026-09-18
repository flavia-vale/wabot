/**
 * "Desembrulha" link de DOMÍNIO PRÓPRIO do grupo de origem (RCA 2026-09-13).
 *
 * O caso real: a cliente monitora um grupo cujo dono publica a oferta pelo
 * site DELE (`https://dicasdeamigas.com.br/p/yaQ4mlRhfU`), não pelo link da
 * loja. Para o robô isso não é oferta nenhuma: `detectLinks` só conhece os
 * domínios das lojas suportadas, então a mensagem chegava sem link, o
 * sanitizador apagava a URL de terceiro (corretamente — ela credita o
 * concorrente) e a oferta virava `skip:policy:...:nolink` ou
 * `skip:no_valid_conversions`. Do lado de fora: "o robô não espelha".
 *
 * Medido no link real antes de escrever este módulo (não é suposição):
 *   - NÃO é redirect HTTP: responde 200 com HTML (Next.js);
 *   - o link da loja está no corpo, inclusive a URL LIMPA do produto
 *     (`https://www.amazon.com.br/dp/B088PNBKTR/`) ao lado do short link de
 *     afiliado do concorrente (`https://link.amazon/...`).
 *
 * A saída deste módulo é o TEXTO com a URL de domínio próprio trocada pela
 * URL da loja. Assim o resto do pipeline (sanitizador, detector, conversor,
 * dedup, imagem) segue byte a byte como já era — nenhum deles precisou mudar,
 * e a comissão vai para a cliente porque quem converte continua sendo o
 * conversor da loja com a credencial dela.
 *
 * Invariantes (não regredir):
 *
 *  - **A decisão é POR LINK, nunca pela mensagem inteira.** Até 2026-09-17 um
 *    único link de loja no texto desligava o desembrulho da mensagem toda
 *    (`if (cleaned.some(isOfferUrl)) return []`). Numa oferta MISTA — os dois
 *    primeiros produtos com link direto da loja e o terceiro/quarto pelo site
 *    do dono do grupo — os links embrulhados nunca eram desembrulhados, o
 *    sanitizador os apagava logo em seguida (eles creditam o concorrente) e a
 *    cliente via exatamente isto: "converte e envia dois; do terceiro em
 *    diante não vai link nenhum, só o texto". Link que JÁ é de loja continua
 *    fora dos candidatos — não há o que desembrulhar nele —, então mensagem
 *    só com link de loja (ou sem link) segue sem gastar rede, como antes.
 *  - **Mensagem mista gasta um orçamento MENOR** (`CUSTOM_DOMAIN_MIXED_BUDGET_MS`).
 *    Ali o desembrulho é um ganho (recupera o link que seria apagado), nunca a
 *    diferença entre espelhar e não espelhar: a oferta sai de qualquer jeito
 *    pelos links de loja que já existem. Gastar os 13s cheios arriscaria
 *    estourar os 25s de preparo da mensagem (`MSG_QUEUE_TIMEOUT_MS`) e derrubar
 *    uma oferta que hoje funciona — regressão pior que o bug.
 *  - **O link de terceiro NUNCA é publicado.** Ele é substituído pelo da loja
 *    (que ainda passa pela conversão) ou permanece como estava, e nesse caso o
 *    sanitizador o remove como sempre removeu. Falha aqui não vaza comissão.
 *  - **Preferir a URL com ID de produto.** O HTML costuma trazer as duas: o
 *    short link de afiliado DO CONCORRENTE e a URL limpa do produto. A limpa
 *    converte melhor (o conversor lê ASIN/MLB direto) e não carrega a tag
 *    dele. Pegar a primeira que aparecer no HTML pegaria a errada.
 *  - **Fracasso não é cacheado** (mesma lição do short link da Shopee): um
 *    timeout de rede não pode virar "esse link não tem produto" pelas horas
 *    seguintes.
 *  - **Fail-safe é NÃO MEXER no texto.** Qualquer erro devolve o texto como
 *    veio; o comportamento volta a ser exatamente o de hoje.
 */
import { detectLinks, isOfferUrl } from '../detector.js'
import { urlHasProductId } from '../converters/linkKind.js'

// Kill-switch no padrão dos outros interruptores de rollout do projeto
// (SHEIN_SHORTLINK_ENABLED, COUPON_LINK_CONVERT): default LIGADO, só o valor
// exatamente 'false' desliga. Ligado por default porque não existe caminho em
// que piore o resultado — ele só entra em cena quando a oferta JÁ ia ser
// descartada por não ter link de loja.
export const isCustomDomainResolveEnabled = () =>
  String(process.env.CUSTOM_DOMAIN_LINK_RESOLVE ?? 'true') !== 'false'

// Teto por mensagem. Cada candidato custa uma ida à rede, e o preparo da
// mensagem inteira tem orçamento de MSG_QUEUE_TIMEOUT_MS (25s) — 2 candidatos
// de 4s cabem com folga larga. Grupo que despeja 10 links por mensagem não
// pode transformar isso em 40s de espera na fila serial.
export const MAX_CANDIDATES_PER_MESSAGE = 2
// 4s eram apertados: medido em staging (2026-09-13), o MESMO endereço respondeu
// em 568ms numa chamada e estourou 4s na seguinte. O site oscila muito a partir
// do servidor, e cada estouro custava a oferta inteira — a cliente via "loja não
// suportada" para uma página que o robô sabe ler.
export const CUSTOM_DOMAIN_FETCH_TIMEOUT_MS =
  Number(process.env.CUSTOM_DOMAIN_FETCH_TIMEOUT_MS) || 8_000
// Teto do desembrulho na mensagem INTEIRA, não por link. Os 13s preservam a
// primeira tentativa histórica de 8s e deixam até ~5s para UMA segunda tentativa
// quando DNS/rede falham transitoriamente. Ainda sobram ~12s do orçamento de 25s
// do preparo da mensagem (`MSG_QUEUE_TIMEOUT_MS`) para conversão e foto.
export const CUSTOM_DOMAIN_TOTAL_BUDGET_MS =
  Number(process.env.CUSTOM_DOMAIN_TOTAL_BUDGET_MS) || 13_000
// Orçamento do desembrulho quando a mensagem JÁ traz link de loja (caso misto).
// Menor que o total de propósito: ver a invariante "mensagem mista gasta um
// orçamento MENOR" no topo deste arquivo.
//
// ⚠️ Nasceu em 6s e teve que subir para 10s (RCA 2026-09-18): 6s não cabia UMA
// tentativa cheia (o teto por link é 8s), então um site lento consumia o
// orçamento inteiro e o SEGUNDO link embrulhado da mesma mensagem nem chegava a
// ser tentado (`sem_tempo_no_orcamento`). A oferta da cliente chegava ao grupo
// com dois "Compre aqui:" vazios — exatamente a queixa que o desembrulho por
// link existia para resolver. Não baixar sem medir.
export const CUSTOM_DOMAIN_MIXED_BUDGET_MS =
  Number(process.env.CUSTOM_DOMAIN_MIXED_BUDGET_MS) || 10_000
// Retry curto e seletivo: aumentar apenas o timeout prolongaria a tentativa
// presa. Uma nova chamada permite ao resolvedor DNS usar cache/fallback sem
// repetir respostas determinísticas (403, página sem loja, anti-SSRF etc.).
export const CUSTOM_DOMAIN_MAX_ATTEMPTS = Math.max(
  1,
  Math.floor(Number(process.env.CUSTOM_DOMAIN_MAX_ATTEMPTS) || 2),
)
// Abaixo disso não vale tentar: o pedido estouraria no meio e só gastaria tempo.
const MIN_USEFUL_BUDGET_MS = 1_500
export const CUSTOM_DOMAIN_MAX_BYTES =
  Number(process.env.CUSTOM_DOMAIN_MAX_BYTES) || 512 * 1024
export const CUSTOM_DOMAIN_MAX_REDIRECTS = 5
const CACHE_TTL_MS = Number(process.env.CUSTOM_DOMAIN_CACHE_TTL_MS) || 6 * 3600_000

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const ANY_HTTP_URL_RE = /https?:\/\/[^\s<>"'`]+/gi
const TRAILING_NOISE_RE = /[.,;!?)\]}'">]+$/

// Hosts que nunca são "site de oferta de um grupo": convite de grupo/canal
// (o sanitizador já trata), redes sociais e encurtadores de conteúdo. Buscar
// esses é gasto de rede garantido sem retorno.
const NEVER_RESOLVE_HOST_RE =
  /(?:^|\.)(?:whatsapp\.com|wa\.me|t\.me|telegram\.me|telegram\.dog|instagram\.com|facebook\.com|fb\.com|youtube\.com|youtu\.be|tiktok\.com|twitter\.com|x\.com|pinterest\.com|linkedin\.com)$/i

// Sites de oferta que RECUSAM a leitura do nosso servidor. A diferença para a
// lista acima é que estes PARECEM valer a pena — são exatamente o tipo de
// página que o desembrulho existe para ler — e por isso só a medição os
// identifica.
//
// Medido em produção (2026-09-16, 72h de `bot.log`): `pechin.co` respondeu por
// 98 das 105 recusas `recusado_http_403`. Ele redireciona 301 para
// `pechinchou.com.br/oferta/<id>`, que está atrás de Cloudflare e devolve 403
// para o nosso IP em TODOS os cabeçalhos testados (navegador, celular,
// WhatsApp e facebookexternalhit) — ou seja, a recusa é por endereço de
// servidor, não por quem dizemos ser, e nenhum cabeçalho a contorna.
//
// Não perde oferta nenhuma: essas mensagens já não eram espelhadas (sem o
// desembrulho não há link de loja para converter). O que muda é parar de
// bater ~98 vezes por janela num site que sempre diz não — economia de rede e,
// principalmente, de reputação do nosso IP, que é compartilhada com as buscas
// de foto das lojas.
//
// Critério para entrar aqui: bloqueio MEDIDO e reprodutível, nunca suspeita.
// Se o bloqueio cair, basta remover a linha.
const BLOCKS_OUR_SERVER_HOST_RE =
  /(?:^|\.)(?:pechin\.co|pechinchou\.com\.br)$/i

// Arquivo, não página: imagem/vídeo/documento nunca contém link de loja.
const FILE_EXTENSION_RE = /\.(?:jpe?g|png|gif|webp|svg|bmp|ico|mp4|mov|webm|mp3|pdf|zip|rar|css|js|json|xml)$/i

// Anti-SSRF sintático. O link vem de um grupo de TERCEIROS, então é entrada
// hostil: sem isso o robô viraria um buscador de rede interna para quem
// publicasse `http://169.254.169.254/...` no grupo monitorado. Bloqueia IP
// literal (v4 e v6), host sem ponto (`localhost`, nomes de serviço em rede
// interna), sufixos de rede local, credencial embutida e porta fora de
// 80/443. Não resolve DNS de propósito: custaria uma consulta por link e o
// vetor realista aqui é o endereço escrito na própria URL.
const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/
const LOCAL_SUFFIX_RE = /\.(?:local|localdomain|internal|intranet|lan|home|corp|test|example|invalid|onion)$/i

export function isSafeCandidateUrl(rawUrl) {
  let parsed
  try {
    parsed = new URL(String(rawUrl ?? ''))
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
  if (parsed.username || parsed.password) return false
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') return false

  const host = parsed.hostname.toLowerCase()
  if (!host || host.length > 253) return false
  if (host.startsWith('[')) return false            // IPv6 literal
  if (IPV4_RE.test(host)) return false              // IPv4 literal (inclui link-local/privados)
  if (!host.includes('.')) return false             // localhost e nomes de rede interna
  if (LOCAL_SUFFIX_RE.test(host)) return false
  if (NEVER_RESOLVE_HOST_RE.test(host)) return false
  if (BLOCKS_OUR_SERVER_HOST_RE.test(host)) return false
  if (FILE_EXTENSION_RE.test(parsed.pathname)) return false
  return true
}

function stripNoise(url) {
  return String(url ?? '').replace(TRAILING_NOISE_RE, '')
}

/** Todas as URLs http(s) do texto, sem a pontuação final. PURA. */
function listUrls(text) {
  const raw = String(text ?? '')
  ANY_HTTP_URL_RE.lastIndex = 0
  return (raw.match(ANY_HTTP_URL_RE) || []).map(stripNoise)
}

/** Verdadeiro quando o texto já traz ao menos um link de loja suportada. PURA. */
export function hasStoreLink(text) {
  return listUrls(text).some(isOfferUrl)
}

/**
 * URLs do texto que valem a pena desembrulhar. PURA.
 *
 * Candidato é a URL que NÃO é de loja suportada: é ela que o sanitizador vai
 * apagar logo depois, então é ela que precisa ser desembrulhada. Link que já é
 * de loja fica de fora — não há o que desembrulhar nele —, e é isso que mantém
 * o custo em zero para mensagem só com link de loja (ou sem link nenhum).
 *
 * NÃO voltar a desligar a varredura inteira quando existe link de loja no
 * texto: era exatamente isso que perdia os links do 3º produto em diante numa
 * oferta mista (ver a invariante no topo deste arquivo).
 */
export function findCandidateLinks(text) {
  const cleaned = listUrls(text)
  if (!cleaned.length) return []

  const seen = new Set()
  const candidates = []
  for (const url of cleaned) {
    if (seen.has(url)) continue
    seen.add(url)
    if (isOfferUrl(url)) continue
    if (!isSafeCandidateUrl(url)) continue
    candidates.push(url)
    if (candidates.length >= MAX_CANDIDATES_PER_MESSAGE) break
  }
  return candidates
}

// O HTML traz a URL escapada de várias formas conforme onde ela aparece
// (JSON embutido do Next.js usa `\/`; atributo usa `&amp;`). Sem desescapar,
// o link existe no corpo e o extrator não o enxerga.
function unescapeHtmlish(html) {
  return String(html ?? '')
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&')
    .replace(/&#x2F;/gi, '/')
}

// O regex de extração do detector termina em `[^\s]*` de propósito: ele foi
// feito para TEXTO CORRIDO, onde o link acaba no espaço. HTML/JSON minificado
// não tem espaço nenhum, então lá esse padrão vira uma armadilha — medido no
// HTML real: o primeiro link (`link.amazon/...`, o do concorrente) engolia
// milhares de caracteres e ESCONDIA a URL limpa do produto que vinha depois,
// e a escolha "prefira quem tem ID de produto" nunca chegava a ver a melhor
// opção. Por isso aqui a URL é PRIMEIRO recortada nos delimitadores de
// HTML/JSON e só depois classificada. Não trocar por `PATTERNS` direto.
const HTML_URL_RE = /https?:\/\/[^\s"'<>\\`{}()\[\]]+/gi

/**
 * Todos os links de loja presentes num HTML, na ordem em que aparecem. PURO.
 */
export function extractStoreUrlsFromHtml(html) {
  const body = unescapeHtmlish(html)
  HTML_URL_RE.lastIndex = 0
  const tokens = body.match(HTML_URL_RE) || []
  const found = []
  const seen = new Set()
  for (const token of tokens) {
    const url = stripNoise(token)
    if (!url || seen.has(url)) continue
    if (!isOfferUrl(url)) continue
    let pathname
    try {
      pathname = new URL(url).pathname
    } catch {
      continue
    }
    if (FILE_EXTENSION_RE.test(pathname)) continue
    const platform = detectLinks(url)[0]?.platform
    if (!platform) continue
    seen.add(url)
    found.push({ platform, url })
  }
  return found
}

/**
 * Escolhe qual link de loja usar. PURA.
 *
 * Prefere o que revela ID de produto (ASIN/MLB/...): é a URL limpa do produto,
 * que converte melhor e NÃO carrega a etiqueta do concorrente. O short link de
 * afiliado dele (`link.amazon/...`, `amzn.to/...`) fica como segunda opção —
 * ele ainda é convertido pelo nosso conversor antes de sair, mas exige uma
 * resolução a mais e nem sempre entrega o ASIN.
 */
export function pickBestStoreUrl(candidates) {
  const list = Array.isArray(candidates) ? candidates.filter(Boolean) : []
  if (!list.length) return null
  return list.find(c => urlHasProductId(c.platform, c.url)) || list[0]
}

const resolvedCache = new Map()

function getCached(url) {
  const hit = resolvedCache.get(url)
  if (!hit) return null
  if (hit.expiresAt < Date.now()) {
    resolvedCache.delete(url)
    return null
  }
  return hit.value
}

function setCached(url, value) {
  if (resolvedCache.size > 500) {
    // Poda simples: o cache é oportunista, não um índice. Descartar o mais
    // antigo evita crescer sem limite dentro do worker (política de memória).
    const oldest = resolvedCache.keys().next().value
    if (oldest !== undefined) resolvedCache.delete(oldest)
  }
  resolvedCache.set(url, { value, expiresAt: Date.now() + CACHE_TTL_MS })
}

export function clearCustomDomainCache() {
  resolvedCache.clear()
}

export function isRetryableCustomDomainFailure(reason) {
  return reason === 'tempo_esgotado' || String(reason ?? '').startsWith('erro_de_rede:')
}

async function readLimitedText(res) {
  const declared = Number(res.headers.get('content-length'))
  if (declared && declared > CUSTOM_DOMAIN_MAX_BYTES) return ''
  if (!res.body?.getReader) return res.text()

  const reader = res.body.getReader()
  const chunks = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    chunks.push(value)
    if (received >= CUSTOM_DOMAIN_MAX_BYTES) {
      await reader.cancel().catch(() => {})
      break
    }
  }
  const body = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8').decode(body)
}

/**
 * Segue a URL (redirects manuais, depois corpo HTML) até achar um link de
 * loja. Devolve `{ platform, url, reason: null }`, ou `{ store: null, reason }`
 * quando não consegue. Nunca lança.
 *
 * O `reason` existe porque este caminho já falhou em silêncio uma vez (staging,
 * 2026-09-13): tudo certo — código no ar, rede boa, página com o link — e a
 * única informação disponível era `null`. Sem motivo registrado, cada falha
 * vira uma investigação do zero. Mesma lição de "o caminho do card de preview
 * era MUDO".
 */
export async function resolveStoreUrlFromCustomDomainDetailed(candidateUrl, options = {}) {
  const {
    fetchImpl = globalThis.fetch,
    timeoutMs = CUSTOM_DOMAIN_FETCH_TIMEOUT_MS,
    useCache = true,
  } = options

  if (typeof fetchImpl !== 'function') return { store: null, reason: 'sem_suporte_a_rede' }
  if (!isSafeCandidateUrl(candidateUrl)) return { store: null, reason: 'endereco_recusado' }

  if (useCache) {
    const cached = getCached(candidateUrl)
    if (cached) return { store: cached, reason: null }
  }

  let current = String(candidateUrl)
  try {
    for (let hop = 0; hop <= CUSTOM_DOMAIN_MAX_REDIRECTS; hop += 1) {
      // Um hop pode já ser a loja (domínio próprio que só redireciona).
      if (isOfferUrl(current)) {
        const direct = extractStoreUrlsFromHtml(current)
        const best = pickBestStoreUrl(direct)
        if (best) {
          if (useCache) setCached(candidateUrl, best)
          return { store: best, reason: null }
        }
      }
      if (!isSafeCandidateUrl(current)) return { store: null, reason: 'redirect_para_endereco_recusado' }

      const res = await fetchImpl(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,*/*' },
      })

      const location = res.headers?.get?.('location')
      if (location && res.status >= 300 && res.status < 400) {
        current = new URL(location, current).toString()
        continue
      }

      if (!res.ok) return { store: null, reason: `recusado_http_${res.status}` }
      const contentType = res.headers?.get?.('content-type') || ''
      if (contentType && !/text\/html|application\/xhtml|text\/plain|application\/json/i.test(contentType)) {
        return { store: null, reason: `tipo_inesperado_${contentType.split(';')[0]}` }
      }

      const html = await readLimitedText(res)
      const best = pickBestStoreUrl(extractStoreUrlsFromHtml(html))
      // Fracasso NÃO é cacheado — de propósito.
      if (best && useCache) setCached(candidateUrl, best)
      if (best) return { store: best, reason: null }
      return { store: null, reason: html ? 'pagina_sem_link_de_loja' : 'pagina_vazia' }
    }
    return { store: null, reason: 'redirects_demais' }
  } catch (err) {
    const nome = err?.name === 'TimeoutError' || err?.name === 'AbortError'
      ? 'tempo_esgotado'
      : `erro_de_rede:${err?.name || 'desconhecido'}`
    return { store: null, reason: nome, detail: err?.message }
  }
}

/**
 * Mesma resolução, devolvendo só o achado — para quem não precisa do motivo.
 */
export async function resolveStoreUrlFromCustomDomain(candidateUrl, options = {}) {
  const { store } = await resolveStoreUrlFromCustomDomainDetailed(candidateUrl, options)
  return store || null
}

/**
 * Troca no TEXTO as URLs de domínio próprio pela URL da loja que elas
 * escondem. Devolve `{ text, resolved, failures }` — `text` é o original quando
 * nada foi resolvido (fail-safe), e `failures` diz POR QUE cada candidato não
 * resolveu, para o robô registrar no log em vez de falhar em silêncio.
 */
export async function resolveCustomDomainLinks(text, options = {}) {
  const raw = String(text ?? '')
  if (!raw || !isCustomDomainResolveEnabled()) return { text: raw, resolved: [], failures: [] }

  const candidates = findCandidateLinks(raw)
  if (!candidates.length) return { text: raw, resolved: [], failures: [] }

  const comecouEm = Date.now()
  // Mensagem mista (já tem link de loja) gasta menos: ver invariante no topo.
  const orcamentoTotal = Number.isFinite(options.totalBudgetMs)
    ? options.totalBudgetMs
    : (hasStoreLink(raw) ? CUSTOM_DOMAIN_MIXED_BUDGET_MS : CUSTOM_DOMAIN_TOTAL_BUDGET_MS)
  const tetoPorLink = Number.isFinite(options.timeoutMs)
    ? options.timeoutMs
    : CUSTOM_DOMAIN_FETCH_TIMEOUT_MS
  const maxTentativas = Number.isFinite(options.maxAttempts)
    ? Math.max(1, Math.floor(options.maxAttempts))
    : CUSTOM_DOMAIN_MAX_ATTEMPTS

  let output = raw
  const resolved = []
  const failures = []
  for (const [indice, candidate] of candidates.entries()) {
    const restante = orcamentoTotal - (Date.now() - comecouEm)
    if (restante < MIN_USEFUL_BUDGET_MS) {
      failures.push({ url: candidate, reason: 'sem_tempo_no_orcamento' })
      continue
    }
    // FATIA POR LINK (RCA 2026-09-18 — não remover). O orçamento é da mensagem
    // inteira, e sem divisão o PRIMEIRO link embrulhado consumia tudo: um site
    // lento fazia o segundo nem ser tentado, e a oferta saía com "Compre aqui:"
    // vazio. Cada link passa a ter um teto próprio = o que sobra dividido pelos
    // links que ainda faltam. Link rápido devolve a sobra para os seguintes
    // (resolveu em 600ms → o próximo volta a ter o teto cheio de 8s), então o
    // caso comum não fica mais lento; o que muda é um link lento não poder mais
    // zerar a chance dos outros.
    const faltando = candidates.length - indice
    const fatiaDoLink = Math.max(MIN_USEFUL_BUDGET_MS, Math.floor(restante / faltando))
    const prazoDoLink = Date.now() + fatiaDoLink
    let store = null
    let reason = null
    let detail
    const attempts = []
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
      const restanteDaTentativa = Math.min(
        orcamentoTotal - (Date.now() - comecouEm),
        prazoDoLink - Date.now(),
      )
      if (restanteDaTentativa < MIN_USEFUL_BUDGET_MS) break

      const iniciouEm = Date.now()
      const resultado = await resolveStoreUrlFromCustomDomainDetailed(candidate, {
        ...options,
        timeoutMs: Math.min(tetoPorLink, restanteDaTentativa),
      })
      store = resultado.store
      reason = resultado.reason
      detail = resultado.detail
      attempts.push({
        attempt: tentativa,
        durationMs: Date.now() - iniciouEm,
        reason,
        ...(detail ? { detail } : {}),
      })

      if (store || !isRetryableCustomDomainFailure(reason)) break
    }
    if (!store) {
      failures.push({
        url: candidate,
        reason: reason || 'sem_tempo_no_orcamento',
        detail,
        attempts,
      })
      continue
    }
    output = output.split(candidate).join(store.url)
    resolved.push({
      from: candidate,
      to: store.url,
      platform: store.platform,
      attempts,
      recoveredByRetry: attempts.length > 1,
    })
  }
  return { text: output, resolved, failures }
}
