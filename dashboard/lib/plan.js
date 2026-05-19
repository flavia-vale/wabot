export function isTrialActive(planSubject) {
  if (planSubject?.plan !== 'trial' || !planSubject?.accessExpiresAt) return false
  const expiresAt = new Date(planSubject.accessExpiresAt)
  return !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date()
}

export function canAccessAdvancedPreservation(planSubject) {
  return planSubject?.plan === 'pro' || isTrialActive(planSubject)
}
