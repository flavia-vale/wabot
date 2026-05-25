const DEFAULT_BRANDING_CTA_TEXT = 'Participe do grupo:'
const MAX_BRANDING_CTA_CHARS = 80
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
const CTA_KEYWORD_RE = /\b(participe|entre|acesse|siga|junte|venha|clique|link|grupo|canal|conheca)\b/i
const CTA_DESTINATION_RE = /\b(grupo|grupos|canal|canais|whatsapp|telegram)\b/i
const TRAILING_INVITE_CTA_RE = /(?:^|[\s|•\-–—:])(?:[^\p{L}\p{N}\s]{1,6}\s*)?(?:participe|entre|acesse|siga|junte-se|venha|clique)(?:\s+\S{1,40}){0,8}\s+(?:grupo|canal|whatsapp|telegram)(?:\s+\S{1,40}){0,4}[:：\-–—|•]*\s*$/iu
const TRAILING_HTTP_URL_RE = /https?:\/\/[^\s<>"]+[^\s<>".,;!?)]$/i
const ALLOWED_OFFER_HOST_RE = /(?:^|\.)((?:s\.)?shopee\.com\.br|shope\.ee|amazon\.com\.br|amzn\.to|a\.co|amzn\.divulgador\.link|amzlink\.to|mercadolivre\.com\.br|mercadolibre\.com|meli\.la|mluvem\.com|magazineluiza\.com\.br|magazinevoce\.com\.br|mlz\.me)$/i

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

function isAllowedOfferUrl(raw) {
  try {
    const url = new URL(String(raw ?? '').trim())
    return ['http:', 'https:'].includes(url.protocol) && ALLOWED_OFFER_HOST_RE.test(url.hostname)
  } catch {
    return false
  }
}

function removeTrailingIrrelevantUrlBlock(text) {
  const lines = String(text ?? '').split('\n')
  const idx = lines.findLastIndex(line => line.trim())
  if (idx <= 0) return String(text ?? '')
  const lastLine = lines[idx].trim()
  if (!TRAILING_HTTP_URL_RE.test(lastLine)) return String(text ?? '')
  if (isAllowedOfferUrl(lastLine)) return String(text ?? '')
  const prev = lines[idx - 1]?.trim() || ''
  if (!isInviteCtaOnlyLine(prev)) return String(text ?? '')
  lines.splice(idx - 1, 2)
  return lines.join('\n')
}

export function sanitizeInviteLinks(text) {
  const raw = String(text ?? '')
  if (!hasInviteLinkCandidate(raw)) return normalizeMessageWhitespace(removeTrailingIrrelevantUrlBlock(raw))
  GROUP_INVITE_URL_RE.lastIndex = 0
  const withoutInviteLinks = raw.replace(GROUP_INVITE_URL_RE, removeInviteUrl)
  return normalizeMessageWhitespace(removeTrailingIrrelevantUrlBlock(removeOrphanInviteCtas(withoutInviteLinks)))
}

export function normalizeBrandingCtaText(text) {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return DEFAULT_BRANDING_CTA_TEXT
  return normalized.slice(0, MAX_BRANDING_CTA_CHARS)
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

export function appendBrandingFooter(text, brandingLink, brandingCtaText = DEFAULT_BRANDING_CTA_TEXT) {
  const message = normalizeMessageWhitespace(text)
  const link = normalizeBrandingLink(brandingLink)
  if (!message || !link) return message
  const cta = normalizeBrandingCtaText(brandingCtaText)
  return `${message}\n\n${cta} ${link}`
}

export function applyConversionsAndBranding(sanitizedText, conversions, brandingLink, brandingCtaText = DEFAULT_BRANDING_CTA_TEXT) {
  let finalText = String(sanitizedText ?? '')
  for (const { url, converted } of conversions) {
    finalText = finalText.replace(url, converted)
  }
  return appendBrandingFooter(finalText, brandingLink, brandingCtaText)
}

export function buildProcessedMessage(originalText, conversions, brandingLink, brandingCtaText = DEFAULT_BRANDING_CTA_TEXT) {
  return applyConversionsAndBranding(sanitizeInviteLinks(originalText), conversions, brandingLink, brandingCtaText)
}

// Stopwords pt-BR para o guard de "título do produto bate com o caption".
// Inclui artigos, preposições, ruído de promo ("oferta", "cupom", "frete")
// e nomes de marketplaces — esses tokens existem em quase todo caption e
// dariam falsos positivos de overlap. Mantém só substantivos/marcas reais.
const PRODUCT_MATCH_STOPWORDS = new Set([
  'para', 'com', 'sem', 'dos', 'das', 'pelo', 'pela', 'pelos', 'pelas',
  'este', 'esta', 'isto', 'esse', 'essa', 'isso', 'aqui', 'onde', 'quando',
  'mais', 'menos', 'muito', 'muita', 'muitos', 'muitas', 'tudo', 'todo', 'toda', 'todos', 'todas',
  'quem', 'qual', 'quais', 'como', 'porque', 'pois', 'entao', 'assim',
  'desde', 'antes', 'apos', 'depois', 'sobre', 'entre', 'contra', 'durante',
  'ser', 'foi', 'sao', 'era', 'eram', 'sera', 'seria', 'tem', 'tinha', 'teve',
  'estar', 'esta', 'estao', 'estava', 'estavam',
  'fazer', 'feito', 'feita', 'faz', 'fazem',
  'oferta', 'ofertas', 'promo', 'promocao', 'promocoes', 'desconto', 'descontos',
  'cupom', 'cupons', 'frete', 'gratis', 'barato', 'barata', 'novo', 'nova', 'novos', 'novas',
  'melhor', 'melhores', 'preco', 'precos', 'reais', 'valor', 'valores',
  'apenas', 'somente', 'agora', 'hoje', 'urgente', 'imperdivel', 'imperdiveis',
  'compre', 'compra', 'comprar', 'clique', 'link', 'confira', 'aproveite',
  'amazon', 'shopee', 'mercadolivre', 'mercado', 'livre', 'magazine', 'luiza', 'magalu',
  'pix', 'cartao', 'parcelas', 'parcelado', 'avista', 'vista',
])

export function extractKeywordTokens(text) {
  const normalized = String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  const out = new Set()
  for (const raw of normalized.split(/[^a-z0-9]+/)) {
    if (!raw) continue
    if (raw.length < 4) continue
    if (/^\d+$/.test(raw)) continue
    if (PRODUCT_MATCH_STOPWORDS.has(raw)) continue
    out.add(raw)
  }
  return out
}

// True quando o referenceText e o candidateText compartilham pelo menos
// um token significativo (substantivo/marca, >=4 chars, não-stopword).
// Quando o referenceText tem menos de `minRefTokens` tokens significativos,
// devolve true (sinal insuficiente para flagar — não bloqueia).
export function hasSignificantTokenOverlap(referenceText, candidateText, { minRefTokens = 3 } = {}) {
  const ref = extractKeywordTokens(referenceText)
  if (ref.size < minRefTokens) return true
  const cand = extractKeywordTokens(candidateText)
  if (!cand.size) return false
  for (const token of ref) {
    if (cand.has(token)) return true
  }
  return false
}

export { DEFAULT_BRANDING_CTA_TEXT, GROUP_INVITE_URL_RE, MAX_BRANDING_CTA_CHARS, PRODUCT_MATCH_STOPWORDS }
