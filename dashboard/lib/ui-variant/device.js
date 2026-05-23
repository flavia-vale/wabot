export const UI_VARIANT_COOKIE = 'ui_variant'

const MOBILE_UA_RE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i

export function normalizeVariant(value) {
  if (value === 'mobile') return 'mobile'
  if (value === 'web') return 'web'
  return null
}

export function detectVariantFromUserAgent(userAgent = '') {
  return MOBILE_UA_RE.test(userAgent) ? 'mobile' : 'web'
}

export function resolveVariant({ queryValue, cookieValue, userAgent }) {
  const queryVariant = normalizeVariant(queryValue)
  if (queryVariant) return queryVariant

  const cookieVariant = normalizeVariant(cookieValue)
  if (cookieVariant) return cookieVariant

  return detectVariantFromUserAgent(userAgent)
}
