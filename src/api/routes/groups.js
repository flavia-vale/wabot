import db from '../../db.js'

export async function groupsRoutes(app) {
  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    return db.group.findMany({ where: { userId: req.user.sub } })
  })

  app.post('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { waJid, name, role } = req.body ?? {}
    if (!waJid || !name || !role) return reply.code(400).send({ error: 'waJid, name e role obrigatórios' })
    if (!['monitor', 'post'].includes(role)) return reply.code(400).send({ error: 'role deve ser monitor ou post' })

    try {
      const group = await db.group.create({
        data: { userId: req.user.sub, waJid, name, role },
      })
      return group
    } catch (err) {
      if (err.code === 'P2002') return reply.code(409).send({ error: 'Grupo já cadastrado com esse role' })
      throw err
    }
  })

  app.delete('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo não encontrado' })
    await db.group.delete({ where: { id: req.params.id } })
    return { ok: true }
  })
}
