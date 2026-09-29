export const RELAY_FOOTER_MAX_CHARS = 1000
export const RELAY_GROUP_LINK_TOKEN = '{{grupoLink}}'

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

export function resolveRelayFooterVariables(footer, { groupLink = '' } = {}) {
  return normalizeRelayFooter(footer)?.replaceAll(RELAY_GROUP_LINK_TOKEN, String(groupLink || '').trim()).trim() ?? ''
}

export function relayFooterControls(value) {
  const normalized = normalizeRelayFooter(value) || ''
  const includeGroupLink = normalized.includes(RELAY_GROUP_LINK_TOKEN)
  const customText = normalized.replaceAll(RELAY_GROUP_LINK_TOKEN, '').trim()
  return { includeGroupLink, includeCustomText: Boolean(customText), customText }
}

export function composeRelayFooter({ includeGroupLink = false, includeCustomText = false, customText = '' } = {}) {
  return [includeCustomText ? normalizeRelayFooter(customText) : '', includeGroupLink ? RELAY_GROUP_LINK_TOKEN : '']
    .filter(Boolean)
    .join('\n\n')
}
