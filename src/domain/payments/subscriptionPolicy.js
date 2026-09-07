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

  // A idade é a do CHECKOUT, não a da linha. `updatedAt` é `@updatedAt` no
  // schema: a reconciliação horária e o webhook renovam esse campo sozinhos, e
  // com ele um checkout de dias atrás parecia recém-criado — a janela de 24h
  // nunca expirava e a cliente era devolvida para sempre ao mesmo link velho
  // (que também impede o freio entre tentativas de rodar, porque o
  // reaproveitamento responde antes).
  const startedAt = toDate(subscription.createdAt) ?? toDate(subscription.updatedAt)
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
 * Janela em que um checkout ainda recém-criado é consultado no MP sob demanda
 * (quando a cliente abre o painel), e intervalo mínimo entre duas consultas da
 * mesma assinatura.
 */
export const SUBSCRIPTION_PENDING_REFRESH_MAX_AGE_MS = 24 * 60 * 60 * 1000
export const SUBSCRIPTION_PENDING_REFRESH_MIN_INTERVAL_MS = 60 * 1000

/**
 * Decide se vale consultar o Mercado Pago AGORA para saber se um checkout
 * ainda marcado como `pending` já virou assinatura valendo.
 *
 * RCA 2026-09-07: a cliente concluía a assinatura, o Mercado Pago cobrava, o
 * acesso era liberado — e o painel continuava dizendo "você começou e não
 * terminou no Mercado Pago", porque quem sincroniza o status é uma passada de
 * HORA EM HORA. Ela lia isso logo depois de pagar, e no admin aparecia
 * "falta concluir" para uma conta que já tinha pago.
 *
 * A consulta é limitada de propósito: só checkout novo (dentro da janela) e no
 * máximo uma vez por minuto por assinatura — o painel é aberto muitas vezes e
 * isso não pode virar uma chamada ao provedor por carregamento de tela.
 *
 * @returns {{ refresh: boolean, reason: string }}
 */
export function shouldRefreshPendingSubscription({
  subscription,
  now = new Date(),
  maxAgeMs = SUBSCRIPTION_PENDING_REFRESH_MAX_AGE_MS,
  minIntervalMs = SUBSCRIPTION_PENDING_REFRESH_MIN_INTERVAL_MS,
} = {}) {
  if (!subscription) return { refresh: false, reason: 'no_subscription' }
  if (normalizeStatus(subscription.status) !== 'pending') return { refresh: false, reason: 'not_pending' }
  if (!subscription.mpSubscriptionId) return { refresh: false, reason: 'no_provider_id' }

  const nowDate = toDate(now) ?? new Date()
  const createdAt = toDate(subscription.createdAt)
  if (!createdAt) return { refresh: false, reason: 'no_timestamp' }
  if (nowDate.getTime() - createdAt.getTime() > Math.max(0, Number(maxAgeMs) || 0)) {
    return { refresh: false, reason: 'too_old' }
  }

  const lastSyncedAt = toDate(subscription.updatedAt) ?? createdAt
  if (nowDate.getTime() - lastSyncedAt.getTime() < Math.max(0, Number(minIntervalMs) || 0)) {
    return { refresh: false, reason: 'checked_recently' }
  }

  return { refresh: true, reason: 'pending_may_be_authorized' }
}

/**
 * Decide o status da assinatura depois de uma COBRANÇA aprovada do Mercado
 * Pago (aviso `subscription_authorized_payment`).
 *
 * Mesmo RCA: esse aviso liberava o acesso e **não encostava no status da
 * assinatura**. Quem só recebe o aviso da cobrança (e não o do preapproval)
 * ficava `pending` para sempre no nosso banco, mesmo cobrando todo mês — daí
 * "Renova manualmente" no painel e "falta concluir" no admin para quem já
 * estava pagando.
 *
 * O que o MP responde na consulta do preapproval é sempre a verdade e ganha de
 * tudo. Sem essa resposta (rede, token), a própria cobrança é prova de que a
 * assinatura estava valendo — mas isso só PROMOVE `pending`; assinatura
 * pausada ou cancelada nunca é ressuscitada por aqui.
 *
 * @returns {{ update: boolean, status: string|null, reason: string }}
 */
