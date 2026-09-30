import dbDefault from '../../db.js'
import { buildFeatureGateError, canUseGroupMembers, FEATURE_CODES } from '../../billing/plans.js'
import { seriesForPeriod, summarizeGroupMembers } from '../../core/groupMemberStats.js'

const WINDOW_DAYS = 31

// Painel "Membros": total atual + variação 24h/7d/30d dos grupos-destino.
// Só quantidade (nunca telefones). Gate PRO ANTES de tocar no banco de amostras.
export async function groupMembersRoutes(app, options = {}) {
  const db = options.db ?? dbDefault
  const loadPlanSubject = options.loadPlanSubject
    ?? (userId => db.user.findUnique({ where: { id: userId }, select: { plan: true, accessExpiresAt: true } }))

  app.get('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const subject = await loadPlanSubject(req.user.sub)
    if (!canUseGroupMembers(subject ?? { plan: 'basic' })) {
      return reply.code(403).send(buildFeatureGateError(FEATURE_CODES.GROUP_MEMBERS))
    }
    const now = options.now?.() ?? new Date()
    const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const groups = await db.group.findMany({
      where: { userId: req.user.sub, role: 'post', kind: 'group' },
      select: {
        id: true, name: true,
        memberSamples: { where: { sampledAt: { gte: since } }, select: { size: true, sampledAt: true }, orderBy: { sampledAt: 'desc' } },
      },
      orderBy: { name: 'asc' },
    })
    const rows = groups.map(g => ({
      id: g.id, name: g.name, ...summarizeGroupMembers(g.memberSamples, now),
      series: { d1: seriesForPeriod(g.memberSamples, 1), d7: seriesForPeriod(g.memberSamples, 7), d30: seriesForPeriod(g.memberSamples, 30) },
    }))
    const totalSize = rows.reduce((sum, r) => sum + (r.size ?? 0), 0)
    return { groups: rows, totalSize }
  })
}
