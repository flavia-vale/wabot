import { fetchOffers as defaultFetchOffers, dedupeOffersByProduct, productDedupKey, buildOfferCandidateLimit } from './shopeeOffers.js'
import { sendBroadcast, isRunning } from '../manager.js'
import db from '../db.js'
import { parseCredentialData } from '../credentialHealth.js'
import { applyVariation, resolveCopyVariationPoolJson } from '../core/copyVariation.js'
import { buildMobileOfferText } from '../../dashboard/lib/mobileOfferComposer.js'
import { composeTemplates } from '../../dashboard/lib/mobileTemplateStore.js'

const PRICE_DIVISOR = 1
const DEFAULT_AUTOMATION_TEMPLATE_KEY = 'automatico_classico'

// Janela da dedup cruzada por grupo (default 24h = "no máximo uma vez por
// dia"). Override em ms via env OFFER_AUTOMATION_DEDUP_WINDOW_MS.
const CROSS_GROUP_DEDUP_WINDOW_MS = Math.max(
  60_000,
  Number(process.env.OFFER_AUTOMATION_DEDUP_WINDOW_MS) || 24 * 60 * 60_000,
)

// Teto de páginas para a rotação da busca Shopee. Ao passar do teto (ou quando
// a página atual volta vazia) a rotação volta para a página 1. Override via env
// OFFER_AUTOMATION_MAX_PAGE.
const MAX_OFFER_PAGE = Math.max(1, Number(process.env.OFFER_AUTOMATION_MAX_PAGE) || 20)

// Próxima página da rotação: avança enquanto a página atual trouxe resultados e
// não passou do teto; volta para 1 quando a página esgotou (rawCount 0) ou
// atingiu o teto. Assim cada execução vê candidatos novos em vez de rebater
// sempre a página 1.
function nextOfferPage(currentPage, rawCount) {
  if (rawCount > 0 && currentPage < MAX_OFFER_PAGE) return currentPage + 1
  return 1
}

function offerPriceCents(offer) {
  return Math.round((Number(offer?.priceMin ?? offer?.price) || 0) * 100)
}

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

