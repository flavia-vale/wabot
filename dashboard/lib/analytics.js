export const TRACKING_EVENTS = {
  AUTH_SUBMIT_ATTEMPT: 'auth_submit_attempt',
  SIGNUP_SUCCESS: 'signup_success',
  LOGIN_SUCCESS: 'login_success',
  AUTH_ERROR: 'auth_error',
  AUTH_MODE_SWITCH: 'auth_mode_switch',
  CONVERSION_PROMPT_VIEWED: 'conversion_prompt_viewed',
  CONVERSION_PROMPT_DISMISSED: 'conversion_prompt_dismissed',
  CONVERSION_PROMPT_CTA_CLICKED: 'conversion_prompt_cta_clicked',
  LEAD_MAGNET_VIEWED: 'lead_magnet_viewed',
  LEAD_MAGNET_FORM_FOCUSED: 'lead_magnet_form_focused',
  LEAD_MAGNET_SUBMITTED: 'lead_magnet_submitted',
  LEAD_MAGNET_PDF_CLICKED: 'lead_magnet_pdf_clicked',
  LEAD_MAGNET_ONLINE_CLICKED: 'lead_magnet_online_clicked',
}

export const PROMPT_EXCLUDED_PATH_PREFIXES = [
  '/login',
  '/dashboard',
  '/admin',
  '/termos',
  '/privacidade',
]

export const PUBLIC_PERSISTED_EVENTS = new Set([
  TRACKING_EVENTS.CONVERSION_PROMPT_VIEWED,
  TRACKING_EVENTS.CONVERSION_PROMPT_DISMISSED,
  TRACKING_EVENTS.CONVERSION_PROMPT_CTA_CLICKED,
  TRACKING_EVENTS.LEAD_MAGNET_VIEWED,
  TRACKING_EVENTS.LEAD_MAGNET_FORM_FOCUSED,
  TRACKING_EVENTS.LEAD_MAGNET_SUBMITTED,
  TRACKING_EVENTS.LEAD_MAGNET_PDF_CLICKED,
  TRACKING_EVENTS.LEAD_MAGNET_ONLINE_CLICKED,
])

export function shouldSuppressConversionPrompt(pathname = resolvePathname()) {
  return PROMPT_EXCLUDED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}


function resolvePathname() {
  if (typeof window === 'undefined') return ''
  return window.location?.pathname || ''
}

export function trackEvent(eventName, params = {}) {
  try {
    if (typeof window === 'undefined' || !eventName) return

    const payload = {
      event: eventName,
      pathname: resolvePathname(),
      ts: new Date().toISOString(),
      ...params,
    }

    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(payload)
    }

    window.dispatchEvent(new CustomEvent('wabot:track', { detail: payload }))
    persistPublicEvent(payload)
  } catch (error) {
    console.error('[analytics] trackEvent failed', error)
  }
}


function persistPublicEvent(payload) {
  if (!PUBLIC_PERSISTED_EVENTS.has(payload.event)) return
  const body = JSON.stringify({ event: payload.event, metadata: payload })
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon('/api/public/analytics', blob)) return
    }
  } catch {}

  try {
    fetch('/api/public/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {})
  } catch {}
}

export function mapAuthError(error) {
  if (!error) return 'unknown_error'
  if (typeof error === 'string') return error.slice(0, 64)

  const status = error?.status || error?.response?.status
  if (status) return `http_${status}`

  const rawMessage = error?.message
  if (!rawMessage) return 'unknown_error'

  const normalized = String(rawMessage).toLowerCase()
  if (normalized.includes('network')) return 'network_error'
  if (normalized.includes('timeout')) return 'timeout_error'
  if (normalized.includes('credenciais')) return 'invalid_credentials'

  return 'auth_error'
}
