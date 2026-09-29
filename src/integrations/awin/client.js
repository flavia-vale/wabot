// Cliente HTTP da Awin — SÓ transporte. Não sabe de banco, de cliente do
// Espelha Grupos nem de oferta automática; por isso é reaproveitável na fase
// de conversão de links.
//
// Fonte de verdade (lida em 2026-09-27/29):
// - Base https://api.awin.com, 20 chamadas/min por usuário, só HTTPS:
//   https://help.awin.com/apidocs/introduction-1
// - Token do USUÁRIO Awin no cabeçalho "Authorization: Bearer <token>":
//   https://help.awin.com/apidocs/api-authentication
//   A especificação ainda lista `accessToken` na URL, mas medimos em
//   2026-09-29 (conta 2701264) que só o cabeçalho basta (200). O token NUNCA
//   vai na URL — URL vai para log de proxy.
// - GET /accounts?type=publisher → { userId, accounts: [{accountId, ...}] }
//   (formato medido): https://help.awin.com/apidocs/returns-information-about-accounts-for-a-given-user
// - POST /publisher/{publisherId}/promotions → { data: [...], pagination:
//   { page, pageSize, total } } (formato medido):
//   https://help.awin.com/apidocs/promotions
//
// FASE FUTURA (não implementada — só o desenho, para a interface não mudar):
// - generateLink(token, publisherId, { advertiserId, destinationUrl,
//   parameters: { clickref, clickref2..6 }, shorten }) →
//   POST /publishers/{publisherId}/linkbuilder/generate  → { url, shortUrl }
//   https://help.awin.com/apidocs/generatelink (loja pode recusar:
//   "deeplinkNotPermitted")
// - generateLinks(token, publisherId, requests[≤100]) →
//   POST /publishers/{publisherId}/linkbuilder/generate-batch
//   https://help.awin.com/apidocs/generatebatchlinks
// - getLinkQuota(token, publisherId) →
//   GET /publishers/{publisherId}/linkbuilder/quota
//   https://help.awin.com/apidocs/quota
// - Plano B local, sem chamada: deep link documentado na Central de Ajuda
//   https://www.awin1.com/cread.php?awinmid=<loja>&awinaffid=<publisher>&ued=<url>
//   https://success.awin.com/articles/en_US/Knowledge/What-does-an-affiliate-link-look-like

import { createHmac } from 'node:crypto'
import { createTokenRateLimiter } from './rateLimiter.js'
import {
  AwinAuthError,
  AwinHttpError,
  AwinNetworkError,
  AwinRateLimitError,
  AwinResponseError,
  AwinTimeoutError,
} from './errors.js'

export const AWIN_BASE_URL = 'https://api.awin.com'
export const AWIN_DEFAULT_TIMEOUT_MS = 15_000
export const AWIN_MAX_PAGE_SIZE = 200
export const AWIN_MIN_PAGE_SIZE = 10

const PUBLISHER_ID_RE = /^\d{1,12}$/

export function isValidPublisherId(value) {
  return PUBLISHER_ID_RE.test(String(value ?? '').trim())
}

// Impressão digital do token: identifica o token para o limitador e para
// detectar reuso, sem permitir recuperá-lo. A chave de cifra entra como
// "pimenta" quando existe (dev/test sem chave continuam funcionando).
export function tokenFingerprint(token) {
  const pepper = process.env.CREDENTIAL_ENCRYPTION_KEY || 'awin-fingerprint'
  return createHmac('sha256', pepper).update(String(token ?? '')).digest('hex')
}

function parseRetryAfter(value) {
  if (value == null || value === '') return null
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000)
  const at = Date.parse(value)
  if (Number.isFinite(at)) return Math.max(0, at - Date.now())
  return null
}

const sharedLimiter = createTokenRateLimiter()

export function createAwinClient({
  fetchFn = globalThis.fetch,
  timeoutMs = AWIN_DEFAULT_TIMEOUT_MS,
  limiter = sharedLimiter,
  baseUrl = AWIN_BASE_URL,
} = {}) {
  async function request(token, { method = 'GET', path, query = null, body = undefined }) {
    const secret = String(token ?? '').trim()
    if (!secret) throw new AwinAuthError(null)
    await limiter.acquire(tokenFingerprint(secret))

    const url = new URL(path, baseUrl)
    for (const [key, value] of Object.entries(query || {})) {
      if (value != null) url.searchParams.set(key, String(value))
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let response
    try {
      response = await fetchFn(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      })
    } catch (error) {
      if (error?.name === 'AbortError' || controller.signal.aborted) throw new AwinTimeoutError()
      throw new AwinNetworkError()
    } finally {
      clearTimeout(timer)
    }

    if (response.status === 401 || response.status === 403) throw new AwinAuthError(response.status)
    if (response.status === 429) throw new AwinRateLimitError(parseRetryAfter(response.headers?.get?.('retry-after')))
    if (!response.ok) throw new AwinHttpError(response.status)
    try {
      return await response.json()
    } catch {
      throw new AwinResponseError()
    }
  }

  // Contas de publisher que o token enxerga. Serve para "Testar conexão" e
  // para conferir se o Publisher ID digitado é mesmo desse token. Mudança de
  // acesso na Awin leva até 10 min para valer (doc de autenticação).
  async function listAccounts(token, { type = 'publisher' } = {}) {
    return request(token, { path: '/accounts', query: { type } })
  }

  async function listPromotions(token, publisherId, { filters = {}, page = 1, pageSize = AWIN_MAX_PAGE_SIZE } = {}) {
    if (!isValidPublisherId(publisherId)) throw new AwinHttpError(400)
    const size = Math.min(AWIN_MAX_PAGE_SIZE, Math.max(AWIN_MIN_PAGE_SIZE, Number(pageSize) || AWIN_MAX_PAGE_SIZE))
    return request(token, {
      method: 'POST',
      path: `/publisher/${String(publisherId).trim()}/promotions`,
      body: { filters, pagination: { page: Math.max(1, Number(page) || 1), pageSize: size } },
    })
  }

  return { listAccounts, listPromotions }
}

let defaultClient = null
export function getDefaultAwinClient() {
  defaultClient ||= createAwinClient()
  return defaultClient
}
