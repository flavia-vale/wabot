// Promoções Rakuten como ORIGEM das ofertas automáticas
// (docs/rca/afiliados-rakuten.md). Mesmo desenho e mesma regra de envio das
// promoções Awin (src/offerAutomation/awinOffers.js):
// - o envio só LÊ do banco (o sync em src/integrations/rakuten/ já guardou
//   as promoções) e nunca chama a Rakuten;
// - cada promoção sai UMA vez por automação (sentItemIds);
// - revezando as lojas; dentro da loja, primeiro a que vence antes;
// - nunca com menos de 1h para vencer nem antes de começar;
// - filtro opcional por lojas e por palavra (título, sem acento).
// Diferenças da Awin: o link é o `clickurl` da Rakuten (já com o ID da
// cliente, sem link curto); a foto é o LOGO da loja; o cupom, quando existe,
// vai na mensagem; validade muito longa (a Rakuten usa 2029/2030 para
// "indeterminada") não aparece.
//
// Este arquivo não importa nada do servidor (pode ser lido pelo painel).

import { AWIN_MIN_REMAINING_MS, formatAwinValidity, parseAdvertiserIds } from './awinOffers.js'

export const RAKUTEN_MIN_REMAINING_MS = AWIN_MIN_REMAINING_MS
// Acima disto a validade não aparece na mensagem (a data sem ano confundiria:
// "Válida até 21/06" de 2029).
export const RAKUTEN_VALIDITY_SHOWN_MS = 60 * 24 * 60 * 60_000
// Candidatas por LOJA (revisão 2026-10-03, R15 = F6 da Awin): com teto global,
// a loja de promoções "indeterminadas" (fim em 2029) nunca entrava na leitura.
const CANDIDATE_ROWS_PER_STORE = 300
// Memória de enviados (F7 da Awin): podada pelo que ainda está ativo; teto.
export const RAKUTEN_SENT_IDS_CAP = 3000

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// FNV-1a 32 bits (mesmo de awinOffers.js; sem node:crypto).
function shortHash(text) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}

// Identidade = LOJA + TÍTULO normalizado (+ cupom). O feed não traz a página
// da loja; a lição da Awin (mesmo produto publicado duas vezes com números
// diferentes) vale aqui também, então o número da Rakuten não é a identidade.
export function rakutenContentKey(promotion) {
  const title = normalizeText(promotion.title).replace(/[^a-z0-9]+/g, ' ').trim()
  const coupon = normalizeText(promotion.couponCode).trim()
  return `${promotion.advertiserId}:${shortHash(`${title}|${coupon}`)}`
}

export function rakutenItemId(promotion) {
  return `rakuten:c:${rakutenContentKey(promotion)}`
}

function tieBreak(a, b) {
  return shortHash(String(a.promotionId)).localeCompare(shortHash(String(b.promotionId))) || String(a.promotionId).localeCompare(String(b.promotionId))
}

function matchesKeyword(promotion, keyword) {
  const words = normalizeText(keyword).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const haystack = normalizeText(`${promotion.title} ${promotion.categories ?? ''} ${promotion.promotionTypes ?? ''}`)
  return words.every((word) => haystack.includes(word))
}

function time(value) {
  if (!value) return null
  const at = new Date(value).getTime()
  return Number.isFinite(at) ? at : null
}

export function formatRakutenValidity(endDate, now = new Date()) {
  const end = time(endDate)
  if (end == null || end - now.getTime() > RAKUTEN_VALIDITY_SHOWN_MS) return ''
  return formatAwinValidity(endDate)
}

export function rakutenCouponLine(couponCode) {
  const code = String(couponCode ?? '').trim()
  return code ? `🎟️ Use o cupom: ${code}` : ''
}

// Promoção guardada → formato de "oferta" que o dispatcher já entende.
export function rakutenPromotionToOffer(promotion, { now = new Date() } = {}) {
  return {
    source: 'rakuten',
    itemId: rakutenItemId(promotion),
    dedupKey: `rakuten:${promotion.accountId}:${rakutenContentKey(promotion)}`,
    productName: promotion.title,
    offerLink: promotion.clickUrl,
    // Logo da loja = foto da oferta. Sem foto o WhatsApp montaria a prévia
    // abrindo o link de rastreio a partir do servidor (clique falso).
    imageUrl: promotion.logoUrl || null,
    // Só cabeçalho Referer do download da foto; nunca o link de rastreio.
    imageRefererUrl: promotion.storeUrl || null,
    storeName: promotion.advertiserName,
    description: rakutenCouponLine(promotion.couponCode),
    validity: formatRakutenValidity(promotion.endDate, now),
    validUntil: promotion.endDate ? new Date(promotion.endDate) : null,
    rakutenPromotionId: promotion.id,
    advertiserId: promotion.advertiserId,
  }
}

