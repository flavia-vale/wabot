// PR-5 click tracker foundation: redirect público + endpoints autenticados.
// Registrado sem prefixo (em server.js) — GET /r/:hash precisa ser raiz para
// caber em URLs curtas tipo https://s.example.com/r/abc12345.

import db from '../../db.js'
import { createShortlink, resolveShortlink, recordClick, getClickStats } from '../../core/clickTracker.js'
import { JID_KIND } from '../../core/jid.js'
import { isSafePublicUrl } from '../../core/ssrfGuard.js'
import { isTrackableAffiliateUrl } from '../../core/trackedLinks.js'

// Formato do hash gerado por generateHash (6 bytes → 8 chars base64url).
// Qualquer outra coisa nem chega no banco.
const HASH_RE = /^[A-Za-z0-9_-]{6,16}$/

// Robô de busca/checagem de link não é clique de gente. O redirect continua
// funcionando para ele; só não conta. Inclui cliente HTTP de servidor (UA
// vazio, `node`, `undici`...) — é o caso do preview automático do Baileys
// buscar o link que o próprio robô enviou. NÃO filtra "WhatsApp": o navegador
// embutido do app pode levar esse nome no UA, e aí é clique de verdade.
// `(?:^|[^a-z])bot` em vez de `bot` solto: celular "CUBOT" é gente.
const NON_HUMAN_UA_RE = /(?:^|[^a-z])(?:bot|crawler|spider)(?:[^a-z]|$)|[a-z]bot\/|facebookexternalhit|^node$|node-fetch|undici|axios\/|curl\/|wget\/|python|go-http-client|java\//i
export function isNonHumanUserAgent(ua) {
  const value = String(ua ?? '').trim()
  return !value || NON_HUMAN_UA_RE.test(value)
}

export async function clickTrackerRoutes(app, opts = {}) {
  // Endpoint público: 302 redireciona pro originalUrl e loga click async.
  // Falha em logar NUNCA bloqueia o redirect — UX > telemetria.
  app.get('/r/:hash', async (req, reply) => {
    // Link curto não é página: não indexa e não fica em cache (cada acesso
    // precisa chegar aqui para contar).
    reply.header('cache-control', 'private, no-store, max-age=0')
    reply.header('x-robots-tag', 'noindex, nofollow')
    if (!HASH_RE.test(String(req.params.hash ?? ''))) return reply.code(404).send({ error: 'Link não encontrado' })
    const link = await resolveShortlink(req.params.hash)
    if (!link) return reply.code(404).send({ error: 'Link não encontrado' })

    // API-4 (defesa em profundidade): nunca redireciona para esquema não-http(s)
    // ou host interno, mesmo que algo assim tenha sido persistido. E só para
    // link de LOJA (src/core/trackedLinks.js): o domínio oficial não vira
    // fachada de redirecionamento para qualquer site.
    if (!isSafePublicUrl(link.originalUrl) || !isTrackableAffiliateUrl(link.originalUrl)) {
      req.log.warn({ linkId: link.id }, 'Shortlink com destino inseguro bloqueado no redirect')
      return reply.code(404).send({ error: 'Link não encontrado' })
    }

    // Hash do IP considera X-Forwarded-For atrás de proxy (já confiável
    // porque trustProxy=true no server). UA bate direto.
    const ip = req.ip
    const ua = req.headers['user-agent']
    if (!isNonHumanUserAgent(ua)) {
      recordClick(link.id, { ip, userAgent: ua }).catch(err => {
        req.log.warn({ err: err?.message, linkId: link.id }, 'recordClick falhou')
      })
    }

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
    // Só link de loja: o /r/:hash recusa qualquer outro destino, então criar
    // um aqui só geraria link morto.
    if (!isTrackableAffiliateUrl(originalUrl)) {
      return reply.code(400).send({ error: 'originalUrl deve ser um link de loja (Shopee, Amazon, Mercado Livre, Magalu, SHEIN ou AliExpress)' })
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
      req.log.error({ err: err?.message }, 'createShortlink falhou')
      return reply.code(500).send({ error: 'Não foi possível criar o link agora. Tente novamente.' })
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
