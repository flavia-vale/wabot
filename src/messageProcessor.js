const URL_TOKEN_CHARS = "[^\\s<>\"'`]+"
const GROUP_INVITE_URL_RE = new RegExp(
  String.raw`(?:https?:\/\/)?(?:` +
    String.raw`chat\.whatsapp\.com\/` + URL_TOKEN_CHARS +
    String.raw`|(?:www\.)?whatsapp\.com\/(?:channel|invite)\/` + URL_TOKEN_CHARS +
    String.raw`|(?:www\.)?(?:t|telegram)\.me\/` + URL_TOKEN_CHARS +
    String.raw`|telegram\.dog\/` + URL_TOKEN_CHARS +
  String.raw`)`,
  'gi',
)
const TRAILING_URL_PUNCTUATION_RE = /[.,;!?)\]}]+$/
const EXTRA_BLANK_LINES_RE = /[ \t]*\n[ \t]*\n[ \t\n]*/g
const LINE_TRAILING_SPACES_RE = /[ \t]+$/gm
const INVITE_HOST_HINT_RE = /(?:chat\.whatsapp\.com\/|whatsapp\.com\/(?:channel|invite)\/|(?:www\.)?t\.me\/|(?:www\.)?telegram\.me\/|telegram\.dog\/)/i
const CTA_KEYWORD_RE = /\b(participe|entre|acesse|siga|junte|venha|clique|link|grupo|canal)\b/i
const CTA_DESTINATION_RE = /\b(grupo|canal|whatsapp|telegram)\b/i
const TRAILING_INVITE_CTA_RE = /(?:^|[\s|•\-–—:])(?:[^\p{L}\p{N}\s]{1,6}\s*)?(?:participe|entre|acesse|siga|junte-se|venha|clique)(?:\s+\S{1,40}){0,8}\s+(?:grupo|canal|whatsapp|telegram)(?:\s+\S{1,40}){0,4}[:：\-–—|•]*\s*$/iu

function hasInviteLinkCandidate(text) {
  return INVITE_HOST_HINT_RE.test(String(text ?? ''))
}

function normalizeMessageWhitespace(text) {
  return String(text ?? '')
    .replace(LINE_TRAILING_SPACES_RE, '')
    .replace(EXTRA_BLANK_LINES_RE, '\n\n')
    .trim()
}

function removeInviteUrl(match) {
  const trailing = match.match(TRAILING_URL_PUNCTUATION_RE)?.[0] ?? ''
  return trailing
}

function normalizeForCtaCheck(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function isInviteCtaOnlyLine(line) {
  const normalized = normalizeForCtaCheck(line)
  if (!normalized.trim() || normalized.length > 140) return false
  return CTA_DESTINATION_RE.test(normalized) && CTA_KEYWORD_RE.test(normalized)
}

function removeOrphanInviteCtas(text) {
  return String(text ?? '')
    .split('\n')
    .map(line => line.replace(TRAILING_INVITE_CTA_RE, '').trimEnd())
    .filter(line => !isInviteCtaOnlyLine(line))
    .join('\n')
}

export function sanitizeInviteLinks(text) {
  const raw = String(text ?? '')
  if (!hasInviteLinkCandidate(raw)) return normalizeMessageWhitespace(raw)
  GROUP_INVITE_URL_RE.lastIndex = 0
  const withoutInviteLinks = raw.replace(GROUP_INVITE_URL_RE, removeInviteUrl)
  return normalizeMessageWhitespace(removeOrphanInviteCtas(withoutInviteLinks))
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
