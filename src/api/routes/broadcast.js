import db from '../../db.js'
import { sendBroadcast, isRunning } from '../../manager.js'

export async function broadcastRoutes(app) {
  app.post('/send', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { text, jids } = req.body ?? {}
    if (!text?.trim()) return reply.code(400).send({ error: 'text obrigatório' })
    if (!isRunning(userId)) return reply.code(400).send({ error: 'Bot não está conectado' })

    let targetJids = jids?.length ? jids : null
    if (!targetJids) {
      const postGroups = await db.group.findMany({ where: { userId, role: 'post' } })
      targetJids = postGroups.map(g => g.waJid)
    }
    if (!targetJids.length) return reply.code(400).send({ error: 'Nenhum grupo de destino configurado' })

    const result = await sendBroadcast(userId, text.trim(), targetJids)
    return result
  })

  app.get('/scheduled', { onRequest: [app.authenticate] }, async (req) => {
    const msgs = await db.scheduledMessage.findMany({
      where: { userId: req.user.sub, status: { not: 'cancelled' } },
      orderBy: { scheduledAt: 'asc' },
    })
    return msgs.map(m => ({ ...m, targetJids: JSON.parse(m.targetJids) }))
  })

  app.post('/scheduled', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { text, scheduledAt, jids } = req.body ?? {}
    if (!text?.trim() || !scheduledAt) return reply.code(400).send({ error: 'text e scheduledAt obrigatórios' })

    const schedDate = new Date(scheduledAt)
    if (isNaN(schedDate.getTime()) || schedDate <= new Date()) {
      return reply.code(400).send({ error: 'scheduledAt deve ser uma data futura válida' })
    }

    let targetJids = jids?.length ? jids : null
    if (!targetJids) {
      const postGroups = await db.group.findMany({ where: { userId, role: 'post' } })
      targetJids = postGroups.map(g => g.waJid)
    }
    if (!targetJids.length) return reply.code(400).send({ error: 'Nenhum grupo de destino configurado' })

    const msg = await db.scheduledMessage.create({
      data: { userId, text: text.trim(), targetJids: JSON.stringify(targetJids), scheduledAt: schedDate },
    })
    return msg
  })

  app.delete('/scheduled/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const msg = await db.scheduledMessage.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
    })
    if (!msg) return reply.code(404).send({ error: 'Mensagem não encontrada' })
    await db.scheduledMessage.update({ where: { id: req.params.id }, data: { status: 'cancelled' } })
    return { ok: true }
  })
}
