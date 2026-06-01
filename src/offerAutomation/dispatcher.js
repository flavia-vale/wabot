import { fetchOffers } from './shopeeOffers.js'
import { sendBroadcast, isRunning } from '../manager.js'
import db from '../db.js'
import { parseCredentialData } from '../credentialHealth.js'
import { applyVariation } from '../core/copyVariation.js'

const PRICE_DIVISOR = 1

function priceStr(raw) {
  const num = Number(raw)
  if (!num || num <= 0) return null
  return (num / PRICE_DIVISOR).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatOfferMessage(offer, keyword) {
  const name = offer.productName ?? 'Produto Shopee'
  const currentRaw = Number(offer.priceMin ?? offer.price) || 0
  const pct = Number(offer.priceDiscountRate) || 0
  const current = priceStr(currentRaw)

  // originPrice não existe na API — calcular via álgebra reversa do desconto
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

export async function runAutomation(automation, { sendBroadcastFn = sendBroadcast, isRunningFn = isRunning, fetchOffersFn = fetchOffers, dbClient = db } = {}) {
  if (!isRunningFn(automation.userId)) return { skipped: 'bot_not_running' }

  const credRow = await dbClient.credential.findUnique({
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
    ;({ offers, rawCount } = await fetchOffersFn({
      keyword: automation.keyword,
      minDiscountPct: automation.minDiscountPct,
      limit: automation.offersPerSend,
      excludeItemIds: sentItemIds,
      creds,
      sortType: automation.sortType ?? 2,
      isAMSOffer: automation.isAMSOffer ?? false,
      isKeySeller: automation.isKeySeller ?? false,
    }))
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

  const botConfig = await dbClient.botConfig.findUnique({ where: { userId: automation.userId } })
  const poolJson = botConfig?.copyVariationPoolJson ?? '{}'

  const sentIds = []
  for (const offer of toSend) {
    const base = formatOfferMessage(offer, automation.keyword)
    const text = applyVariation(base, { groupId: automation.destGroupJid, poolJson, random: true })
    await sendBroadcastFn(automation.userId, text, [automation.destGroupJid], {
      imageUrl: offer.imageUrl,
      imageRefererUrl: offer.offerLink,
      source: 'offerAutomation',
    })
    sentIds.push(offer.itemId)
  }

  const newSentIds = addSentIds(sentItemIds, sentIds)
  await dbClient.offerAutomation.update({
    where: { id: automation.id },
    data: { lastSentAt: new Date(), sentItemIds: JSON.stringify(newSentIds) },
  })

  return { sent: sentIds.length }
}