export async function resolveOffers({ automation, sentItemIds, creds, fetchOffersFn = defaultFetchOffers }) {
  const base = {
    keyword: automation.keyword,
    minDiscountPct: automation.minDiscountPct,
    limit: automation.offersPerSend,
    creds,
    sortType: automation.sortType ?? 2,
    listType: automation.listType ?? 1,
    page: automation.page ?? 1,
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

  // `await`: no modo inline isRunning é boolean; no modo remote devolve uma
  // Promise. Sem await, `!Promise` é sempre false e o guard era ignorado em
  // remote — o dispatcher seguia pro sendBroadcast e falhava com "Bot não está
  // rodando" a cada tick do cron, floodando log e gastando CPU/IO à toa.
  if (!(await isRunningFn(automation.userId))) return { skipped: 'bot_not_running' }

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

  // Página atual da rotação (default 1). Cada execução avança a página para
  // trazer candidatos novos; ao esgotar volta para 1 (ver nextOfferPage).
  const currentPage = Number(automation.page) > 0 ? Number(automation.page) : 1

  let offers, rawCount
  try {
    ;({ offers, rawCount } = await resolveOffers({
      automation: { ...automation, page: currentPage },
      sentItemIds,
      creds,
      fetchOffersFn,
    }))
  } catch (err) {
    return { error: err.message }
  }

  const advancedPage = nextOfferPage(currentPage, rawCount)

  // A Shopee devolve o mesmo produto sob itemIds diferentes (mesmo nome, preço
  // ligeiramente distinto). Sem colapsar por nome, ofertas idênticas saíam em
  // duplicata no mesmo envio. A dedup por itemId (sentItemIds) não cobre isso.
  offers = dedupeOffersByProduct(offers)

  // Dedup cruzada entre automações, por grupo de destino: `sentItemIds` é
  // per-automação, então N automações pro mesmo grupo reenviavam o mesmo
  // produto. Aqui filtramos contra o que JÁ saiu pro grupo nas últimas 24h
  // (independe de qual automação enviou). Liberamos se o PREÇO mudou — é uma
  // oferta nova de fato.
  const dedupSince = new Date(Date.now() - CROSS_GROUP_DEDUP_WINDOW_MS)
  const recentSends = await dbInstance.offerAutomationSentLog.findMany({
    where: { userId: automation.userId, destGroupJid: automation.destGroupJid, sentAt: { gte: dedupSince } },
    select: { productKey: true, priceCents: true },
  })
  const recentPricesByKey = new Map()
  for (const row of recentSends) {
    if (!recentPricesByKey.has(row.productKey)) recentPricesByKey.set(row.productKey, new Set())
    recentPricesByKey.get(row.productKey).add(row.priceCents)
  }
  offers = offers.filter((offer) => {
    const prices = recentPricesByKey.get(productDedupKey(offer))
    return !prices || !prices.has(offerPriceCents(offer))
  })

  if (!offers.length) {
    // rawCount > 0 significa que a Shopee retornou produtos, mas o filtro de
    // desconto mínimo / a dedup (itens já enviados ou já enviados ao grupo no
    // dia) removeu todos — diferente de a busca não ter trazido nada.
    // Mesmo sem enviar, avançamos a página para que o próximo disparo busque
    // candidatos diferentes (senão ficaríamos presos na mesma página filtrada).
    await dbInstance.offerAutomation.update({
      where: { id: automation.id },
      data: { page: advancedPage },
    }).catch(() => {})
    return { skipped: rawCount > 0 ? 'all_offers_filtered' : 'no_offers_found' }
  }

  const toSend = offers.slice(0, automation.offersPerSend)

  const botConfig = await dbInstance.botConfig.findUnique({ where: { userId: automation.userId } })
  const poolJson = resolveCopyVariationPoolJson(botConfig?.copyVariationPoolJson)
  const groupInviteLink = botConfig?.brandingGroupLink ?? ''
  const couponLink = botConfig?.couponLink ?? ''
  const templateBody = resolveAutomationTemplateBody(botConfig, automation.templateKey)

  const sentIds = []
  // Envios seguem sequenciais (stagger anti-ban); só os logs de dedup cruzada
  // são acumulados para gravar de uma vez (createMany) após o loop, evitando
  // N writes serializados no SQLite.
  const sentLogRows = []
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
    // Registra no log cruzado por grupo (com preço) pra próxima automação que
    // mire o mesmo grupo não reenviar este produto no mesmo dia.
    sentLogRows.push({
      userId: automation.userId,
      destGroupJid: automation.destGroupJid,
      productKey: productDedupKey(offer),
      priceCents: offerPriceCents(offer),
      itemId: offer.itemId != null ? String(offer.itemId) : null,
    })
  }
  if (sentLogRows.length) {
    await dbInstance.offerAutomationSentLog.createMany({ data: sentLogRows }).catch(() => {})
  }

  // Poda registros fora da janela pra tabela não crescer indefinidamente.
  await dbInstance.offerAutomationSentLog.deleteMany({
    where: { userId: automation.userId, destGroupJid: automation.destGroupJid, sentAt: { lt: dedupSince } },
  }).catch(() => {})

  const newSentIds = addSentIds(sentItemIds, sentIds)
  await dbInstance.offerAutomation.update({
    where: { id: automation.id },
    data: { lastSentAt: new Date(), sentItemIds: JSON.stringify(newSentIds), page: advancedPage },
  })

  return { sent: sentIds.length }
}

// Dry-run da busca: roda a MESMA pipeline de fetch (resolveOffers + dedupe por
// produto) que runAutomation usa, mas SEM enviar e SEM tocar no banco. Serve
// pro botão "Executar busca" do painel visualizar o que cada combinação de
// parâmetros traz. Não exclui sentItemIds nem aplica dedup 24h por grupo —
// é leitura pura da API Shopee a partir das escolhas do usuário.
export async function searchOffersPreview({ params = {}, creds, fetchOffersFn = defaultFetchOffers }) {
  const automation = {
    keyword: params.keyword,
    minDiscountPct: Number(params.minDiscountPct) || 0,
    offersPerSend: Number(params.offersPerSend) || 1,
    sortType: Number(params.sortType) || 2,
    listType: Number.isFinite(Number(params.listType)) ? Number(params.listType) : 1,
    page: Number(params.page) || 1,
    prioritizeAMS: Boolean(params.prioritizeAMS ?? false),
    isKeySeller: Boolean(params.isKeySeller ?? false),
  }
  const { offers, rawCount } = await resolveOffers({ automation, sentItemIds: [], creds, fetchOffersFn })
  const deduped = dedupeOffersByProduct(offers)
  return {
    params: {
      keyword: automation.keyword,
      sortType: automation.sortType,
      listType: automation.listType,
      page: automation.page,
      minDiscountPct: automation.minDiscountPct,
      prioritizeAMS: automation.prioritizeAMS,
      isKeySeller: automation.isKeySeller,
      candidateLimit: buildOfferCandidateLimit(automation.offersPerSend),
    },
    rawCount,
    afterDiscountFilter: offers.length,
    afterProductDedupe: deduped.length,
    offers: deduped,
  }
}
