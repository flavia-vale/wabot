// Cliente HTTP da Rakuten Advertising — SÓ transporte. Não sabe de banco, de
// cliente do Espelha Grupos nem de oferta automática (mesmo desenho do
// cliente Awin, src/integrations/awin/client.js).
//
// Medido em 2026-09-30 com uma conta real (SID 4640819, rede Brasil = 8):
// - Token: POST https://api.linksynergy.com/token, cabeçalho
//   "Authorization: Bearer base64(<Client ID>:<Client Secret>)", corpo
//   form "scope=<SID>" → { access_token, refresh_token, token_type,
//   expires_in: 3600 }. SID errado → 401 e segredo errado → 400, os dois com
//   { error: "invalid_client" } (não dá para saber qual dos três está errado).
// - Dados: cabeçalho "Authorization: Bearer <access_token>". Token vencido
//   ou inválido → 401 { error: "invalid_token" }.
// - Limite: 100 chamadas/min (cabeçalhos x-ratelimit-limit-minute /
//   ratelimit-remaining). Usamos no máximo 60/min por conta.
// - GET /coupon/1.0?network=8&resultsperpage=&pagenumber= → XML
//   <couponfeed><TotalMatches/><TotalPages/><link>…</link></couponfeed>.
//   Página além da última → 200 sem <link>. Só vêm lojas APROVADAS.
// - GET /v2/advertisers/{id} → JSON { advertiser: { id, name, url,
//   logo_url, network } }. O logo (merchant.linksynergy.com/fs/logo/lg_<id>)
//   é imagem estática: baixá-lo NÃO conta clique (diferente do clickurl).
//
// O token de acesso fica em memória (um por conta, ~1 KB) até 5 min antes
// de vencer. O segredo nunca vai na URL — URL vai para log de proxy.

import { createHmac } from 'node:crypto'
import { createTokenRateLimiter } from '../awin/rateLimiter.js'
import {
  RakutenAuthError,
  RakutenHttpError,
  RakutenNetworkError,
  RakutenRateLimitError,
  RakutenResponseError,
  RakutenTimeoutError,
} from './errors.js'

export const RAKUTEN_BASE_URL = 'https://api.linksynergy.com'
export const RAKUTEN_DEFAULT_TIMEOUT_MS = 20_000
export const RAKUTEN_BRAZIL_NETWORK = '8'
export const RAKUTEN_MAX_PAGE_SIZE = 500
const TOKEN_EARLY_REFRESH_MS = 5 * 60_000
const TOKEN_CACHE_MAX = 500

const SID_RE = /^\d{1,12}$/
const CLIENT_FIELD_RE = /^[A-Za-z0-9_-]{8,200}$/

export function isValidSid(value) {
  return SID_RE.test(String(value ?? '').trim())
}

export function isValidClientField(value) {
  return CLIENT_FIELD_RE.test(String(value ?? '').trim())
}

// Impressão digital do trio de acesso: chave do limitador e do cache de
// token, sem permitir recuperar o segredo.
export function credentialFingerprint({ clientId, clientSecret, sid } = {}) {
  const pepper = process.env.CREDENTIAL_ENCRYPTION_KEY || 'rakuten-fingerprint'
  return createHmac('sha256', pepper).update(`${clientId ?? ''}:${clientSecret ?? ''}:${sid ?? ''}`).digest('hex')
}

function parseRetryAfter(value) {
  if (value == null || value === '') return null
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000)
  const at = Date.parse(value)
  if (Number.isFinite(at)) return Math.max(0, at - Date.now())
  return null
}

const sharedLimiter = createTokenRateLimiter({ maxPerMinute: 60 })

