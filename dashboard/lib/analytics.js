export function trackEvent(eventName, params = {}) {
  try {
    if (typeof window === 'undefined' || !eventName) return

    const payload = {
      event: eventName,
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
