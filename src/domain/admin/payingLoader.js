// Fonte ÚNICA de "quem já pagou" e "quem é pagante AGORA" no admin.
//
// Regra (docs/rca/admin.md, tag Pagante): pagante sai de PAGAMENTO APROVADO,
// nunca do campo `plan` — liberação manual e trial também escrevem `plan`.
// Pagamento aprovado chega por dois caminhos: `Payment` (avulso/checkout) e
// `SubscriptionCharge` (renovação recuperada pela reconciliação quando o
// webhook se perde — essa NUNCA grava `Payment`). Contar só um dos dois
// esconde pagante de verdade.
//
// Tudo aqui é em LOTE: um `groupBy` por lista ou um filtro de relação dentro
// do próprio `count`, nunca uma consulta por linha.

import { CHARGE_OUTCOME_STATUSES } from '../payments/chargeOutcome.js'

const APPROVED_PAYMENT_STATUSES = ['approved']
export const APPROVED_CHARGE_STATUSES = CHARGE_OUTCOME_STATUSES.aprovada

/** Cláusula Prisma (em `User`): já teve pagamento aprovado por qualquer caminho. */
export function everPaidWhere() {
  return {
    OR: [
      { payments: { some: { status: { in: APPROVED_PAYMENT_STATUSES } } } },
      { subscriptionCharges: { some: { status: { in: APPROVED_CHARGE_STATUSES } } } },
    ],
  }
}

/** Acesso em dia: sem validade (liberado sem prazo) ou validade no futuro — mesma regra de `resolvePayingStatus`. */
export function accessValidWhere(now = new Date()) {
  return { OR: [{ accessExpiresAt: null }, { accessExpiresAt: { gt: now } }] }
}

/** Pagante AGORA: conta ativa, já pagou e o acesso está em dia. */
export function currentPayingWhere(now = new Date()) {
  return { status: 'active', AND: [everPaidWhere(), accessValidWhere(now)] }
}

/** Já foi pagante: pagou e o acesso venceu (conversa de recuperação, não de venda). */
export function formerPayingWhere(now = new Date()) {
  return { AND: [everPaidWhere(), { accessExpiresAt: { lt: now } }] }
}

/** Pagante atual sem atividade desde `since` (ou nunca) — o "pagante parado". */
export function stalePayingWhere(now = new Date(), since) {
  return {
    status: 'active',
    AND: [everPaidWhere(), accessValidWhere(now), { OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: since } }] }],
  }
}

export async function loadEverPaidUserIds(db, userIds = []) {
  const ids = [...new Set((userIds ?? []).filter(Boolean))]
  if (!db?.payment?.groupBy || !ids.length) return new Set()
  try {
    const [paymentRows, chargeRows] = await Promise.all([
      db.payment.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, status: { in: APPROVED_PAYMENT_STATUSES } },
        _count: { _all: true },
      }),
      db.subscriptionCharge?.groupBy
        ? db.subscriptionCharge.groupBy({
            by: ['userId'],
            where: { userId: { in: ids }, status: { in: APPROVED_CHARGE_STATUSES } },
            _count: { _all: true },
          }).catch(() => [])
        : [],
    ])
    return new Set([...paymentRows, ...chargeRows].map(row => row.userId).filter(Boolean))
  } catch {
    // Falha aqui não pode derrubar a listagem: sem o dado, ninguém recebe a
    // tag (falta de tag é ausência de informação, tag errada é informação
    // falsa — e a segunda é pior).
    return new Set()
  }
}
