import { PRESERVATION_FEATURE, ACCOUNT_PRESERVATION_FEATURES } from '../core/preservationFeatures.js'
export const PLAN_IDS = Object.freeze({
  TRIAL: 'trial',
  BASIC: 'basic',
  PRO: 'pro',
})

export const FEATURE_CODES = Object.freeze({
  CHANNELS: 'channels',
  ADVANCED_PRESERVATION: 'advanced_preservation',
  OFFER_AUTOMATIONS: 'offer_automations',
  OFFER_QUEUES: 'offer_queues',
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
    canUseOfferAutomations: hasProLikeAccess,
    canUseOfferQueues: hasProLikeAccess,
  }
}

export function canUseChannels(userOrPlan = {}, options = {}) {
  return getPlanEntitlements(userOrPlan, options).canUseChannels
}

export function canUseAdvancedPreservation(userOrPlan = {}, options = {}) {
  return getPlanEntitlements(userOrPlan, options).canUseAdvancedPreservation
}

export function canUseOfferAutomations(userOrPlan = {}, options = {}) {
  return getPlanEntitlements(userOrPlan, options).canUseOfferAutomations
}

export function canUseOfferQueues(userOrPlan = {}, options = {}) {
  return getPlanEntitlements(userOrPlan, options).canUseOfferQueues
}

// Cache em memória pra evitar martelar o DB no fan-out do bot-worker e nos
// ticks dos crons de automação/fila.
// TTL de 60s — aceitável: mudança de plano leva até 1min pra refletir.
const PLAN_ACCESS_CACHE_TTL_MS = 60_000
const planAccessCache = new Map() // userId → { fetchedAt, plan, accessExpiresAt, entitlements }

export function __resetCacheForTests() {
  planAccessCache.clear()
}

/**
 * Retorna os entitlements completos do usuário, cacheados por 60s.
 * Use em hot paths (bot-worker fan-out, cron de automações/filas).
 *
 * @param {string} userId
 * @param {{ db?: object, now?: number }} opts
 * @returns {Promise<{ entitlements: object, plan: string|null, accessExpiresAt: Date|null }>}
 */
export async function getPlanAccess(userId, opts = {}) {
  const db = opts.db
  if (!db) throw new Error('getPlanAccess: db obrigatório')
  const now = opts.now ?? Date.now()
  const cached = planAccessCache.get(userId)
  if (cached && now - cached.fetchedAt < PLAN_ACCESS_CACHE_TTL_MS) {
    return { entitlements: cached.entitlements, plan: cached.plan, accessExpiresAt: cached.accessExpiresAt }
  }
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { plan: true, accessExpiresAt: true },
  })
  if (!user) {
    const entitlements = getPlanEntitlements({ plan: null, accessExpiresAt: null }, { now: new Date(now) })
    const entry = { fetchedAt: now, plan: null, accessExpiresAt: null, entitlements }
    planAccessCache.set(userId, entry)
    return { entitlements, plan: null, accessExpiresAt: null }
  }
  const accessExpiresAt = user.accessExpiresAt
    ? (user.accessExpiresAt instanceof Date ? user.accessExpiresAt : new Date(user.accessExpiresAt))
    : null
  const entitlements = getPlanEntitlements({ plan: user.plan, accessExpiresAt }, { now: new Date(now) })
  const entry = { fetchedAt: now, plan: user.plan, accessExpiresAt, entitlements }
  planAccessCache.set(userId, entry)
  return { entitlements, plan: user.plan, accessExpiresAt }
}

/**
 * Retorna se usuário tem acesso ao Módulo de Preservação Avançada (Pro ou Trial ativo).
 * Wrapper de getPlanAccess — mantém o contrato dos call sites existentes.
 *
 * @param {string} userId
 * @param {{ db?: object, now?: number }} opts
 * @returns {Promise<{ active: boolean, plan: string|null, accessExpiresAt: Date|null }>}
 */
export async function getAdvancedPreservationAccess(userId, opts = {}) {
  if (!opts.db) throw new Error('getAdvancedPreservationAccess: db obrigatório')
  const { entitlements, plan, accessExpiresAt } = await getPlanAccess(userId, opts)
  return { active: entitlements.canUseAdvancedPreservation, plan, accessExpiresAt }
}

/**
 * A preservação fica disponível quando o plano permite e ao menos uma defesa
 * opt-in foi ligada. Cada defesa é opt-in e pode operar de forma independente.
 * Plano B / Fase 3: cadência/janela (throttle + quiet) saiu da conta e virou
 * config POR DESTINO, então NÃO entra mais neste select — só as defesas de conta
 * (ACCOUNT_PRESERVATION_FEATURES). Isso também evita selecionar colunas que serão
 * dropadas no teardown.
 */
export const PRESERVATION_FEATURE_SELECT = Object.freeze(
  Object.fromEntries(ACCOUNT_PRESERVATION_FEATURES.map(key => [key, true])),
)

export function isPreservationActive(planAccess, botConfig) {
  const planAllows = typeof planAccess === 'boolean' ? planAccess : Boolean(planAccess?.active)
  if (!planAllows) return false
  // Plano B / Fase 3: cadência (throttle/quiet) virou config por destino, sempre
  // ativa — não conta mais para "preservação ativa" da conta. O sinal deriva só
  // das features opcionais que seguem globais (follow guard, variação de copy,
  // mutação de imagem, probe).
  return ACCOUNT_PRESERVATION_FEATURES.some(key => botConfig?.[key] === true)
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

  if (featureCode === FEATURE_CODES.OFFER_AUTOMATIONS) {
    return {
      error: 'As ofertas automáticas estão disponíveis no Trial ativo e no plano Pro.',
      code: 'FEATURE_REQUIRES_PRO',
      feature: FEATURE_CODES.OFFER_AUTOMATIONS,
      requiredPlan: PLAN_IDS.PRO,
    }
  }

  if (featureCode === FEATURE_CODES.OFFER_QUEUES) {
    return {
      error: 'As filas de ofertas estão disponíveis no Trial ativo e no plano Pro.',
      code: 'FEATURE_REQUIRES_PRO',
      feature: FEATURE_CODES.OFFER_QUEUES,
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
