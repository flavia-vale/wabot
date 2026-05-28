import db from '../../db.js'
import { detectLinks } from '../../detector.js'
import { convertLink as defaultConvertLink } from '../../converters/index.js'
import { fetchProductInfo as defaultFetchProductInfo } from '../../converters/productInfoScraper.js'
import { parseCredentialData, validateCredentialData } from '../../credentialHealth.js'

const MAX_LINKS_PER_REQUEST = 10
const MAX_TEXT_LENGTH = 12_000
const MAX_REQUESTS_PER_WINDOW = 6
const RATE_LIMIT_WINDOW_MS = 60_000
const MAX_ACTIVE_REQUESTS_PER_USER = 1
const MAX_ACTIVE_REQUESTS_GLOBAL = 8
const CONVERSION_TIMEOUT_MS = 15_000
const REQUEST_DEADLINE_MS = 45_000
const RATE_STATE_MAX_ENTRIES = 5_000
const BODY_LIMIT_BYTES = 32 * 1024

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function secondsUntil(timestamp, now = Date.now()) {
  return Math.max(1, Math.ceil((timestamp - now) / 1000))
}

function cleanupRateState(rateState, windowMs, now = Date.now()) {
  if (rateState.size <= RATE_STATE_MAX_ENTRIES) return
  for (const [userId, state] of rateState.entries()) {
    if (now - state.windowStart >= windowMs && state.active <= 0) {
      rateState.delete(userId)
    }
  }
}

function getRateStateForUser(rateState, userId, windowMs, now = Date.now()) {
  cleanupRateState(rateState, windowMs, now)
  const current = rateState.get(userId)
  if (!current || now - current.windowStart >= windowMs) {
    const next = { windowStart: now, count: 0, active: current?.active ?? 0 }
    rateState.set(userId, next)
    return next
  }
  return current
}

function buildCredentialsMap(credentials) {
  return Object.fromEntries(credentials.map(credential => [credential.platform, parseCredentialData(credential.data)]))
}

function missingCredentialMessage(validation) {
  const missing = validation.missing?.length ? `: ${validation.missing.join(', ')}` : ''
  return `Credenciais de ${validation.label} ausentes ou incompletas${missing}. Abra a aba Credenciais para configurar antes de converter links dessa loja.`
}

function buildErrorResult(index, link, validation, code, error) {
  return {
    index,
    platform: link.platform,
    label: validation.label,
    originalUrl: link.url,
    convertedUrl: null,
    status: 'error',
    code,
    error,
  }
}

