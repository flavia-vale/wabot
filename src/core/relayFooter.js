export const RELAY_FOOTER_MAX_CHARS = 1000

export function normalizeRelayFooter(value) {
  if (value === undefined) return undefined
  if (value === null) return ''
  return String(value).replace(/\r\n?/g, '\n').trim()
}

export function appendRelayFooter(message, footer) {
  const normalizedFooter = normalizeRelayFooter(footer)
  if (!normalizedFooter) return String(message ?? '')

  const normalizedMessage = String(message ?? '').trimEnd()
  return normalizedMessage ? `${normalizedMessage}\n\n${normalizedFooter}` : normalizedFooter
}
