export const TRACKING_EVENTS = {
  AUTH_SUBMIT_ATTEMPT: 'auth_submit_attempt',
  SIGNUP_SUCCESS: 'signup_success',
  LOGIN_SUCCESS: 'login_success',
  AUTH_ERROR: 'auth_error',
  AUTH_MODE_SWITCH: 'auth_mode_switch',
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
  } catch (error) {
    console.error('[analytics] trackEvent failed', error)
  }
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
