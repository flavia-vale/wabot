// Elegibilidade de solicitação de saque self-service (009-affiliate-improvements-r1,
// US2). Módulo puro, sem acesso a DB/env — recebe valores já calculados pelo
// chamador (affiliateBalance.js + reconsulta de pedido aberto).

/**
 * @param {{ availableCents: number, debtCents: number, minPayoutCents: number, hasOpenRequest: boolean }} params
 * @returns {{ ok: boolean, error?: string, reason?: 'open_request'|'debt_pending'|'below_minimum' }}
 */
export function canRequestPayout({ availableCents = 0, debtCents = 0, minPayoutCents = 0, hasOpenRequest = false } = {}) {
  // FR-014: no máximo um pedido em aberto por vez.
  if (hasOpenRequest) return { ok: false, reason: 'open_request', error: 'Você já tem uma solicitação de saque em aberto.' }
  // FR-013: saldo devedor pendente bloqueia novo saque (será abatido no próximo repasse).
  if (debtCents > 0) return { ok: false, reason: 'debt_pending', error: 'Você tem saldo devedor pendente; ele será descontado do seu próximo repasse.' }
  // FR-012: saldo abaixo do mínimo configurado.
  if (availableCents < minPayoutCents) {
    return { ok: false, reason: 'below_minimum', error: `Saldo disponível abaixo do valor mínimo de saque (R$ ${(minPayoutCents / 100).toFixed(2)}).` }
  }
  return { ok: true }
}
