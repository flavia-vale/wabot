import db from '../../db.js'
import { trackAnalyticsEventSafe } from '../../analytics.js'

function normalizeGroupJid(rawJid) {
  const jid = String(rawJid ?? '').trim()
  if (!jid) return null
  if (jid.includes('@')) return jid
  return `${jid}@g.us`
}

export async function groupsRoutes(app) {
  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    return db.group.findMany({ where: { userId: req.user.sub } })
  })

  app.post('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { waJid: rawJid, name: rawName, role } = req.body ?? {}
    const waJid = normalizeGroupJid(rawJid)
    const name = rawName?.trim()
    if (!waJid || !name || !role) return reply.code(400).send({ error: 'waJid, name e role obrigatórios' })
    if (!['monitor', 'post'].includes(role)) return reply.code(400).send({ error: 'role deve ser monitor ou post' })

    try {
      const group = await db.group.create({
        data: { userId: req.user.sub, waJid, name, role },
      })
      trackAnalyticsEventSafe({
        userId: req.user.sub,
        event: role === 'monitor' ? 'monitor_group_created' : 'post_group_created',
        metadata: { role },
      })
      return group
    } catch (err) {
      if (err.code === 'P2002') return reply.code(409).send({ error: 'Grupo já cadastrado com esse role' })
      throw err
    }
  })

  app.put('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo não encontrado' })

    const { imageMode, imageLinkTarget, fallbackToOriginal } = req.body ?? {}
    if (imageMode !== undefined && !['none', 'original', 'fetch'].includes(imageMode)) {
      return reply.code(400).send({ error: 'imageMode deve ser none, original ou fetch' })
    }
    if (imageLinkTarget !== undefined && !['first', 'last'].includes(imageLinkTarget)) {
      return reply.code(400).send({ error: 'imageLinkTarget deve ser first ou last' })
    }
    if (fallbackToOriginal !== undefined && typeof fallbackToOriginal !== 'boolean') {
      return reply.code(400).send({ error: 'fallbackToOriginal deve ser boolean' })
    }

    const updated = await db.group.update({
      where: { id: req.params.id },
      data: {
        ...(imageMode !== undefined ? { imageMode } : {}),
        ...(imageLinkTarget !== undefined ? { imageLinkTarget } : {}),
        ...(fallbackToOriginal !== undefined ? { fallbackToOriginal } : {}),
      },
    })
    return updated
  })

  app.delete('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo não encontrado' })
    await db.group.delete({ where: { id: req.params.id } })
    return { ok: true }
  })
}
