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
// - GET /linklocator/1.0/getMerchByAppStatus/approved → lojas aprovadas
//   (plano de 2026-09-30: Netshoes WL 43984, Cruzeiro Store 54198). XML.
//
// O token de acesso fica em memória (um por conta, ~1 KB) até 5 min antes
// de vencer. O segredo nunca vai na URL — URL vai para log de proxy.

import { createHmac } from 'node:crypto'
import { createTokenRateLimiter } from '../awin/rateLimiter.js'
import {
  RakutenAccessDeniedError,
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
// Teto de uma resposta (revisão 2026-10-03, R10): a página de 500 ofertas
// medida tem ~1 MB. Resposta maior que isto é defeito do outro lado e não
// pode derrubar a API por falta de memória.
export const RAKUTEN_MAX_RESPONSE_BYTES = 10 * 1024 * 1024
// Pedido de token recusado por DADO ERRADO (medido 2026-09-30: SID errado e
// segredo errado → `invalid_client`). Qualquer outra recusa é passageira
// (revisão 2026-10-03, R2): um soluço da Rakuten não pode desligar a conta.
const CREDENTIAL_REFUSED_ERRORS = new Set(['invalid_client', 'unauthorized_client', 'invalid_grant'])
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

  // Lê o corpo contando bytes (teto R10). Sem stream (respostas de teste),
  // cai no text() — ainda dentro do prazo de send().
  async function readBody(response) {
    const declared = Number(response.headers?.get?.('content-length'))
    if (Number.isFinite(declared) && declared > RAKUTEN_MAX_RESPONSE_BYTES) throw new RakutenResponseError()
    const reader = response.body?.getReader?.()
    if (!reader) {
      const text = await response.text()
      if (Buffer.byteLength(String(text ?? '')) > RAKUTEN_MAX_RESPONSE_BYTES) throw new RakutenResponseError()
      return String(text ?? '')
    }
    const chunks = []
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > RAKUTEN_MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {})
        throw new RakutenResponseError()
      }
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks, received).toString('utf8')
  }

  // Requisição INTEIRA dentro do prazo — inclusive a leitura do corpo
  // (revisão 2026-10-03, R1: o prazo era desligado antes do corpo e uma
  // resposta que travava no meio segurava a sync de todas as contas para
  // sempre). → { status, ok, headers, text }
  async function send(url, init) {
    const controller = new AbortController()
    let timer
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new RakutenTimeoutError())
      }, timeoutMs)
    })
    const work = (async () => {
      let response
      try {
        response = await fetchFn(url, { ...init, signal: controller.signal })
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) throw new RakutenTimeoutError()
        throw new RakutenNetworkError()
      }
      let text = ''
      try {
        text = await readBody(response)
      } catch (error) {
        if (error instanceof RakutenResponseError) throw error
        if (error?.name === 'AbortError' || controller.signal.aborted) throw new RakutenTimeoutError()
        throw new RakutenNetworkError()
      }
      return { status: response.status, ok: response.ok, headers: response.headers, text }
    })()
    work.catch(() => {})
    try {
      return await Promise.race([work, deadline])
    } finally {
      clearTimeout(timer)
    }
  }

  function parseJson(text) {
    try {
      return JSON.parse(text)
    } catch {
      throw new RakutenResponseError()
    }
  }

  function oauthError(text) {
    try {
      return String(JSON.parse(text)?.error ?? '')
    } catch {
      return ''
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
    if ([400, 401, 403].includes(response.status) && CREDENTIAL_REFUSED_ERRORS.has(oauthError(response.text))) {
      throw new RakutenAuthError(response.status)
    }
    checkStatus(response)
    const body = parseJson(response.text)
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
  // novo UMA vez; recusado de novo → RakutenAccessDeniedError (passageiro:
  // quem decide desligar a conta é a sync, depois de 3 seguidos — R2).
  async function request(creds, { path, query = null, accept = 'application/json', parse = 'json', method = 'GET', body = undefined }) {
    const c = readCreds(creds)
    const url = new URL(path, baseUrl)
    for (const [key, value] of Object.entries(query || {})) {
      if (value != null) url.searchParams.set(key, String(value))
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await accessToken(c)
      await limiter.acquire(c.key)
      const response = await send(url.toString(), {
        method,
        headers: { Authorization: `Bearer ${token}`, Accept: accept, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      })
      if (response.status === 401 || response.status === 403) {
        tokens.delete(c.key)
        if (attempt === 0) continue
        throw new RakutenAccessDeniedError(response.status)
      }
      checkStatus(response)
      return parse === 'text' ? response.text : parseJson(response.text)
    }
    throw new RakutenAccessDeniedError(null)
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

  // Lojas em que a cliente foi APROVADA (Link Locator, XML cru; quem traduz é
  // storeMatcher.extractApprovedMerchants). Base da conversão de links.
  async function listApprovedMerchants(creds) {
    return request(creds, { path: '/linklocator/1.0/getMerchByAppStatus/approved', accept: 'application/xml', parse: 'text' })
  }

  // Deep link oficial (POST /v1/links/deep_links) — medido em 2026-10-03:
  // devolve advertiser.deep_link.deep_link_url com o MESMO `id` dos links do
  // feed. Usado só para descobrir o `id` da conta quando o feed não tem
  // nenhuma promoção (revisão 2026-10-03, R18). Não abre nem conta clique.
  async function generateDeepLink(creds, { advertiserId, url }) {
    if (!/^\d{1,12}$/.test(String(advertiserId ?? ''))) throw new RakutenHttpError(400)
    return request(creds, { path: '/v1/links/deep_links', method: 'POST', body: { url: String(url), advertiser_id: Number(advertiserId) } })
  }

  return { verify, listCoupons, getAdvertiser, listApprovedMerchants, generateDeepLink, cachedTokens: () => tokens.size }
}

let defaultClient = null
export function getDefaultRakutenClient() {
  defaultClient ||= createRakutenClient()
  return defaultClient
}
