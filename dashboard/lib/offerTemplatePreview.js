import { applyVariation, resolveCopyVariationPoolJson } from '../../src/core/copyVariation.js'
import { buildMobileOfferText, showCouponStandIn } from './mobileOfferComposer.js'

export const OFFER_TEMPLATE_PREVIEW_SAMPLE = {
  groupId: 'preview-destino-whatsapp',
  date: '2026-06-02',
  link: 'https://s.shopee.com.br/oferta-afiliada',
  groupInviteLink: 'https://chat.whatsapp.com/seu-grupo',
  couponLink: 'https://espelhagrupos.com.br/cupons',
  product: {
    title: 'Kit 3 Organizadores Dobráveis Multiuso',
    price: 'R$ 39,90',
    oldPrice: 'R$ 79,90',
    discount: '-50% OFF',
    rating: '⭐ 4.8',
    sales: '🛒 2.3 mil+ vendidos',
    storeName: 'Shopee',
    platform: 'shopee',
  },
}

export function buildRenderedOfferTemplatePreview({
  template,
  copyVariationPoolJson,
  groupInviteLink,
  couponLink,
  groupId = OFFER_TEMPLATE_PREVIEW_SAMPLE.groupId,
  date = OFFER_TEMPLATE_PREVIEW_SAMPLE.date,
  random = false,
} = {}) {
  const baseText = buildMobileOfferText({
    product: OFFER_TEMPLATE_PREVIEW_SAMPLE.product,
    link: OFFER_TEMPLATE_PREVIEW_SAMPLE.link,
    template: template?.key,
    templateBody: template?.body,
    preserveAutomationPlaceholders: true,
    keepCouponToken: true,
  })

  return applyVariation(showCouponStandIn(baseText), {
    groupId,
    date,
    random,
    poolJson: resolveCopyVariationPoolJson(copyVariationPoolJson),
    groupInviteLink: groupInviteLink || OFFER_TEMPLATE_PREVIEW_SAMPLE.groupInviteLink,
    couponLink: couponLink || OFFER_TEMPLATE_PREVIEW_SAMPLE.couponLink,
    autoInjectWhenMissing: false,
  })
}

export function summarizeAutomationTemplateUsage(automations = []) {
  const usage = new Map()
  for (const automation of automations || []) {
    const key = automation?.templateKey || 'automatico_classico'
    const current = usage.get(key) || { total: 0, enabled: 0, paused: 0, groups: [] }
    current.total += 1
    if (automation?.enabled === false) current.paused += 1
    else current.enabled += 1
    const groupName = String(automation?.destGroupName || automation?.destGroupJid || '').trim()
    if (groupName && current.groups.length < 3 && !current.groups.includes(groupName)) {
      current.groups.push(groupName)
    }
    usage.set(key, current)
  }
  return usage
}
