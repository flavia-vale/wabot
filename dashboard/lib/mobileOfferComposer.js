export const TEMPLATE_OPTIONS = [
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

export function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) return text
  }
  return ''
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

export function buildMobileOfferText({
  product = {},
  manualProduct = {},
  link = '',
  template = 'achadinho',
  bonusMode = '',
  groupBonus = {},
  couponLinks = {},
  selectedCouponStores = [],
  couponCta = '🎟 Mais cupons da {loja}:',
} = {}) {
  const normalized = normalizeMobileOfferProduct(product, manualProduct)
  const lines = [getMobileOfferTemplateHeading(template), '', normalized.title]

  if (normalized.price) {
    lines.push(normalized.oldPrice ? `De ${normalized.oldPrice} por *${normalized.price}*` : `Por *${normalized.price}*`)
  } else {
    lines.push('De {preço_de} por *{preço}*')
  }

  lines.push('', `👉 ${link}`)

  const groupLink = String(groupBonus?.link || '').trim()
  if ((bonusMode === 'group' || bonusMode === 'both') && groupLink) {
    lines.push('', String(groupBonus?.cta || '').trim() || 'Entre no nosso grupo:')
    lines.push(groupLink)
  }

  if (bonusMode === 'coupons' || bonusMode === 'both') {
    const firstCouponStore = selectedCouponStores.find((storeKey) => String(couponLinks?.[storeKey] || '').trim())
    if (firstCouponStore) {
      const store = COUPON_STORES.find((item) => item.key === firstCouponStore)
      lines.push('', (String(couponCta || '').trim() || 'Mais cupons da {loja}:').replace('{loja}', store?.nome || 'loja'))
      lines.push(String(couponLinks[firstCouponStore] || '').trim())
    }
  }

  return lines.join('\n')
}
