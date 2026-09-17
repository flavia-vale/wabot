import { fetchOffers as defaultFetchOffers, dedupeOffersByProduct, productDedupKey, buildOfferCandidateLimit, resolveShopeeOfferPrice } from './shopeeOffers.js'
import { sendBroadcast, isRunning } from '../manager.js'
import db from '../db.js'
import { parseCredentialData } from '../credentialHealth.js'
import { applyVariation, resolveCopyVariationPoolJson } from '../core/copyVariation.js'
import { buildMobileOfferText } from '../../dashboard/lib/mobileOfferComposer.js'
import { composeTemplates } from '../../dashboard/lib/mobileTemplateStore.js'
import { createAndEnqueueStory } from '../instagram/storyDeliveryService.js'
import { getInstagramDeliveryRuntime } from '../instagram/publishing/runtime.js'
import { DELIVERY_SOURCE_TYPE } from '../domain/delivery/constants.js'

const PRICE_DIVISOR = 1
const DEFAULT_AUTOMATION_TEMPLATE_KEY = 'automatico_classico'

// Janela da dedup cruzada por grupo (default 120min). Override em ms via
// env OFFER_AUTOMATION_DEDUP_WINDOW_MS.
const CROSS_GROUP_DEDUP_WINDOW_MS = Math.max(
  60_000,
  Number(process.env.OFFER_AUTOMATION_DEDUP_WINDOW_MS) || 120 * 60_000,
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

export function offerPriceCents(offer) {
  return Math.round(resolveOfferPrice(offer) * 100)
}

// A Shopee pode devolver `priceMin: ""` junto de `price` preenchido. O
// nullish coalescing não pula string vazia e fazia a mensagem perder o preço.
// Centralizar o fallback mantém snapshot, texto e deduplicação consistentes.
export function resolveOfferPrice(offer = {}) {
  return resolveShopeeOfferPrice(offer) ?? 0
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

export function automationOfferProduct(offer) {
  const currentRaw = resolveOfferPrice(offer)
  const pct = Number(offer.priceDiscountRate) || 0
  const originalRaw = pct > 0 && currentRaw > 0 ? Math.round(currentRaw * 100 / (100 - pct)) : 0
  const price = priceStr(currentRaw)
  const oldPrice = priceStr(originalRaw)
  return {
    title: offer.productName ?? 'Produto Shopee',
    price,
    oldPrice,
    // Alguns modelos salvos usam a variável editorial `{preçoDoTexto}` em
    // vez de `{preço}`. A fila tinha preço no snapshot, mas não preenchia esse
    // campo, então o compositor removia a variável e deixava apenas "💰".
    textPrice: oldPrice ? `De ${oldPrice} por ${price}` : price,
    discount: discountStr(pct),
    rating: ratingStr(offer.ratingStar),
    sales: salesStr(offer.sales),
    storeName: 'Shopee',
  }
}

export function ensureRenderedAutomationPrice(renderedText, product = {}) {
  const text = String(renderedText || '')
  const price = String(product.price || '').trim()
  if (!price || text.includes(price)) return text
  const oldPrice = String(product.oldPrice || '').trim()
  const priceLine = oldPrice ? `💰 ~${oldPrice}~ → *${price}*` : `💰 *${price}*`
  if (/^\s*💰\s*$/m.test(text)) return text.replace(/^\s*💰\s*$/m, priceLine)
  const linkIndex = text.search(/^\s*(?:👉|🛒).*https?:\/\//m)
  if (linkIndex >= 0) return `${text.slice(0, linkIndex).trimEnd()}\n\n${priceLine}\n\n${text.slice(linkIndex)}`
  return `${text.trimEnd()}\n\n${priceLine}`
}

function parseTemplateStore(mobileTemplatesJson) {
  try { return JSON.parse(mobileTemplatesJson || '{}') } catch { return {} }
}

export function resolveAutomationTemplateBody(botConfig, templateKey) {
  const templates = composeTemplates(parseTemplateStore(botConfig?.mobileTemplatesJson))
  const key = templateKey || DEFAULT_AUTOMATION_TEMPLATE_KEY
  return templates.find((template) => template.key === key)?.body
    || templates.find((template) => template.key === DEFAULT_AUTOMATION_TEMPLATE_KEY)?.body
    || null
}

export function materializeAutomationOffer(automation, offer, botConfig) {
  const templateBody = resolveAutomationTemplateBody(botConfig, automation.templateKey)
  const base = formatOfferMessage(offer, automation.keyword, templateBody)
  const renderedText = applyVariation(base, {
    groupId: automation.destGroupJid,
    poolJson: resolveCopyVariationPoolJson(botConfig?.copyVariationPoolJson),
    groupInviteLink: botConfig?.brandingGroupLink ?? '',
    couponLink: botConfig?.couponLink ?? '',
    random: true,
    autoInjectWhenMissing: false,
  })
  return {
    productKey: productDedupKey(offer),
    itemId: offer.itemId == null ? null : String(offer.itemId),
    priceCents: offerPriceCents(offer),
    productUrl: offer.offerLink,
    imageUrl: offer.imageUrl || null,
    imageRefererUrl: offer.offerLink || null,
    productSnapshot: automationOfferProduct(offer),
    renderedText,
  }
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
  const currentRaw = resolveOfferPrice(offer)
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

  // UMA busca só, sempre. A opção "priorizar comissão extra" (`prioritizeAMS`)
  // foi retirada em 2026-09-17: ela fazia uma segunda busca e devolvia
  // [...ofertasComComissãoExtra, ...restantes], e era a CONCATENAÇÃO — não a
  // ordem escolhida pela cliente — que decidia quem saía. Com 1 produto por
  // envio e "mais baratos primeiro", publicava o item de R$500 no lugar do de
  // R$10. A coluna continua no banco, dormente; nada aqui a lê. Não voltar a
  // ler sem pedido explícito — ver o RCA em AGENTS.md.
  const result = await fetchOffersFn({ ...base, isAMSOffer: false, excludeItemIds: sentItemIds })
  return { ...result, offers: result.offers.filter(offer => resolveOfferPrice(offer) > 0) }
}

export async function runAutomation(automation, {
  sendBroadcastFn = sendBroadcast,
  isRunningFn = isRunning,
  fetchOffersFn = defaultFetchOffers,
  dbOverride,
  sendStoryFn = createAndEnqueueStory,
  instagramRuntimeFn = getInstagramDeliveryRuntime,
} = {}) {
  const dbInstance = dbOverride ?? db

  // `await`: no modo inline isRunning é boolean; no modo remote devolve uma
  // Promise. Sem await, `!Promise` é sempre false e o guard era ignorado em
  // remote — o dispatcher seguia pro sendBroadcast e falhava com "Bot não está
  // rodando" a cada tick do cron, floodando log e gastando CPU/IO à toa.
  const instagramDestinations = (automation.instagramDestinations ?? []).map(link => link.destination ?? link).filter(destination => destination?.id && destination.enabled !== false)
  const whatsappAvailable = automation.destGroupJid ? await isRunningFn(automation.userId) : false
  if (!whatsappAvailable && !instagramDestinations.length) return { skipped: 'bot_not_running' }

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
  const recentSends = automation.destGroupJid ? await dbInstance.offerAutomationSentLog.findMany({
    where: { userId: automation.userId, destGroupJid: automation.destGroupJid, sentAt: { gte: dedupSince } },
    select: { productKey: true, priceCents: true },
  }) : []
  const recentPricesByKey = new Map()
  for (const row of recentSends) {
    if (!recentPricesByKey.has(row.productKey)) recentPricesByKey.set(row.productKey, new Set())
    recentPricesByKey.get(row.productKey).add(row.priceCents)
  }
  const whatsappEligible = new Set(offers.filter((offer) => {
    const prices = recentPricesByKey.get(productDedupKey(offer))
    return !prices || !prices.has(offerPriceCents(offer))
  }).map(offer => String(offer.itemId)))

  if (!offers.length || (!instagramDestinations.length && whatsappEligible.size === 0)) {
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
  const failures = []
  let storiesQueued = 0
  const instagramRuntime = instagramDestinations.length ? instagramRuntimeFn() : null
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
    // Aceite por CANAL, não um booleano só. Com um booleano compartilhado,
    // falha de um destino Instagram (Meta fora do ar) impedia o item de entrar
    // em sentItemIds mesmo com o WhatsApp JÁ entregue — e o item voltava
    // candidato a cada tick, indefinidamente, arriscando reenvio ao grupo.
    let whatsappAccepted = true
    let instagramAccepted = true
    // Se existe destino WhatsApp mas a sessão está offline, o Story ainda
    // pode sair; porém o item não entra em sentItemIds até o WhatsApp voltar.
    // Isso evita perder silenciosamente a entrega WhatsApp por causa do
    // sucesso do canal irmão.
    if (automation.destGroupJid && !whatsappAvailable && whatsappEligible.has(String(offer.itemId))) whatsappAccepted = false
    if (whatsappAvailable && whatsappEligible.has(String(offer.itemId))) try {
      await sendBroadcastFn(automation.userId, text, [automation.destGroupJid], {
        imageUrl: offer.imageUrl,
        imageRefererUrl: offer.offerLink,
        source: 'offerAutomation',
      })
    } catch (err) {
      // Uma falha pontual num item do lote (timeout de IPC pro worker, bot sem
      // socket no instante exato, imagem que não baixou) NÃO pode abortar o
      // `for` inteiro: sem este try/catch, um `throw` aqui pulava o resto do
      // loop E o bloco de persistência abaixo — perdendo o progresso dos itens
      // JÁ enviados com sucesso (sentLogRows/sentItemIds/page nunca eram
      // gravados) e deixando a automação presa tentando o MESMO lote a cada
      // tick do cron, sem nunca avançar (sintoma: "fila automática parou de
      // enviar"). Loga e segue para o próximo item; o item que falhou fica de
      // fora de `sentItemIds`, então entra candidato de novo no próximo tick.
      failures.push({ itemId: offer.itemId, error: err?.message })
      whatsappAccepted = false
    }
    if (whatsappAvailable && whatsappEligible.has(String(offer.itemId)) && whatsappAccepted) {
      sentLogRows.push({ userId: automation.userId, destGroupJid: automation.destGroupJid, productKey: productDedupKey(offer), priceCents: offerPriceCents(offer), itemId: offer.itemId != null ? String(offer.itemId) : null })
    }
    for (const destination of instagramDestinations) {
      try {
        if (!instagramRuntime) throw Object.assign(new Error('Fila de Instagram indisponível'), { code: 'INSTAGRAM_RUNTIME_UNAVAILABLE' })
        const current = offerPriceCents(offer)
        const discount = Number(offer.priceDiscountRate) || 0
        const oldPriceCents = discount > 0 ? Math.round(current * 100 / (100 - discount)) : null
        await sendStoryFn({
          userId: automation.userId,
          destinationId: destination.id,
          sourceType: DELIVERY_SOURCE_TYPE.OFFER_AUTOMATION,
          sourceId: automation.id,
          idempotencyKey: `offer-automation:${automation.id}:${destination.id}:${productDedupKey(offer)}:${current}`,
          offer: { offerKey: String(offer.itemId), title: offer.productName || 'Produto Shopee', priceCents: current, oldPriceCents, discountLabel: discount ? `${discount}% OFF` : null, storeName: 'Shopee', productUrl: offer.offerLink, imageUrl: offer.imageUrl, callToAction: 'Oferta por tempo limitado' },
        }, instagramRuntime)
        storiesQueued++
      } catch (err) {
        failures.push({ itemId: offer.itemId, destinationId: destination.id, error: err?.message })
        instagramAccepted = false
      }
    }
    // O item só reentra como candidato enquanto o canal que FALHOU ainda tem o
    // que entregar. O Story é idempotente pela chave (automação, destino,
    // produto, preço), então reprocessar o item não republica o que já saiu.
    if (whatsappAccepted && instagramAccepted) sentIds.push(offer.itemId)
  }
  if (sentLogRows.length) {
    await dbInstance.offerAutomationSentLog.createMany({ data: sentLogRows }).catch(() => {})
  }

  // Poda registros fora da janela pra tabela não crescer indefinidamente.
  if (automation.destGroupJid) await dbInstance.offerAutomationSentLog.deleteMany({
    where: { userId: automation.userId, destGroupJid: automation.destGroupJid, sentAt: { lt: dedupSince } },
  }).catch(() => {})

  const newSentIds = addSentIds(sentItemIds, sentIds)
  await dbInstance.offerAutomation.update({
    where: { id: automation.id },
    data: { lastSentAt: new Date(), sentItemIds: JSON.stringify(newSentIds), page: advancedPage },
  })

  return { sent: sentIds.length, ...(storiesQueued ? { storiesQueued } : {}), ...(failures.length ? { failed: failures.length, failures } : {}) }
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