export function decideSubscriptionStatusFromCharge({ storedStatus, snapshotStatus } = {}) {
  const stored = normalizeStatus(storedStatus)
  const fromProvider = normalizeStatus(snapshotStatus)

  if (fromProvider) {
    if (fromProvider === stored) return { update: false, status: fromProvider, reason: 'already_in_sync' }
    return { update: true, status: fromProvider, reason: 'provider_status' }
  }

  if (stored === 'pending') return { update: true, status: SUBSCRIPTION_ACTIVE_STATUS, reason: 'charge_is_proof' }
  return { update: false, status: null, reason: 'no_provider_status' }
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
 * Um checkout `pending` tem DOIS significados opostos, e tratá-los com a mesma
 * frase foi o que fez uma cliente que já tinha pago ler "você não terminou":
 *
 *  - ninguém pagou nada depois de abrir o checkout → ela de fato parou no meio
 *    e precisa concluir (ou o avulso continua aberto);
 *  - já existe pagamento aprovado depois de o checkout nascer → o Mercado Pago
 *    cobrou, o acesso foi liberado e o que falta é só a confirmação chegar até
 *    nós. Nesse caso ela não tem NADA a fazer, e dizer o contrário faz a pessoa
 *    tentar assinar de novo — que é exatamente o que dispara a recusa do
 *    antifraude (ver `decideSubscriptionAttemptCooldown`).
 *
 * @returns {{ awaitingConfirmation: boolean, label: string, notice: string }|null}
 */
export function describePendingSubscriptionNotice({ status, subscriptionStartedAt, lastApprovedPaymentAt } = {}) {
  if (normalizeStatus(status) !== 'pending') return null

  const startedAt = toDate(subscriptionStartedAt)
  const paidAt = toDate(lastApprovedPaymentAt)
  const paidAfterStart = Boolean(paidAt && (!startedAt || paidAt.getTime() >= startedAt.getTime() - 5 * 60 * 1000))

  if (paidAfterStart) {
    return {
      awaitingConfirmation: true,
      label: 'Confirmando a renovação automática',
      notice: 'Recebemos seu pagamento e seu acesso já está liberado. Estamos confirmando a renovação automática com o Mercado Pago — isso costuma levar alguns minutos e você não precisa fazer nada. Não assine de novo.',
    }
  }

  return {
    awaitingConfirmation: false,
    label: describeSubscriptionStatus('pending'),
    notice: 'Você começou a ligar a cobrança automática e não terminou no Mercado Pago. Enquanto isso, a renovação continua manual.',
  }
}

/**
 * Resumo para o painel. Nunca devolve identificador do provedor — a tela não
 * precisa e ele não deve circular no navegador.
 */
export function summarizeSubscriptionForPanel(subscription, { lastApprovedPaymentAt = null } = {}) {
  if (!subscription) {
    return { hasSubscription: false, autoRenew: false, status: null, statusLabel: describeSubscriptionStatus(null), plan: null, nextChargeAt: null, cancelledAt: null, canCancel: false, awaitingConfirmation: false, notice: null }
  }
  const status = normalizeStatus(subscription.status)
  const nextCharge = toDate(subscription.nextChargeAt)
  const pendingNotice = describePendingSubscriptionNotice({
    status,
    subscriptionStartedAt: subscription.createdAt,
    lastApprovedPaymentAt,
  })
  return {
    hasSubscription: true,
    autoRenew: isSubscriptionActive(status),
    status,
    statusLabel: pendingNotice?.label ?? describeSubscriptionStatus(status),
    plan: subscription.plan ?? null,
    nextChargeAt: nextCharge,
    cancelledAt: toDate(subscription.cancelledAt),
    canCancel: decideSubscriptionCancellation(subscription).ok,
    awaitingConfirmation: Boolean(pendingNotice?.awaitingConfirmation),
    // A tela mostra ESTE texto — assim painel e admin nunca discordam sobre o
    // que dizer para a mesma assinatura.
    notice: pendingNotice?.notice ?? null,
  }
}
