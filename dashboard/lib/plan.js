export function isTrialActive(planSubject) {
  if (planSubject?.plan !== 'trial' || !planSubject?.accessExpiresAt) return false
  const expiresAt = new Date(planSubject.accessExpiresAt)
  return !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date()
}

// Premium entra junto (mesma regra de hasProLikeAccess e do backend): a cópia
// antiga esquecia o premium e mostrava a tela de venda a quem já tem acesso.
export function canAccessAdvancedPreservation(planSubject) {
  return planSubject?.plan === 'pro' || planSubject?.plan === 'premium' || isTrialActive(planSubject)
}
