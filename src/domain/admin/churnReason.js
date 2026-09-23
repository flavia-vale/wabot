/**
 * Motivo de churn — VOLUNTÁRIO x INVOLUNTÁRIO x AMBÍGUO (2026-09-23).
 *
 * Por que existe: `ltvRetention.js` já sabe se uma cliente renovou, mas não
 * sabe POR QUE quem não renovou não renovou. Sem essa separação, "17%
 * renovaram" não diz se o produto está perdendo cliente satisfeita (churn
 * involuntário — cobrança falhou) ou cliente insatisfeita (voluntário) ou se
 * é só o rastro do pagamento avulso pré-01/09 (ambíguo: pode ser esquecimento,
 * não dá para saber pela tabela).
 *
 * Metodologia (ProfitWell/Paddle Retain, Recurly — separar sempre os dois
 * antes de decidir o que fazer): involuntário se resolve com dunning/retry de
 * cobrança; voluntário se resolve com produto/preço/atendimento. Tratá-los
 * como uma coisa só mistura duas conversas diferentes.
 *
 * Categorias:
 * - `involuntario_cobranca_recusada`: teve cobrança automática (Subscription)
 *   e o Mercado Pago recusou pelo menos uma tentativa depois do 1º pagamento,
 *   sem cobrança aprovada depois dela.
 * - `voluntario_cancelou_no_painel`: cancelou a cobrança automática pelo
 *   próprio painel (`Subscription.cancelledAt`), sem recusa por trás.
 * - `ambiguo_avulso_sem_retentativa`: pagou avulso (sem NUNCA ter ligado a
 *   cobrança automática) e não repetiu a compra. Não afirma causa — pode ser
 *   esquecimento (histórico: renovar exigia refazer a compra à mão até
 *   01/09/2026) ou desistência silenciosa.
 * - `indeterminado`: teve cobrança automática, mas nem recusa nem cancelo
 *   explícito registrados — dado incompleto, investigar antes de agir.
 *
 * Módulo PURO: sem banco, sem rede. Quem chama já filtrou contas de teste e
 * já decidiu quem é "não renovou" (cohort madura o bastante para medir).
 */

export const CHURN_REASONS = Object.freeze({
  INVOLUNTARIO: 'involuntario_cobranca_recusada',
  VOLUNTARIO: 'voluntario_cancelou_no_painel',
  AMBIGUO_AVULSO: 'ambiguo_avulso_sem_retentativa',
  INDETERMINADO: 'indeterminado',
})

const LABELS = Object.freeze({
  [CHURN_REASONS.INVOLUNTARIO]: 'involuntário — cobrança automática recusada',
  [CHURN_REASONS.VOLUNTARIO]: 'voluntário — cancelou a cobrança automática no painel',
  [CHURN_REASONS.AMBIGUO_AVULSO]: 'ambíguo — pagou avulso e não repetiu a compra (pode ser esquecimento)',
  [CHURN_REASONS.INDETERMINADO]: 'indeterminado — teve cobrança automática sem recusa nem cancelamento registrados',
})

export function describeChurnReason(reason) {
  return LABELS[reason] ?? 'motivo desconhecido'
}

/**
 * @param {boolean} everHadAutopay - já teve alguma `Subscription` (recorrência ligada alguma vez)
 * @param {boolean} explicitCancel - existe `Subscription` com `status='cancelled'` e `cancelledAt`
 * @param {boolean} hadRejectedChargeAfterFirstPayment - `SubscriptionCharge.status==='rejected'` depois do 1º pagamento aprovado
 * @param {boolean} hadApprovedChargeAfterFirstPayment - alguma cobrança automática aprovada depois do 1º pagamento (se true, não é churn — quem chama já filtrou isso)
 */
export function classifyChurnReason({
  everHadAutopay = false,
  explicitCancel = false,
  hadRejectedChargeAfterFirstPayment = false,
} = {}) {
  if (!everHadAutopay) return CHURN_REASONS.AMBIGUO_AVULSO
  if (hadRejectedChargeAfterFirstPayment) return CHURN_REASONS.INVOLUNTARIO
  if (explicitCancel) return CHURN_REASONS.VOLUNTARIO
  return CHURN_REASONS.INDETERMINADO
}
