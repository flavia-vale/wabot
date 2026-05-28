import db from '../../db.js'
import {
  FEATURE_CODES,
  buildFeatureGateError,
  getAdvancedPreservationAccess,
} from '../../billing/plans.js'
import { getHealth as getChannelHealth } from '../../core/channelHealth.js'
import { recomputeScore as recomputeReportRiskScore } from '../../core/reportRiskScore.js'
import { getClickStats } from '../../core/clickTracker.js'
import { getProbeMonitoringSummary } from '../../core/probeEvidence.js'


import { getProbeSessionSnapshot, isProbeSessionSelectable, setProbeSession } from '../../core/probeSessions.js'

const PRESERVATION_CONFIG_KEYS = [
  'channelMinIntervalSec',
  'channelBurstCap',
  'channelBurstWindowSec',
  'channelDailyCap',
  'channelStaggerJitterMs',
  'channelQuietHoursJson',
  'maxDailyFollows',
  'copyVariationPoolJson',
  'imageMutationEnabled',
  'probeEnabled',
]

function pickConfig(botConfig) {
  const out = {}
  for (const k of PRESERVATION_CONFIG_KEYS) out[k] = botConfig?.[k] ?? null
  out.probeAccountSessionId = botConfig?.probeAccountSessionId ?? null
  return out
}

function validatePartialUpdate(body = {}) {
  const updates = {}
  const errors = []
  const int = (key, { min = 0, max = Number.MAX_SAFE_INTEGER, nullable = false } = {}) => {
    if (!(key in body)) return
    const v = body[key]
    if (nullable && v === null) { updates[key] = null; return }
    if (!Number.isInteger(v) || v < min || v > max) {
      errors.push(`${key} deve ser inteiro entre ${min} e ${max}${nullable ? ' ou null' : ''}`)
      return
    }
    updates[key] = v
  }
  const bool = (key) => {
    if (!(key in body)) return
    if (typeof body[key] !== 'boolean') { errors.push(`${key} deve ser boolean`); return }
    updates[key] = body[key]
  }
  const json = (key) => {
    if (!(key in body)) return
    if (typeof body[key] !== 'string') { errors.push(`${key} deve ser string JSON`); return }
    try { JSON.parse(body[key]) } catch { errors.push(`${key} contém JSON inválido`); return }
    updates[key] = body[key]
  }

  int('channelMinIntervalSec', { min: 1, max: 86400 })
  int('channelBurstCap', { min: 1, max: 1000 })
  int('channelBurstWindowSec', { min: 60, max: 86400 })
  int('channelDailyCap', { min: 1, max: 10000, nullable: true })
  int('channelStaggerJitterMs', { min: 0, max: 600000 })
  int('maxDailyFollows', { min: 1, max: 50 })
  json('channelQuietHoursJson')
  json('copyVariationPoolJson')
  bool('imageMutationEnabled')
  bool('probeEnabled')

  return { updates, errors }
}

async function requirePreservationAccess(req, reply) {
  const access = await getAdvancedPreservationAccess(req.user.sub, { db })
  if (!access.active) {
    reply.code(402).send(buildFeatureGateError(FEATURE_CODES.ADVANCED_PRESERVATION))
    return true
  }
  return false
}

