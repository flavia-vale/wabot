export const REGISTER_MODE = 'register'
export const DEFAULT_REGISTER_CAMPAIGN = 'organic-public-cta'
export const ATTRIBUTION_QUERY_KEYS = [
  'source',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'ref',
  'conversion_prompt_id',
  'conversion_prompt_variant',
]

const SAFE_VALUE_RE = /[^\p{L}\p{N}._~:@/-]/gu

export function sanitizeAttributionValue(value, maxLength = 96) {
  if (value === undefined || value === null) return ''
  return String(value)
    .trim()
    .replace(SAFE_VALUE_RE, '-')
    .replace(/-+/g, '-')
    .slice(0, maxLength)
}

function setIfPresent(params, key, value) {
  const safeValue = sanitizeAttributionValue(value)
  if (safeValue) params.set(key, safeValue)
}

export function buildRegisterHref({
  source = 'site',
  medium = 'organic',
  campaign = DEFAULT_REGISTER_CAMPAIGN,
  content = '',
  term = '',
  ref = '',
  conversionPromptId = '',
  conversionPromptVariant = '',
  extra = {},
} = {}) {
  const params = new URLSearchParams({ mode: REGISTER_MODE })
  setIfPresent(params, 'source', source)
  setIfPresent(params, 'utm_source', source)
  setIfPresent(params, 'utm_medium', medium)
  setIfPresent(params, 'utm_campaign', campaign)
  setIfPresent(params, 'utm_content', content)
  setIfPresent(params, 'utm_term', term)
  setIfPresent(params, 'ref', ref)
  setIfPresent(params, 'conversion_prompt_id', conversionPromptId)
  setIfPresent(params, 'conversion_prompt_variant', conversionPromptVariant)

  for (const [key, value] of Object.entries(extra)) {
    if (key === 'email') {
      const emailValue = String(value ?? '').trim().slice(0, 160)
      if (emailValue) params.set(key, emailValue)
      continue
    }
    setIfPresent(params, key, value)
  }

  return `/login?${params.toString()}`
}

export function readAttributionFromSearchParams(searchParams) {
  const attribution = {}
  for (const key of ATTRIBUTION_QUERY_KEYS) {
    const value = typeof searchParams?.get === 'function' ? searchParams.get(key) : undefined
    const safeValue = sanitizeAttributionValue(value)
    if (safeValue) attribution[key] = safeValue
  }

  if (!attribution.source && attribution.utm_source) attribution.source = attribution.utm_source
  if (!attribution.utm_source && attribution.source) attribution.utm_source = attribution.source
  return attribution
}

const FIRST_TOUCH_LANDING_COOKIE = 'first_touch_landing'
const FIRST_TOUCH_LANDING_MAX_LENGTH = 500

function readCookie(name) {
  if (typeof document === 'undefined' || typeof document.cookie !== 'string') return ''
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function writeCookie(name, value) {
  if (typeof document === 'undefined') return
  const encoded = encodeURIComponent(value)
  document.cookie = `${name}=${encoded}; path=/; max-age=15552000; SameSite=Lax`
}

/**
 * Grava, só na primeira vez da sessão (semântica first-touch, D4), a página de entrada
 * atual num cookie `SameSite=Lax`. Não sobrescreve se já existir. Degrada graciosamente
 * (nunca lança) quando `document`/cookies não estão disponíveis ou estão bloqueados.
 */
export function captureFirstTouchLandingPage(pathnameAndSearch) {
  try {
    if (typeof document === 'undefined') return ''
    const existing = readCookie(FIRST_TOUCH_LANDING_COOKIE)
    if (existing) return existing

    const raw = String(pathnameAndSearch ?? '')
    const safeValue = sanitizeAttributionValue(raw, FIRST_TOUCH_LANDING_MAX_LENGTH)
    if (!safeValue) return ''

    writeCookie(FIRST_TOUCH_LANDING_COOKIE, safeValue)
    return safeValue
  } catch {
    return ''
  }
}

/**
 * Lê a página de entrada first-touch persistida por `captureFirstTouchLandingPage`.
 * Degrada graciosamente (retorna string vazia) se cookies não estiverem disponíveis.
 */
export function getFirstTouchLandingPage() {
  try {
    return readCookie(FIRST_TOUCH_LANDING_COOKIE)
  } catch {
    return ''
  }
}

const FIRST_TOUCH_CLICK_ID_COOKIE = 'first_touch_gclid'

/**
 * Guarda o identificador de clique do anúncio (`gclid`/`gbraid`/`wbraid`) na
 * PRIMEIRA visita, com a mesma semântica first-touch da página de entrada.
 *
 * Precisa ser first-touch porque quase ninguém se cadastra no clique do
 * anúncio: a pessoa chega, lê, volta dias depois e só então cria a conta. Sem
 * persistir, o cadastro parece orgânico e a campanha nunca recebe o crédito.
 *
 * Não reusa `sanitizeAttributionValue` de propósito — ela troca `_` por `-`, e
 * `_` é caractere válido dentro de um gclid.
 */
export function captureFirstTouchClickId(clickId) {
  try {
    if (typeof document === 'undefined') return ''
    const existing = readCookie(FIRST_TOUCH_CLICK_ID_COOKIE)
    if (existing) return existing

    const safeValue = String(clickId ?? '').trim()
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(safeValue)) return ''

    writeCookie(FIRST_TOUCH_CLICK_ID_COOKIE, safeValue)
    return safeValue
  } catch {
    return ''
  }
}

export function getFirstTouchClickId() {
  try {
    return readCookie(FIRST_TOUCH_CLICK_ID_COOKIE)
  } catch {
    return ''
  }
}

export function attributionForTracking(attribution = {}) {
  return Object.fromEntries(
    Object.entries(attribution)
      .filter(([key, value]) => ATTRIBUTION_QUERY_KEYS.includes(key) && value)
      .map(([key, value]) => [key, sanitizeAttributionValue(value)])
  )
}

// RCA 2026-09-11 ("Página nova NUNCA nasce órfã"): link INTERNO para página de
// conteúdo tem que apontar para o endereço limpo. O Google descobre a página
// pelo endereço do link; se ele carregar querystring, a variante é o que entra
// na fila de rastreamento e a consolidação passa a depender só da canônica.
//
// A atribuição de cadastro NÃO é afetada: ela vive em `/login?mode=register…`,
// que continua carregando os parâmetros, e o primeiro toque é gravado em cookie
// que nunca é sobrescrito. O clique interno segue medido por `data-seo-cta`.
const INTERNAL_ATTRIBUTION_TARGETS = ['/login', '/cadastro']

export function internalContentHref(href, queryString = '') {
  const alvo = String(href ?? '').trim()
  if (!alvo.startsWith('/')) return alvo
  const mantemAtribuicao = INTERNAL_ATTRIBUTION_TARGETS.some(
    (rota) => alvo === rota || alvo.startsWith(`${rota}?`) || alvo.startsWith(`${rota}/`),
  )
  if (!mantemAtribuicao) return alvo.split('?')[0]
  const query = String(queryString ?? '').replace(/^[?&]+/, '')
  if (!query) return alvo
  return alvo.includes('?') ? `${alvo}&${query}` : `${alvo}?${query}`
}
