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
  'aff',
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
  aff = '',
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
  setIfPresent(params, 'aff', aff)
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

export function attributionForTracking(attribution = {}) {
  return Object.fromEntries(
    Object.entries(attribution)
      .filter(([key, value]) => ATTRIBUTION_QUERY_KEYS.includes(key) && value)
      .map(([key, value]) => [key, sanitizeAttributionValue(value)])
  )
}
