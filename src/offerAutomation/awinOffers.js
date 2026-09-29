// Promoções Awin como ORIGEM das ofertas automáticas (docs/rca/afiliados-awin.md).
//
// Diferente da Shopee, aqui não há busca na hora: o sync (src/integrations/
// awin/) já guardou as promoções da conta no banco; o envio só LÊ do banco e
// nunca chama a Awin. Promoção não tem preço nem foto: sai com título, loja,
// descrição, validade e o link de afiliado que a própria Awin devolve
// (urlTracking — medido em 2026-09-29: 208/208 já saem com o ID da cliente).
//
// Regra de envio aprovada em 2026-09-29:
// - cada promoção sai UMA vez por automação (sentItemIds, itemId "awin:<id>");
// - revezando entre as lojas (uma de cada loja por vez), para uma loja com
//   muitas promoções não tomar o grupo;
// - dentro de cada loja, primeiro a que vence antes;
// - nunca envia promoção que vence em menos de 1h nem que ainda não começou;
// - filtro opcional por lojas e por palavra (título ou descrição).

export const AWIN_AUTOMATION_TEMPLATE_KEY = 'promocao_awin'
export const AWIN_MIN_REMAINING_MS = 60 * 60_000
const CANDIDATE_ROWS_LIMIT = 1000
const DESCRIPTION_IN_MESSAGE_MAX = 280

// Modelo padrão sem preço. As variáveis vazias somem sozinhas
// (applyTemplateVariables em dashboard/lib/mobileOfferComposer.js).
export const AWIN_PROMOTION_TEMPLATE_BODY = `{{gancho}}

🏷️ *{produto}*
🏬 {loja}

{descrição}

⏰ {validade}

{{cta}}
👉 {link}

{{convitegrupo}}`

export function awinItemId(promotion) {
  return `awin:${promotion.promotionId}`
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function parseAdvertiserIds(value) {
  let list = value
  if (typeof value === 'string') {
    try { list = JSON.parse(value || '[]') } catch { list = [] }
  }
  if (!Array.isArray(list)) return []
  return [...new Set(list.map((item) => String(item).trim()).filter((item) => /^\d{1,12}$/.test(item)))]
}

function matchesKeyword(promotion, keyword) {
  const words = normalizeText(keyword).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const haystack = normalizeText(`${promotion.title} ${promotion.description ?? ''}`)
  return words.every((word) => haystack.includes(word))
}

function time(value) {
  if (!value) return null
  const at = new Date(value).getTime()
  return Number.isFinite(at) ? at : null
}

// "Válida até 29/09 às 23:59" no horário de Brasília.
export function formatAwinValidity(endDate) {
  const at = time(endDate)
  if (at == null) return ''
  const parts = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(at)).map((part) => [part.type, part.value]))
  return `Válida até ${parts.day}/${parts.month} às ${parts.hour}:${parts.minute}`
}

function shortDescription(text, title) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!clean || normalizeText(clean) === normalizeText(title)) return ''
  return clean.length > DESCRIPTION_IN_MESSAGE_MAX ? `${clean.slice(0, DESCRIPTION_IN_MESSAGE_MAX - 1).trimEnd()}…` : clean
}

// Promoção guardada → formato de "oferta" que o dispatcher já entende.
// Preço 0: a dedup cruzada por grupo (OfferAutomationSentLog) funciona igual,
// com priceCents 0 fixo.
export function awinPromotionToOffer(promotion) {
  return {
    source: 'awin',
    itemId: awinItemId(promotion),
    dedupKey: `awin:${promotion.accountId}:${promotion.promotionId}`,
    productName: promotion.title,
    offerLink: promotion.urlTracking,
    imageUrl: null,
    storeName: promotion.advertiserName,
    description: shortDescription(promotion.description, promotion.title),
    validity: formatAwinValidity(promotion.endDate),
    validUntil: promotion.endDate ? new Date(promotion.endDate) : null,
    awinPromotionId: promotion.id,
    advertiserId: promotion.advertiserId,
  }
}