// Em que posição do histórico cada loja saiu por último (maior = mais recente).
// Os ids carregam a loja (`rakuten:c:<loja>:...`) e o histórico está em ordem
// de envio. PURA.
export function rakutenStoreLastSentOrder(sentItemIds = []) {
  const order = new Map()
  sentItemIds.forEach((id, index) => {
    const match = /^rakuten:c:(\d{1,12}):/.exec(String(id))
    if (match) order.set(match[1], index)
  })
  return order
}

/**
 * Histórico de enviados só com o que ainda pode voltar a ser candidato. Ids de
 * outras origens ficam intactos. PURA (F7 da Awin, revisão 2026-10-03 R15).
 */
export function pruneRakutenSentIds(sentItemIds = [], activePromotions = []) {
  const alive = new Set(activePromotions.map(rakutenItemId))
  const kept = sentItemIds.map(String).filter((id) => !id.startsWith('rakuten:') || alive.has(id))
  return kept.length > RAKUTEN_SENT_IDS_CAP ? kept.slice(kept.length - RAKUTEN_SENT_IDS_CAP) : kept
}

// PURA: escolhe e ordena as promoções candidatas.
export function selectRakutenCandidates(promotions, { sentItemIds = [], advertiserIds = [], keyword = '', now = new Date(), limit = 5 } = {}) {
  const nowMs = now.getTime()
  const sent = new Set(sentItemIds.map(String))
  const allowedStores = new Set(parseAdvertiserIds(advertiserIds))
  const filtered = promotions.filter((promotion) => {
    if (promotion.status && promotion.status !== 'active') return false
    const start = time(promotion.startDate)
    if (start != null && start > nowMs) return false
    const end = time(promotion.endDate)
    if (end != null && end - nowMs < RAKUTEN_MIN_REMAINING_MS) return false
    if (sent.has(rakutenItemId(promotion))) return false
    if (allowedStores.size && !allowedStores.has(String(promotion.advertiserId))) return false
    return matchesKeyword(promotion, keyword)
  })

  const endOrInfinity = (promotion) => time(promotion.endDate) ?? Number.POSITIVE_INFINITY
  const byEnd = (a, b) => endOrInfinity(a) - endOrInfinity(b) || tieBreak(a, b)
  const seenContent = new Set()
  const eligible = [...filtered].sort(byEnd).filter((promotion) => {
    const key = rakutenContentKey(promotion)
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
  const queues = [...byStore.values()]
  // Revezamento DE VERDADE entre execuções (F5 da Awin): abre a loja que saiu
  // há mais tempo (nunca saiu = primeiro); o fim mais próximo só desempata.
  const lastSent = rakutenStoreLastSentOrder(sentItemIds)
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
export async function loadRakutenOffers({ db, automation, sentItemIds = [], now = new Date(), limit }) {
  if (!automation.rakutenAccountId) return { skipped: 'no_rakuten_account' }
  const account = await db.rakutenAccount.findFirst({
    where: { id: automation.rakutenAccountId, userId: automation.userId },
    select: { id: true },
  })
  if (!account) return { skipped: 'no_rakuten_account' }
  const where = {
    userId: automation.userId,
    accountId: account.id,
    status: 'active',
    OR: [{ endDate: null }, { endDate: { gt: new Date(now.getTime() + RAKUTEN_MIN_REMAINING_MS) } }],
  }
  const stores = await db.rakutenPromotion.findMany({ where, distinct: ['advertiserId'], select: { advertiserId: true } })
  const perStore = await Promise.all(stores.map(({ advertiserId }) => db.rakutenPromotion.findMany({
    where: { ...where, advertiserId },
    orderBy: { endDate: 'asc' },
    take: CANDIDATE_ROWS_PER_STORE,
  })))
  const rows = perStore.flat()
  if (!rows.length) return { skipped: 'no_rakuten_promotions', sentItemIds: pruneRakutenSentIds(sentItemIds, []) }
  const picked = selectRakutenCandidates(rows, {
    sentItemIds,
    advertiserIds: automation.rakutenAdvertiserIds,
    keyword: automation.keyword,
    now,
    limit: Math.max(1, Number(limit) || 1),
  })
  const active = await db.rakutenPromotion.findMany({
    where: { userId: automation.userId, accountId: account.id, status: 'active' },
    select: { advertiserId: true, title: true, couponCode: true },
  })
  return { offers: picked.map((row) => rakutenPromotionToOffer(row, { now })), rawCount: rows.length, sentItemIds: pruneRakutenSentIds(sentItemIds, active) }
}

// Na entrega da fila de revisão: a promoção ainda vale?
export async function isRakutenPromotionStillValid({ db, userId, rakutenPromotionId, now = new Date() }) {
  if (!rakutenPromotionId) return false
  const row = await db.rakutenPromotion.findFirst({
    where: { id: rakutenPromotionId, userId, status: 'active' },
    select: { endDate: true },
  })
  if (!row) return false
  const end = time(row.endDate)
  return end == null || end - now.getTime() >= RAKUTEN_MIN_REMAINING_MS
}
