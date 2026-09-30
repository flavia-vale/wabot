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
// Por LOJA (revisão 2026-09-30): um teto global ordenado por fim deixava de
// fora a loja cujas promoções vencem depois — e, com as mais próximas todas já
// enviadas, a automação "acabava" com promoções boas ainda no banco.
const CANDIDATE_ROWS_PER_STORE = 300
// Memória do que já saiu, para promoções (catálogo finito). O teto de 200 da
// Shopee fazia a mesma promoção voltar depois de ~200 envios; aqui a lista é
// podada pelo que ainda está ativo, e o teto é só rede de segurança.
export const AWIN_SENT_IDS_CAP = 3000
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

// Identidade da promoção = LOJA + PÁGINA DA LOJA (ou título, sem página),
// nunca o número da Awin. Medido no staging em 2026-09-29: a Arno publica o
// MESMO produto duas vezes, uma por voltagem ("...LN63 127V" e "...LN63
// 220V"), com números diferentes e a MESMA página (`url`). A 1ª correção
// (loja + título) deixava os dois passarem; a página é o que eles têm igual.
// Vale no mesmo envio, contra o que já saiu (sentItemIds) e na dedup cruzada
// por grupo (productKey).
function normalizedStorePage(value) {
  try {
    const url = new URL(String(value ?? '').trim())
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    const path = decodeURIComponent(url.pathname).toLowerCase().replace(/\/+$/, '')
    return host ? `${host}${path}` : null
  } catch {
    return null
  }
}

function normalizedTitle(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, ' ').trim()
}

// FNV-1a 32 bits: curto e sem depender de node:crypto (este arquivo também
// é importado pelo painel).
function shortHash(text) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}

function awinTitleKey(promotion) {
  return `${promotion.advertiserId}:${shortHash(normalizedTitle(promotion.title))}`
}

// Página INICIAL da loja (sem caminho) não identifica produto nenhum: várias
// promoções diferentes da mesma loja apontam para ela. Usar a página como
// identidade fazia a 1ª enviada bloquear todas as outras para sempre
// (revisão 2026-09-30) — para ela vale o título.
function isStoreHome(page) {
  return !page || !page.includes('/')
}

export function awinContentKey(promotion) {
  const page = normalizedStorePage(promotion.url)
  return page && !isStoreHome(page) ? `${promotion.advertiserId}:u:${shortHash(page)}` : awinTitleKey(promotion)
}

export function awinItemId(promotion) {
  return `awin:c:${awinContentKey(promotion)}`
}

// Formato da 1ª correção (loja + título, 2026-09-29 tarde). Continua valendo
// para o que já foi enviado com ele.
export function awinTitleItemId(promotion) {
  return `awin:c:${awinTitleKey(promotion)}`
}

// Desempate quando várias vencem na mesma hora: ordem "embaralhada" mas
// sempre a mesma (hash do número). Pela ordem do número, a loja que cadastra
// em sequência (Arno: 4118874..4118893 = só liquidificadores) mandava três
// produtos da mesma linha seguidos.
function tieBreak(a, b) {
  return shortHash(String(a.promotionId)).localeCompare(shortHash(String(b.promotionId))) || String(a.promotionId).localeCompare(String(b.promotionId))
}

