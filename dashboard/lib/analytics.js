export function trackEvent(eventName, payload = {}) {
  if (typeof window === 'undefined') return

  const eventPayload = {
    event: eventName,
    ...payload,
    ts: Date.now(),
  }

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(eventPayload)
  }

  window.dispatchEvent(new CustomEvent('wabot:track', { detail: eventPayload }))
}
