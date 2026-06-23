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

// Nota: as variações de texto (gancho/CTA/convite) — pool e liga/desliga —
// NÃO vivem mais aqui. São editadas exclusivamente em "Templates de mensagens"
// (rota /api/config). Esta rota cuida só das defesas de preservação.
const PRESERVATION_CONFIG_KEYS = [
  'channelMinIntervalSec',
  'channelBurstCap',
  'channelBurstWindowSec',
  'channelDailyCap',
  'channelStaggerJitterMs',
  'channelQuietHoursJson',
  'maxDailyFollows',
  'channelThrottleEnabled',
  'quietHoursEnabled',
  'followGuardEnabled',
  'imageMutationActive',
  'probeEnabled',
]

function pickConfig(botConfig) {
  const out = {}
  for (const k of PRESERVATION_CONFIG_KEYS) {
    const publicKey = k === 'imageMutationActive' ? 'imageMutationEnabled' : k
    out[publicKey] = botConfig?.[k] ?? null
  }
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
  bool('channelThrottleEnabled')
  bool('quietHoursEnabled')
  bool('followGuardEnabled')
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

// ---------- Plano B: validação de preset/override por destino ----------
const HOURS_TZ_DEFAULT = 'America/Sao_Paulo'

function validateOperatingHoursJson(value, errors, key) {
  if (typeof value !== 'string') { errors.push(`${key} deve ser string JSON`); return undefined }
  let parsed
  try { parsed = JSON.parse(value) } catch { errors.push(`${key} contém JSON inválido`); return undefined }
  const okHour = (h) => Number.isInteger(h) && h >= 0 && h <= 23
  if (!okHour(parsed?.startHour) || !okHour(parsed?.endHour)) {
    errors.push(`${key} deve ter startHour/endHour inteiros entre 0 e 23`)
    return undefined
  }
  return JSON.stringify({
    startHour: parsed.startHour,
    endHour: parsed.endHour,
    tz: typeof parsed.tz === 'string' && parsed.tz ? parsed.tz : HOURS_TZ_DEFAULT,
  })
}

// Campos de preservação compartilhados por preset e override de destino.
// nullable=true (override de destino) aceita null = "herda do preset".
function collectPreservationFields(body, { nullable }) {
  const updates = {}
  const errors = []
  const has = (k) => k in body

  const num = (key, min, max, allowNull = false) => {
    if (!has(key)) return
    const v = body[key]
    if ((nullable || allowNull) && v === null) { updates[key] = null; return }
    if (!Number.isInteger(v) || v < min || v > max) { errors.push(`${key} deve ser inteiro entre ${min} e ${max}`); return }
    updates[key] = v
  }
  const bool = (key) => {
    if (!has(key)) return
    const v = body[key]
    if (nullable && v === null) { updates[key] = null; return }
    if (typeof v !== 'boolean') { errors.push(`${key} deve ser boolean`); return }
    updates[key] = v
  }
  const hoursJson = (key) => {
    if (!has(key)) return
    if (nullable && body[key] === null) { updates[key] = null; return }
    const normalized = validateOperatingHoursJson(body[key], errors, key)
    if (normalized !== undefined) updates[key] = normalized
  }

  bool('operatingHoursEnabled')
  hoursJson('operatingHoursJson')
  bool('throttleEnabled')
  num('minIntervalSec', 1, 86400)
  num('burstCap', 1, 1000)
  num('burstWindowSec', 60, 86400)
  num('dailyCap', 1, 10000, true)
  return { updates, errors }
}

function validatePresetBody(body = {}, { partial = false } = {}) {
  const { updates, errors } = collectPreservationFields(body, { nullable: false })
  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) errors.push('name é obrigatório')
    else updates.name = name
  } else if (!partial) {
    errors.push('name é obrigatório')
  }
  if ('isDefault' in body) {
    if (typeof body.isDefault !== 'boolean') errors.push('isDefault deve ser boolean')
    else updates.isDefault = body.isDefault
  }
  return { updates, errors }
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
    const data = { ...updates }
    if ('imageMutationEnabled' in data) {
      data.imageMutationActive = data.imageMutationEnabled
      delete data.imageMutationEnabled
    }
    const updated = await db.botConfig.upsert({
      where: { userId: req.user.sub },
      update: data,
      create: {
        userId: req.user.sub,
        ...data,
      },
    })
    return { config: pickConfig(updated) }
  })

  // ---------- Plano B: presets de preservação ----------
  const PRESET_SELECT = {
    id: true, name: true, isDefault: true,
    operatingHoursEnabled: true, operatingHoursJson: true,
    throttleEnabled: true, minIntervalSec: true, burstCap: true, burstWindowSec: true, dailyCap: true,
    createdAt: true, updatedAt: true,
  }

  // Garante um único isDefault por usuário (desmarca os demais).
  async function clearOtherDefaults(userId, keepId) {
    await db.preservationPreset.updateMany({
      where: { userId, isDefault: true, ...(keepId ? { id: { not: keepId } } : {}) },
      data: { isDefault: false },
    })
  }

  app.get('/presets', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    const presets = await db.preservationPreset.findMany({
      where: { userId: req.user.sub },
      select: PRESET_SELECT,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })
    return { presets }
  })

  app.post('/presets', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    const { updates, errors } = validatePresetBody(req.body)
    if (errors.length) return reply.code(400).send({ error: errors.join('; '), errors })
    if (updates.isDefault) await clearOtherDefaults(req.user.sub)
    const preset = await db.preservationPreset.create({
      data: { userId: req.user.sub, ...updates },
      select: PRESET_SELECT,
    })
    return { preset }
  })

  app.put('/presets/:id', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    const { updates, errors } = validatePresetBody(req.body, { partial: true })
    if (errors.length) return reply.code(400).send({ error: errors.join('; '), errors })
    const owned = await db.preservationPreset.findFirst({ where: { id: req.params.id, userId: req.user.sub }, select: { id: true } })
    if (!owned) return reply.code(404).send({ error: 'Preset não encontrado' })
    if (updates.isDefault) await clearOtherDefaults(req.user.sub, owned.id)
    const updated = await db.preservationPreset.update({
      where: { id: owned.id },
      data: updates,
      select: PRESET_SELECT,
    })
    return { preset: updated }
  })

  app.delete('/presets/:id', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    const owned = await db.preservationPreset.findFirst({ where: { id: req.params.id, userId: req.user.sub }, select: { id: true, isDefault: true } })
    if (!owned) return reply.code(404).send({ error: 'Preset não encontrado' })
    // O default é o fallback da conta — não pode sumir sem deixar destinos sem
    // proteção. Para trocar, marque outro como default antes.
    if (owned.isDefault) return reply.code(409).send({ error: 'Não é possível excluir o preset padrão. Marque outro como padrão primeiro.' })
    // Grupos que referenciam o preset caem para null (FK SET NULL) → herdam o default.
    await db.preservationPreset.delete({ where: { id: owned.id } })
    return { ok: true }
  })

  // Aplica um preset a vários destinos de uma vez (UX de escala).
  app.post('/presets/:id/apply', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    const groupIds = Array.isArray(req.body?.groupIds) ? req.body.groupIds.filter((g) => typeof g === 'string') : null
    if (!groupIds || groupIds.length === 0) return reply.code(400).send({ error: 'groupIds deve ser uma lista não vazia' })
    const owned = await db.preservationPreset.findFirst({ where: { id: req.params.id, userId: req.user.sub }, select: { id: true } })
    if (!owned) return reply.code(404).send({ error: 'Preset não encontrado' })
    const res = await db.group.updateMany({
      where: { id: { in: groupIds }, userId: req.user.sub, role: 'post' },
      data: { preservationPresetId: owned.id },
    })
    return { applied: res.count }
  })

  // ---------- Plano B: preservação por destino (Group role=post) ----------
  const DESTINATION_SELECT = {
    id: true, name: true, waJid: true, kind: true, preservationPresetId: true,
    operatingHoursEnabled: true, operatingHoursJson: true,
    throttleEnabled: true, minIntervalSec: true, burstCap: true, burstWindowSec: true, dailyCap: true,
  }

  app.get('/destinations', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    const destinations = await db.group.findMany({
      where: { userId: req.user.sub, role: 'post' },
      select: DESTINATION_SELECT,
      orderBy: { name: 'asc' },
    })
    return { destinations }
  })

  app.put('/destinations/:id', async (req, reply) => {
    if (await requirePreservationAccess(req, reply)) return
    const { updates, errors } = collectPreservationFields(req.body ?? {}, { nullable: true })
    if ('preservationPresetId' in (req.body ?? {})) {
      const presetId = req.body.preservationPresetId
      if (presetId === null) {
        updates.preservationPresetId = null
      } else if (typeof presetId === 'string') {
        const preset = await db.preservationPreset.findFirst({ where: { id: presetId, userId: req.user.sub }, select: { id: true } })
        if (!preset) errors.push('preservationPresetId não encontrado')
        else updates.preservationPresetId = presetId
      } else {
        errors.push('preservationPresetId deve ser string ou null')
      }
    }
    if (errors.length) return reply.code(400).send({ error: errors.join('; '), errors })
    const owned = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub, role: 'post' }, select: { id: true } })
    if (!owned) return reply.code(404).send({ error: 'Destino não encontrado' })
    const updated = await db.group.update({ where: { id: owned.id }, data: updates, select: DESTINATION_SELECT })
    return { destination: updated }
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
    const evidenceMap = await getProbeMonitoringSummary({ userId: req.user.sub, channels }, { db })
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
    const probeMode = process.env.PROBE_MODE === 'full' ? 'full' : 'manual_fallback'
    return {
      enabled: Boolean(cfg?.probeEnabled),
      probeAccountSessionId: cfg?.probeAccountSessionId ?? null,
      sessionState: (await getProbeSessionSnapshot(req.user.sub)).state,
      probeMode,
      telemetryConfidence: probeMode === 'full' ? 'high' : 'medium',
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