// PURA: escolhe e ordena as promoções candidatas.
export function selectAwinCandidates(promotions, { sentItemIds = [], advertiserIds = [], keyword = '', now = new Date(), limit = 5 } = {}) {
  const nowMs = now.getTime()
  const sent = new Set(sentItemIds.map(String))
  const allowedStores = new Set(parseAdvertiserIds(advertiserIds))
  const eligible = promotions.filter((promotion) => {
    if (promotion.status && promotion.status !== 'active') return false
    const start = time(promotion.startDate)
    if (start != null && start > nowMs) return false
    const end = time(promotion.endDate)
    if (end != null && end - nowMs < AWIN_MIN_REMAINING_MS) return false
    if (sent.has(awinItemId(promotion))) return false
    if (allowedStores.size && !allowedStores.has(String(promotion.advertiserId))) return false
    return matchesKeyword(promotion, keyword)
  })

  const byStore = new Map()
  for (const promotion of eligible) {
    const key = String(promotion.advertiserId)
    if (!byStore.has(key)) byStore.set(key, [])
    byStore.get(key).push(promotion)
  }
  const endOrInfinity = (promotion) => time(promotion.endDate) ?? Number.POSITIVE_INFINITY
  const queues = [...byStore.values()].map((list) => list.sort((a, b) => endOrInfinity(a) - endOrInfinity(b) || String(a.promotionId).localeCompare(String(b.promotionId))))
  // A loja cuja próxima promoção vence antes abre a rodada.
  queues.sort((a, b) => endOrInfinity(a[0]) - endOrInfinity(b[0]) || String(a[0].advertiserName).localeCompare(String(b[0].advertiserName)))

  const picked = []
  for (let round = 0; picked.length < limit; round++) {
    let added = false
    for (const queue of queues) {
      if (round < queue.length && picked.length < limit) {
        picked.push(queue[round])
        added = true
      }
    }
    if (!added) break
  }
  return picked
}

// Lê do banco as promoções da conta da automação (sempre filtrando por
// userId) → { offers, rawCount } | { skipped }.
export async function loadAwinOffers({ db, automation, sentItemIds = [], now = new Date(), limit }) {
  if (!automation.awinAccountId) return { skipped: 'no_awin_account' }
  const account = await db.awinAccount.findFirst({
    where: { id: automation.awinAccountId, userId: automation.userId },
    select: { id: true },
  })
  if (!account) return { skipped: 'no_awin_account' }
  const rows = await db.awinPromotion.findMany({
    where: {
      userId: automation.userId,
      accountId: account.id,
      status: 'active',
      OR: [{ endDate: null }, { endDate: { gt: new Date(now.getTime() + AWIN_MIN_REMAINING_MS) } }],
    },
    orderBy: { endDate: 'asc' },
    take: CANDIDATE_ROWS_LIMIT,
  })
  if (!rows.length) return { skipped: 'no_awin_promotions' }
  const picked = selectAwinCandidates(rows, {
    sentItemIds,
    advertiserIds: automation.awinAdvertiserIds,
    keyword: automation.keyword,
    now,
    limit: Math.max(1, Number(limit) || 1),
  })
  return { offers: picked.map(awinPromotionToOffer), rawCount: rows.length }
}

// Na entrega da fila de revisão: a promoção ainda vale?
export async function isAwinPromotionStillValid({ db, userId, awinPromotionId, now = new Date() }) {
  if (!awinPromotionId) return false
  const row = await db.awinPromotion.findFirst({
    where: { id: awinPromotionId, userId, status: 'active' },
    select: { endDate: true },
  })
  if (!row) return false
  const end = time(row.endDate)
  return end == null || end - now.getTime() >= AWIN_MIN_REMAINING_MS
}
