// O que a tela de plano oferece e em que ordem — módulo PURO.
//
// Dado (27/09/2026, `diag-assinatura-recusada.mjs --days=30` em produção): de
// 21 checkouts de cobrança automática, 4 ficaram ativos. 9 recusas vieram do
// ANTIFRAUDE do Mercado Pago na primeira cobrança da assinatura (a mesma
// pessoa pagou avulso minutos depois e foi aprovada — o cartão era bom); 7
// pessoas clicaram e não terminaram no MP (4 delas pagaram por Pix, que a
// assinatura do MP não aceita). Nenhuma venda se perdeu, mas quase ninguém
// ficou com renovação automática.
//
// Decisão (dona do produto, 27/09): o PRIMEIRO pagamento é sempre avulso (Pix
// ou cartão, o caminho que aprova). A renovação automática só é oferecida a
// quem já tem acesso pago, e começa a cobrar quando o período atual termina —
// nunca duas cobranças pelo mesmo mês. Hipótese a medir: com histórico de
// pagamento aprovado, o antifraude aceita a recorrência.

const PAID_PLANS = new Set(['basic', 'pro'])

function toDate(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatDay(date) {
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/** Acesso pago e ainda válido: só então faz sentido falar de renovação. */
export function hasPaidActiveAccess({ plan, accessExpiresAt, now = new Date() } = {}) {
  if (!PAID_PLANS.has(String(plan ?? '').toLowerCase())) return false
  const exp = toDate(accessExpiresAt)
  return Boolean(exp && exp.getTime() > (toDate(now) ?? new Date()).getTime())
}

/**
 * Data em que a cobrança automática deve COMEÇAR: o fim do período já pago.
 * `null` quando não há período pago válido (aí a assinatura começaria agora —
 * e é justamente o caso em que não a oferecemos).
 * @returns {Date|null}
 */
export function subscriptionStartDate({ plan, accessExpiresAt, now = new Date() } = {}) {
  if (!hasPaidActiveAccess({ plan, accessExpiresAt, now })) return null
  return toDate(accessExpiresAt)
}

/**
 * @param {{ plan?: string, isActive?: boolean, autoRenew?: boolean, accessExpiresAt?: string|Date, now?: Date }} overview
 * @returns {{
 *   mode: 'first_payment'|'renewal'|'auto_renew_on',
 *   primaryLabel: string,
 *   showAutoRenew: boolean,
 *   autoRenewLabel: string|null,
 *   autoRenewStartsAt: Date|null,
 *   note: string,
 * }}
 */
export function decideCheckoutOffer({ plan, isActive, autoRenew, accessExpiresAt, now = new Date() } = {}) {
  const paid = hasPaidActiveAccess({ plan, accessExpiresAt, now }) && isActive !== false

  if (paid && autoRenew) {
    return {
      mode: 'auto_renew_on',
      primaryLabel: 'Pagar uma vez',
      showAutoRenew: false,
      autoRenewLabel: null,
      autoRenewStartsAt: null,
      note: 'Sua renovação automática já está ligada. Pagar uma vez adianta o próximo período.',
    }
  }

  if (paid) {
    const startsAt = toDate(accessExpiresAt)
    return {
      mode: 'renewal',
      primaryLabel: 'Renovar agora (Pix ou cartão)',
      showAutoRenew: true,
      autoRenewLabel: 'Ligar renovação automática no cartão',
      autoRenewStartsAt: startsAt,
      note: `A primeira cobrança automática acontece em ${formatDay(startsAt)}, quando o período atual termina. Nada é cobrado duas vezes.`,
    }
  }

  return {
    mode: 'first_payment',
    primaryLabel: 'Pagar agora (Pix ou cartão)',
    showAutoRenew: false,
    autoRenewLabel: null,
    autoRenewStartsAt: null,
    note: 'Depois do primeiro pagamento você pode ligar a renovação automática no cartão, se quiser.',
  }
}
