// Delega para getPlanEntitlements (src/billing/plans.js) — MESMA fonte que o
// backend usa para o gate de plano (FR-015/FR-015a,
// specs/018-unificar-protecao-anti-ban): Pro, Premium ou Trial ativo liberam
// canais, Anti-banimento, ofertas automáticas e filas. Não duplicar a regra
// de Trial ativo aqui — é exatamente essa duplicação que deixou o Premium
// bloqueado na tela antiga de Preservação (dashboard/lib/plan.js, removida).
// A autoridade é sempre o backend (403/402 FEATURE_REQUIRES_PRO) — aqui é só
// para a UI decidir entre a feature e o paywall.
import { getPlanEntitlements } from '../../src/billing/plans.js'

export function hasProLikeAccess({ plan, accessExpiresAt } = {}) {
  return getPlanEntitlements({ plan, accessExpiresAt }).canUseChannels
}

export function hasInstagramStoriesAccess({ plan, accessExpiresAt } = {}) {
  if (plan !== 'premium') return false
  if (!accessExpiresAt) return true
  const expiresAt = new Date(accessExpiresAt)
  return !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date()
}
