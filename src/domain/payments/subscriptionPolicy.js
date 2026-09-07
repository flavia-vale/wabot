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
 * Janela em que um checkout de assinatura ainda vale a pena reaproveitar.
 * Passou disso, a pessoa desistiu faz tempo e um link novo é mais honesto.
 */
export const SUBSCRIPTION_REUSE_MAX_AGE_MS = 24 * 60 * 60 * 1000

/**
 * Decide se um checkout de assinatura ainda em aberto deve ser REAPROVEITADO
 * em vez de criar outro idêntico.
 *
 * RCA 2026-09 ("pagamento recusado" no checkout recorrente): o antifraude do
 * Mercado Pago recusa tentativas seguidas com parâmetros iguais ou muito
 * parecidos — ele lê a repetição como cobrança duplicada. Como `pending` de
 * propósito não bloqueia, cada clique em "Assinar" criava um preapproval NOVO
 * com exatamente os mesmos dados (mesmo valor, mesmo e-mail, mesma descrição,
 * mesma conta). Quem tentava de novo depois de uma recusa alimentava
 * justamente o padrão que gera a recusa. Reaproveitar o checkout que já existe
 * é o controle que o próprio MP recomenda.
 *
 * Continua valendo a invariante de que `pending` NUNCA trava a conta: fora da
 * janela, com plano diferente, sem identificador do provedor ou sem data
 * confiável, a resposta é criar um checkout novo.
 *
 * @returns {{ reuse: boolean, reason: string }}
 */
export function decidePendingSubscriptionReuse({
  subscription,
  plan,
  now = new Date(),
  maxAgeMs = SUBSCRIPTION_REUSE_MAX_AGE_MS,
} = {}) {
  if (!subscription) return { reuse: false, reason: 'no_pending' }
  if (normalizeStatus(subscription.status) !== 'pending') return { reuse: false, reason: 'not_pending' }
  if (!subscription.mpSubscriptionId) return { reuse: false, reason: 'no_provider_id' }
  if (plan && subscription.plan && normalizeStatus(subscription.plan) !== normalizeStatus(plan)) {
    return { reuse: false, reason: 'plan_changed' }
  }

  const startedAt = toDate(subscription.updatedAt) ?? toDate(subscription.createdAt)
  if (!startedAt) return { reuse: false, reason: 'no_timestamp' }

  const ageMs = ((toDate(now) ?? new Date()).getTime()) - startedAt.getTime()
  if (!Number.isFinite(ageMs)) return { reuse: false, reason: 'no_timestamp' }
  if (ageMs > Math.max(0, Number(maxAgeMs) || 0)) return { reuse: false, reason: 'too_old' }

  return { reuse: true, reason: 'reusable_pending' }
}

/**
 * Intervalo mínimo antes de recriar um checkout idêntico depois de tentativas
 * seguidas que não deram em pagamento.
 *
 * Medido no caso real (2026-09-07): a cliente criou TRÊS checkouts do mesmo
 * plano em 57 minutos (09:05, 09:08, 10:02) e viu a recusa do antifraude no
 * terceiro. O reaproveitamento acima cobre o segundo (o primeiro ainda estava
 * em aberto às 09:08), mas NÃO o terceiro: às 10:02 os dois anteriores já
 * tinham sido encerrados pela reconciliação, então não havia o que
 * reaproveitar e um checkout novo e idêntico nascia mesmo assim.
 *
 * Não dá para decidir isso pela recusa em si: o Mercado Pago não nos manda
 * aviso de pagamento recusado nesse fluxo e a tabela de pagamentos da conta
 * fica vazia. O sinal que TEMOS é a repetição — vários checkouts do mesmo
 * plano em pouco tempo, nenhum virando assinatura ativa.
 */
export const SUBSCRIPTION_ATTEMPT_WINDOW_MS = 6 * 60 * 60 * 1000
export const SUBSCRIPTION_ATTEMPT_MAX = 2
export const SUBSCRIPTION_ATTEMPT_COOLDOWN_MS = 2 * 60 * 60 * 1000

