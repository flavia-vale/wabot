import {
  freezeSnapshot,
  optionalHttpUrl,
  optionalNonNegativeInteger,
  optionalString,
  requiredString,
} from './validation.js'

/**
 * Snapshot imutável e independente de canal. Adaptadores podem omitir campos
 * que não se aplicam, mas não devem voltar à origem para reinterpretar a oferta.
 */
export function createCanonicalOffer(input = {}) {
  const priceCents = optionalNonNegativeInteger(input.priceCents, 'priceCents')
  const oldPriceCents = optionalNonNegativeInteger(input.oldPriceCents, 'oldPriceCents')
  if (oldPriceCents != null && priceCents != null && oldPriceCents < priceCents) {
    throw new TypeError('oldPriceCents não pode ser menor que priceCents')
  }

  return freezeSnapshot({
    offerKey: requiredString(input.offerKey, 'offerKey'),
    title: requiredString(input.title, 'title'),
    description: optionalString(input.description),
    priceCents,
    oldPriceCents,
    currency: optionalString(input.currency)?.toUpperCase() || 'BRL',
    discountLabel: optionalString(input.discountLabel),
    couponCode: optionalString(input.couponCode),
    callToAction: optionalString(input.callToAction),
    storeName: optionalString(input.storeName),
    productUrl: optionalHttpUrl(input.productUrl, 'productUrl'),
    imageUrl: optionalHttpUrl(input.imageUrl, 'imageUrl'),
    attributes: input.attributes && typeof input.attributes === 'object' && !Array.isArray(input.attributes)
      ? { ...input.attributes }
      : {},
  })
}
