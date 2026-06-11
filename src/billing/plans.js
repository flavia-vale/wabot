import { PRESERVATION_FEATURE } from '../core/preservationFeatures.js'
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

// Cache em memória pra evitar martelar o DB no fan-out do bot-worker.
// TTL de 60s — aceitável: mudança de plano leva até 1min pra refletir nas defesas.
const PRESERVATION_CACHE_TTL_MS = 60_000
const preservationCache = new Map() // userId → { fetchedAt, active, plan, accessExpiresAt }

export function __resetCacheForTests() {
  preservationCache.clear()
}

/**
 * Retorna se usuário tem acesso ao Módulo de Preservação Avançada (Pro ou Trial ativo).
 * Cacheia o resultado por 60s. Use em hot paths (bot-worker fan-out, cron).
 *
 * @param {string} userId
 * @param {{ db?: object, now?: number }} opts
 * @returns {Promise<{ active: boolean, plan: string|null, accessExpiresAt: Date|null }>}
 */
export async function getAdvancedPreservationAccess(userId, opts = {}) {
  const db = opts.db
  if (!db) throw new Error('getAdvancedPreservationAccess: db obrigatório')
  const now = opts.now ?? Date.now()
  const cached = preservationCache.get(userId)
  if (cached && now - cached.fetchedAt < PRESERVATION_CACHE_TTL_MS) {
    return { active: cached.active, plan: cached.plan, accessExpiresAt: cached.accessExpiresAt }
  }
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { plan: true, accessExpiresAt: true },
  })
  if (!user) {
    const entry = { fetchedAt: now, active: false, plan: null, accessExpiresAt: null }
    preservationCache.set(userId, entry)
    return { active: false, plan: null, accessExpiresAt: null }
  }
  const accessExpiresAt = user.accessExpiresAt
    ? (user.accessExpiresAt instanceof Date ? user.accessExpiresAt : new Date(user.accessExpiresAt))
    : null
  const active = canUseAdvancedPreservation({ plan: user.plan, accessExpiresAt }, { now: new Date(now) })
  const entry = { fetchedAt: now, active, plan: user.plan, accessExpiresAt }
  preservationCache.set(userId, entry)
  return { active, plan: user.plan, accessExpiresAt }
}

/**
 * A preservação fica disponível quando o plano permite e ao menos uma defesa
 * foi ligada. Cada defesa é opt-in e pode operar de forma independente.
 */
export const PRESERVATION_FEATURE_SELECT = Object.freeze(
  Object.fromEntries(Object.values(PRESERVATION_FEATURE).map(key => [key, true])),
)

export function isPreservationActive(planAccess, botConfig) {
  const planAllows = typeof planAccess === 'boolean' ? planAccess : Boolean(planAccess?.active)
  if (!planAllows) return false
  return Object.keys(PRESERVATION_FEATURE_SELECT).some(key => botConfig?.[key] === true)
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
