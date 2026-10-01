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
// Decisão (dona do produto, 27/09, revista no mesmo dia): as recusas do
// antifraude aconteciam TAMBÉM no avulso, então esconder a recorrência no
// primeiro pagamento não atacava a causa. A cobrança automática volta a ser
// oferecida desde o primeiro pagamento, como opção ao lado do avulso (avulso
// primeiro, porque aceita Pix). O que fica desta regra: para quem JÁ tem
// acesso pago, a recorrência começa no fim do período pago (nunca duas
// cobranças pelo mesmo mês) e, com renovação ligada, não se oferece de novo.
// Limite honesto: a criação de assinatura no Mercado Pago (`/preapproval`)
// só recebe o e-mail da pagadora; nome, telefone e CPF são digitados por ela
// na tela do próprio Mercado Pago. Os dados completos que passamos a mandar
// valem para o avulso (`checkoutPayer.js`).
//
// REVISTO 01/10/2026 (dado de produção, `diag-antifraude-mp.mjs --days=30`):
// a premissa "as recusas aconteciam TAMBÉM no avulso" estava errada. A 1ª
// cobrança da assinatura chega do MP como `operation_type=regular_payment`
// (igual ao avulso); o que a separa é `point_of_interaction.type=SUBSCRIPTIONS`.
// Separando por ele: das 9 contas recusadas por suspeita em 30 dias, 8
// começaram pela cobrança automática e TODAS foram recusadas na 1ª tentativa
// (~3 aprovadas × ~12 recusadas). No avulso: ~38 aprovadas × 6 recusadas, e 6
// das 8 pagaram o avulso minutos depois da recusa. Decisão: no PRIMEIRO
// pagamento só o avulso (Pix ou cartão); a cobrança automática é oferecida a
// quem já tem período pago e começa no vencimento. A rota
// `/create-subscription` aplica a mesma regra (`canStartSubscription`).

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
    note: 'Depois do primeiro pagamento você pode ligar a renovação automática no cartão, começando no vencimento.',
  }
}

/**
 * A rota de assinatura só cria checkout para quem já tem período pago — a
 * mesma regra da tela, aplicada no servidor para que tela antiga em cache ou
 * chamada direta não volte a mandar ninguém para a cobrança imediata que o
 * antifraude do MP recusa (ver o topo deste arquivo).
 * @returns {{ allowed: true, startDate: Date } | { allowed: false, code: string, message: string }}
 */
export function canStartSubscription({ plan, accessExpiresAt, now = new Date() } = {}) {
  const startDate = subscriptionStartDate({ plan, accessExpiresAt, now })
  if (startDate) return { allowed: true, startDate }
  return {
    allowed: false,
    code: 'SUBSCRIPTION_REQUIRES_PAID_PERIOD',
    message: 'Faça o primeiro pagamento por Pix ou cartão. Depois dele você pode ligar a renovação automática, começando no vencimento.',
  }
}
