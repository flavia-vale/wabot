import dbDefault from '../../db.js'
import { sendBroadcast, isRunning } from '../../manager.js'
import { enforceChannelPlanGate, loadUserPlanSubject, resolveTargetJids } from './broadcastTargets.js'

function optionalUrl(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return /^https?:\/\//i.test(normalized) ? normalized : null
}

export async function broadcastRoutes(app, deps = {}) {
  const db = deps.db ?? dbDefault
  const sendBroadcastImpl = deps.sendBroadcast ?? sendBroadcast
  const isRunningImpl = deps.isRunning ?? isRunning
  const now = deps.now ?? (() => new Date())

  app.post('/send', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { text, jids, imageUrl, imageRefererUrl } = req.body ?? {}
    if (!text?.trim()) return reply.code(400).send({ error: 'text obrigatório' })
    if (!isRunningImpl(userId)) return reply.code(400).send({ error: 'Bot não está conectado' })

    const targetJids = await resolveTargetJids({ db, userId, jids })
    const gateError = enforceChannelPlanGate(targetJids, await loadUserPlanSubject(db, userId))
    if (gateError) return reply.code(403).send(gateError)
    if (!targetJids.length) return reply.code(400).send({ error: 'Nenhum grupo/canal de destino configurado' })

    return sendBroadcastImpl(userId, text.trim(), targetJids, {
      imageUrl: optionalUrl(imageUrl) ?? undefined,
      imageRefererUrl: optionalUrl(imageRefererUrl) ?? undefined,
    })
  })

  app.get('/scheduled', { onRequest: [app.authenticate] }, async (req) => {
    const msgs = await db.scheduledMessage.findMany({
      where: { userId: req.user.sub, status: { not: 'cancelled' } },
      orderBy: { scheduledAt: 'asc' },
    })
    return msgs.map((message) => ({ ...message, targetJids: JSON.parse(message.targetJids) }))
  })

  app.post('/scheduled', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { text, scheduledAt, jids, imageUrl, imageRefererUrl } = req.body ?? {}
    if (!text?.trim() || !scheduledAt) return reply.code(400).send({ error: 'text e scheduledAt obrigatórios' })

    const schedDate = new Date(scheduledAt)
    if (Number.isNaN(schedDate.getTime()) || schedDate <= now()) {
      return reply.code(400).send({ error: 'scheduledAt deve ser uma data futura válida' })
    }

    const targetJids = await resolveTargetJids({ db, userId, jids })
    const gateError = enforceChannelPlanGate(targetJids, await loadUserPlanSubject(db, userId))
    if (gateError) return reply.code(403).send(gateError)
    if (!targetJids.length) return reply.code(400).send({ error: 'Nenhum grupo/canal de destino configurado' })

    return db.scheduledMessage.create({
      data: {
        userId,
        text: text.trim(),
        targetJids: JSON.stringify(targetJids),
        scheduledAt: schedDate,
        imageUrl: optionalUrl(imageUrl),
        imageRefererUrl: optionalUrl(imageRefererUrl),
      },
    })
  })

  app.delete('/scheduled/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const msg = await db.scheduledMessage.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
      select: { id: true, status: true },
    })
    if (!msg) return reply.code(404).send({ error: 'Mensagem não encontrada' })
    if (msg.status === 'cancelled') return { ok: true, alreadyCancelled: true }

    await db.scheduledMessage.update({ where: { id: msg.id }, data: { status: 'cancelled' } })
    return { ok: true, alreadyCancelled: false }
  })
}
