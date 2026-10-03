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

/**
 * Classifica quem NÃO renovou (pagou uma vez só e o acesso pago já venceu além
 * da carência) — a MESMA conta de `scripts/diag-motivo-nao-renovou.mjs`, agora
 * também usada pela rota `GET /finance/churn`. A decisão de cada cliente
 * continua em `classifyChurnReason`; aqui só se monta a entrada dela.
 *
 * `customers` vem de `buildLtvReport(...).customers` (ltvRetention.js).
 */
export function classifyNonRenewals(customers = [], { subscriptions = [], charges = [] } = {}) {
  const subsByUser = new Map()
  for (const s of subscriptions) {
    if (!subsByUser.has(s.userId)) subsByUser.set(s.userId, [])
    subsByUser.get(s.userId).push(s)
  }
  const chargesByUser = new Map()
  for (const c of charges) {
    if (!chargesByUser.has(c.userId)) chargesByUser.set(c.userId, [])
    chargesByUser.get(c.userId).push(c)
  }
  return customers
    .filter((c) => !c.renewed && c.status === 'cancelada')
    .map((c) => {
      const subs = subsByUser.get(c.userId) || []
      const everHadAutopay = subs.length > 0
      const explicitCancel = subs.some((s) => s.status === 'cancelled' && s.cancelledAt)
      const hadRejectedChargeAfterFirstPayment = (chargesByUser.get(c.userId) || [])
        .some((ch) => ch.attemptedAt >= c.firstPaidAt && ch.status === 'rejected')
      const reason = classifyChurnReason({ everHadAutopay, explicitCancel, hadRejectedChargeAfterFirstPayment })
      return { ...c, reason }
    })
}

/** Grupo leigo de cada motivo: voluntário × involuntário × sem como afirmar. */
export function churnGroupOf(reason) {
  if (reason === CHURN_REASONS.VOLUNTARIO) return 'voluntario'
  if (reason === CHURN_REASONS.INVOLUNTARIO) return 'involuntario'
  return 'incerto'
}

/**
 * Resumo para a tela: total por motivo e, por mês em que o acesso pago venceu
 * (`coverageEnd`), só dos últimos `months` meses. `monthKey` é injetado
 * (`monthKeyOf`) para o módulo continuar sem dependências.
 */
export function buildChurnReport(classified = [], { now = new Date(), months = 6, monthKey } = {}) {
  const keyOf = monthKey ?? ((d) => new Date(d).toISOString().slice(0, 7))
  const nowDate = new Date(now)
  const span = Math.min(24, Math.max(1, Math.floor(Number(months)) || 6))
  const reasons = Object.values(CHURN_REASONS)
  const zeros = () => Object.fromEntries(reasons.map((r) => [r, 0]))
  const rows = []
  for (let i = span - 1; i >= 0; i -= 1) {
    const month = keyOf(new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() - i, 15)))
    rows.push({ month, voluntario: 0, involuntario: 0, incerto: 0, total: 0, byReason: zeros() })
  }
  const rowByMonth = new Map(rows.map((r) => [r.month, r]))
  const byReason = zeros()
  let total = 0
  for (const c of classified) {
    if (!c.coverageEnd) continue
    const row = rowByMonth.get(keyOf(c.coverageEnd))
    if (!row) continue
    row[churnGroupOf(c.reason)] += 1
    row.total += 1
    row.byReason[c.reason] += 1
    byReason[c.reason] += 1
    total += 1
  }
  return {
    months: span,
    total,
    byReason: reasons.map((reason) => ({ reason, count: byReason[reason], label: describeChurnReason(reason), group: churnGroupOf(reason) })),
    monthly: rows,
    note: 'Conta só quem pagou uma vez e deixou o acesso pago vencer (passada a carência). Involuntário = cobrança automática recusada; voluntário = cancelou a cobrança no painel; o resto não dá para afirmar.',
  }
}
