import { isOfferUrl } from './detector.js'

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
const ANY_HTTP_URL_RE = /https?:\/\/[^\s<>"'`]+/gi
const TRAILING_URL_NOISE_RE = /[.,;!?)\]}'">]+$/

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

// Remove qualquer URL http(s) que NÃO seja de um marketplace de oferta
// suportado (Amazon, Shopee, Mercado Livre, Magalu). Links de outras
// origens — landing pages, lovable.app, encurtadores aleatórios, sites do
// próprio grupo monitorado — não são ofertas e não devem ser repassados.
// A pontuação final ("https://x.com.") é preservada para não deixar o
// texto truncado de forma estranha. Os links de oferta ficam intactos para
// que applyConversionsAndBranding os substitua pelo link de afiliado.
function removeNonOfferUrls(text) {
  return String(text ?? '').replace(ANY_HTTP_URL_RE, (match) => {
    const trailing = match.match(TRAILING_URL_NOISE_RE)?.[0] ?? ''
    const core = trailing ? match.slice(0, match.length - trailing.length) : match
    return isOfferUrl(core) ? match : trailing
  })
}

export function sanitizeInviteLinks(text) {
  const raw = String(text ?? '')
  GROUP_INVITE_URL_RE.lastIndex = 0
  const withoutInviteLinks = hasInviteLinkCandidate(raw)
    ? raw.replace(GROUP_INVITE_URL_RE, removeInviteUrl)
    : raw
  const withoutNonOfferUrls = removeNonOfferUrls(withoutInviteLinks)
  return normalizeMessageWhitespace(removeOrphanInviteCtas(withoutNonOfferUrls))
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

// Strips the given URLs from the text. Strategy:
// 1. Replace each stripped URL in-place (inline removal).
// 2. If a line still contains another http URL after removal (e.g. a converted
//    product link on the same line), keep the cleaned line.
// 3. If the line has no remaining URL, drop it entirely — this removes orphaned
//    CTAs like "🏷️ Cupons disponíveis aqui:" that have no link to follow.
//
// Rationale: the old implementation filtered whole lines containing the URL,
// which accidentally killed converted product links when a product URL and a
// coupon URL landed on the same line — breaking mirroring for those messages.
export function stripUrlsFromText(text, urls) {
  if (!urls || !urls.length) return text
  const result = String(text ?? '').split('\n')
    .map(line => {
      if (!urls.some(url => line.includes(url))) return line
      let cleaned = line
      for (const url of urls) {
        cleaned = cleaned.split(url).join('')
      }
      // Keep the line only if another URL (e.g. the converted product link) remains.
      return /https?:\/\//.test(cleaned) ? cleaned : ''
    })
    .join('\n')
  return normalizeMessageWhitespace(result)
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

// Detecta anúncios de cupom genérico (ex: "CUPOM: GRAMADOVERDE", "Use o Cupom ALOCUPOM").
// Esses captions descrevem um desconto aplicável a qualquer produto do marketplace —
// o link pode resolver para produtos aleatórios, então o guard de title_mismatch
// não se aplica (não há "o produto" para comparar com o caption).
// Critério: presença de "cupom" (qualquer case) + palavra toda em maiúsculas ≥4 chars
// (o código do cupom em si, ex: GRAMADOVERDE, ALOCUPOM, TORCIDAO).
export function isCouponAnnouncement(text) {
  if (!/\bcupom\b/i.test(text)) return false
  return /\b[A-Z]{4,}\b/.test(text)
}

// Marcadores de cupom de LOJA / store-wide: frases que só aparecem quando o
// desconto vale para o catálogo inteiro (não para um produto específico). Um
// "produto + cupom" (ex: "Tênis Polo Wear... Use o Cupom VEMAPROVEITAR") nunca
// usa essas frases — ele nomeia o produto. Alta precisão (poucos falsos
// positivos) de propósito: na dúvida, NÃO classificar como genérico.
const GENERIC_COUPON_MARKERS = [
  /compras?\s+a\s+partir\s+de/i,        // limite mínimo de carrinho ("em compras a partir de R$ X")
  /pesquise\s+(pelo|o|seu)\s+produto/i, // "pesquise pelo produto desejado"
  /produto\s+desejado/i,
  /qualquer\s+produto/i,
  /em\s+todo\s+o?\s*site/i,
  /v[áa]lido\s+(para|em)\s+(todo|qualquer)/i,
]

// True quando o caption tem cara de cupom store-wide (catálogo inteiro), e não
// de oferta de um produto específico. Usado para decidir a imagem de mensagens
// de cupom quando o título do link não pôde ser raspado (titleOverlap='unknown',
// ex: short link de cupom que não resolve og:title, ou Shopee fora do guard):
// store-wide → não buscar imagem hi-res (o link resolve p/ produto aleatório);
// não-genérico → manter a aposta de produto (busca hi-res). Ver
// decideSkipActiveFetchForCoupon em monitoredImageResolver.js.
export function looksLikeGenericCoupon(text) {
  if (!text) return false
  return GENERIC_COUPON_MARKERS.some((re) => re.test(text))
}

export { DEFAULT_BRANDING_CTA_TEXT, GROUP_INVITE_URL_RE, MAX_BRANDING_CTA_CHARS, PRODUCT_MATCH_STOPWORDS }
