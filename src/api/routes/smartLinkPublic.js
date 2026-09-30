// GET /g/:slug — endereço público do Link Inteligente (sem prefixo, como /r/:hash).
// Redireciona (302) para o convite do grupo mais vazio. Nunca redireciona para
// fora de chat.whatsapp.com e nunca fica em cache: cada acesso precisa passar aqui.

import dbDefault from '../../db.js'
import { createReserveTracker, inviteUrl, normalizeSlug, pickGroup } from '../../core/smartLinkPicker.js'
import { createTrackGuard } from './affiliateTrackGuard.js'
import { isNonHumanUserAgent } from './clickTracker.js'

const CACHE_TTL_MS = 10_000
// Muita gente atrás do mesmo IP (rede móvel/CGNAT): o limite por IP é folgado.
// Serve contra abuso de robô, não contra tráfego normal do link divulgado.
const RATE_MAX_PER_MIN = Number(process.env.SMART_LINK_RATE_MAX) || 120

const saoPauloDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)

const page = (title, message) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title><style>body{font-family:system-ui,sans-serif;background:#EEF6F2;color:#1F2D2A;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center}main{max-width:420px}h1{font-size:1.25rem;margin:0 0 8px}p{color:#5A6E68;margin:0}</style></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`

export async function smartLinkPublicRoutes(app, options = {}) {
  const db = options.db ?? dbDefault
  const now = options.now ?? (() => Date.now())
  const guard = options.guard ?? createTrackGuard({ rateMax: RATE_MAX_PER_MIN, now })
  const reserve = createReserveTracker()
  const lastPicked = new Map()
  const cache = new Map()

  const cleanup = setInterval(() => guard.cleanup(), 5 * 60_000)
  cleanup.unref?.()
  app.addHook('onClose', async () => clearInterval(cleanup))

  async function loadLink(slug) {
    const hit = cache.get(slug)
    if (hit && hit.expiresAt > now()) return hit.value
    const link = await db.smartLink.findUnique({
      where: { slug },
      select: {
        id: true, enabled: true, capPerGroup: true,
        groups: { select: { id: true, groupId: true, inviteCode: true, enabled: true } },
      },
    })
    let value = null
    if (link) {
      const groups = []
      for (const g of link.groups) {
        const sample = await db.groupMemberSample.findFirst({
          where: { groupId: g.groupId }, orderBy: { sampledAt: 'desc' }, select: { size: true, sampledAt: true },
        })
        groups.push({ ...g, size: sample?.size ?? null, sampledAtMs: sample?.sampledAt ? new Date(sample.sampledAt).getTime() : 0 })
      }
      value = { id: link.id, enabled: link.enabled, capPerGroup: link.capPerGroup, groups }
    }
    cache.set(slug, { value, expiresAt: now() + CACHE_TTL_MS })
    if (cache.size > 5000) cache.clear()
    return value
  }

  app.get('/g/:slug', async (req, reply) => {
    reply.header('cache-control', 'private, no-store, max-age=0')
    reply.header('x-robots-tag', 'noindex, nofollow')
    reply.type('text/html; charset=utf-8')

    const slug = normalizeSlug(req.params.slug)
    if (!slug) return reply.code(404).send(page('Link não encontrado', 'Confira o endereço e tente de novo.'))
    if (guard.rateLimited(req.ip)) return reply.code(429).send(page('Muitos acessos', 'Aguarde um minuto e tente de novo.'))

    const link = await loadLink(slug)
    if (!link || !link.enabled) return reply.code(404).send(page('Link não encontrado', 'Este link não está disponível.'))

    const candidates = link.groups.map(g => ({
      id: g.id, enabled: g.enabled, inviteCode: g.inviteCode, size: g.size,
      reserved: reserve.get(g.id, g.sampledAtMs), lastPickedAt: lastPicked.get(g.id) ?? 0,
    }))
    const { group, reason } = pickGroup(candidates, { cap: link.capPerGroup })
    if (!group) {
      // 200 de propósito: página de erro 5xx pode ser trocada pela do Cloudflare.
      return reply.code(200).send(reason === 'all_full'
        ? page('Grupos lotados', 'Todos os grupos estão cheios no momento. Tente novamente mais tarde.')
        : page('Link indisponível', 'Este link ainda não tem grupos disponíveis.'))
    }

    // Robô de checagem/preview não é gente: redireciona, mas não reserva vaga nem conta clique.
    if (!isNonHumanUserAgent(req.headers['user-agent'])) {
      const chosen = link.groups.find(g => g.id === group.id)
      reserve.add(group.id, chosen?.sampledAtMs ?? 0)
      lastPicked.set(group.id, now())
      db.smartLinkDailyClick.upsert({
        where: { smartLinkGroupId_day: { smartLinkGroupId: group.id, day: saoPauloDay(new Date(now())) } },
        create: { smartLinkGroupId: group.id, day: saoPauloDay(new Date(now())), clicks: 1 },
        update: { clicks: { increment: 1 } },
      }).catch(err => req.log.warn({ err: err?.message, smartLinkGroupId: group.id }, 'clique do link inteligente não contado'))
    }
    return reply.redirect(inviteUrl(group.inviteCode), 302)
  })
}
