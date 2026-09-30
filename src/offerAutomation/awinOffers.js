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
//
// O núcleo dessa regra é comum às origens de promoção e mora em
// promotionSelection.js (puro; este arquivo também é importado pelo painel).

import {
  PROMOTION_MIN_REMAINING_MS,
  createPromotionSelector,
  formatPromotionValidity,
  hasMinimumTimeLeft,
  normalizeText,
} from './promotionSelection.js'

export const AWIN_AUTOMATION_TEMPLATE_KEY = 'promocao_awin'
export const AWIN_MIN_REMAINING_MS = PROMOTION_MIN_REMAINING_MS
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

// Identidade da promoção = LOJA + PÁGINA DA LOJA (ou título, sem página),
// nunca o número da Awin. Medido no staging em 2026-09-29: a Arno publica o
// MESMO produto duas vezes, uma por voltagem ("...LN63 127V" e "...LN63
// 220V"), com números diferentes e a MESMA página (`url`). A 1ª correção
// (loja + título) deixava os dois passarem; a página é o que eles têm igual.
// Vale no mesmo envio, contra o que já saiu (sentItemIds) e na dedup cruzada
// por grupo (productKey). A regra mora em promotionSelection.js (comum às
// origens de promoção); aqui só os campos e o prefixo da Awin.
const awinSelector = createPromotionSelector({
  prefix: 'awin',
  minRemainingMs: AWIN_MIN_REMAINING_MS,
  fields: {
    id: 'promotionId',
    store: 'advertiserId',
    storeName: 'advertiserName',
    title: 'title',
    description: 'description',
    page: 'url',
    start: 'startDate',
    end: 'endDate',
    status: 'status',
  },
})

export function awinContentKey(promotion) {
  return awinSelector.contentKey(promotion)
}

// Formato atual: awin:c:<loja>:u:<hash da página> (ou por título, sem página).
export function awinItemId(promotion) {
  return awinSelector.itemId(promotion)
}

// Formato da 1ª correção (loja + título, 2026-09-29 tarde). Continua valendo
// para o que já foi enviado com ele.
export function awinTitleItemId(promotion) {
  return awinSelector.titleItemId(promotion)
}

// Formato antigo (até 2026-09-29): um item por número da Awin. Continua
// valendo para o que já foi enviado com ele.
export function awinLegacyItemId(promotion) {
  return awinSelector.legacyItemId(promotion)
}

export function parseAdvertiserIds(value) {
  let list = value
  if (typeof value === 'string') {
    try { list = JSON.parse(value || '[]') } catch { list = [] }
  }
  if (!Array.isArray(list)) return []
  return [...new Set(list.map((item) => String(item).trim()).filter((item) => /^\d{1,12}$/.test(item)))]
}

// "Válida até 29/09 às 23:59" no horário de Brasília.
export function formatAwinValidity(endDate) {
  return formatPromotionValidity(endDate)
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

// PURA: escolhe e ordena as promoções candidatas (regra em
// promotionSelection.js: revezamento de lojas, vence antes primeiro, janela
// de 1h, uma por conteúdo, filtro por loja e palavra).
export function selectAwinCandidates(promotions, { sentItemIds = [], advertiserIds = [], keyword = '', now = new Date(), limit = 5 } = {}) {
  return awinSelector.select(promotions, { sentItemIds, storeIds: parseAdvertiserIds(advertiserIds), keyword, now, limit })
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
  return hasMinimumTimeLeft(row.endDate, { now, minRemainingMs: AWIN_MIN_REMAINING_MS })
}
