export const PLAN_IDS = Object.freeze({
  TRIAL: 'trial',
  BASIC: 'basic',
  PRO: 'pro',
})

export const FEATURE_CODES = Object.freeze({
  CHANNELS: 'channels',
  ADVANCED_PRESERVATION: 'advanced_preservation',
})

const KNOWN_PLANS = new Set(Object.values(PLAN_IDS))

export function normalizePlan(plan) {
  const normalized = String(plan ?? '').trim().toLowerCase()
  return KNOWN_PLANS.has(normalized) ? normalized : PLAN_IDS.TRIAL
}

export function isAccessActive(accessExpiresAt, now = new Date()) {
  if (!accessExpiresAt) return false
  const expiresAt = accessExpiresAt instanceof Date ? accessExpiresAt : new Date(accessExpiresAt)
  if (Number.isNaN(expiresAt.getTime())) return false
  return expiresAt > now
}

export function isTrialActive(userOrPlan = {}, now = new Date()) {
  const plan = typeof userOrPlan === 'string' ? userOrPlan : userOrPlan?.plan
  const accessExpiresAt = typeof userOrPlan === 'string' ? null : userOrPlan?.accessExpiresAt
  return normalizePlan(plan) === PLAN_IDS.TRIAL && isAccessActive(accessExpiresAt, now)
}

export function getPlanEntitlements(userOrPlan = {}, { now = new Date() } = {}) {
  const plan = typeof userOrPlan === 'string' ? userOrPlan : userOrPlan?.plan
  const normalizedPlan = normalizePlan(plan)
  const trialActive = typeof userOrPlan === 'string' ? false : isTrialActive(userOrPlan, now)
  const hasProLikeAccess = normalizedPlan === PLAN_IDS.PRO || trialActive

  return {
    plan: normalizedPlan,
    isTrialActive: trialActive,
    canUseGroups: true,
    canUseChannels: hasProLikeAccess,
    canUseAdvancedPreservation: hasProLikeAccess,
  }
}

export function canUseChannels(userOrPlan = {}, options = {}) {
  return getPlanEntitlements(userOrPlan, options).canUseChannels
}

export function canUseAdvancedPreservation(userOrPlan = {}, options = {}) {
  return getPlanEntitlements(userOrPlan, options).canUseAdvancedPreservation
}

export function buildFeatureGateError(feature = FEATURE_CODES.CHANNELS) {
  const featureCode = String(feature || FEATURE_CODES.CHANNELS)
  if (featureCode === FEATURE_CODES.ADVANCED_PRESERVATION) {
    return {
      error: 'O Módulo de Preservação Avançada está disponível no Trial ativo e no plano Pro.',
      code: 'FEATURE_REQUIRES_PRO',
      feature: FEATURE_CODES.ADVANCED_PRESERVATION,
      requiredPlan: PLAN_IDS.PRO,
    }
  }

  return {
    error: 'Canais estão disponíveis no Trial ativo e no plano Pro.',
    code: 'FEATURE_REQUIRES_PRO',
    feature: FEATURE_CODES.CHANNELS,
    requiredPlan: PLAN_IDS.PRO,
  }
}
