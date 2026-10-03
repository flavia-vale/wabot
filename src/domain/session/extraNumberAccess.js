// Quem pode ter número reserva (docs/rca/multi-numero.md): flag ligada, plano
// PRO (ou acima, ou Teste ativo — mesma regra do resto do produto), acesso em
// dia e pelo menos um número extra pago.
import { PLAN_IDS, normalizePlan, isAccessActive, isTrialActive } from '../../billing/plans.js'
import { multiNumberEnabled } from './multiNumberFlag.js'

export function extraNumberAccess(user = {}, { now = new Date(), env = process.env } = {}) {
  if (!multiNumberEnabled(env)) return { allowed: false, reason: 'disabled' }
  const plan = normalizePlan(user?.plan)
  const proLike = [PLAN_IDS.PRO, PLAN_IDS.PREMIUM].includes(plan) || isTrialActive(user, now)
  if (!proLike) return { allowed: false, reason: 'requires_pro' }
  if (!isAccessActive(user?.accessExpiresAt, now)) return { allowed: false, reason: 'access_expired' }
  if (!(Number(user?.extraNumbers) > 0)) return { allowed: false, reason: 'not_purchased' }
  return { allowed: true, reason: null }
}
