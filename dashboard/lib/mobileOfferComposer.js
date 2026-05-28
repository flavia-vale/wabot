export const TEMPLATE_OPTIONS = [
  {
    key: 'simples',
    name: 'Simples',
    preview: `🛍️ [produto]

De R$ 499
💥 Por R$ 398

🛒 Compre aqui 👉 link`,
  },
  {
    key: 'achadinho',
    name: 'Achadinho ✨',
    preview: `✨ Achadinho do dia

[produto]
De R$ 79 por R$ 39,90`,
  },
  {
    key: 'relampago',
    name: 'Relâmpago ⚡',
    preview: `⚡ ÚLTIMAS HORAS ⚡

[produto]
De R$ 99 por R$ 49!`,
  },
  {
    key: 'tech',
    name: 'Tech 🔌',
    preview: `🔌 Achado tech

[produto]
De R$ 199 por R$ 149`,
  },
  {
    key: 'beleza',
    name: 'Beleza 💄',
    preview: `💄 Pra mimar você

[produto]
De R$ 89 por R$ 59`,
  },
]

export const COUPON_STORES = [
  { key: 'shopee', nome: 'Shopee', cor: '#EE4D2D' },
  { key: 'mercadolivre', nome: 'Mercado Livre', cor: '#FFE600' },
  { key: 'amazon', nome: 'Amazon', cor: '#FF9900' },
  { key: 'magazineluiza', nome: 'Magalu', cor: '#0086FF' },
]

const HTTP_URL_RE = /https?:\/\/[^\s]+/gi

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
  return {
    title: firstText(product?.title, manual.title, 'Produto em oferta'),
    price: firstText(product?.price, product?.newPrice, product?.priceNow, manual.price),
    oldPrice: firstText(product?.oldPrice, product?.priceWas, manual.oldPrice),
  }
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

export function buildMobileOfferText({
  product = {},
  manualProduct = {},
  link = '',
  template = 'simples',
  bonusMode = '',
  groupBonus = {},
  couponLinks = {},
  selectedCouponStores = [],
  couponCta = '🎟 Mais cupons da {loja}:',
  offerStoreKey = '',
} = {}) {
  const normalized = normalizeMobileOfferProduct(product, manualProduct)

  if (template === 'simples') {
    const lines = [`🛍️ ${normalized.title}`, '']
    if (normalized.oldPrice) lines.push(`De ${normalized.oldPrice}`)
    lines.push(normalized.price ? `💥 Por ${normalized.price}` : '💥 Por *{preço}*')
    lines.push('', `🛒 Compre aqui 👉 ${link}`)

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

  const lines = [getMobileOfferTemplateHeading(template), '', normalized.title]

  if (normalized.price) {
    lines.push(normalized.oldPrice ? `De ${normalized.oldPrice} por *${normalized.price}*` : `Por *${normalized.price}*`)
  } else {
    lines.push('De {preço_de} por *{preço}*')
  }

  lines.push('', `👉 ${link}`)

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
