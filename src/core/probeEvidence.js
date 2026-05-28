import db from '../db.js'
import { recordProbeSeen } from './channelProbe.js'

function toDate(v) {
  if (!v) return null
  return v instanceof Date ? v : new Date(v)
}

export async function registerProbeEvidence({ userId, groupId, probeSessionId, messageFingerprint = null, seenAt = new Date(), sentAt = null, matchSource = 'manual-ping-fallback' }, opts = {}) {
  const prisma = opts.db ?? db
  const seen = toDate(seenAt) ?? new Date()
  const sent = toDate(sentAt) ?? seen
  const latencyMs = Math.max(0, seen.getTime() - sent.getTime())

  await prisma.probeEvidence.create({
    data: {
      userId,
      groupId,
      probeSessionId: String(probeSessionId || 'manual'),
      messageFingerprint: String(messageFingerprint || `${groupId}:${Math.floor(seen.getTime() / 60000)}`),
      sentAt: sent,
      seenAt: seen,
      latencyMs,
      matchSource,
    },
  })

  await recordProbeSeen(groupId, { db: prisma, now: seen.getTime() })
}

export async function getProbeMonitoringSummary({ userId }, opts = {}) {
  const prisma = opts.db ?? db
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const rows = await prisma.probeEvidence.findMany({
    where: { userId, seenAt: { gte: since } },
    orderBy: { seenAt: 'desc' },
    select: { groupId: true, seenAt: true, latencyMs: true },
  })

  const out = new Map()
  for (const row of rows) {
    const curr = out.get(row.groupId) ?? { misses24h: 0, lastLatencyMs: null, lastEvidenceAt: null }
    if (curr.lastEvidenceAt == null) {
      curr.lastEvidenceAt = row.seenAt
      curr.lastLatencyMs = row.latencyMs
    }
    out.set(row.groupId, curr)
  }
  return out
}
