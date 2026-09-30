// Núcleo comum das promoções como ORIGEM das ofertas automáticas (Awin hoje;
// Lomadee e Rakuten no mesmo modelo — docs/plano-integracao-lomadee.md 13.2).
// Só regra PURA: sem banco, sem I/O e sem node:crypto (é importado pelo
// painel via awinOffers.js). Cada origem diz como ler os seus campos.
//
// Regra de envio (aprovada 2026-09-29, docs/rca/afiliados-awin.md):
// - cada promoção sai UMA vez por automação (sentItemIds);
// - identidade = LOJA + PÁGINA DA LOJA (ou título, sem página), nunca o
//   número do provedor (RCA das promoções "repetidas" da Arno: mesmo produto
//   publicado uma vez por voltagem, com números diferentes e a mesma página);
// - revezando entre as lojas (uma de cada loja por vez);
// - dentro de cada loja, primeiro a que vence antes; empate pelo hash do
//   número (varia a linha de produto e é sempre o mesmo);
// - nunca envia promoção que vence em menos de 1h nem que ainda não começou;
// - filtro opcional por lojas e por palavra (título ou descrição, sem acento).

export const PROMOTION_MIN_REMAINING_MS = 60 * 60_000

// Nome do campo de cada dado na linha guardada da origem.
// id = número da promoção no provedor (só desempate e id antigo).
export const DEFAULT_PROMOTION_FIELDS = Object.freeze({
  id: 'promotionId',
  store: 'advertiserId',
  storeName: 'advertiserName',
  title: 'title',
  description: 'description',
  page: 'url',
  start: 'startDate',
  end: 'endDate',
  status: 'status',
})

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function normalizedTitle(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, ' ').trim()
}

// host + caminho, sem www., query ou barra final.
export function normalizedStorePage(value) {
  try {
    const url = new URL(String(value ?? '').trim())
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    const path = decodeURIComponent(url.pathname).toLowerCase().replace(/\/+$/, '')
    return host ? `${host}${path}` : null
  } catch {
    return null
  }
}

// FNV-1a 32 bits: curto e sem depender de node:crypto.
export function shortHash(text) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}

export function promotionTime(value) {
  if (!value) return null
  const at = new Date(value).getTime()
  return Number.isFinite(at) ? at : null
}

// "Válida até 29/09 às 23:59" no horário de Brasília.
export function formatPromotionValidity(endDate) {
  const at = promotionTime(endDate)
  if (at == null) return ''
  const parts = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(at)).map((part) => [part.type, part.value]))
  return `Válida até ${parts.day}/${parts.month} às ${parts.hour}:${parts.minute}`
}

// Sem data de fim = vale; com data, precisa de pelo menos minRemainingMs.
export function hasMinimumTimeLeft(endDate, { now = new Date(), minRemainingMs = PROMOTION_MIN_REMAINING_MS } = {}) {
  const end = promotionTime(endDate)
  return end == null || end - now.getTime() >= minRemainingMs
}

// Identidade e seleção de UMA origem. prefix vira o começo do itemId
// (`<prefix>:c:<loja>:u:<hash da página>`).
export function createPromotionSelector({ prefix, fields = {}, minRemainingMs = PROMOTION_MIN_REMAINING_MS, activeStatus = 'active' } = {}) {
  if (!prefix) throw new Error('createPromotionSelector: prefix obrigatório')
  const f = { ...DEFAULT_PROMOTION_FIELDS, ...fields }

  const titleKey = (promotion) => `${promotion[f.store]}:${shortHash(normalizedTitle(promotion[f.title]))}`
  const contentKey = (promotion) => {
    const page = normalizedStorePage(promotion[f.page])
    return page ? `${promotion[f.store]}:u:${shortHash(page)}` : titleKey(promotion)
  }
  const itemId = (promotion) => `${prefix}:c:${contentKey(promotion)}`
  // Formato por título (1ª correção da Awin) e o antigo, pelo número.
  const titleItemId = (promotion) => `${prefix}:c:${titleKey(promotion)}`
  const legacyItemId = (promotion) => `${prefix}:${promotion[f.id]}`

  const promotionId = (promotion) => String(promotion[f.id])
  const tieBreak = (a, b) => shortHash(promotionId(a)).localeCompare(shortHash(promotionId(b))) || promotionId(a).localeCompare(promotionId(b))
  const endOrInfinity = (promotion) => promotionTime(promotion[f.end]) ?? Number.POSITIVE_INFINITY
  const byEnd = (a, b) => endOrInfinity(a) - endOrInfinity(b) || tieBreak(a, b)

  const matchesKeyword = (promotion, keyword) => {
    const words = normalizeText(keyword).split(/\s+/).filter(Boolean)
    if (!words.length) return true
    const haystack = normalizeText(`${promotion[f.title]} ${promotion[f.description] ?? ''}`)
    return words.every((word) => haystack.includes(word))
  }

  // storeIds já normalizados pela origem (lista de strings; vazia = todas).
  function select(promotions, { sentItemIds = [], storeIds = [], keyword = '', now = new Date(), limit = 5 } = {}) {
    const nowMs = now.getTime()
    const sent = new Set(sentItemIds.map(String))
    // Já saiu = qualquer formato de id que esta promoção já teve. E tudo que
    // tem o mesmo conteúdo dela (a outra voltagem, a cópia) também já saiu.
    const wasSent = (promotion) => sent.has(itemId(promotion)) || sent.has(titleItemId(promotion)) || sent.has(legacyItemId(promotion))
    const sentContent = new Set(promotions.filter(wasSent).map(contentKey))
    const allowedStores = new Set(storeIds.map(String))
    const filtered = promotions.filter((promotion) => {
      const status = promotion[f.status]
      if (status && status !== activeStatus) return false
      const start = promotionTime(promotion[f.start])
      if (start != null && start > nowMs) return false
      const end = promotionTime(promotion[f.end])
      if (end != null && end - nowMs < minRemainingMs) return false
      if (wasSent(promotion) || sentContent.has(contentKey(promotion))) return false
      if (allowedStores.size && !allowedStores.has(String(promotion[f.store]))) return false
      return matchesKeyword(promotion, keyword)
    })

    // Uma só por conteúdo (loja + página): fica a que vence antes.
    const seenContent = new Set()
    const eligible = [...filtered].sort(byEnd).filter((promotion) => {
      const key = contentKey(promotion)
      if (seenContent.has(key)) return false
      seenContent.add(key)
      return true
    })

    // eligible já está em ordem de validade: cada fila de loja também fica.
    const byStore = new Map()
    for (const promotion of eligible) {
      const key = String(promotion[f.store])
      if (!byStore.has(key)) byStore.set(key, [])
      byStore.get(key).push(promotion)
    }
    const queues = [...byStore.values()]
    // A loja cuja próxima promoção vence antes abre a rodada.
    queues.sort((a, b) => endOrInfinity(a[0]) - endOrInfinity(b[0]) || String(a[0][f.storeName]).localeCompare(String(b[0][f.storeName])))

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

  // tieBreak/matchesKeyword/byEnd expostos para a origem que precisa de uma
  // seleção própria (Awin: revezamento por loja + página inicial → título).
  return { contentKey, titleKey, itemId, titleItemId, legacyItemId, select, tieBreak, matchesKeyword, byEnd }
}
