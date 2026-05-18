import db from '../../db.js'
import { trackAnalyticsEventSafe } from '../../analytics.js'
import {
  reloadConfig as _reloadConfig,
  channelMetadata as _channelMetadata,
  followChannelImmediate as _followChannelImmediate,
  listFollowedChannels as _listFollowedChannels,
  isRunning as _isRunning,
} from '../../manager.js'
import { ensureJid, detectKind, parseChannelInviteUrl, JID_KIND } from '../../core/jid.js'
import { canFollowNow, logFollow } from '../../core/followGuard.js'
import { getHealth as getChannelHealth } from '../../core/channelHealth.js'
import { captureSnapshot } from '../../jobs/channelSnapshot.js'
import { FORWARD_MODE, NO_LINK_SCOPE, normalizeForwardingPolicy } from '../../forwardingPolicy.js'

const ALLOWED_KINDS = new Set([JID_KIND.GROUP, JID_KIND.CHANNEL])

function parseBoolean(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value === 'true'
  return Boolean(value)
}

function normalizeGroupJid(rawJid) {
  return ensureJid(rawJid, JID_KIND.GROUP)
}

export async function groupsRoutes(app, opts = {}) {
  const reloadConfig = opts.reloadConfig ?? _reloadConfig
  const channelMetadata = opts.channelMetadata ?? _channelMetadata
  const followChannelImmediate = opts.followChannelImmediate ?? _followChannelImmediate
  const listFollowedChannelsFn = opts.listFollowedChannels ?? _listFollowedChannels
  const isRunning = opts.isRunning ?? _isRunning
  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    return db.group.findMany({ where: { userId: req.user.sub } })
  })

  app.post('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { waJid: rawJid, name: rawName, role, kind: rawKind } = req.body ?? {}
    const kind = (rawKind ?? JID_KIND.GROUP).toString()
    if (!ALLOWED_KINDS.has(kind)) return reply.code(400).send({ error: 'kind deve ser group ou channel' })
    const waJid = ensureJid(rawJid, kind === JID_KIND.CHANNEL ? JID_KIND.CHANNEL : JID_KIND.GROUP)
    const name = rawName?.trim()
    if (!waJid || !name || !role) return reply.code(400).send({ error: 'waJid, name e role obrigatórios' })
    if (!['monitor', 'post'].includes(role)) return reply.code(400).send({ error: 'role deve ser monitor ou post' })
    if (detectKind(waJid) !== kind) return reply.code(400).send({ error: `waJid não bate com kind=${kind}` })

    try {
      const group = await db.group.create({
        data: { userId: req.user.sub, waJid, name, role, kind, forwardMode: FORWARD_MODE.LINK_ONLY },
      })
      trackAnalyticsEventSafe({
        userId: req.user.sub,
        event: role === 'monitor' ? 'monitor_group_created' : 'post_group_created',
        metadata: { role, kind },
      })
      const configReloaded = reloadConfig(req.user.sub)
      app.log.info({ groupId: group.id, role, kind, configReloaded }, 'Grupo/canal criado; configuração do worker recarregada quando disponível')
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

    const configReloaded = reloadConfig(req.user.sub)
    app.log.info({ monitorId: monitor.id, postCount: postIds.length, configReloaded }, 'Destinos do grupo monitor atualizados; configuração do worker recarregada quando disponível')
    return { postIds }
  })

  app.put('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo não encontrado' })

    const { blockedKeywords, allowedPlatforms, welcomeMsg, imageMode, imageLinkTarget, fallbackToOriginal, forwardMode, noLinkScope } = req.body ?? {}
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

    if (forwardMode !== undefined && !Object.values(FORWARD_MODE).includes(forwardMode)) {
      return reply.code(400).send({ error: 'forwardMode inválido' })
    }
    if (noLinkScope !== undefined && !Object.values(NO_LINK_SCOPE).includes(noLinkScope)) {
      return reply.code(400).send({ error: 'noLinkScope inválido' })
    }
    if (forwardMode === FORWARD_MODE.LINK_ONLY && noLinkScope !== undefined && noLinkScope !== null) {
      return reply.code(400).send({ error: 'noLinkScope só pode ser usado com forwardMode=ALLOW_NO_LINK' })
    }

    const currentPolicy = normalizeForwardingPolicy(group)
    const requestedForwardMode = forwardMode ?? currentPolicy.forwardMode
    const requestedNoLinkScope = requestedForwardMode === FORWARD_MODE.ALLOW_NO_LINK
      ? (noLinkScope ?? currentPolicy.noLinkScope ?? NO_LINK_SCOPE.TEXT_ONLY)
      : null

    const updated = await db.group.update({
      where: { id: req.params.id },
      data: {
        ...(blockedKeywords !== undefined ? { blockedKeywords: String(blockedKeywords).trim() || null } : {}),
        ...(allowedPlatforms !== undefined ? { allowedPlatforms: String(allowedPlatforms).trim() || null } : {}),
        ...(welcomeMsg !== undefined ? { welcomeMsg: String(welcomeMsg).trim() || null } : {}),
        ...(imageMode !== undefined ? { imageMode } : {}),
        ...(imageLinkTarget !== undefined ? { imageLinkTarget } : {}),
        ...(fallbackToOriginal !== undefined ? { fallbackToOriginal: parseBoolean(fallbackToOriginal) } : {}),
        ...(forwardMode !== undefined ? { forwardMode: requestedForwardMode } : {}),
        ...((noLinkScope !== undefined || forwardMode !== undefined) ? { noLinkScope: requestedNoLinkScope } : {}),
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
    const configReloaded = reloadConfig(req.user.sub)
    app.log.info({ groupId: group.id, role: group.role, configReloaded }, 'Grupo removido; configuração do worker recarregada quando disponível')
    return { ok: true }
  })

  app.post('/resolve-channel-invite', { onRequest: [app.authenticate] }, async (req, reply) => {
    const url = req.body?.url
    const inviteCode = typeof url === 'string' ? parseChannelInviteUrl(url) : null
    if (!inviteCode) return reply.code(400).send({ error: 'URL de convite de canal inválida' })
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado. Conecte primeiro.' })
    try {
      const data = await channelMetadata(req.user.sub, { inviteCode })
      if (!data) return reply.code(404).send({ error: 'Canal não encontrado. Confira o link.' })
      return data
    } catch (err) {
      req.log.warn({ err: err.message, inviteCode }, 'resolve-channel-invite falhou')
      return reply.code(502).send({ error: err.message || 'Falha ao buscar canal' })
    }
  })

  app.post('/resolve-channel-jid', { onRequest: [app.authenticate] }, async (req, reply) => {
    const jid = typeof req.body?.jid === 'string' ? req.body.jid.trim() : ''
    if (detectKind(jid) !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'JID deve terminar com @newsletter' })
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado.' })
    try {
      const data = await channelMetadata(req.user.sub, { jid })
      if (!data) return reply.code(404).send({ error: 'Canal não encontrado' })
      return data
    } catch (err) {
      req.log.warn({ err: err.message, jid }, 'resolve-channel-jid falhou')
      return reply.code(502).send({ error: err.message })
    }
  })

  app.post('/:id/follow-now', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo/canal não encontrado' })
    if (group.kind !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'follow-now só vale pra canais' })
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado.' })

    const guard = await canFollowNow(req.user.sub)
    if (!guard.ok) {
      const retryAfterSec = Math.max(1, Math.ceil((guard.retryAfterMs ?? 60_000) / 1000))
      reply.header('Retry-After', String(retryAfterSec))
      return reply.code(429).send({
        error: 'Limite anti-ban atingido',
        reason: guard.reason,
        retryAfterMs: guard.retryAfterMs,
        dailyUsed: guard.dailyUsed,
        dailyCap: guard.dailyCap,
      })
    }

    try {
      const data = await followChannelImmediate(req.user.sub, group.waJid)
      await logFollow(req.user.sub, group.waJid, 'ok').catch(() => {})
      return data
    } catch (err) {
      req.log.warn({ err: err.message, groupId: group.id }, 'follow-now falhou')
      await logFollow(req.user.sub, group.waJid, 'error', err.message ?? null).catch(() => {})
      return reply.code(502).send({ error: err.message || 'Falha ao seguir canal' })
    }
  })

  app.get('/:id/snapshots', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo/canal não encontrado' })
    if (group.kind !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'snapshots só vale pra canais' })
    return db.channelSnapshot.findMany({
      where: { groupId: group.id },
      orderBy: { snapshotedAt: 'desc' },
      take: 30,
    })
  })

  app.post('/:id/snapshot-now', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo/canal não encontrado' })
    if (group.kind !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'snapshot só vale pra canais' })
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado.' })
    try {
      const row = await captureSnapshot(group.id, {
        userId: req.user.sub,
        waJid: group.waJid,
        getMetadata: channelMetadata,
      })
      if (!row) return reply.code(502).send({ error: 'Não foi possível obter metadata do canal' })
      return row
    } catch (err) {
      req.log.warn({ err: err.message, groupId: group.id }, 'snapshot-now falhou')
      return reply.code(502).send({ error: err.message ?? 'Falha ao capturar snapshot' })
    }
  })

  app.post('/:id/recreate', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo/canal não encontrado' })
    if (group.kind !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'recreate só vale pra canais' })
    const newJid = req.body?.newJid
    if (!newJid || typeof newJid !== 'string' || !newJid.endsWith('@newsletter')) {
      return reply.code(400).send({ error: 'newJid inválido (deve terminar em @newsletter)' })
    }
    if (newJid === group.waJid) {
      return reply.code(400).send({ error: 'newJid é igual ao JID atual' })
    }
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado.' })

    // Valida ownership do novo canal antes de trocar.
    let meta
    try {
      meta = await channelMetadata(req.user.sub, { jid: newJid })
    } catch (err) {
      req.log.warn({ err: err.message, newJid }, 'recreate: falha ao buscar metadata do novo canal')
      return reply.code(502).send({ error: 'Não foi possível verificar o novo canal' })
    }
    if (!meta) return reply.code(404).send({ error: 'Novo canal não encontrado no WhatsApp' })
    if (!meta.isViewerOwner) return reply.code(403).send({ error: 'Você não é admin do novo canal' })

    const updated = await db.group.update({
      where: { id: group.id },
      data: { waJid: newJid, name: meta.name || group.name },
    })
    // Reset health/throttle do canal pra começar limpo no novo JID.
    await db.channelHealth.deleteMany({ where: { groupId: group.id } }).catch(() => {})
    await db.channelThrottle.deleteMany({ where: { groupId: group.id } }).catch(() => {})

    return { group: updated, owner: meta.owner, name: meta.name }
  })

  app.get('/:id/health', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo/canal não encontrado' })
    if (group.kind !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'health só vale pra canais' })
    return getChannelHealth(group.id)
  })

  app.post('/:id/refresh-admin', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo/canal não encontrado' })
    if (group.kind !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'refresh-admin só vale pra canais' })
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado.' })
    try {
      const data = await channelMetadata(req.user.sub, { jid: group.waJid })
      if (!data) return reply.code(404).send({ error: 'Canal não encontrado no WhatsApp' })
      return { isViewerOwner: data.isViewerOwner, owner: data.owner, name: data.name }
    } catch (err) {
      req.log.warn({ err: err.message, groupId: group.id }, 'refresh-admin falhou')
      return reply.code(502).send({ error: err.message || 'Falha ao verificar canal' })
    }
  })

  app.get('/wa/channels', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado.' })
    try {
      const data = await listFollowedChannelsFn(req.user.sub)
      return data ?? []
    } catch (err) {
      req.log.warn({ err: err.message }, 'wa/channels falhou')
      return reply.code(502).send({ error: err.message || 'Falha ao listar canais' })
    }
  })
}
