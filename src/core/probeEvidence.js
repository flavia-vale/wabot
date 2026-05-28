import db from '../db.js'
import { recordProbeSeen } from './channelProbe.js'

const PROBE_EXPECTED_MAX_DELAY_MS = 15 * 60 * 1000

function toDate(v) {
  if (!v) return null
  return v instanceof Date ? v : new Date(v)
}

function fingerprintFromSent(groupId, sentAt) {
  const sent = toDate(sentAt)
  if (!sent) return null
  return `${groupId}:${Math.floor(sent.getTime() / 60000)}`
}

export async function resolveLatestSentForGroup({ userId, groupWaJid }, opts = {}) {
  const prisma = opts.db ?? db
  const row = await prisma.messageLog.findFirst({
    where: { userId, destGroup: groupWaJid, status: 'success' },
    orderBy: { sentAt: 'desc' },
    select: { sentAt: true },
  })
  return row?.sentAt ?? null
}

export async function registerProbeEvidence({ userId, groupId, probeSessionId, messageFingerprint = null, seenAt = new Date(), sentAt = null, matchSource = 'manual-ping-fallback' }, opts = {}) {
  const prisma = opts.db ?? db
  const seen = toDate(seenAt) ?? new Date()
  const sent = toDate(sentAt)
  const latencyMs = sent ? Math.max(0, seen.getTime() - sent.getTime()) : null

  await prisma.probeEvidence.create({
    data: {
      userId,
      groupId,
      probeSessionId: String(probeSessionId || 'manual'),
      messageFingerprint: String(messageFingerprint || fingerprintFromSent(groupId, sent) || `${groupId}:${Math.floor(seen.getTime() / 60000)}`),
      sentAt: sent ?? seen,
      seenAt: seen,
      latencyMs: latencyMs ?? 0,
      matchSource,
    },
  })

  await recordProbeSeen(groupId, { db: prisma, now: seen.getTime() })
}

export async function getProbeMonitoringSummary({ userId, channels = [] }, opts = {}) {
  const prisma = opts.db ?? db
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const groupIdByWaJid = new Map(channels.map(c => [c.waJid, c.id]))

  const [evidences, sends] = await Promise.all([
    prisma.probeEvidence.findMany({
      where: { userId, seenAt: { gte: since } },
      orderBy: { seenAt: 'desc' },
      select: { groupId: true, seenAt: true, sentAt: true, latencyMs: true },
    }),
    prisma.messageLog.findMany({
      where: { userId, status: 'success', sentAt: { gte: since } },
      orderBy: { sentAt: 'desc' },
      select: { destGroup: true, sentAt: true },
    }),
  ])

  const evidenceByGroup = new Map()
  for (const ev of evidences) {
    const curr = evidenceByGroup.get(ev.groupId) ?? { lastLatencyMs: null, lastEvidenceAt: null, evidenceTimes: [] }
    if (!curr.lastEvidenceAt) {
      curr.lastEvidenceAt = ev.seenAt
      curr.lastLatencyMs = ev.latencyMs
    }
    curr.evidenceTimes.push(ev.seenAt.getTime())
    evidenceByGroup.set(ev.groupId, curr)
  }

  const out = new Map()
  for (const ch of channels) {
    const base = evidenceByGroup.get(ch.id) ?? { lastLatencyMs: null, lastEvidenceAt: null, evidenceTimes: [] }
    out.set(ch.id, { lastLatencyMs: base.lastLatencyMs, lastEvidenceAt: base.lastEvidenceAt, misses24h: 0, evidenceTimes: base.evidenceTimes })
  }

  for (const send of sends) {
    const groupId = groupIdByWaJid.get(send.destGroup)
    if (!groupId) continue
    const row = out.get(groupId)
    if (!row) continue
    const sentMs = send.sentAt.getTime()
    const matched = row.evidenceTimes.some(t => t >= sentMs && t <= sentMs + PROBE_EXPECTED_MAX_DELAY_MS)
    if (!matched) row.misses24h += 1
  }

  for (const [k, v] of out) {
    delete v.evidenceTimes
    out.set(k, v)
  }
  return out
}
