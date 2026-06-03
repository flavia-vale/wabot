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
    ],
  },
  {
    key: 'automation',
    title: 'Ganchos, CTAs e links globais',
    helper: 'Substituídas nas ofertas automáticas usando as variações e links configurados nesta página.',
    variables: [
      { token: '{{gancho}}', label: 'Gancho aleatório', example: '🚨 COOOOOORRE QUE TÁ ACABANDO!' },
      { token: '{{cta}}', label: 'CTA aleatório', example: '📲 Entre no nosso grupo oficial:' },
      { token: '{{convitegrupo}}', label: 'Convite/fechamento aleatório', example: '⚠️ Preço sujeito a alteração.' },
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
  return ''
}

export function stripAutomationTemplatePlaceholders(text = '') {
  return String(text || '')
    .replace(AUTOMATION_TEMPLATE_PLACEHOLDER_RE, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function applyTemplateVariables(body, { title = '', price = '', oldPrice = '', link = '', discount = '', rating = '', sales = '', storeName = '' } = {}) {
  let result = body
    .replace(/\{produto\}/g, title || '{produto}')
    .replace(/\{preço\}/g, price || '{preço}')
    .replace(/\{link\}/g, link || '{link}')
    .replace(/\{desconto\}/g, discount || '')
    .replace(/\{rating\}/g, rating || '')
    .replace(/\{vendas\}/g, sales || '')
    .replace(/\{loja\}/g, storeName || '')
  if (oldPrice) {
    result = result.replace(/\{preço_de\}/g, oldPrice)
  } else {
    result = result
      .replace(/💰\s*~\{preço_de\}~\s*→\s*\*([^*]+)\*\s*\(\*?\s*\*?\)/g, '💰 *$1*')
      .replace(/De \{preço_de\} por \*([^*]+)\*/g, '*$1*')
      .replace(/^\s*~?De \{preço_de\}~?\s*$/gm, '')
      .replace(/\{preço_de\}/g, '')
  }
  return result
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
