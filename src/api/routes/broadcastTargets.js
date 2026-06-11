import { detectKind, ensureJid, JID_KIND } from '../../core/jid.js'
import { buildFeatureGateError, canUseChannels } from '../../billing/plans.js'

export function normalizeTargetJids(jids) {
  const input = Array.isArray(jids) ? jids : []
  return [...new Set(input.map((jid) => {
    const normalized = ensureJid(jid, JID_KIND.GROUP)
    if (!normalized) return null
    return detectKind(normalized) === JID_KIND.CHANNEL ? ensureJid(jid, JID_KIND.CHANNEL) : normalized
  }).filter(Boolean))]
}

export async function resolveTargetJids({ db, userId, jids }) {
  if (Array.isArray(jids) && jids.length) return normalizeTargetJids(jids)
  const postGroups = await db.group.findMany({ where: { userId, role: 'post' } })
  return normalizeTargetJids(postGroups.map((group) => group.waJid))
}

export async function loadUserPlanSubject(db, userId) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { plan: true, accessExpiresAt: true } })
  return user ?? { plan: 'basic', accessExpiresAt: null }
}

export function enforceChannelPlanGate(targetJids, planSubject) {
  if (canUseChannels(planSubject)) return null
  return targetJids.some((jid) => detectKind(jid) === JID_KIND.CHANNEL) ? buildFeatureGateError() : null
}
