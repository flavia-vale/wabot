/**
 * Regras puras da assinatura recorrente (Mercado Pago `preapproval`).
 *
 * Fica separado das rotas de propósito: decisão de cobrança é a parte que NÃO
 * pode depender de rede, banco ou hora do servidor para ser testada. Tudo aqui
 * é função pura, com `now` injetável.
 *
 * Status que o MP usa no preapproval: `pending` (criada, a pessoa ainda não
 * concluiu), `authorized` (valendo, cobra sozinha), `paused` e `cancelled`.
 */

/** Único status em que o MP cobra sozinho. */
export const SUBSCRIPTION_ACTIVE_STATUS = 'authorized'

/** Status em que ainda faz sentido consultar o MP (não é fim de linha). */
export const SUBSCRIPTION_OPEN_STATUSES = Object.freeze(['pending', 'authorized', 'paused'])

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeStatus(status) {
  return String(status ?? '').trim().toLowerCase()
}

export function isSubscriptionActive(status) {
  return normalizeStatus(status) === SUBSCRIPTION_ACTIVE_STATUS
}

/**
 * Uma conta não pode ter duas assinaturas cobrando ao mesmo tempo — seria
 * cobrar a mesma pessoa duas vezes por mês. `pending` NÃO bloqueia: é o
 * checkout que a pessoa abriu e abandonou, e barrar por causa dele deixaria a
 * conta sem conseguir assinar nunca mais.
 */
export function blocksNewSubscription(subscription) {
  return isSubscriptionActive(subscription?.status)
}

/**
 * @returns {{ ok: boolean, reason: 'ok'|'not_found'|'already_cancelled' }}
 */
export function decideSubscriptionCancellation(subscription) {
  if (!subscription) return { ok: false, reason: 'not_found' }
  const status = normalizeStatus(subscription.status)
  if (status === 'cancelled') return { ok: false, reason: 'already_cancelled' }
  return { ok: true, reason: 'ok' }
}

/**
 * Rede de segurança contra webhook perdido.
 *
 * O acesso é renovado quando chega o aviso de pagamento autorizado do MP. Se
 * esse aviso se perder (rede, deploy, fila), a cobrança acontece e o acesso
 * corta assim mesmo — a cliente paga e fica sem robô. Como o próprio MP diz
 * qual é a PRÓXIMA cobrança, o período já pago vai até essa data: quem tem
 * assinatura valendo deve ter acesso pelo menos até lá.
 *
 * Só ESTENDE, nunca encurta, e só para assinatura que está cobrando de fato.
 *
 * @returns {{ extend: boolean, until: Date|null, reason: string }}
 */
export function decideAccessExtensionFromSubscription({
  status,
  nextChargeAt,
  accessExpiresAt,
  now = new Date(),
} = {}) {
  if (!isSubscriptionActive(status)) return { extend: false, until: null, reason: 'not_active' }

  const nextCharge = toDate(nextChargeAt)
  if (!nextCharge) return { extend: false, until: null, reason: 'no_next_charge' }

  const nowDate = toDate(now) ?? new Date()
  if (nextCharge <= nowDate) return { extend: false, until: null, reason: 'next_charge_in_past' }

  const currentExpiry = toDate(accessExpiresAt)
  if (currentExpiry && currentExpiry >= nextCharge) {
    return { extend: false, until: null, reason: 'already_covered' }
  }

  return { extend: true, until: nextCharge, reason: currentExpiry ? 'access_behind_next_charge' : 'no_access_recorded' }
}

/**
 * Texto que a cliente lê. Linguagem leiga obrigatória nesta superfície: nada de
 * "preapproval", "authorized", "gateway" na tela.
 */
export function describeSubscriptionStatus(status) {
  switch (normalizeStatus(status)) {
    case 'authorized': return 'Renovação automática ligada'
    case 'pending': return 'Falta concluir no Mercado Pago'
    case 'paused': return 'Renovação automática pausada'
    case 'cancelled': return 'Renovação automática cancelada'
    default: return 'Sem renovação automática'
  }
}

/**
 * Resumo para o painel. Nunca devolve identificador do provedor — a tela não
 * precisa e ele não deve circular no navegador.
 */
export function summarizeSubscriptionForPanel(subscription) {
  if (!subscription) {
    return { hasSubscription: false, autoRenew: false, status: null, statusLabel: describeSubscriptionStatus(null), plan: null, nextChargeAt: null, cancelledAt: null, canCancel: false }
  }
  const status = normalizeStatus(subscription.status)
  const nextCharge = toDate(subscription.nextChargeAt)
  return {
    hasSubscription: true,
    autoRenew: isSubscriptionActive(status),
    status,
    statusLabel: describeSubscriptionStatus(status),
    plan: subscription.plan ?? null,
    nextChargeAt: nextCharge,
    cancelledAt: toDate(subscription.cancelledAt),
    canCancel: decideSubscriptionCancellation(subscription).ok,
  }
}
