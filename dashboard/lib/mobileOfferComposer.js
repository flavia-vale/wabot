export const TEMPLATE_OPTIONS = [
  {
    key: 'automatico_classico',
    name: 'Automático clássico',
    preview: `🏷️ *{produto}*

💰 ~{preço_de}~ → *{preço}* (*{desconto}*)
{rating} | {vendas}

👉 {link}`,
  },
  {
    key: 'simples',
    name: 'Simples',
    preview: `🛍️ {produto}

~De {preço_de}~
💥 *Por {preço}*

🛒 Compre aqui 👉 {link}`,
  },
]

export const OFFER_TEMPLATE_VARIABLE_GROUPS = [
  {
    key: 'offer',
    title: 'Dados da oferta',
    helper: 'Substituídas no Gerar oferta e nas ofertas automáticas.',
    variables: [
      { token: '{produto}', label: 'Nome do produto', example: 'Liquidificador turbo' },
      { token: '{preço}', label: 'Preço atual', example: 'R$ 89,90' },
      { token: '{preço_de}', label: 'Preço antigo', example: 'R$ 129,90' },
      { token: '{desconto}', label: 'Desconto', example: '-31% OFF' },
      { token: '{rating}', label: 'Avaliação', example: '⭐ 4.8' },
      { token: '{vendas}', label: 'Vendas', example: '🛒 1.200+ vendidos' },
      { token: '{link}', label: 'Link da oferta', example: 'https://shope.ee/abc' },
      { token: '{loja}', label: 'Loja/plataforma', example: 'Shopee' },
      { token: '{linhaDeCupom}', label: 'Linha de cupom', example: '🎟️ Use o cupom: OFERTA10' },
      { token: '{preçoDoTexto}', label: 'Preço escrito na oferta', example: 'De R$ 129,90 por R$ 89,90' },
      { token: '{cupom}', label: 'Cupom de desconto', example: '🎟️ Use o cupom BEMVINDO10 — de R$ 300,00 por R$ 270,00 com o cupom' },
    ],
  },
  {
    key: 'automation',
    title: 'Ganchos, CTAs e links globais',
    helper: 'Substituídas nas ofertas automáticas usando as variações e links configurados nesta página.',
    variables: [
      { token: '{{gancho}}', label: 'Gancho aleatório', example: '🚨 COOOOOORRE QUE TÁ ACABANDO!' },
      { token: '{{cta}}', label: 'CTA aleatório', example: '⚠️ Preços e estoque podem mudar.' },
      { token: '{{convitegrupo}}', label: 'Convite do grupo aleatório', example: '📲 Entre no nosso grupo oficial:' },
      { token: '{{grupoLink}}', label: 'Link de convite do grupo', example: 'https://chat.whatsapp.com/...' },
      { token: '{{cupomLink}}', label: 'Link de cupom global', example: 'https://...' },
    ],
  },
]

export const OFFER_TEMPLATE_VARIABLES = OFFER_TEMPLATE_VARIABLE_GROUPS.flatMap((group) => group.variables)

export const COUPON_STORES = [
  { key: 'shopee', nome: 'Shopee', cor: '#EE4D2D' },
  { key: 'mercadolivre', nome: 'Mercado Livre', cor: '#FFE600' },
  { key: 'amazon', nome: 'Amazon', cor: '#FF9900' },
  { key: 'magazineluiza', nome: 'Magalu', cor: '#0086FF' },
  { key: 'shein', nome: 'SHEIN', cor: '#000000' },
]

const HTTP_URL_RE = /https?:\/\/[^\s]+/gi
const AUTOMATION_TEMPLATE_PLACEHOLDER_RE = /\{\{(?:gancho|greeting|cta|convitegrupo|trailer|grupoLink|cupomLink)\}\}/g

export function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) return text
  }
  return ''
}

