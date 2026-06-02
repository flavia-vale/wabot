import { fetchOffers as defaultFetchOffers } from './shopeeOffers.js'
import { sendBroadcast, isRunning } from '../manager.js'
import db from '../db.js'
import { parseCredentialData } from '../credentialHealth.js'
import { applyVariation, resolveCopyVariationPoolJson } from '../core/copyVariation.js'
import { buildMobileOfferText } from '../../dashboard/lib/mobileOfferComposer.js'
import { composeTemplates } from '../../dashboard/lib/mobileTemplateStore.js'

const PRICE_DIVISOR = 1
const DEFAULT_AUTOMATION_TEMPLATE_KEY = 'automatico_classico'

function priceStr(raw) {
  const num = Number(raw)
  if (!num || num <= 0) return null
  return (num / PRICE_DIVISOR).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function salesStr(raw) {
  const num = Number(raw)
  if (!num || num <= 0) return ''
  return `🛒 ${num.toLocaleString('pt-BR')}+ vendidos`
}

function ratingStr(raw) {
  const num = Number(raw)
  if (!num || num <= 0) return ''
  return `⭐ ${num.toFixed(1)}`
}

function discountStr(raw) {
  const pct = Number(raw) || 0
  return pct > 0 ? `-${pct}% OFF` : ''
}

function automationOfferProduct(offer) {
  const currentRaw = Number(offer.priceMin ?? offer.price) || 0
  const pct = Number(offer.priceDiscountRate) || 0
  const originalRaw = pct > 0 && currentRaw > 0 ? Math.round(currentRaw * 100 / (100 - pct)) : 0
  return {
    title: offer.productName ?? 'Produto Shopee',
    price: priceStr(currentRaw),
    oldPrice: priceStr(originalRaw),
    discount: discountStr(pct),
    rating: ratingStr(offer.ratingStar),
    sales: salesStr(offer.sales),
    storeName: 'Shopee',
  }
}

function parseTemplateStore(mobileTemplatesJson) {
  try { return JSON.parse(mobileTemplatesJson || '{}') } catch { return {} }
}

function resolveAutomationTemplateBody(botConfig, templateKey) {
  const templates = composeTemplates(parseTemplateStore(botConfig?.mobileTemplatesJson))
  const key = templateKey || DEFAULT_AUTOMATION_TEMPLATE_KEY
  return templates.find((template) => template.key === key)?.body
    || templates.find((template) => template.key === DEFAULT_AUTOMATION_TEMPLATE_KEY)?.body
    || null
}


export function formatOfferMessage(offer, keyword, templateBody = null) {
  if (templateBody) {
    return buildMobileOfferText({
      product: automationOfferProduct(offer),
      link: offer.offerLink,
      template: DEFAULT_AUTOMATION_TEMPLATE_KEY,
      templateBody,
      preserveAutomationPlaceholders: true,
    })
  }

  const name = offer.productName ?? 'Produto Shopee'
  const currentRaw = Number(offer.priceMin ?? offer.price) || 0
  const pct = Number(offer.priceDiscountRate) || 0
  const current = priceStr(currentRaw)

  const originalRaw = pct > 0 && currentRaw > 0 ? Math.round(currentRaw * 100 / (100 - pct)) : 0
  const original = priceStr(originalRaw)
  const stars = offer.ratingStar ? `⭐ ${Number(offer.ratingStar).toFixed(1)}` : ''
  const sold = offer.sales ? `🛒 ${Number(offer.sales).toLocaleString('pt-BR')}+ vendidos` : ''

  const lines = [`🏷️ *${name}*`, '']

  if (original && current && pct > 0) {
    lines.push(`💰 ~${original}~ → *${current}* (*-${pct}% OFF*)`)
  } else if (current) {
    lines.push(`💰 *${current}*`)
  }

  const meta = [stars, sold].filter(Boolean).join(' | ')
  if (meta) lines.push(meta)

  lines.push('', `👉 ${offer.offerLink}`)
  return lines.join('\n')
}


function addSentIds(existing, newIds) {
  const all = [...existing, ...newIds.map(String)]
  return all.length > 200 ? all.slice(all.length - 200) : all
}

async function resolveOffers({ automation, sentItemIds, creds, fetchOffersFn }) {
  const base = {
    keyword: automation.keyword,
    minDiscountPct: automation.minDiscountPct,
    limit: automation.offersPerSend,
    creds,
    sortType: automation.sortType ?? 2,
    isKeySeller: automation.isKeySeller ?? false,
  }

  if (!automation.prioritizeAMS) {
    return fetchOffersFn({ ...base, isAMSOffer: false, excludeItemIds: sentItemIds })
  }

  const { offers: amsOffers, rawCount: amsRawCount } = await fetchOffersFn({ ...base, isAMSOffer: true, excludeItemIds: sentItemIds })
  const amsItemIds = amsOffers.map(o => String(o.itemId))
  const { offers: regularOffers, rawCount: regularRawCount } = await fetchOffersFn({
    ...base,
    isAMSOffer: false,
    excludeItemIds: [...sentItemIds, ...amsItemIds],
  })
  return { offers: [...amsOffers, ...regularOffers], rawCount: amsRawCount + regularRawCount }
}

export async function runAutomation(automation, {
  sendBroadcastFn = sendBroadcast,
  isRunningFn = isRunning,
  fetchOffersFn = defaultFetchOffers,
  dbOverride,
} = {}) {
  const dbInstance = dbOverride ?? db

  if (!isRunningFn(automation.userId)) return { skipped: 'bot_not_running' }

  const credRow = await dbInstance.credential.findUnique({
    where: { userId_platform: { userId: automation.userId, platform: 'shopee' } },
  })
  if (!credRow) return { skipped: 'no_shopee_credentials' }

  const creds = parseCredentialData(credRow.data)
  if (!creds?.appId || !creds?.secretKey) return { skipped: 'invalid_shopee_credentials' }

  let sentItemIds
  try {
    sentItemIds = JSON.parse(automation.sentItemIds ?? '[]')
  } catch {
    sentItemIds = []
  }

  let offers, rawCount
  try {
    ;({ offers, rawCount } = await resolveOffers({ automation, sentItemIds, creds, fetchOffersFn }))
  } catch (err) {
    return { error: err.message }
  }

  if (!offers.length) {
    // rawCount > 0 significa que a Shopee retornou produtos, mas o filtro de
    // desconto mínimo ou a dedup (itens já enviados) removeu todos — diferente
    // de a busca não ter trazido nada.
    return { skipped: rawCount > 0 ? 'all_offers_filtered' : 'no_offers_found' }
  }

  const toSend = offers.slice(0, automation.offersPerSend)

  const botConfig = await dbInstance.botConfig.findUnique({ where: { userId: automation.userId } })
  const poolJson = resolveCopyVariationPoolJson(botConfig?.copyVariationPoolJson)
  const groupInviteLink = botConfig?.brandingGroupLink ?? ''
  const couponLink = botConfig?.couponLink ?? ''
  const templateBody = resolveAutomationTemplateBody(botConfig, automation.templateKey)

  const sentIds = []
  for (const offer of toSend) {
    const base = formatOfferMessage(offer, automation.keyword, templateBody)
    const text = applyVariation(base, {
      groupId: automation.destGroupJid,
      poolJson,
      groupInviteLink,
      couponLink,
      random: true,
      autoInjectWhenMissing: false,
    })
    await sendBroadcastFn(automation.userId, text, [automation.destGroupJid], {
      imageUrl: offer.imageUrl,
      imageRefererUrl: offer.offerLink,
      source: 'offerAutomation',
    })
    sentIds.push(offer.itemId)
  }

  const newSentIds = addSentIds(sentItemIds, sentIds)
  await dbInstance.offerAutomation.update({
    where: { id: automation.id },
    data: { lastSentAt: new Date(), sentItemIds: JSON.stringify(newSentIds) },
  })

  return { sent: sentIds.length }
}
