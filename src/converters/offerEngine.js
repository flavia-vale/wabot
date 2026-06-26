// Motor único de montagem de oferta usado pelo endpoint
// `/api/link-conversion/scrape-offer` (painel "Criar oferta"). Mantido como
// ponto único para que qualquer futuro consumidor de oferta reaproveite a
// mesma busca de título/preço em vez de duplicar a lógica.
//
// A lógica de "converter -> resolver -> scrapar com credenciais (cookie ML) ->
// fallback" vive aqui, em um só lugar.
//
// Qual link aparece na oferta final é controlado por `keepOriginalLink`:
//   - painel: TEMPORARIAMENTE (2026-06) usa keepOriginalLink = true — o
//     usuário cola o próprio link de afiliado e a oferta sai com ele. A
//     conversão ainda roda internamente só para buscar título/preço.
//     Contrato histórico (a restaurar): painel com keepOriginalLink = false
//     (link convertido na oferta).

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

// Quando `keepOriginalLink=true`, substitui `partner_id` no link original pela
// tag do próprio usuário — evita que links colados com ID de outra pessoa
// vazem comissão para terceiros, mantendo a URL intacta (sem converter produto).
function injectOwnerTagInUrl(originalUrl, platform, credentialsMap) {
  const tag = credentialsMap?.[platform]?.tag
  if (!tag) return originalUrl
  try {
    const u = new URL(originalUrl)
    if (!u.searchParams.has('partner_id')) return originalUrl
    u.searchParams.set('partner_id', tag)
    return u.toString()
  } catch {
    return originalUrl
  }
}

// Motor compartilhado. Converte (quando há credenciais para a plataforma),
// scrapa título/preço com as credenciais disponíveis e aplica os fallbacks.
//
// `keepOriginalLink`:
//   false -> `displayUrl` = link convertido (afiliado)
//   true  (temporariamente, o painel) -> `displayUrl` = link original colado
//          pelo usuário
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

  let offerUrl = url
  let conversionSuccess = false
  let reasonCode = null
  let reasonMessage = null
  let conversionWarning = null

  const mlCredentials = credentialsMap.mercadolivre || null
  const shopeeCredentials = credentialsMap.shopee || null

  if (!platform) {
    const failure = conversionFailureFromContext('unsupported')
    reasonCode = failure.reasonCode
    reasonMessage = failure.reasonMessage
  } else {
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

  const conversionMeta = () => ({
    attempted: true,
    success: conversionSuccess,
    usedOriginalUrl: !conversionSuccess,
    reasonCode: conversionSuccess ? null : reasonCode,
    reasonMessage: conversionSuccess ? null : reasonMessage,
    platform,
  })

  // Link exibido ao usuário: com keepOriginalLink=true devolve o original
  // colado; caso contrário, o convertido (offerUrl).
  // Exceção: se o link original já tiver `partner_id` de outra pessoa, troca
  // pela tag do próprio usuário (mantém a URL original, só substitui o ID).
  const displayUrl = injectOwnerTagInUrl(url, platform, credentialsMap)
  const displayUrlFor = (finalUrl) => keepOriginalLink ? displayUrl : (finalUrl || offerUrl)

  try {
    let info = await fetchProductInfo(offerUrl, { mlCredentials, shopeeCredentials })

    // Quando o link convertido é short-link (ex.: Shopee/Amazon) pode haver
    // bloqueio de redirect/anti-bot no scrape do convertido, ou o scrape pode
    // trazer título mas não preço. Nesses casos tentamos o original para
    // complementar título/preço sem perder o offerUrl convertido.
    if (conversionSuccess && offerUrl !== url && !info?.newPrice) {
      try {
        const fallbackInfo = await fetchProductInfo(url, { mlCredentials, shopeeCredentials })
        if (hasUsefulOfferInfo(fallbackInfo)) {
          info = {
            ...info,
            title: info?.title || fallbackInfo?.title,
            newPrice: info?.newPrice || fallbackInfo?.newPrice || '',
            oldPrice: info?.oldPrice || fallbackInfo?.oldPrice || '',
            finalUrl: fallbackInfo?.finalUrl || info?.finalUrl || offerUrl,
          }
        }
      } catch {
        // mantém resultado do convertido
      }
    }

    return {
      title: info?.title || '',
      oldPrice: info?.oldPrice || '',
      newPrice: info?.newPrice || '',
      finalUrl: info?.finalUrl || offerUrl,
      offerUrl,
      displayUrl: displayUrlFor(info?.finalUrl),
      conversionWarning,
      conversion: conversionMeta(),
    }
  } catch (err) {
    logger.warn?.({ err: err.message, url: offerUrl }, 'Falha ao buscar informações do produto; retornando fallback mínimo')

    if (conversionSuccess && offerUrl !== url) {
      try {
        const originalInfo = await fetchProductInfo(url, { mlCredentials, shopeeCredentials })
        if (hasUsefulOfferInfo(originalInfo)) {
          return {
            title: originalInfo?.title || '',
            oldPrice: originalInfo?.oldPrice || '',
            newPrice: originalInfo?.newPrice || '',
            finalUrl: originalInfo?.finalUrl || url,
            offerUrl,
            displayUrl: displayUrlFor(originalInfo?.finalUrl),
            conversionWarning,
            conversion: conversionMeta(),
            scrapeWarning: {
              code: 'SCRAPE_OFFER_FETCH_FALLBACK_ORIGINAL',
              message: 'Não foi possível ler dados pelo link convertido. Usamos o link original para preencher a oferta.',
            },
          }
        }
      } catch {
        // cai no fallback mínimo abaixo
      }
    }

    const fallbackTitle = inferTitleFromUrl(offerUrl) || inferTitleFromUrl(url)
    return {
      title: fallbackTitle,
      oldPrice: '',
      newPrice: '',
      finalUrl: offerUrl,
      offerUrl,
      displayUrl: displayUrlFor(null),
      conversionWarning,
      conversion: conversionMeta(),
      scrapeWarning: {
        code: 'SCRAPE_OFFER_FETCH_FAILED',
        message: 'Não foi possível ler as informações do produto agora. Preencha o template manualmente ou tente outro link.',
      },
    }
  }
}
