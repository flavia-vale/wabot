// Aritmética PURA dos Cards do Financeiro (aba admin).
//
// Extraído da rota GET /finance/overview para ser testável sem banco. Existe
// porque a receita de assinatura recorrente tem DOIS caminhos de aprovação e
// só um grava em `Payment` (ver comentário na rota) — somar as duas fontes
// (avulso em `Payment` + `SubscriptionCharge`) é exatamente o ponto que
// tinha ficado sem cobertura e escondia receita real dos Cards.

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

/**
 * Combina a receita avulsa (Payment) com a de assinatura (SubscriptionCharge)
 * para o mesmo recorte de tempo. As duas fontes NUNCA se sobrepõem: avulso
 * exclui `mpPaymentId` com prefixo `sub_` na própria query, e SubscriptionCharge
 * é gravada nos dois caminhos de aprovação de assinatura — nenhuma cobrança
 * aprovada fica de fora e nenhuma é contada duas vezes.
 */
export function combineRevenueTotals({ oneTimeAmount = 0, oneTimeCount = 0, subscriptionAmount = 0, subscriptionCount = 0 } = {}) {
  return {
    amount: round2((oneTimeAmount || 0) + (subscriptionAmount || 0)),
    count: (oneTimeCount || 0) + (subscriptionCount || 0),
  }
}

/** Clientes pagantes distintos, contando quem pagou por qualquer um dos dois caminhos uma vez só. */
export function countDistinctPayingUsers(oneTimeUserIds = [], subscriptionUserIds = []) {
  return new Set([...oneTimeUserIds, ...subscriptionUserIds]).size
}

export function computeAverageLtv(totalLtv, payingUsers) {
  return payingUsers ? round2(totalLtv / payingUsers) : 0
}

/** Taxa do Mercado Pago sobre a base combinada (avulso via MP + assinatura, que é sempre MP). */
export function computeMercadoPagoFees({ baseAmount = 0, baseCount = 0, feePercent = 0, feeFixedCents = 0 } = {}) {
  return round2((baseAmount || 0) * (feePercent / 100) + ((baseCount || 0) * (feeFixedCents || 0)) / 100)
}

export function computeNetRevenue({ grossRevenue = 0, affiliateCommissions = 0, mpFees = 0 } = {}) {
  return round2((grossRevenue || 0) - (affiliateCommissions || 0) - (mpFees || 0))
}