export async function preservationRoutes(app) {
  app.addHook('preHandler', async (req) => {
    if (typeof app.authenticate === 'function') {
      return app.authenticate(req)
    }
    return req.jwtVerify()
  })

  // ---------- Config ----------
  app.get('/config', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    const cfg = await db.botConfig.findUnique({ where: { userId: req.user.sub } })
    const flags = {
      clickTrackerSaltConfigured: Boolean(process.env.CLICK_HASH_SALT),
      shortlinkBaseUrl: process.env.SHORTLINK_BASE_URL || null,
    }
    return { config: pickConfig(cfg ?? {}), flags }
  })

  app.put('/config', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    const { updates, errors } = validatePartialUpdate(req.body)
    if (errors.length) return reply.code(400).send({ error: errors.join('; '), errors })
    const updated = await db.botConfig.upsert({
      where: { userId: req.user.sub },
      update: updates,
      create: { userId: req.user.sub, ...updates },
    })
    return { config: pickConfig(updated) }
  })

  // ---------- Probe session (PR-1 foundation) ----------
  app.post('/probe/session/start', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    const userId = req.user.sub
    const snapshot = await getProbeSessionSnapshot(userId)
    if (snapshot.state === 'connected' || snapshot.state === 'connecting' || snapshot.state === 'qr_pending') {
      return reply.code(409).send({ error: 'Já existe sessão probe ativa para este usuário.', session: snapshot })
    }

    const sessionId = `probe_${userId}`
    const session = await setProbeSession(userId, {
      sessionId,
      state: 'qr_pending',
      qrExpiresAt: new Date(Date.now() + 60 * 1000),
      lastError: null,
    })
    return { ok: true, session }
  })

  app.get('/probe/session/status', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    return { ok: true, session: await getProbeSessionSnapshot(req.user.sub) }
  })

  app.post('/probe/session/stop', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    const session = await setProbeSession(req.user.sub, {
      state: 'disconnected',
      qrExpiresAt: null,
      lastError: null,
    })
    return { ok: true, session }
  })

  app.post('/probe/session/select', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    const probeAccountSessionId = String(req.body?.probeAccountSessionId ?? '').trim()
    if (!probeAccountSessionId) return reply.code(400).send({ error: 'probeAccountSessionId é obrigatório.' })
    if (!/^probe_[a-zA-Z0-9_-]{3,120}$/.test(probeAccountSessionId)) {
      return reply.code(400).send({ error: 'probeAccountSessionId inválido.' })
    }
    if (!(await isProbeSessionSelectable(req.user.sub, probeAccountSessionId))) {
      return reply.code(409).send({ error: 'Sessão probe não está ativa para seleção.' })
    }

    const updated = await db.botConfig.upsert({
      where: { userId: req.user.sub },
      update: { probeAccountSessionId },
      create: { userId: req.user.sub, probeAccountSessionId },
    })

    return { ok: true, config: pickConfig(updated) }
  })

  // ---------- Monitoring ----------
  app.get('/monitoring/health', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    const groups = await db.group.findMany({
      where: { userId: req.user.sub, role: 'post' },
      select: { id: true, name: true, waJid: true, kind: true },
    })
    const out = await Promise.all(groups.map(async (g) => {
      const health = await getChannelHealth(g.id, { db })
      return { groupId: g.id, name: g.name, waJid: g.waJid, kind: g.kind, health }
    }))
    return { items: out }
  })

  app.get('/monitoring/risk-score', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    const channels = await db.group.findMany({
      where: { userId: req.user.sub, role: 'post', kind: 'channel' },
      include: { channelHealth: true },
    })
    const items = channels.map((g) => ({
      groupId: g.id,
      name: g.name,
      waJid: g.waJid,
      score: g.channelHealth?.reportRiskScore ?? null,
    }))
    const validScores = items.map(i => i.score).filter(s => typeof s === 'number')
    const avgScore = validScores.length
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : null
    return { items, avgScore }
  })

  app.post('/monitoring/risk-score/recompute-all', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    const channels = await db.group.findMany({
      where: { userId: req.user.sub, role: 'post', kind: 'channel' },
      select: { id: true },
    })
    let recomputed = 0
    for (const g of channels) {
      try {
        await recomputeReportRiskScore(g.id, { db })
        recomputed++
      } catch {}
    }
    return { recomputed, total: channels.length }
  })

  app.get('/monitoring/follows', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    const limit = Math.min(Number(req.query?.limit ?? 20) || 20, 200)
    const items = await db.followLog.findMany({
      where: { userId: req.user.sub },
      orderBy: { followedAt: 'desc' },
      take: limit,
    })
    return { items }
  })

  app.get('/monitoring/snapshots', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    const channels = await db.group.findMany({
      where: { userId: req.user.sub, role: 'post', kind: 'channel' },
      select: { id: true, name: true, waJid: true },
    })
    const items = await Promise.all(channels.map(async (g) => {
      const snaps = await db.channelSnapshot.findMany({
        where: { groupId: g.id },
        orderBy: { snapshotedAt: 'desc' },
        take: 1,
        select: { snapshotedAt: true },
      })
      const total = await db.channelSnapshot.count({ where: { groupId: g.id } })
      return {
        groupId: g.id,
        name: g.name,
        waJid: g.waJid,
        lastSnapshotAt: snaps[0]?.snapshotedAt ?? null,
        total,
      }
    }))
    return { items }
  })

  app.get('/monitoring/probe', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    const cfg = await db.botConfig.findUnique({ where: { userId: req.user.sub } })
    const channels = await db.group.findMany({
      where: { userId: req.user.sub, role: 'post', kind: 'channel' },
      include: { channelHealth: true },
    })
    const evidenceMap = await getProbeMonitoringSummary({ userId: req.user.sub }, { db })
    const items = channels.map((g) => {
      const ev = evidenceMap.get(g.id)
      return {
        groupId: g.id,
        name: g.name,
        waJid: g.waJid,
        lastProbeSeenAt: g.channelHealth?.lastProbeSeenAt ?? null,
        lastLatencyMs: ev?.lastLatencyMs ?? null,
        misses24h: ev?.misses24h ?? 0,
      }
    })
    return {
      enabled: Boolean(cfg?.probeEnabled),
      probeAccountSessionId: cfg?.probeAccountSessionId ?? null,
      sessionState: (await getProbeSessionSnapshot(req.user.sub)).state,
      items,
    }
  })

  app.get('/monitoring/clicks', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    // getClickStats takes a single opts object: { userId, db, days? }
    const stats = await getClickStats({ userId: req.user.sub, db })
    return stats
  })
}
