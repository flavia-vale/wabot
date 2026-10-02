import { applyVariation, resolveCopyVariationPoolJson } from '../../src/core/copyVariation.js'
import { buildMobileOfferText, showCouponStandIn } from './mobileOfferComposer.js'

export const OFFER_TEMPLATE_PREVIEW_SAMPLE = {
  groupId: 'preview-destino-whatsapp',
  date: '2026-06-02',
  link: 'https://s.shopee.com.br/oferta-afiliada',
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

// Link global vazio NÃO ganha link de exemplo na prévia: o robô envia a linha
// vazia, e um link fictício aqui fazia a cliente achar que já estava configurado
// (RCA 2026-10-02 — "Resgate os cupons aqui:" saindo sem link).
export const MISSING_COUPON_LINK_NOTICE = '⚠️ Preencha o Link de cupom no final da página (Links opcionais)'
export const MISSING_GROUP_LINK_NOTICE = '⚠️ Preencha o Link de convite do grupo no final da página (Links opcionais)'

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
    groupInviteLink: String(groupInviteLink || '').trim() || MISSING_GROUP_LINK_NOTICE,
    couponLink: String(couponLink || '').trim() || MISSING_COUPON_LINK_NOTICE,
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
