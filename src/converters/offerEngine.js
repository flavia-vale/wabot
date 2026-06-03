// Motor único de montagem de oferta compartilhado entre o endpoint
// `/api/link-conversion/scrape-offer` (painel "Criar oferta") e o bot do
// Telegram (`src/telegram/offerBot.js`).
//
// Antes da unificação cada caminho buscava título/preço de forma diferente:
// o painel convertia o link, passava credenciais (cookie ML) e tinha
// fallback; o Telegram scrapava o link cru, sem credenciais e sem fallback.
// Isso fazia o MESMO link render resultados diferentes (ver análise no
// AGENTS.md / histórico). Aqui a lógica de "converter -> resolver -> scrapar
// com credenciais -> fallback" vive em um só lugar.
//
// A ÚNICA diferença permitida entre os dois consumidores é qual link aparece
// na oferta final, controlada por `keepOriginalLink`:
//   - painel: usa o link convertido (afiliado) -> keepOriginalLink = false
//   - Telegram: converte só para buscar dados, mas devolve o link colado pelo
//     usuário -> keepOriginalLink = true

import { detectLinks } from '../detector.js'
import { convertLink as defaultConvertLink } from './index.js'
import { fetchProductInfo as defaultFetchProductInfo } from './productInfoScraper.js'
import { parseCredentialData, validateCredentialData } from '../credentialHealth.js'

export const CONVERSION_TIMEOUT_MS = 15_000

const noopLogger = { warn() {} }

export function extractSingleLink(url) {
  const links = detectLinks(url)
  return links[0] ?? null
}

export function buildCredentialsMap(credentials) {
  return Object.fromEntries(
    (credentials || []).map(credential => [credential.platform, parseCredentialData(credential.data)]),
  )
}

export function missingCredentialMessage(validation) {
  const missing = validation.missing?.length ? `: ${validation.missing.join(', ')}` : ''
  return `Credenciais de ${validation.label} ausentes ou incompletas${missing}. Abra a aba Credenciais para configurar antes de converter links dessa loja.`
}

export function conversionFailureFromContext(context, err) {
  if (context === 'unsupported') return { reasonCode: 'UNSUPPORTED_PLATFORM', reasonMessage: 'Loja ainda sem conversão automática.' }
  if (context === 'missing_credentials') return { reasonCode: 'MISSING_CREDENTIALS', reasonMessage: 'Credenciais ausentes ou incompletas para esta loja.' }
  if (context === 'empty_result') return { reasonCode: 'CONVERSION_RETURNED_EMPTY', reasonMessage: 'O conversor não retornou um link válido.' }
  if (err?.code === 'CONVERSION_TIMEOUT') return { reasonCode: 'CONVERSION_TIMEOUT', reasonMessage: err.message }
  return { reasonCode: 'CONVERSION_FAILED', reasonMessage: err?.message || 'Falha na conversão do link.' }
}

