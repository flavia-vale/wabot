import db from '../../db.js'
import { trackAnalyticsEventSafe } from '../../analytics.js'
import { reloadConfig } from '../../manager.js'

function parseBoolean(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value === 'true'
  return Boolean(value)
}

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

  app.get('/:id/targets', { onRequest: [app.authenticate] }, async (req, reply) => {
    const monitor = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub, role: 'monitor' } })
    if (!monitor) return reply.code(404).send({ error: 'Grupo monitor não encontrado' })

    const targets = await db.groupTarget.findMany({ where: { userId: req.user.sub, monitorId: monitor.id }, select: { postId: true } })
    return { postIds: targets.map(t => t.postId) }
  })

  app.put('/:id/targets', { onRequest: [app.authenticate] }, async (req, reply) => {
    const monitor = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub, role: 'monitor' } })
    if (!monitor) return reply.code(404).send({ error: 'Grupo monitor não encontrado' })

    const postIds = Array.isArray(req.body?.postIds) ? [...new Set(req.body.postIds.map(String))] : []
    const validPosts = await db.group.findMany({
      where: { userId: req.user.sub, role: 'post', id: { in: postIds } },
      select: { id: true },
    })
    if (validPosts.length !== postIds.length) return reply.code(400).send({ error: 'Lista de grupos destino inválida' })

    await db.$transaction([
      db.groupTarget.deleteMany({ where: { userId: req.user.sub, monitorId: monitor.id } }),
      ...postIds.map(postId => db.groupTarget.create({ data: { userId: req.user.sub, monitorId: monitor.id, postId } })),
    ])

    return { postIds }
  })

  app.put('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo não encontrado' })

    const { blockedKeywords, allowedPlatforms, welcomeMsg, imageMode, imageLinkTarget, fallbackToOriginal } = req.body ?? {}
    if (allowedPlatforms !== undefined) {
      const platforms = String(allowedPlatforms).split(',').filter(Boolean)
      const invalid = platforms.find(p => !['shopee', 'amazon', 'mercadolivre', 'magazineluiza'].includes(p))
      if (invalid) return reply.code(400).send({ error: 'allowedPlatforms contém plataforma inválida' })
    }

    if (imageMode !== undefined && !['none', 'fetch', 'original'].includes(imageMode)) {
      return reply.code(400).send({ error: 'imageMode inválido' })
    }
    if (imageLinkTarget !== undefined && !['first', 'last'].includes(imageLinkTarget)) {
      return reply.code(400).send({ error: 'imageLinkTarget inválido' })
    }

    const updated = await db.group.update({
      where: { id: req.params.id },
      data: {
        ...(blockedKeywords !== undefined ? { blockedKeywords: String(blockedKeywords).trim() || null } : {}),
        ...(allowedPlatforms !== undefined ? { allowedPlatforms: String(allowedPlatforms).trim() || null } : {}),
        ...(welcomeMsg !== undefined ? { welcomeMsg: String(welcomeMsg).trim() || null } : {}),
        ...(imageMode !== undefined ? { imageMode } : {}),
        ...(imageLinkTarget !== undefined ? { imageLinkTarget } : {}),
        ...(fallbackToOriginal !== undefined ? { fallbackToOriginal: parseBoolean(fallbackToOriginal) } : {}),
      },
    })
    const configReloaded = reloadConfig(req.user.sub)
    app.log.info({ groupId: updated.id, imageMode: updated.imageMode, imageLinkTarget: updated.imageLinkTarget, fallbackToOriginal: updated.fallbackToOriginal, configReloaded }, 'Grupo atualizado; configuração do worker recarregada quando disponível')
    return updated
  })

  app.delete('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo não encontrado' })
    await db.group.delete({ where: { id: req.params.id } })
    return { ok: true }
  })
}
