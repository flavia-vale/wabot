// Saldo do afiliado (009-affiliate-improvements-r1, US1). Módulo puro, sem
// acesso a DB/env — recebe linhas já agregadas/consultadas pelo chamador.
//
// Saldo devedor: derivado do AffiliateCommissionLedger (append-only), nunca
// uma coluna mutável (ver research.md R1). Lançamentos toStatus='debt' têm
// amountCents negativo (dívida criada por estorno de comissão já paga);
// toStatus='debt_settled' têm amountCents positivo (amortização no repasse
// seguinte). O piso é 0 — nunca "sobra" crédito por amortização em excesso.
//
// Saldo disponível: soma das comissões elegíveis/aprovadas (ainda não pagas),
// que é o que o afiliado pode sacar.

const DEBT_TO_STATUS = 'debt'
const DEBT_SETTLED_TO_STATUS = 'debt_settled'
const AVAILABLE_STATUSES = new Set(['eligible', 'approved'])

/**
 * @param {{ ledgerRows: Array<{ toStatus: string, amountCents: number }> }} params
 * @returns {number} dívida em centavos, piso em 0
 */
export function computeDebtCents({ ledgerRows = [] } = {}) {
  let debt = 0
  let settled = 0
  for (const row of ledgerRows) {
    const amount = Number(row?.amountCents) || 0
    if (row?.toStatus === DEBT_TO_STATUS) debt += -amount
    else if (row?.toStatus === DEBT_SETTLED_TO_STATUS) settled += amount
  }
  return Math.max(0, debt - settled)
}

/**
 * @param {{ commissionRows: Array<{ status: string, commissionAmountCents: number }> }} params
 * @returns {number} saldo disponível em centavos (comissões eligible/approved)
 */
export function computeAvailableCents({ commissionRows = [] } = {}) {
  let total = 0
  for (const row of commissionRows) {
    if (AVAILABLE_STATUSES.has(row?.status)) total += Number(row?.commissionAmountCents) || 0
  }
  return total
}
