// Cobrança do número reserva (vários números por conta, Fase 1 —
// docs/rca/multi-numero.md). Decisão da dona do produto (2026-10-03):
// ASSINATURA SEPARADA no Mercado Pago, só do adicional, R$29/mês.
//
// A assinatura do adicional mora na mesma tabela `Subscription`, com
// plan = 'extra_number', e vai ao MP com external_reference próprio. Regra de
// ouro: NADA do fluxo do plano (liberar/estender acesso, "uma assinatura por
// conta", aviso de cobrança recusada do plano, reconciliação) pode enxergar
// essa linha — todas as consultas do plano usam PLAN_SUBSCRIPTION_WHERE.
import { EXTRA_NUMBER_PRICE_CENTS } from '../multiNumber/waitlist.js'

export const EXTRA_NUMBER_PLAN = 'extra_number'
export const EXTRA_NUMBER_PRICE = EXTRA_NUMBER_PRICE_CENTS / 100
export const EXTRA_NUMBER_TITLE = 'Espelha Grupos · Número reserva'
const REFERENCE_PREFIX = 'addon:extra_number:'

// Filtro das consultas do PLANO: ignora a assinatura do adicional.
export const PLAN_SUBSCRIPTION_WHERE = Object.freeze({ plan: { not: EXTRA_NUMBER_PLAN } })

export function buildExtraNumberReference(userId) {
  const id = String(userId ?? '')
  if (!id || id.includes(':')) throw new Error('userId inválido para a referência do adicional')
  return `${REFERENCE_PREFIX}${id}`
}

// external_reference do MP → userId do adicional, ou null (referência do plano).
export function parseExtraNumberReference(reference) {
  const raw = String(reference ?? '')
  if (!raw.startsWith(REFERENCE_PREFIX)) return null
  const userId = raw.slice(REFERENCE_PREFIX.length)
  return userId && !userId.includes(':') ? userId : null
}

export function isExtraNumberSubscription(subscription) {
  return subscription?.plan === EXTRA_NUMBER_PLAN
}

// Quantos números extras a conta tem, dado o status da assinatura do
// adicional. Fase 1: no máximo 1. Pausada, cancelada ou pendente = 0.
export function extraNumbersForStatus(status) {
  return status === 'authorized' ? 1 : 0
}
