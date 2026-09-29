// Pré-pago de 3 e 6 meses (B11) — módulo PURO.
//
// Decisão da dona do produto (28/09/2026): 3 meses com 4% de desconto e 6
// meses com 7%. NÃO há 12 meses. O preço é sempre calculado AQUI, no servidor,
// a partir do preço mensal do plano; a tela nunca manda valor.
//
// Duas regras de segurança que não podem regredir:
//  1. A flag `BILLING_PREPAID_ENABLED` só governa CRIAR checkout pré-pago. Ao
//     PROCESSAR um pagamento (webhook, callback, reconciliação) a flag é
//     ignorada: quem pagou 3 meses antes de a flag ser desligada recebe os 3
//     meses. Senão, desligar a flag comeria o acesso de quem já pagou.
//  2. Só se concedem meses extras quando o valor que o Mercado Pago aprovou é
//     IGUAL ao total que o servidor gravou no `metadata` da preferência. Valor
//     diferente cai em 1 mês (o comportamento de sempre): nunca se dá acesso
//     longo por um pagamento que não bate.

export const PREPAID_DISCOUNT_PCT_BY_MONTHS = Object.freeze({ 3: 4, 6: 7 })
export const PREPAID_MONTHS = Object.freeze(Object.keys(PREPAID_DISCOUNT_PCT_BY_MONTHS).map(Number))
export const DAYS_PER_MONTH = 30

const CENT_TOLERANCE = 0.005

export function isPrepaidEnabled(env = process.env) {
  return String(env?.BILLING_PREPAID_ENABLED ?? '').trim().toLowerCase() === 'true'
}

function roundCents(value) {
  return Math.round(Number(value) * 100) / 100
}

/**
 * @returns {null | { months: number, days: number, discountPct: number, monthlyPrice: number, fullPrice: number, total: number, savings: number }}
 */
export function buildPrepaidOffer({ months, monthlyPrice } = {}) {
  const m = Number(months)
  const price = Number(monthlyPrice)
  const discountPct = PREPAID_DISCOUNT_PCT_BY_MONTHS[m]
  if (!discountPct || !Number.isFinite(price) || price <= 0) return null
  const fullPrice = roundCents(price * m)
  const total = roundCents(fullPrice * (1 - discountPct / 100))
  return {
    months: m,
    days: m * DAYS_PER_MONTH,
    discountPct,
    monthlyPrice: price,
    fullPrice,
    total,
    savings: roundCents(fullPrice - total),
  }
}

/** Metadata gravado na preferência do Mercado Pago (nada vem da tela). */
export function buildPrepaidMetadata(offer) {
  if (!offer) return {}
  return { months: offer.months, prepaid_total: offer.total }
}

/**
 * Quantos meses conceder e qual valor registrar, a partir do que o Mercado
 * Pago devolveu. Sem metadata válida, ou com valor que não bate: 1 mês e o
 * preço mensal (comportamento anterior, intocado).
 *
 * @returns {{ months: number, days: number, amount: number, prepaid: boolean }}
 */
export function resolvePurchaseTerms({ metadataMonths, metadataPrepaidTotal, paidAmount, monthlyPrice } = {}) {
  const single = { months: 1, days: DAYS_PER_MONTH, amount: Number(monthlyPrice), prepaid: false }
  const months = Number(metadataMonths)
  if (!PREPAID_DISCOUNT_PCT_BY_MONTHS[months]) return single

  const declaredTotal = Number(metadataPrepaidTotal)
  const paid = Number(paidAmount)
  if (!Number.isFinite(declaredTotal) || !Number.isFinite(paid)) return single
  if (Math.abs(declaredTotal - paid) > CENT_TOLERANCE) return single

  return { months, days: months * DAYS_PER_MONTH, amount: roundCents(paid), prepaid: true }
}
