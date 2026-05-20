import db from '../../db.js'
import { sendBroadcast, isRunning } from '../../manager.js'
import { detectKind, ensureJid, JID_KIND } from '../../core/jid.js'
import { buildFeatureGateError, canUseChannels } from '../../billing/plans.js'

function normalizeTargetJids(jids) {
  const input = Array.isArray(jids) ? jids : []
  return [...new Set(
    input
      .map((jid) => {
        const normalized = ensureJid(jid, JID_KIND.GROUP)
        if (!normalized) return null
        return detectKind(normalized) === JID_KIND.CHANNEL
          ? ensureJid(jid, JID_KIND.CHANNEL)
          : normalized
      })
      .filter(Boolean),
  )]
}

async function loadUserPlanSubject(userId) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { plan: true, accessExpiresAt: true },
  })

  return user ?? { plan: 'basic', accessExpiresAt: null }
}

function enforceChannelPlanGate(targetJids, planSubject) {
  if (canUseChannels(planSubject)) return null
  const hasChannelDestination = targetJids.some((jid) => detectKind(jid) === JID_KIND.CHANNEL)
  return hasChannelDestination ? buildFeatureGateError() : null
}

export async function broadcastRoutes(app, deps = {}) {
  const sendBroadcastImpl = deps.sendBroadcast ?? sendBroadcast
  const isRunningImpl = deps.isRunning ?? isRunning

  app.post('/send', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { text, jids } = req.body ?? {}
    if (!text?.trim()) return reply.code(400).send({ error: 'text obrigatório' })
    if (!isRunningImpl(userId)) return reply.code(400).send({ error: 'Bot não está conectado' })

    const planSubject = await loadUserPlanSubject(userId)
    let targetJids = jids?.length ? normalizeTargetJids(jids) : null
    if (!targetJids) {
      const postGroups = await db.group.findMany({ where: { userId, role: 'post' } })
      targetJids = normalizeTargetJids(postGroups.map((g) => g.waJid))
    }

    const gateError = enforceChannelPlanGate(targetJids, planSubject)
    if (gateError) return reply.code(403).send(gateError)
    if (!targetJids.length) return reply.code(400).send({ error: 'Nenhum grupo/canal de destino configurado' })

    return sendBroadcastImpl(userId, text.trim(), targetJids)
  })

  app.get('/scheduled', { onRequest: [app.authenticate] }, async (req) => {
    const msgs = await db.scheduledMessage.findMany({
      where: { userId: req.user.sub, status: { not: 'cancelled' } },
      orderBy: { scheduledAt: 'asc' },
    })
    return msgs.map((m) => ({ ...m, targetJids: JSON.parse(m.targetJids) }))
  })

  app.post('/scheduled', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { text, scheduledAt, jids } = req.body ?? {}
    if (!text?.trim() || !scheduledAt) return reply.code(400).send({ error: 'text e scheduledAt obrigatórios' })

    const schedDate = new Date(scheduledAt)
    if (isNaN(schedDate.getTime()) || schedDate <= new Date()) {
      return reply.code(400).send({ error: 'scheduledAt deve ser uma data futura válida' })
    }

    const planSubject = await loadUserPlanSubject(userId)
    let targetJids = jids?.length ? normalizeTargetJids(jids) : null
    if (!targetJids) {
      const postGroups = await db.group.findMany({ where: { userId, role: 'post' } })
      targetJids = normalizeTargetJids(postGroups.map((g) => g.waJid))
    }

    const gateError = enforceChannelPlanGate(targetJids, planSubject)
    if (gateError) return reply.code(403).send(gateError)
    if (!targetJids.length) return reply.code(400).send({ error: 'Nenhum grupo/canal de destino configurado' })

    return db.scheduledMessage.create({
      data: { userId, text: text.trim(), targetJids: JSON.stringify(targetJids), scheduledAt: schedDate },
    })
  })

  app.delete('/scheduled/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const msg = await db.scheduledMessage.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
      select: { id: true, status: true },
    })
    if (!msg) return reply.code(404).send({ error: 'Mensagem não encontrada' })
    if (msg.status === 'cancelled') return { ok: true, alreadyCancelled: true }

    await db.scheduledMessage.update({ where: { id: req.params.id }, data: { status: 'cancelled' } })
    return { ok: true, alreadyCancelled: false }
  })
}
