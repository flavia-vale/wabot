// Carrega links do Link Inteligente com ocupação, cliques e estado do aviso.
// Usado pela tela (por usuária) e pelo job de avisos (todos os links). O número
// de membros é SEMPRE a última amostra medida — nunca estimativa por clique.

import { summarizeGroupMembers } from './groupMemberStats.js'
import { MEASURABLE_MAX_AGE_MS, linkGrowthPerHour, summarizeLinkOccupancy } from './smartLinkOccupancy.js'
import { isValidInviteCode } from './smartLinkPicker.js'

const saoPauloDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)

/**
 * @param {{ db: any, where: object, now?: Date }} args  `where` filtra SmartLink (ex.: { userId, deletedAt: null })
 */
export async function loadSmartLinkStats({ db, where, now = new Date() }) {
  const todayKey = saoPauloDay(now)
  const since7 = saoPauloDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000))
  const samplesSince = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)
  const links = await db.smartLink.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      groups: {
        orderBy: { createdAt: 'asc' },
        include: {
          group: { select: { id: true, name: true, memberSamples: { where: { sampledAt: { gte: samplesSince } }, orderBy: { sampledAt: 'desc' }, select: { size: true, sampledAt: true } } } },
          dailyClicks: { where: { day: { gte: since7 } }, select: { day: true, clicks: true } },
        },
      },
    },
  })
  return links.map(link => {
    const groups = link.groups.map(g => {
      const stats = summarizeGroupMembers(g.group.memberSamples, now)
      const ageMs = stats.sampledAt ? now.getTime() - Date.parse(stats.sampledAt) : Infinity
      return {
        id: g.id,
        groupId: g.groupId,
        name: g.group.name,
        enabled: g.enabled,
        hasInvite: isValidInviteCode(g.inviteCode),
        size: stats.size,
        sampledAt: stats.sampledAt,
        stale: stats.stale,
        measurable: ageMs <= MEASURABLE_MAX_AGE_MS,
        delta24h: stats.delta24h,
        delta7d: stats.delta7d,
        occupancyPct: stats.size == null ? null : Math.round((stats.size / link.capPerGroup) * 100),
        clicksToday: g.dailyClicks.filter(d => d.day === todayKey).reduce((sum, d) => sum + d.clicks, 0),
        clicks7d: g.dailyClicks.reduce((sum, d) => sum + d.clicks, 0),
      }
    })
    const measuredActive = groups.filter(g => g.enabled && g.hasInvite && g.measurable && g.size != null)
    const occupancy = summarizeLinkOccupancy(groups, { cap: link.capPerGroup, growthPerHour: linkGrowthPerHour(measuredActive) })
    return {
      id: link.id, userId: link.userId, name: link.name, slug: link.slug, path: `/g/${link.slug}`,
      enabled: link.enabled, capPerGroup: link.capPerGroup,
      notifyEmail: link.notifyEmail ?? true,
      notifyWhatsapp: link.notifyWhatsapp ?? true,
      alert: {
        kind: link.alertKind ?? null,
        lastSentAt: link.alertLastSentAt ?? null,
        reminders: link.alertReminders ?? 0,
        activeGroups: link.alertActiveGroups ?? null,
      },
      clicksToday: groups.reduce((sum, g) => sum + g.clicksToday, 0),
      clicks7d: groups.reduce((sum, g) => sum + g.clicks7d, 0),
      totalSize: groups.reduce((sum, g) => sum + (g.size ?? 0), 0),
      occupancy,
      groups: groups.map(({ measurable, ...publicGroup }) => publicGroup),
    }
  })
}
