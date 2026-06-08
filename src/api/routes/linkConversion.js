import db from '../../db.js'
import { detectLinks } from '../../detector.js'
import { convertLink as defaultConvertLink } from '../../converters/index.js'
import { fetchProductInfo as defaultFetchProductInfo } from '../../converters/productInfoScraper.js'
import { validateCredentialData } from '../../credentialHealth.js'
import { assertPublicUrl } from '../../core/ssrfGuard.js'
import {
  buildScrapedOffer,
  buildCredentialsMap,
  missingCredentialMessage,
  normalizeConverter,
  withTimeout,
} from '../../converters/offerEngine.js'

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

    // D-2 (anti-SSRF): /scrape-offer aceita qualquer URL pública de produto,
    // mas o servidor vai buscá-la (fetch). Bloqueia hosts internos/privados
    // (127.0.0.1, 169.254.169.254, Redis local, etc.) antes de chamar o motor.
    try {
      await assertPublicUrl(url)
    } catch (err) {
      if (err?.code === 'SSRF_BLOCKED') {
        return reply.code(400).send({
          error: 'Não foi possível buscar esse link. Cole um link público de produto de uma loja suportada.',
          code: 'SCRAPE_OFFER_BLOCKED_URL',
        })
      }
      throw err
    }

    const userId = req.user.sub
    const credentials = await findCredentials(userId)
    const credentialsMap = buildCredentialsMap(credentials)

    // Painel "Criar oferta": o link mostrado é o CONVERTIDO (afiliado), por
    // isso keepOriginalLink=false. A busca de título/preço (conversão ->
    // resolução -> scrape com credenciais -> fallback) vive no motor único
    // compartilhado com o bot do Telegram (offerEngine.js).
    const offer = await buildScrapedOffer({
      url,
      credentialsMap,
      keepOriginalLink: false,
      convertLink,
      fetchProductInfo,
      conversionTimeoutMs: operational.conversionTimeoutMs,
      logger: app.log,
    })

    return {
      title: offer.title,
      oldPrice: offer.oldPrice,
      newPrice: offer.newPrice,
      finalUrl: offer.finalUrl,
      offerUrl: offer.offerUrl,
      conversionWarning: offer.conversionWarning,
      conversion: offer.conversion,
      ...(offer.scrapeWarning ? { scrapeWarning: offer.scrapeWarning } : {}),
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
