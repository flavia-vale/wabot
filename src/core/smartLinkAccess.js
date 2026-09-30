// Quem pode manter um Link Inteligente funcionando (decisão da dona, 30/09:
// plano vencido = o link PARA NA HORA).
//
// Por que a data é checada aqui e não só em `canUseSmartLinks`: a regra de PRO
// (`getPlanEntitlements`) trata `plan: 'pro'` como PRO mesmo com `accessExpiresAt`
// no passado — o vencimento de quem paga é barrado em outro lugar (início da
// sessão e worker, que olham `accessExpiresAt < agora`). O link público não passa
// por nenhum desses, então olha a data sozinho.

import { canUseSmartLinks } from '../billing/plans.js'

const BLOCKED_STATUSES = new Set(['banned', 'suspended'])

/**
 * @param {{plan?:string, accessExpiresAt?:Date|string|null, status?:string}|null|undefined} user
 * @param {Date} [now]
 */
export function isSmartLinkOwnerEligible(user, now = new Date()) {
  if (!user) return false
  if (BLOCKED_STATUSES.has(String(user.status ?? ''))) return false
  if (user.accessExpiresAt) {
    const expiresAt = new Date(user.accessExpiresAt)
    // Data ilegível não vale como "sem vencimento": na dúvida, não serve o link.
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) return false
  }
  return canUseSmartLinks({ plan: user.plan, accessExpiresAt: user.accessExpiresAt }, { now })
}