/**
 * Decide se uma NOVA tentativa de assinar deve esperar.
 *
 * Segurar a terceira tentativa protege a própria cliente: cada checkout
 * idêntico a mais piora a leitura do antifraude, e insistir é o caminho mais
 * rápido para nenhuma tentativa passar. A espera é sempre LIMITADA e o
 * pagamento avulso continua aberto — a conta nunca fica sem forma de pagar.
 *
 * Fail-safe em tudo: sem lista confiável, com assinatura ativa no meio, ou com
 * teto desligado (`maxAttempts <= 0`), a resposta é DEIXAR TENTAR. Barrar por
 * dúvida seria impedir uma compra legítima.
 *
 * @returns {{ wait: boolean, reason: string, retryAt: Date|null, attempts: number }}
 */
export function decideSubscriptionAttemptCooldown({
  recentSubscriptions,
  plan,
  now = new Date(),
  windowMs = SUBSCRIPTION_ATTEMPT_WINDOW_MS,
  maxAttempts = SUBSCRIPTION_ATTEMPT_MAX,
  cooldownMs = SUBSCRIPTION_ATTEMPT_COOLDOWN_MS,
} = {}) {
  const allow = (reason, attempts = 0) => ({ wait: false, reason, retryAt: null, attempts })

  const limit = Number(maxAttempts)
  if (!Number.isFinite(limit) || limit <= 0) return allow('cooldown_disabled')
  if (!Array.isArray(recentSubscriptions) || recentSubscriptions.length === 0) return allow('no_history')

  const nowDate = toDate(now) ?? new Date()
  const windowStart = nowDate.getTime() - Math.max(0, Number(windowMs) || 0)

  let attempts = 0
  let lastAttemptAt = null
  for (const subscription of recentSubscriptions) {
    // Assinatura valendo no meio da janela significa que a conta consegue
    // pagar — quem barra a segunda assinatura é `blocksNewSubscription`.
    if (isSubscriptionActive(subscription?.status)) return allow('has_active_subscription')

    if (plan && subscription?.plan && normalizeStatus(subscription.plan) !== normalizeStatus(plan)) continue

    const createdAt = toDate(subscription?.createdAt)
    if (!createdAt || createdAt.getTime() < windowStart) continue

    attempts += 1
    if (!lastAttemptAt || createdAt > lastAttemptAt) lastAttemptAt = createdAt
  }

  if (attempts < limit) return allow('under_limit', attempts)
  if (!lastAttemptAt) return allow('no_timestamp', attempts)

  const retryAt = new Date(lastAttemptAt.getTime() + Math.max(0, Number(cooldownMs) || 0))
  if (retryAt <= nowDate) return allow('cooldown_elapsed', attempts)

  return { wait: true, reason: 'too_many_recent_attempts', retryAt, attempts }
}

/**
 * Texto que a cliente lê quando a tentativa precisa esperar. Linguagem leiga
 * obrigatória, e três coisas que ele NUNCA pode deixar de dizer: que o cartão
 * dela não é o problema, quando ela pode tentar de novo, e que o pagamento
 * avulso continua disponível agora.
 */
export function describeSubscriptionCooldown(retryAt, now = new Date()) {
  const target = toDate(retryAt)
  const nowDate = toDate(now) ?? new Date()
  const minutes = target ? Math.max(1, Math.ceil((target.getTime() - nowDate.getTime()) / 60000)) : null
  const quando = minutes === null
    ? 'daqui a pouco'
    : minutes >= 60
      ? `daqui a ${Math.round(minutes / 60)} hora${Math.round(minutes / 60) > 1 ? 's' : ''}`
      : `daqui a ${minutes} minutos`

  return `Você abriu a cobrança automática algumas vezes seguidas e o banco costuma recusar quando isso se repete — não é problema com o seu cartão. Espere ${quando} para ligar a cobrança automática. Se preferir não esperar, o pagamento avulso continua disponível agora.`
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
