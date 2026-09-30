import dbDefault from '../../db.js'
import { groupInviteCode as _groupInviteCode } from '../../manager.js'
import { captureMemberSamplesForUser } from '../../jobs/groupMemberSamples.js'
import { buildFeatureGateError, canUseSmartLinks, FEATURE_CODES } from '../../billing/plans.js'
import { DEFAULT_CAP_PER_GROUP, isValidInviteCode, normalizeCap, normalizeSlug } from '../../core/smartLinkPicker.js'
import { pickWorstLink } from '../../core/smartLinkOccupancy.js'
import { loadSmartLinkStats } from '../../core/smartLinkStats.js'

const MAX_LINKS_PER_USER = 20
const MAX_GROUPS_PER_LINK = 30
const NAME_MAX = 80

const saoPauloDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)

// Link Inteligente: cadastro e painel (autenticado, PRO). O redirect público
// fica em smartLinkPublic.js. Só quantidade e convite; nunca telefones.
export async function smartLinksRoutes(app, options = {}) {
  const db = options.db ?? dbDefault
  const groupInviteCode = options.groupInviteCode ?? _groupInviteCode
  const captureSamples = options.captureSamples ?? captureMemberSamplesForUser
  const now = options.now ?? (() => new Date())
  const loadPlanSubject = options.loadPlanSubject
    ?? (userId => db.user.findUnique({ where: { id: userId }, select: { plan: true, accessExpiresAt: true } }))

  app.addHook('preHandler', async (req, reply) => {
    const subject = await loadPlanSubject(req.user.sub)
    if (!canUseSmartLinks(subject ?? { plan: 'basic' })) {
      return reply.code(403).send(buildFeatureGateError(FEATURE_CODES.SMART_LINKS))
    }
  })

  const ownedLink = (userId, id) => db.smartLink.findFirst({ where: { id, userId, deletedAt: null } })

  // O robô precisa ser admin: o WhatsApp só entrega o convite para admin.
  async function fetchInvite(userId, waJid) {
    try {
      const data = await groupInviteCode(userId, waJid)
      const code = typeof data === 'string' ? data : data?.code
      if (!isValidInviteCode(code)) return { error: 'O WhatsApp não devolveu um convite válido. O robô precisa ser admin do grupo.' }
      return { code }
    } catch (err) {
      const raw = String(err?.message ?? '')
      if (/não está rodando|não conectado/i.test(raw)) return { error: 'Conecte o WhatsApp para buscar o convite do grupo.', status: 409 }
      return { error: 'Não foi possível buscar o convite. Confirme que o robô é admin deste grupo e tente de novo.' }
    }
  }

  // Nada interno sai para a tela: sem id de usuária e sem o estado bruto do aviso.
  const presentLink = ({ userId, alert, ...link }) => ({
    ...link,
    lastAlert: alert?.kind ? { kind: alert.kind, sentAt: alert.lastSentAt ? new Date(alert.lastSentAt).toISOString() : null } : null,
  })
  const loadLinkStats = async (userId) => (await loadSmartLinkStats({ db, where: { userId, deletedAt: null }, now: now() })).map(presentLink)

  app.get('/', { onRequest: [app.authenticate] }, async (req) => ({ links: await loadLinkStats(req.user.sub) }))

  // Card do painel principal: só o que ele precisa (sem a lista de grupos).
  app.get('/summary', { onRequest: [app.authenticate] }, async (req) => {
    const links = (await loadLinkStats(req.user.sub)).filter(l => l.enabled)
    const summaries = links.map(l => ({ id: l.id, name: l.name, path: l.path, capPerGroup: l.capPerGroup, groupCount: l.groups.length, ...l.occupancy }))
    return { linkCount: links.length, worst: pickWorstLink(summaries) }
  })

  app.post('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const name = String(req.body?.name ?? '').trim().slice(0, NAME_MAX)
    if (!name) return reply.code(400).send({ error: 'Dê um nome para o link.' })
    const slug = normalizeSlug(req.body?.slug)
    if (!slug) return reply.code(400).send({ error: 'Nome do endereço inválido. Use de 3 a 40 letras minúsculas, números ou hífen (ex.: promo-tech).' })
    if (await db.smartLink.count({ where: { userId: req.user.sub, deletedAt: null } }) >= MAX_LINKS_PER_USER) {
      return reply.code(409).send({ error: `Limite de ${MAX_LINKS_PER_USER} links inteligentes.` })
    }
    const taken = { error: 'Este endereço já está em uso. Escolha outro.' }
    const existing = await db.smartLink.findUnique({ where: { slug }, select: { id: true, userId: true, deletedAt: true } })
    try {
      if (existing) {
        // Endereço apagado continua reservado para quem o divulgou: só a mesma
        // dona reativa (sem os grupos antigos); nenhuma outra pessoa o pega.
        if (existing.deletedAt && existing.userId === req.user.sub) {
          await db.smartLinkGroup.deleteMany({ where: { smartLinkId: existing.id } })
          await db.smartLink.update({ where: { id: existing.id }, data: { name, enabled: true, deletedAt: null, capPerGroup: DEFAULT_CAP_PER_GROUP } })
          return reply.code(201).send({ id: existing.id, slug, path: `/g/${slug}` })
        }
        return reply.code(409).send(taken)
      }
      const link = await db.smartLink.create({ data: { userId: req.user.sub, name, slug, capPerGroup: DEFAULT_CAP_PER_GROUP } })
      return reply.code(201).send({ id: link.id, slug: link.slug, path: `/g/${link.slug}` })
    } catch (err) {
      // Corrida entre dois cadastros do mesmo endereço (unique no banco).
      if (err?.code === 'P2002') return reply.code(409).send(taken)
      throw err
    }
  })

  app.patch('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const link = await ownedLink(req.user.sub, req.params.id)
    if (!link) return reply.code(404).send({ error: 'Link não encontrado.' })
    const data = {}
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim().slice(0, NAME_MAX)
      if (!name) return reply.code(400).send({ error: 'Dê um nome para o link.' })
      data.name = name
    }
    if (req.body?.enabled !== undefined) {
      if (typeof req.body.enabled !== 'boolean') return reply.code(400).send({ error: 'Valor inválido.' })
      data.enabled = req.body.enabled
    }
    for (const field of ['notifyEmail', 'notifyWhatsapp']) {
      if (req.body?.[field] === undefined) continue
      if (typeof req.body[field] !== 'boolean') return reply.code(400).send({ error: 'Valor inválido.' })
      data[field] = req.body[field]
    }
    if (req.body?.capPerGroup !== undefined) {
      const cap = normalizeCap(req.body.capPerGroup)
      if (cap == null) return reply.code(400).send({ error: 'O limite por grupo deve ficar entre 50 e 1024 membros.' })
      data.capPerGroup = cap
    }
    await db.smartLink.update({ where: { id: link.id }, data })
    return { ok: true }
  })

  app.delete('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const link = await ownedLink(req.user.sub, req.params.id)
    if (!link) return reply.code(404).send({ error: 'Link não encontrado.' })
    await db.smartLinkGroup.deleteMany({ where: { smartLinkId: link.id } })
    await db.smartLink.update({ where: { id: link.id }, data: { deletedAt: new Date(), enabled: false } })
    return { ok: true }
  })

  app.post('/:id/groups', { onRequest: [app.authenticate] }, async (req, reply) => {
    const link = await ownedLink(req.user.sub, req.params.id)
    if (!link) return reply.code(404).send({ error: 'Link não encontrado.' })
    const group = await db.group.findFirst({
      where: { id: String(req.body?.groupId ?? ''), userId: req.user.sub, role: 'post', kind: 'group' },
      select: { id: true, waJid: true },
    })
    if (!group) return reply.code(404).send({ error: 'Grupo de destino não encontrado.' })
    if (await db.smartLinkGroup.count({ where: { smartLinkId: link.id } }) >= MAX_GROUPS_PER_LINK) {
      return reply.code(409).send({ error: `Máximo de ${MAX_GROUPS_PER_LINK} grupos por link.` })
    }
    if (await db.smartLinkGroup.findFirst({ where: { smartLinkId: link.id, groupId: group.id }, select: { id: true } })) {
      return reply.code(409).send({ error: 'Este grupo já está neste link.' })
    }
    const invite = await fetchInvite(req.user.sub, group.waJid)
    if (invite.error) return reply.code(invite.status ?? 422).send({ error: invite.error })
    let row
    try {
      row = await db.smartLinkGroup.create({ data: { smartLinkId: link.id, groupId: group.id, inviteCode: invite.code } })
    } catch (err) {
      if (err?.code === 'P2002') return reply.code(409).send({ error: 'Este grupo já está neste link.' })
      throw err
    }
    // Sem amostra o grupo só entraria no rodízio na próxima hora cheia (e, sendo
    // provavelmente o mais vazio, ficaria sem tráfego). Mede já — sem travar a resposta.
    void Promise.resolve(captureSamples(req.user.sub)).catch(err => req.log.warn({ err: err?.message }, 'amostra imediata do grupo falhou'))
    return reply.code(201).send({ id: row.id })
  })

  const ownedLinkGroup = (userId, id, linkGroupId) => db.smartLinkGroup.findFirst({
    where: { id: linkGroupId, smartLinkId: id, smartLink: { userId } },
    include: { group: { select: { waJid: true } } },
  })

  app.patch('/:id/groups/:linkGroupId', { onRequest: [app.authenticate] }, async (req, reply) => {
    const row = await ownedLinkGroup(req.user.sub, req.params.id, req.params.linkGroupId)
    if (!row) return reply.code(404).send({ error: 'Grupo não encontrado neste link.' })
    const data = {}
    if (req.body?.enabled !== undefined) {
      if (typeof req.body.enabled !== 'boolean') return reply.code(400).send({ error: 'Valor inválido.' })
      data.enabled = req.body.enabled
    }
    if (req.body?.refreshInvite) {
      const invite = await fetchInvite(req.user.sub, row.group.waJid)
      if (invite.error) return reply.code(invite.status ?? 422).send({ error: invite.error })
      data.inviteCode = invite.code
    }
    await db.smartLinkGroup.update({ where: { id: row.id }, data })
    return { ok: true }
  })

  app.delete('/:id/groups/:linkGroupId', { onRequest: [app.authenticate] }, async (req, reply) => {
    const row = await ownedLinkGroup(req.user.sub, req.params.id, req.params.linkGroupId)
    if (!row) return reply.code(404).send({ error: 'Grupo não encontrado neste link.' })
    await db.smartLinkGroup.delete({ where: { id: row.id } })
    return { ok: true }
  })
}
