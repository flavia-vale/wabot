// Espelho client-side de getPlanEntitlements (src/billing/plans.js): Pro ou
// Trial ativo liberam canais, Preservação Avançada, ofertas automáticas e
// filas. A autoridade é sempre o backend (403 FEATURE_REQUIRES_PRO) — aqui é
// só para a UI decidir entre a feature e o paywall.
export function hasProLikeAccess({ plan, accessExpiresAt } = {}) {
  if (plan === 'pro' || plan === 'premium') return true
  if (plan !== 'trial' || !accessExpiresAt) return false
  const expiresAt = new Date(accessExpiresAt)
  return !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date()
}

export function hasInstagramStoriesAccess({ plan, accessExpiresAt } = {}) {
  if (plan !== 'premium') return false
  if (!accessExpiresAt) return true
  const expiresAt = new Date(accessExpiresAt)
  return !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date()
}
