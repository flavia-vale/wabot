// PR-5 click tracker foundation: redirect público + endpoints autenticados.
// Registrado sem prefixo (em server.js) — GET /r/:hash precisa ser raiz para
// caber em URLs curtas tipo https://s.example.com/r/abc12345.

import db from '../../db.js'
import { createShortlink, resolveShortlink, recordClick, getClickStats } from '../../core/clickTracker.js'
import { JID_KIND } from '../../core/jid.js'
import { isSafePublicUrl } from '../../core/ssrfGuard.js'

export async function clickTrackerRoutes(app, opts = {}) {
  // Endpoint público: 302 redireciona pro originalUrl e loga click async.
  // Falha em logar NUNCA bloqueia o redirect — UX > telemetria.
  app.get('/r/:hash', async (req, reply) => {
    const link = await resolveShortlink(req.params.hash)
    if (!link) return reply.code(404).send({ error: 'Link não encontrado' })

    // API-4 (defesa em profundidade): nunca redireciona para esquema não-http(s)
    // ou host interno, mesmo que algo assim tenha sido persistido.
    if (!isSafePublicUrl(link.originalUrl)) {
      req.log.warn({ linkId: link.id }, 'Shortlink com destino inseguro bloqueado no redirect')
      return reply.code(404).send({ error: 'Link não encontrado' })
    }

    // Hash do IP considera X-Forwarded-For atrás de proxy (já confiável
    // porque trustProxy=true no server). UA bate direto.
    const ip = req.ip
    const ua = req.headers['user-agent']
    recordClick(link.id, { ip, userAgent: ua }).catch(err => {
      req.log.warn({ err: err?.message, linkId: link.id }, 'recordClick falhou')
    })

    return reply.redirect(link.originalUrl, 302)
  })

  // Endpoint autenticado: cria um shortlink.
  app.post('/api/links/shortlink', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { originalUrl, groupId, messageLogId } = req.body ?? {}
    if (!originalUrl || typeof originalUrl !== 'string') {
      return reply.code(400).send({ error: 'originalUrl obrigatório' })
    }
    // API-4 (anti open-redirect): o shortlink é servido pelo domínio oficial;
    // só aceita destino http(s) público para não virar fachada de phishing.
    if (!isSafePublicUrl(originalUrl)) {
      return reply.code(400).send({ error: 'originalUrl deve ser um link público http(s) válido' })
    }
    // Validar groupId se fornecido (precisa pertencer ao user).
    if (groupId) {
      const group = await db.group.findFirst({ where: { id: groupId, userId: req.user.sub } })
      if (!group) return reply.code(404).send({ error: 'groupId inválido' })
    }
    try {
      const result = await createShortlink(req.user.sub, originalUrl, { groupId, messageLogId })
      return result
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })

  // Estatísticas de clicks por canal.
  app.get('/api/groups/:id/clicks', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo/canal não encontrado' })
    if (group.kind !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'clicks só vale pra canais' })
    const daysRaw = Number(req.query?.days)
    const days = Number.isFinite(daysRaw) && daysRaw >= 1 && daysRaw <= 90 ? Math.floor(daysRaw) : 7
    return getClickStats({ groupId: group.id, days })
  })
}