async function withTimeout(promise, timeoutMs, message) {
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

function resolveOperationalOptions(opts) {
  return {
    maxTextLength: opts.maxTextLength ?? MAX_TEXT_LENGTH,
    maxRequestsPerWindow: opts.maxRequestsPerWindow ?? MAX_REQUESTS_PER_WINDOW,
    rateLimitWindowMs: opts.rateLimitWindowMs ?? RATE_LIMIT_WINDOW_MS,
    maxActiveRequestsPerUser: opts.maxActiveRequestsPerUser ?? MAX_ACTIVE_REQUESTS_PER_USER,
    maxActiveRequestsGlobal: opts.maxActiveRequestsGlobal ?? MAX_ACTIVE_REQUESTS_GLOBAL,
    conversionTimeoutMs: opts.conversionTimeoutMs ?? CONVERSION_TIMEOUT_MS,
    requestDeadlineMs: opts.requestDeadlineMs ?? REQUEST_DEADLINE_MS,
  }
}

const SCRAPE_OFFER_URL_RE = /^https?:\/\/[^\s]+$/i


function extractSingleLink(url) {
  const links = detectLinks(url)
  return links[0] ?? null
}

function conversionFailureFromContext(context, err) {
  if (context === 'unsupported') return { reasonCode: 'UNSUPPORTED_PLATFORM', reasonMessage: 'Loja ainda sem conversão automática.' }
  if (context === 'missing_credentials') return { reasonCode: 'MISSING_CREDENTIALS', reasonMessage: 'Credenciais ausentes ou incompletas para esta loja.' }
  if (context === 'empty_result') return { reasonCode: 'CONVERSION_RETURNED_EMPTY', reasonMessage: 'O conversor não retornou um link válido.' }
  if (err?.code === 'CONVERSION_TIMEOUT') return { reasonCode: 'CONVERSION_TIMEOUT', reasonMessage: err.message }
  return { reasonCode: 'CONVERSION_FAILED', reasonMessage: err?.message || 'Falha na conversão do link.' }
}

function inferTitleFromUrl(url) {
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

export async function linkConversionRoutes(app, opts = {}) {
  const convertLink = opts.converter ? normalizeConverter(opts.converter) : defaultConvertLink
  const fetchProductInfo = opts.fetchProductInfo ?? defaultFetchProductInfo
  const findCredentials = opts.findCredentials ?? ((userId) => db.credential.findMany({ where: { userId } }))
  const rateState = opts.rateState ?? new Map()
  const getNow = opts.now ?? (() => Date.now())
  const operational = resolveOperationalOptions(opts)
  let activeRequestsGlobal = 0

  app.post('/scrape-offer', { onRequest: [app.authenticate], bodyLimit: BODY_LIMIT_BYTES }, async (req, reply) => {
    const url = normalizeText(req.body?.url)
    if (!url || !SCRAPE_OFFER_URL_RE.test(url)) {
      return reply.code(400).send({
        error: 'Cole um link válido começando com http(s):// para gerar a oferta.',
        code: 'SCRAPE_OFFER_INVALID_URL',
      })
    }

    const userId = req.user.sub
    const parsedLink = extractSingleLink(url)
    const platform = parsedLink?.platform ?? null

    let offerUrl = url
    let conversionSuccess = false
    let reasonCode = null
    let reasonMessage = null

    if (!platform) {
      const failure = conversionFailureFromContext('unsupported')
      reasonCode = failure.reasonCode
      reasonMessage = failure.reasonMessage
    } else {
      const credentials = await findCredentials(userId)
      const credentialsMap = buildCredentialsMap(credentials)
      const validation = validateCredentialData(platform, credentialsMap[platform])

      if (!validation.configured) {
        const failure = conversionFailureFromContext('missing_credentials')
        reasonCode = failure.reasonCode
        reasonMessage = missingCredentialMessage(validation)
      } else {
        try {
          const convertedUrl = await withTimeout(
            convertLink(platform, url, credentialsMap),
            operational.conversionTimeoutMs,
            `Tempo limite de conversão excedido para ${validation.label}. Tente novamente.`,
          )
          if (convertedUrl) {
            offerUrl = convertedUrl
            conversionSuccess = true
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

    try {
      const info = await fetchProductInfo(offerUrl)
      return {
        title: info?.title || '',
        oldPrice: info?.oldPrice || '',
        newPrice: info?.newPrice || '',
        finalUrl: info?.finalUrl || offerUrl,
        offerUrl,
        conversion: {
          attempted: true,
          success: conversionSuccess,
          usedOriginalUrl: !conversionSuccess,
          reasonCode: conversionSuccess ? null : reasonCode,
          reasonMessage: conversionSuccess ? null : reasonMessage,
          platform,
        },
      }
    } catch (err) {
      app.log.warn({ err: err.message, url: offerUrl }, 'Falha ao buscar informações do produto; retornando fallback mínimo')
      const fallbackTitle = inferTitleFromUrl(offerUrl) || inferTitleFromUrl(url)
      return {
        title: fallbackTitle,
        oldPrice: '',
        newPrice: '',
        finalUrl: offerUrl,
        offerUrl,
        conversion: {
          attempted: true,
          success: conversionSuccess,
          usedOriginalUrl: !conversionSuccess,
          reasonCode: conversionSuccess ? null : reasonCode,
          reasonMessage: conversionSuccess ? null : reasonMessage,
          platform,
        },
        scrapeWarning: {
          code: 'SCRAPE_OFFER_FETCH_FAILED',
          message: 'Não foi possível ler as informações do produto agora. Preencha o template manualmente ou tente outro link.',
        },
      }
    }
  })

  app.post('/convert', { onRequest: [app.authenticate], bodyLimit: BODY_LIMIT_BYTES }, async (req, reply) => {
    const userId = req.user.sub
    const now = getNow()
    const state = getRateStateForUser(rateState, userId, operational.rateLimitWindowMs, now)

    if (activeRequestsGlobal >= operational.maxActiveRequestsGlobal) {
      return reply.code(503).send({
        error: 'Conversor ocupado no momento. Tente novamente em alguns instantes.',
        code: 'LINK_CONVERSION_GLOBAL_BUSY',
        retryable: true,
        retryAfterSeconds: 10,
      })
    }

    if (state.active >= operational.maxActiveRequestsPerUser) {
      return reply.code(429).header('Retry-After', '10').send({
        error: 'Já existe uma conversão em andamento para sua conta. Aguarde terminar antes de enviar outro lote.',
        code: 'LINK_CONVERSION_ALREADY_RUNNING',
        retryable: true,
        retryAfterSeconds: 10,
      })
    }

    if (state.count >= operational.maxRequestsPerWindow) {
      const retryAfterSeconds = secondsUntil(state.windowStart + operational.rateLimitWindowMs, now)
      return reply.code(429).header('Retry-After', String(retryAfterSeconds)).send({
        error: `Você atingiu o limite de ${operational.maxRequestsPerWindow} conversões por minuto. Aguarde ${retryAfterSeconds}s e tente novamente.`,
        code: 'LINK_CONVERSION_RATE_LIMITED',
        retryable: true,
        retryAfterSeconds,
      })
    }

    state.count += 1
    state.active += 1
    activeRequestsGlobal += 1

    try {
      const text = normalizeText(req.body?.text)
      if (!text) {
        return reply.code(400).send({
          error: 'Cole pelo menos um link de produto para converter.',
          code: 'LINK_CONVERSION_EMPTY_TEXT',
        })
      }

      if (text.length > operational.maxTextLength) {
        return reply.code(413).send({
          error: `Texto muito grande para conversão manual. Cole até ${operational.maxTextLength.toLocaleString('pt-BR')} caracteres por vez para evitar sobrecarga.`,
          code: 'LINK_CONVERSION_TEXT_TOO_LARGE',
          maxLength: operational.maxTextLength,
        })
      }

      const links = detectLinks(text)
      if (!links.length) {
        return reply.code(400).send({
          error: 'Não encontramos links compatíveis. Cole links da Amazon, Mercado Livre, Shopee ou Magazine Luiza.',
          code: 'LINK_CONVERSION_NO_LINKS',
        })
      }

      if (links.length > MAX_LINKS_PER_REQUEST) {
        return reply.code(400).send({
          error: `Cole no máximo ${MAX_LINKS_PER_REQUEST} links por vez. Encontramos ${links.length} links no texto; divida em partes menores para converter com segurança.`,
          code: 'LINK_CONVERSION_LIMIT_EXCEEDED',
          count: links.length,
          max: MAX_LINKS_PER_REQUEST,
        })
      }

      const credentials = await findCredentials(userId)
      const credentialsMap = buildCredentialsMap(credentials)
      const deadlineAt = Date.now() + operational.requestDeadlineMs

      const results = []
      for (const [index, link] of links.entries()) {
        const validation = validateCredentialData(link.platform, credentialsMap[link.platform])
        if (!validation.configured) {
          results.push(buildErrorResult(index, link, validation, 'MISSING_CREDENTIALS', missingCredentialMessage(validation)))
          continue
        }

        const remainingMs = deadlineAt - Date.now()
        if (remainingMs <= 0) {
          results.push(buildErrorResult(
            index,
            link,
            validation,
            'REQUEST_DEADLINE_EXCEEDED',
            'A conversão demorou demais e foi interrompida para proteger a estabilidade do sistema. Tente novamente com menos links.',
          ))
          continue
        }

        try {
          const conversionResult = await withTimeout(
            convertLink(link.platform, link.url, credentialsMap),
            Math.min(operational.conversionTimeoutMs, remainingMs),
            `Tempo limite de conversão excedido para ${validation.label}. Tente novamente ou envie menos links por vez.`,
          )
          if (!conversionResult?.url) {
            results.push(buildErrorResult(
              index,
              link,
              validation,
              'CONVERSION_RETURNED_EMPTY',
              `O conversor de ${validation.label} não retornou um link convertido. Confira se o link e as credenciais estão válidos.`,
            ))
            continue
          }

          results.push({
            index,
            platform: link.platform,
            label: validation.label,
            originalUrl: link.url,
            convertedUrl: conversionResult.url,
            warning: conversionResult.warning ?? null,
            status: 'converted',
            code: null,
            error: null,
          })
        } catch (err) {
          results.push(buildErrorResult(index, link, validation, 'CONVERSION_FAILED', `Falha na conversão de ${validation.label}: ${err.message}`))
        }
      }

      const convertedCount = results.filter(result => result.status === 'converted').length
      return {
        count: links.length,
        convertedCount,
        failedCount: links.length - convertedCount,
        max: MAX_LINKS_PER_REQUEST,
        results,
      }
    } catch (err) {
      app.log.error({ err: err.message, userId }, 'Falha inesperada na conversão manual de links')
      return reply.code(500).send({
        error: 'Falha inesperada ao converter links. Tente novamente em instantes.',
        code: 'LINK_CONVERSION_UNEXPECTED_ERROR',
      })
    } finally {
      state.active = Math.max(0, state.active - 1)
      activeRequestsGlobal = Math.max(0, activeRequestsGlobal - 1)
    }
  })
}
