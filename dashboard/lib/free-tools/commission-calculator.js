// Calculadora de comissão e retorno do afiliado (A9 / EG-29).
//
// Matemática pura sobre números que a PRÓPRIA pessoa informa. Os valores
// iniciais são só um exemplo para a tela não abrir vazia: não são média de
// mercado nem resultado de cliente, e a página diz isso.

export const DEFAULT_INPUTS = Object.freeze({
  monthlyClicks: 1500,
  conversionRatePct: 2,
  averageTicket: 90,
  commissionRatePct: 5,
  monthlyCost: 69,
})

export const INPUT_LIMITS = Object.freeze({
  monthlyClicks: { min: 0, max: 10_000_000 },
  conversionRatePct: { min: 0, max: 100 },
  averageTicket: { min: 0, max: 100_000 },
  commissionRatePct: { min: 0, max: 100 },
  monthlyCost: { min: 0, max: 100_000 },
})

function toFiniteNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function clampCommissionInput(key, value) {
  const limits = INPUT_LIMITS[key]
  const fallback = DEFAULT_INPUTS[key] ?? 0
  const number = toFiniteNumber(value, fallback)
  if (!limits) return number
  return Math.min(limits.max, Math.max(limits.min, number))
}

export function sanitizeCommissionInputs(inputs = {}) {
  return Object.fromEntries(
    Object.keys(DEFAULT_INPUTS).map((key) => [key, clampCommissionInput(key, inputs[key])]),
  )
}

export function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(Number(value || 0))
}

/**
 * @returns {{
 *   orders: number, soldValue: number, commission: number,
 *   netResult: number, roiPct: number|null,
 *   commissionPerOrder: number, breakEvenOrders: number|null,
 *   breakEvenClicks: number|null, coversCost: boolean,
 * }}
 */
export function calculateAffiliateCommission(rawInputs = {}) {
  const { monthlyClicks, conversionRatePct, averageTicket, commissionRatePct, monthlyCost } = sanitizeCommissionInputs(rawInputs)

  const orders = monthlyClicks * (conversionRatePct / 100)
  const soldValue = orders * averageTicket
  const commission = soldValue * (commissionRatePct / 100)
  const netResult = commission - monthlyCost
  const roiPct = monthlyCost > 0 ? (netResult / monthlyCost) * 100 : null

  const commissionPerOrder = averageTicket * (commissionRatePct / 100)
  const breakEvenOrders = commissionPerOrder > 0 ? monthlyCost / commissionPerOrder : null
  const breakEvenClicks = breakEvenOrders !== null && conversionRatePct > 0
    ? breakEvenOrders / (conversionRatePct / 100)
    : null

  return {
    orders,
    soldValue,
    commission,
    netResult,
    roiPct,
    commissionPerOrder,
    breakEvenOrders,
    breakEvenClicks,
    coversCost: commission >= monthlyCost,
  }
}
