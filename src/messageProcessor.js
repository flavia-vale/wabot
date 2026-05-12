const GROUP_INVITE_URL_RE = /(?:https?:\/\/)?(?:chat\.whatsapp\.com\/[A-Za-z0-9_-]+|(?:www\.)?whatsapp\.com\/channel\/[A-Za-z0-9_-]+|(?:t|telegram)\.me\/(?:joinchat\/[A-Za-z0-9_-]+|\+[A-Za-z0-9_-]+)|telegram\.dog\/(?:joinchat\/[A-Za-z0-9_-]+|\+[A-Za-z0-9_-]+))/gi
const EXTRA_BLANK_LINES_RE = /[ \t]*\n[ \t]*\n[ \t\n]*/g
const LINE_TRAILING_SPACES_RE = /[ \t]+$/gm
const INVITE_HOST_HINT_RE = /(?:chat\.whatsapp\.com\/|whatsapp\.com\/channel\/|t\.me\/(?:joinchat\/|\+)|telegram\.me\/(?:joinchat\/|\+)|telegram\.dog\/(?:joinchat\/|\+))/i

function hasInviteLinkCandidate(text) {
  return INVITE_HOST_HINT_RE.test(String(text ?? ''))
}

function normalizeMessageWhitespace(text) {
  return String(text ?? '')
    .replace(LINE_TRAILING_SPACES_RE, '')
    .replace(EXTRA_BLANK_LINES_RE, '\n\n')
    .trim()
}

export function sanitizeInviteLinks(text) {
  const raw = String(text ?? '')
  if (!hasInviteLinkCandidate(raw)) return normalizeMessageWhitespace(raw)
  GROUP_INVITE_URL_RE.lastIndex = 0
  return normalizeMessageWhitespace(raw.replace(GROUP_INVITE_URL_RE, ''))
}

export function normalizeBrandingLink(link) {
  const value = String(link ?? '').trim()
  if (!value) return ''

  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname) ? value : ''
  } catch {
    return ''
  }
}

export function isValidBrandingLink(link) {
  return Boolean(normalizeBrandingLink(link))
}

export function appendBrandingFooter(text, brandingLink) {
  const message = normalizeMessageWhitespace(text)
  const link = normalizeBrandingLink(brandingLink)
  if (!message || !link) return message
  return `${message}\n\nParticipe do grupo: ${link}`
}

export function applyConversionsAndBranding(sanitizedText, conversions, brandingLink) {
  let finalText = String(sanitizedText ?? '')
  for (const { url, converted } of conversions) {
    finalText = finalText.replace(url, converted)
  }
  return appendBrandingFooter(finalText, brandingLink)
}

export function buildProcessedMessage(originalText, conversions, brandingLink) {
  return applyConversionsAndBranding(sanitizeInviteLinks(originalText), conversions, brandingLink)
}

export { GROUP_INVITE_URL_RE }