export function inferTitleFromUrl(url) {
  try {
    const u = new URL(String(url || ''))
    const host = u.hostname.replace(/^www\./, '')
    if (/mercadolivre\.com\.br$/.test(host)) {
      const m = u.pathname.match(/^\/([^/]+)\/(?:p|up)\//i)
      if (m?.[1]) return decodeURIComponent(m[1]).replace(/-/g, ' ').trim()
    }
    if (/amazon\.com\.br$/.test(host)) {
      const m = u.pathname.match(/^\/([^/]+)\/dp\//i)
      if (m?.[1]) return decodeURIComponent(m[1]).replace(/-/g, ' ').trim()
    }
    if (/shopee\.com\.br$/.test(host)) {
      const m = u.pathname.match(/^\/([^/]+)-i\.\d+\.\d+/i)
      if (m?.[1]) return decodeURIComponent(m[1]).replace(/-/g, ' ').trim()
    }
  } catch {}
  return ''
}

export function hasUsefulOfferInfo(info) {
  const title = typeof info?.title === 'string' ? info.title.trim() : ''
  const newPrice = typeof info?.newPrice === 'string' ? info.newPrice.trim() : ''
  const oldPrice = typeof info?.oldPrice === 'string' ? info.oldPrice.trim() : ''
  return Boolean(title || newPrice || oldPrice)
}

export async function withTimeout(promise, timeoutMs, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(message)
      err.code = 'CONVERSION_TIMEOUT'
      reject(err)
    }, Math.max(1, timeoutMs))
    timer.unref?.()
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// Normaliza um conversor injetado (testes) para o mesmo contrato de
// `defaultConvertLink`: `{ url, warning } | null`. O conversor injetado pode
// devolver string (caso comum), objeto `{ url, warning }` ou null.
export function normalizeConverter(converter) {
  return async (platform, url, credentials) => {
    const result = await converter(platform, url, credentials)
    if (!result) return null
    if (typeof result === 'string') return { url: result, warning: null }
    if (result.url) return { url: result.url, warning: result.warning ?? null }
    return null
  }
}

// Motor compartilhado. Converte (quando há credenciais para a plataforma),
// scrapa título/preço com as credenciais disponíveis e aplica os fallbacks.
//
// `keepOriginalLink`:
//   false (painel) -> `displayUrl` = link convertido (afiliado)
//   true  (Telegram) -> `displayUrl` = link original colado pelo usuário
//
// Retorno: { title, oldPrice, newPrice, finalUrl, offerUrl, displayUrl,
//            conversionWarning, conversion, scrapeWarning? }
export async function buildScrapedOffer({
  url,
  platform: platformArg,
  credentialsMap = {},
  keepOriginalLink = false,
  convertLink = defaultConvertLink,
  fetchProductInfo = defaultFetchProductInfo,
  conversionTimeoutMs = CONVERSION_TIMEOUT_MS,
  logger = noopLogger,
} = {}) {
  const parsedLink = extractSingleLink(url)
  const platform = platformArg ?? parsedLink?.platform ?? null

  const mlCredentials = credentialsMap.mercadolivre || null
  const shopeeCredentials = credentialsMap.shopee || null
  const scrapeCreds = { mlCredentials, shopeeCredentials }

  const hasPrice = (i) => Boolean(typeof i?.newPrice === 'string' && i.newPrice.trim())

  // 1) DADOS: scrapa o link ORIGINAL. O fetchProductInfo já resolve short
  //    links, landings /social/, recomendações /up/ e aplica o cookie ML
  //    internamente, então UMA requisição traz título+preço na maioria dos
  //    casos. Scrapar o link CONVERTIDO (afiliado) aqui era pior: Amazon e
  //    Shopee respondem com anti-bot/throttle no 2º hit em sequência (o
  //    fallback), derrubando o preço. Buscar o original num único hit é o
  //    caminho confiável; a conversão entra só para o link de exibição
  //    (afiliado) e como fallback de dados quando o original não traz preço.
  let info = {}
  let scrapeThrew = false
  try {
    info = (await fetchProductInfo(url, scrapeCreds)) || {}
  } catch (err) {
    logger.warn?.({ err: err.message, url }, 'Falha ao buscar dados pelo link original')
    info = {}
    scrapeThrew = true
  }

  let offerUrl = url
  let conversionAttempted = false
  let conversionSuccess = false
  let reasonCode = null
  let reasonMessage = null
  let conversionWarning = null

  // 2) CONVERSÃO: necessária para o link de exibição do painel (afiliado) e,
  //    em ambos os consumidores, como fallback de dados quando o original não
  //    trouxe preço. O Telegram exibe o link original, então só converte se
  //    precisar completar dados — evitando um hit extra na loja no caminho
  //    feliz (preço já obtido do original).
  const needConversionForDisplay = !keepOriginalLink
  const needConversionForData = !hasPrice(info)

  if (!platform) {
    const failure = conversionFailureFromContext('unsupported')
    reasonCode = failure.reasonCode
    reasonMessage = failure.reasonMessage
  } else if (needConversionForDisplay || needConversionForData) {
    conversionAttempted = true
    const validation = validateCredentialData(platform, credentialsMap[platform])
    if (!validation.configured) {
      const failure = conversionFailureFromContext('missing_credentials')
      reasonCode = failure.reasonCode
      reasonMessage = missingCredentialMessage(validation)
    } else {
      try {
        const conversionResult = await withTimeout(
          convertLink(platform, url, credentialsMap),
          conversionTimeoutMs,
          `Tempo limite de conversão excedido para ${validation.label}. Tente novamente.`,
        )
        if (conversionResult?.url) {
          offerUrl = conversionResult.url
          conversionSuccess = true
          conversionWarning = conversionResult.warning ?? null
        } else {
          const failure = conversionFailureFromContext('empty_result')
          reasonCode = failure.reasonCode
          reasonMessage = failure.reasonMessage
        }
      } catch (err) {
        const failure = conversionFailureFromContext('error', err)
        reasonCode = failure.reasonCode
        reasonMessage = failure.reasonMessage
      }
    }
  }

  // 3) FALLBACK DE DADOS: só quando o original não trouxe preço E a conversão
  //    gerou um link diferente. Raro — cobre links que apenas o conversor
  //    consegue resolver. No caminho feliz (preço veio do original) não há
  //    segundo hit na loja.
  if (!hasPrice(info) && conversionSuccess && offerUrl !== url) {
    try {
      const alt = await fetchProductInfo(offerUrl, scrapeCreds)
      if (hasUsefulOfferInfo(alt)) {
        info = {
          title: info?.title || alt?.title || '',
          newPrice: info?.newPrice || alt?.newPrice || '',
          oldPrice: info?.oldPrice || alt?.oldPrice || '',
          finalUrl: info?.finalUrl || alt?.finalUrl || offerUrl,
        }
      }
    } catch {
      // mantém o que veio do original
    }
  }

  const conversionMeta = () => ({
    attempted: conversionAttempted,
    success: conversionSuccess,
    usedOriginalUrl: !conversionSuccess,
    reasonCode: conversionSuccess ? null : reasonCode,
    reasonMessage: conversionSuccess ? null : reasonMessage,
    platform,
  })

  // Link exibido ao usuário: Telegram SEMPRE o original colado; painel o
  // convertido (offerUrl).
  const displayUrl = keepOriginalLink ? url : offerUrl

  if (hasUsefulOfferInfo(info)) {
    return {
      title: info?.title || '',
      oldPrice: info?.oldPrice || '',
      newPrice: info?.newPrice || '',
      finalUrl: info?.finalUrl || offerUrl,
      offerUrl,
      displayUrl,
      conversionWarning,
      conversion: conversionMeta(),
    }
  }

  // A busca FALHOU (exceção): degrada inferindo o título do slug da URL e
  // sinaliza scrapeWarning, para o painel exibir um template parcial editável.
  // (No Telegram, se o slug não render título, vira "produto não encontrado".)
  if (scrapeThrew) {
    const fallbackTitle = inferTitleFromUrl(offerUrl) || inferTitleFromUrl(url)
    return {
      title: fallbackTitle,
      oldPrice: '',
      newPrice: '',
      finalUrl: info?.finalUrl || offerUrl,
      offerUrl,
      displayUrl,
      conversionWarning,
      conversion: conversionMeta(),
      scrapeWarning: {
        code: 'SCRAPE_OFFER_FETCH_FAILED',
        message: 'Não foi possível ler as informações do produto agora. Preencha o template manualmente ou tente outro link.',
      },
    }
  }

  // Scrape OK porém sem dados úteis → "produto não encontrado". NÃO inferimos
  // título da URL aqui: evita o Telegram montar oferta-lixo só com slug.
  return {
    title: '',
    oldPrice: '',
    newPrice: '',
    finalUrl: info?.finalUrl || offerUrl,
    offerUrl,
    displayUrl,
    conversionWarning,
    conversion: conversionMeta(),
  }
}
