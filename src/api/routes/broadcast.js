import dbDefault from '../../db.js'
import { sendBroadcast, isRunning } from '../../manager.js'
import { enforceChannelPlanGate, loadUserPlanSubject, resolveTargetJids, validateBroadcastText } from './broadcastTargets.js'

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
    validateBroadcastText(text)
    if (!await isRunningImpl(userId)) return reply.code(400).send({ error: 'Bot não está conectado' })

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
      where: { userId: req.user.sub, status: { in: ['pending', 'queued'] } },
      orderBy: { scheduledAt: 'asc' },
    })
    return msgs.map((message) => ({ ...message, targetJids: JSON.parse(message.targetJids) }))
  })

  app.post('/scheduled', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { text, scheduledAt, jids, imageUrl, imageRefererUrl } = req.body ?? {}
    if (!text?.trim() || !scheduledAt) return reply.code(400).send({ error: 'text e scheduledAt obrigatórios' })
    validateBroadcastText(text)

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
    const cancelled = await db.scheduledMessage.updateMany({
      where: { id: req.params.id, userId: req.user.sub, status: 'pending' },
      data: { status: 'cancelled' },
    })
    if (cancelled.count === 1) return { ok: true }

    const existing = await db.scheduledMessage.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
      select: { status: true },
    })
    if (!existing) return reply.code(404).send({ error: 'Mensagem agendada não encontrada' })

    return reply.code(409).send({
      error: 'Somente agendamentos pendentes podem ser cancelados',
      status: existing.status,
    })
  })
}