// Formato antigo (até 2026-09-29): um item por número da Awin. Continua
// valendo para o que já foi enviado com ele.
export function awinLegacyItemId(promotion) {
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
    dedupKey: `awin:${promotion.accountId}:${awinContentKey(promotion)}`,
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
// Em que posição do histórico cada loja saiu por último (maior = mais recente).
// Os ids novos carregam a loja (`awin:c:<loja>:...`); o histórico é gravado em
// ordem de envio.
export function storeLastSentOrder(sentItemIds = []) {
  const order = new Map()
  sentItemIds.forEach((id, index) => {
    const match = /^awin:c:(\d{1,12}):/.exec(String(id))
    if (match) order.set(match[1], index)
  })
  return order
}

export function selectAwinCandidates(promotions, { sentItemIds = [], advertiserIds = [], keyword = '', now = new Date(), limit = 5 } = {}) {
  const nowMs = now.getTime()
  const sent = new Set(sentItemIds.map(String))
  // Já saiu = qualquer formato de id que esta promoção já teve. E tudo que
  // tem o mesmo conteúdo dela (a outra voltagem, a cópia) também já saiu.
  const wasSent = (promotion) => sent.has(awinItemId(promotion)) || sent.has(awinTitleItemId(promotion)) || sent.has(awinLegacyItemId(promotion))
  const sentContent = new Set(promotions.filter(wasSent).map(awinContentKey))
  const allowedStores = new Set(parseAdvertiserIds(advertiserIds))
  const filtered = promotions.filter((promotion) => {
    if (promotion.status && promotion.status !== 'active') return false
    const start = time(promotion.startDate)
    if (start != null && start > nowMs) return false
    const end = time(promotion.endDate)
    if (end != null && end - nowMs < AWIN_MIN_REMAINING_MS) return false
    if (wasSent(promotion) || sentContent.has(awinContentKey(promotion))) return false
    if (allowedStores.size && !allowedStores.has(String(promotion.advertiserId))) return false
    return matchesKeyword(promotion, keyword)
  })

  const endOrInfinity = (promotion) => time(promotion.endDate) ?? Number.POSITIVE_INFINITY
  // Uma só por conteúdo (loja + página): fica a que vence antes.
  const seenContent = new Set()
  const eligible = [...filtered]
    .sort((a, b) => endOrInfinity(a) - endOrInfinity(b) || tieBreak(a, b))
    .filter((promotion) => {
      const key = awinContentKey(promotion)
      if (seenContent.has(key)) return false
      seenContent.add(key)
      return true
    })

  const byStore = new Map()
  for (const promotion of eligible) {
    const key = String(promotion.advertiserId)
    if (!byStore.has(key)) byStore.set(key, [])
    byStore.get(key).push(promotion)
  }
  const queues = [...byStore.values()].map((list) => list.sort((a, b) => endOrInfinity(a) - endOrInfinity(b) || tieBreak(a, b)))
  // A loja cuja próxima promoção vence antes abre a rodada.
  // Revezamento DE VERDADE entre execuções (revisão 2026-09-30): antes a loja
  // com a promoção mais perto de vencer abria TODA rodada — com 1 oferta por
  // envio, só ela saía até acabar. Agora abre a loja que saiu há mais tempo
  // (nunca saiu = primeiro); o fim mais próximo só desempata.
  const lastSent = storeLastSentOrder(sentItemIds)
  const recency = (queue) => lastSent.get(String(queue[0].advertiserId)) ?? -1
  queues.sort((a, b) => recency(a) - recency(b) || endOrInfinity(a[0]) - endOrInfinity(b[0]) || String(a[0].advertiserName).localeCompare(String(b[0].advertiserName)))

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
  const where = {
    userId: automation.userId,
    accountId: account.id,
    status: 'active',
    OR: [{ endDate: null }, { endDate: { gt: new Date(now.getTime() + AWIN_MIN_REMAINING_MS) } }],
  }
  const stores = await db.awinPromotion.findMany({ where, distinct: ['advertiserId'], select: { advertiserId: true } })
  const perStore = await Promise.all(stores.map(({ advertiserId }) => db.awinPromotion.findMany({
    where: { ...where, advertiserId },
    orderBy: { endDate: 'asc' },
    take: CANDIDATE_ROWS_PER_STORE,
  })))
  const rows = perStore.flat()
  if (!rows.length) return { skipped: 'no_awin_promotions', sentItemIds: pruneAwinSentIds(sentItemIds, []) }
  const picked = selectAwinCandidates(rows, {
    sentItemIds,
    advertiserIds: automation.awinAdvertiserIds,
    keyword: automation.keyword,
    now,
    limit: Math.max(1, Number(limit) || 1),
  })
  // Memória podada: fica só o que ainda está ativo (inclusive as promoções que
  // não entraram nesta leitura — a identidade vem de todas as ativas).
  const active = await db.awinPromotion.findMany({
    where: { userId: automation.userId, accountId: account.id, status: 'active' },
    select: { promotionId: true, advertiserId: true, url: true, title: true },
  })
  return { offers: picked.map(awinPromotionToOffer), rawCount: rows.length, sentItemIds: pruneAwinSentIds(sentItemIds, active) }
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

/**
 * Histórico de enviados só com o que ainda pode voltar a ser candidato (as
 * três formas de id de cada promoção ativa). Ids de outras origens (Shopee)
 * ficam intactos. PURA.
 */
export function pruneAwinSentIds(sentItemIds = [], activePromotions = []) {
  const alive = new Set()
  for (const promotion of activePromotions) {
    alive.add(awinItemId(promotion))
    alive.add(awinTitleItemId(promotion))
    alive.add(awinLegacyItemId(promotion))
    // Forma antiga (antes da página inicial virar título): continua valendo
    // enquanto a promoção existir, para não reenviar o que já saiu.
    const page = normalizedStorePage(promotion.url)
    if (page) alive.add(`awin:c:${promotion.advertiserId}:u:${shortHash(page)}`)
  }
  const kept = sentItemIds.map(String).filter((id) => !id.startsWith('awin:') || alive.has(id))
  return kept.length > AWIN_SENT_IDS_CAP ? kept.slice(kept.length - AWIN_SENT_IDS_CAP) : kept
}