export function createRakutenClient({
  fetchFn = globalThis.fetch,
  timeoutMs = RAKUTEN_DEFAULT_TIMEOUT_MS,
  limiter = sharedLimiter,
  baseUrl = RAKUTEN_BASE_URL,
  now = () => Date.now(),
} = {}) {
  const tokens = new Map()

  async function send(url, init) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetchFn(url, { ...init, signal: controller.signal })
    } catch (error) {
      if (error?.name === 'AbortError' || controller.signal.aborted) throw new RakutenTimeoutError()
      throw new RakutenNetworkError()
    } finally {
      clearTimeout(timer)
    }
  }

  function checkStatus(response) {
    if (response.status === 429) throw new RakutenRateLimitError(parseRetryAfter(response.headers?.get?.('retry-after')))
    if (!response.ok) throw new RakutenHttpError(response.status)
  }

  function readCreds(creds) {
    const clientId = String(creds?.clientId ?? '').trim()
    const clientSecret = String(creds?.clientSecret ?? '').trim()
    const sid = String(creds?.sid ?? '').trim()
    if (!clientId || !clientSecret || !isValidSid(sid)) throw new RakutenAuthError(null)
    return { clientId, clientSecret, sid, key: credentialFingerprint({ clientId, clientSecret, sid }) }
  }

  async function requestToken(c) {
    await limiter.acquire(c.key)
    const basic = Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64')
    const response = await send(new URL('/token', baseUrl).toString(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ scope: c.sid }).toString(),
    })
    if (response.status === 400 || response.status === 401 || response.status === 403) throw new RakutenAuthError(response.status)
    checkStatus(response)
    let body
    try { body = await response.json() } catch { throw new RakutenResponseError() }
    const accessToken = typeof body?.access_token === 'string' ? body.access_token : ''
    if (!accessToken) throw new RakutenResponseError()
    const ttlMs = Math.max(60_000, (Number(body.expires_in) || 3600) * 1000 - TOKEN_EARLY_REFRESH_MS)
    if (tokens.size >= TOKEN_CACHE_MAX) tokens.delete(tokens.keys().next().value)
    tokens.set(c.key, { accessToken, expiresAt: now() + ttlMs })
    return accessToken
  }

  async function accessToken(c) {
    const cached = tokens.get(c.key)
    if (cached && cached.expiresAt > now()) return cached.accessToken
    tokens.delete(c.key)
    return requestToken(c)
  }

  // Chamada autenticada. Token recusado (vencido antes da hora) → pede um
  // novo UMA vez; recusado de novo → RakutenAuthError.
  async function request(creds, { path, query = null, accept = 'application/json', parse = 'json' }) {
    const c = readCreds(creds)
    const url = new URL(path, baseUrl)
    for (const [key, value] of Object.entries(query || {})) {
      if (value != null) url.searchParams.set(key, String(value))
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await accessToken(c)
      await limiter.acquire(c.key)
      const response = await send(url.toString(), { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: accept } })
      if (response.status === 401 || response.status === 403) {
        tokens.delete(c.key)
        if (attempt === 0) continue
        throw new RakutenAuthError(response.status)
      }
      checkStatus(response)
      try {
        return parse === 'text' ? await response.text() : await response.json()
      } catch {
        throw new RakutenResponseError()
      }
    }
    throw new RakutenAuthError(null)
  }

  // Os dados valem? Só pede o token (1 chamada).
  async function verify(creds) {
    const c = readCreds(creds)
    tokens.delete(c.key)
    await requestToken(c)
    return true
  }

  // Feed de ofertas/promoções das lojas aprovadas (XML cru; quem traduz é
  // translate.js).
  async function listCoupons(creds, { page = 1, pageSize = RAKUTEN_MAX_PAGE_SIZE, network = RAKUTEN_BRAZIL_NETWORK } = {}) {
    const size = Math.min(RAKUTEN_MAX_PAGE_SIZE, Math.max(1, Number(pageSize) || RAKUTEN_MAX_PAGE_SIZE))
    return request(creds, {
      path: '/coupon/1.0',
      query: { network, resultsperpage: size, pagenumber: Math.max(1, Number(page) || 1) },
      accept: 'application/xml',
      parse: 'text',
    })
  }

  async function getAdvertiser(creds, advertiserId) {
    if (!/^\d{1,12}$/.test(String(advertiserId ?? ''))) throw new RakutenHttpError(400)
    return request(creds, { path: `/v2/advertisers/${String(advertiserId)}` })
  }

  return { verify, listCoupons, getAdvertiser, cachedTokens: () => tokens.size }
}

let defaultClient = null
export function getDefaultRakutenClient() {
  defaultClient ||= createRakutenClient()
  return defaultClient
}