export function isValidHttpUrl(value) {
  const text = String(value || '').trim()
  if (!text) return false
  try {
    const url = new URL(text)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function countMobileOfferHttpLinks(text = '') {
  return String(text || '').match(HTTP_URL_RE)?.length || 0
}

export function getMobileOfferSingleLinkWarning(text = '') {
  return countMobileOfferHttpLinks(text) > 1
    ? 'Cole apenas um link por oferta. Para vários links, use o Conversor e crie uma oferta por produto.'
    : ''
}

export function normalizeMobileOfferProduct(product = {}, manual = {}) {
  const normalized = {
    title: firstText(product?.title, product?.productName, manual.title, 'Produto em oferta'),
    price: firstText(product?.price, product?.newPrice, product?.priceNow, manual.price),
    oldPrice: firstText(product?.oldPrice, product?.priceWas, manual.oldPrice),
  }
  const discount = firstText(product?.discount, product?.discountText, manual.discount)
  const rating = firstText(product?.rating, product?.ratingText, manual.rating)
  const sales = firstText(product?.sales, product?.salesText, manual.sales)
  const storeName = firstText(product?.storeName, product?.store, product?.platformName, manual.storeName)
  if (discount) normalized.discount = discount
  if (rating) normalized.rating = rating
  if (sales) normalized.sales = sales
  if (storeName) normalized.storeName = storeName
  return normalized
}

export function getMobileOfferTemplateHeading(template) {
  if (template === 'relampago') return '⚡ Oferta relâmpago'
  if (template === 'tech') return '🔌 Achado tech'
  if (template === 'beleza') return '💄 Achadinho de beleza'
  return '✨ Achadinho do dia'
}

export function detectMobileOfferStoreKey({ product = {}, link = '' } = {}) {
  const explicit = firstText(product?.conversion?.platform, product?.platform, product?.storeKey).toLowerCase()
  if (COUPON_STORES.some((store) => store.key === explicit)) return explicit

  const urlText = firstText(link, product?.finalUrl, product?.offerUrl)
  if (!isValidHttpUrl(urlText)) return ''
  const host = new URL(urlText).hostname.toLowerCase()
  if (host.includes('shopee')) return 'shopee'
  if (host.includes('mercadolivre') || host.includes('mercadolibre') || host.includes('meli.')) return 'mercadolivre'
  if (host.includes('amazon') || host.includes('amzn.')) return 'amazon'
  if (host.includes('magazineluiza') || host.includes('magalu')) return 'magazineluiza'
  if (host.includes('shein')) return 'shein'
  return ''
}

export function stripAutomationTemplatePlaceholders(text = '') {
  return String(text || '')
    .replace(AUTOMATION_TEMPLATE_PLACEHOLDER_RE, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// RCA 2026-09-19 (cliente julianepumuceno16@gmail.com): oferta do "Criar oferta"
// saiu no grupo com o texto cru "Por {preço}" e com a decoração vazia "~De: ~ |".
// Duas causas, as duas aqui:
//   1. valor vazio caía no PRÓPRIO token ("price || '{preço}'"), o que faz
//      sentido na prévia do editor e nunca pode chegar ao grupo;
//   2. a limpeza de preço antigo vazio era escrita à mão para os DOIS templates
//      de fábrica — qualquer template customizado ficava com a decoração órfã.
// Hoje todo valor vazio vira uma marca invisível e a limpeza é genérica: o
// trecho (entre "|") que só tinha aquele valor some inteiro; se a linha inteira
// era só isso, a linha some. Nunca inventamos texto no lugar do preço —
// publicar preço errado é pior que publicar oferta sem preço, e o painel avisa.
const EMPTY_MARK = '\u0000'
const VALUE_OPEN = '\u0001'
const VALUE_CLOSE = '\u0002'
const SENTINELS_RE = /[\u0000\u0001\u0002]/g

function markValue(value) {
  const text = String(value ?? '').replace(SENTINELS_RE, '').trim()
  return text ? `${VALUE_OPEN}${text}${VALUE_CLOSE}` : EMPTY_MARK
}

// Quebra a linha nos "|" de fora dos valores substituídos — título de produto
// com "|" no meio não pode ser partido ao meio pela limpeza.
function splitTemplateSegments(line) {
  const segments = []
  let current = ''
  let insideValue = false
  for (const char of line) {
    if (char === VALUE_OPEN) insideValue = true
    else if (char === VALUE_CLOSE) insideValue = false
    if (char === '|' && !insideValue) {
      segments.push(current)
      current = ''
      continue
    }
    current += char
  }
  segments.push(current)
  return segments
}

// Dentro de um trecho que SOBROU (tem valor de verdade), tira só a decoração
// que ficou envolvendo o valor vazio: ~tachado~, (parênteses) e *negrito*.
function stripEmptyDecoration(segment) {
  const dropWhenOnlyEmpty = (match) => (match.includes(VALUE_OPEN) ? match : '')
  return segment
    .replace(/~[^~\n]*\u0000[^~\n]*~/g, dropWhenOnlyEmpty)
    .replace(/\([^()\n]*\u0000[^()\n]*\)/g, dropWhenOnlyEmpty)
    .replace(/\*[^*\n]*\u0000[^*\n]*\*/g, dropWhenOnlyEmpty)
    .replace(/\u0000/g, '')
}

function cleanupEmptyValues(text) {
  return String(text)
    .split('\n')
    .map((line) => {
      if (!line.includes(EMPTY_MARK)) return line
      const segments = splitTemplateSegments(line)
      const kept = segments.filter((segment) => !(segment.includes(EMPTY_MARK) && !segment.includes(VALUE_OPEN)))
      if (!kept.length) return ''
      const rebuilt = kept.map(stripEmptyDecoration).join('|')
      return kept.length === segments.length ? rebuilt : rebuilt.trim()
    })
    .join('\n')
}

export function applyTemplateVariables(body, { title = '', price = '', oldPrice = '', link = '', discount = '', rating = '', sales = '', storeName = '', couponLine = '', textPrice = '' } = {}) {
  let preparedBody = String(body ?? '').replace(SENTINELS_RE, '')
  if (!couponLine) preparedBody = preparedBody.replace(/^[ \t]*\{linhaDeCupom\}[ \t]*(?:\r?\n|$)/gm, '')
  if (!textPrice) preparedBody = preparedBody.replace(/^[ \t]*\{preçoDoTexto\}[ \t]*(?:\r?\n|$)/gm, '')
  let result = preparedBody
    .replace(/\{produto\}/g, markValue(title))
    .replace(/\{preço\}/g, markValue(price))
    .replace(/\{link\}/g, markValue(link))
    .replace(/\{desconto\}/g, markValue(discount))
    .replace(/\{rating\}/g, markValue(rating))
    .replace(/\{vendas\}/g, markValue(sales))
    .replace(/\{loja\}/g, markValue(storeName))
    .replace(/\{linhaDeCupom\}/g, markValue(couponLine))
    .replace(/\{preçoDoTexto\}/g, markValue(textPrice))
  if (oldPrice) {
    result = result.replace(/\{preço_de\}/g, markValue(oldPrice))
  } else {
    // Formas dos dois templates de fábrica: preservadas para a saída deles não
    // mudar. Template customizado cai na limpeza genérica logo abaixo.
    result = result
      .replace(/💰\s*~\{preço_de\}~\s*→\s*\*([^*\u0000]+)\*\s*\(\*?[\s\u0000]*\*?\)/g, '💰 *$1*')
      .replace(/De \{preço_de\} por \*([^*]+)\*/g, '*$1*')
      .replace(/^\s*~?De \{preço_de\}~?\s*$/gm, '')
      .replace(/\{preço_de\}/g, EMPTY_MARK)
  }
  return cleanupEmptyValues(result)
    .replace(SENTINELS_RE, '')
    .replace(/\(\*?\s*\*?\)/g, '')
    .replace(/^\s*\|\s*$/gm, '')
    .replace(/^\s*\|\s*/gm, '')
    .replace(/\s*\|\s*$/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function buildMobileOfferText({
  product = {},
  manualProduct = {},
  link = '',
  template = 'achadinho',
  templateBody = null,
  bonusMode = '',
  groupBonus = {},
  couponLinks = {},
  selectedCouponStores = [],
  couponCta = '🎟 Mais cupons da {loja}:',
  offerStoreKey = '',
  preserveAutomationPlaceholders = false,
} = {}) {
  const normalized = normalizeMobileOfferProduct(product, manualProduct)

  let lines
  if (templateBody) {
    const bodyText = applyTemplateVariables(templateBody, {
      title: normalized.title,
      price: normalized.price,
      oldPrice: normalized.oldPrice,
      link,
      discount: normalized.discount,
      rating: normalized.rating,
      sales: normalized.sales,
      storeName: normalized.storeName,
      couponLine: product?.couponLine,
      textPrice: product?.textPrice,
    })
    lines = (preserveAutomationPlaceholders ? bodyText : stripAutomationTemplatePlaceholders(bodyText)).split('\n')
  } else {
    lines = [getMobileOfferTemplateHeading(template), '', normalized.title]
    if (normalized.price) {
      lines.push(normalized.oldPrice ? `De ${normalized.oldPrice} por *${normalized.price}*` : `Por *${normalized.price}*`)
    } else {
      lines.push('De {preço_de} por *{preço}*')
    }
    lines.push('', `👉 ${link}`)
  }

  const groupLink = String(groupBonus?.link || '').trim()
  if ((bonusMode === 'group' || bonusMode === 'both') && isValidHttpUrl(groupLink)) {
    lines.push('', String(groupBonus?.cta || '').trim() || 'Entre no nosso grupo:')
    lines.push(groupLink)
  }

  if (bonusMode === 'coupons' || bonusMode === 'both') {
    const detectedStoreKey = offerStoreKey || detectMobileOfferStoreKey({ product, link })
    const selectedOrDetected = selectedCouponStores.includes(detectedStoreKey) || !selectedCouponStores.length
    const couponLink = String(couponLinks?.[detectedStoreKey] || '').trim()
    if (detectedStoreKey && selectedOrDetected && isValidHttpUrl(couponLink)) {
      const store = COUPON_STORES.find((item) => item.key === detectedStoreKey)
      lines.push('', (String(couponCta || '').trim() || 'Mais cupons da {loja}:').replace('{loja}', store?.nome || 'loja'))
      lines.push(couponLink)
    }
  }

  return lines.join('\n')
}
