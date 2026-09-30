// GET /g/:slug — endereço público do Link Inteligente (sem prefixo, como /r/:hash).
// Redireciona (302) para o convite do grupo mais vazio. Nunca redireciona para
// fora de chat.whatsapp.com e nunca fica em cache: cada acesso precisa passar aqui.

import dbDefault from '../../db.js'
import { createReserveTracker, inviteUrl, normalizeSlug, pickGroup } from '../../core/smartLinkPicker.js'
import { MEASURABLE_MAX_AGE_MS } from '../../core/smartLinkOccupancy.js'
import { createTrackGuard } from './affiliateTrackGuard.js'
import { isNonHumanUserAgent } from './clickTracker.js'

const CACHE_TTL_MS = 10_000
const CLICK_FLUSH_MS = 5_000
// Amostra mais velha que isto (sessão fora do ar, robô removido do grupo) deixa
// de valer como medida: o grupo passa a "sem medida" e só recebe tráfego se não
// houver grupo medido com vaga. Evita mandar gente ao grupo de tamanho velho.
const STALE_SAMPLE_MS = MEASURABLE_MAX_AGE_MS
// Limite geral por IP: FOLGADO, porque muita gente compartilha o mesmo IP na
// rede móvel (CGNAT) e o link é divulgado em vários lugares. Não é para barrar
// tráfego normal, só robô descontrolado.
const RATE_MAX_PER_MIN = Number(process.env.SMART_LINK_RATE_MAX) || 1200
// Limite dos ERROS (endereço que não existe): é assim que se varre endereços
// alheios. Bem mais baixo, e só conta quem erra.
const MISS_MAX_PER_MIN = Number(process.env.SMART_LINK_MISS_MAX) || 30

const saoPauloDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)

const page = (title, message) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title><style>body{font-family:system-ui,sans-serif;background:#EEF6F2;color:#1F2D2A;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center}main{max-width:420px}h1{font-size:1.25rem;margin:0 0 8px}p{color:#5A6E68;margin:0}</style></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`

export async function smartLinkPublicRoutes(app, options = {}) {
  const db = options.db ?? dbDefault
  const now = options.now ?? (() => Date.now())
  const guard = options.guard ?? createTrackGuard({ rateMax: RATE_MAX_PER_MIN, now })
  const missGuard = options.missGuard ?? createTrackGuard({ rateMax: MISS_MAX_PER_MIN, now })
  const reserve = createReserveTracker()
  const lastPicked = new Map()
  const cache = new Map()
  const inflight = new Map()
  // Cliques em memória, gravados em lote: um link divulgado em muitos lugares
  // pode dar dezenas de cliques por segundo e cada um virar escrita no SQLite
  // disputaria o banco com os envios do robô.
  const pendingClicks = new Map()

  async function flushClicks() {
    const batch = [...pendingClicks.values()]
    pendingClicks.clear()
    for (const item of batch) {
      try {
        await db.smartLinkDailyClick.upsert({
          where: { smartLinkGroupId_day: { smartLinkGroupId: item.smartLinkGroupId, day: item.day } },
          create: { smartLinkGroupId: item.smartLinkGroupId, day: item.day, clicks: item.n },
          update: { clicks: { increment: item.n } },
        })
      } catch (err) {
        app.log.warn({ err: err?.message, smartLinkGroupId: item.smartLinkGroupId }, 'cliques do link inteligente não gravados')
      }
    }
  }
  function countClick(smartLinkGroupId) {
    const day = saoPauloDay(new Date(now()))
    const key = `${smartLinkGroupId}|${day}`
    const cur = pendingClicks.get(key)
    if (cur) cur.n += 1
    else pendingClicks.set(key, { smartLinkGroupId, day, n: 1 })
  }

  const cleanup = setInterval(() => { guard.cleanup(); missGuard.cleanup() }, 5 * 60_000)
  const flusher = setInterval(() => { void flushClicks() }, options.clickFlushMs ?? CLICK_FLUSH_MS)
  cleanup.unref?.()
  flusher.unref?.()
  app.addHook('onClose', async () => {
    clearInterval(cleanup)
    clearInterval(flusher)
    await flushClicks()
  })

  async function fetchLink(slug) {
    const link = await db.smartLink.findUnique({
      where: { slug },
      select: {
        id: true, enabled: true, deletedAt: true, capPerGroup: true,
        groups: { select: { id: true, groupId: true, inviteCode: true, enabled: true } },
      },
    })
    if (!link || link.deletedAt) return null
    const groups = []
    for (const g of link.groups) {
      const sample = await db.groupMemberSample.findFirst({
        where: { groupId: g.groupId }, orderBy: { sampledAt: 'desc' }, select: { size: true, sampledAt: true },
      })
      const sampledAtMs = sample?.sampledAt ? new Date(sample.sampledAt).getTime() : 0
      const stale = !sample || now() - sampledAtMs > STALE_SAMPLE_MS
      groups.push({ ...g, size: stale ? null : sample.size, sampledAtMs })
    }
    return { id: link.id, enabled: link.enabled, capPerGroup: link.capPerGroup, groups }
  }

  // Cache de 10 s + uma única consulta em andamento por endereço: sem isso, na
  // virada do cache todos os acessos simultâneos de um link viral iriam ao banco.
  async function loadLink(slug) {
    const hit = cache.get(slug)
    if (hit && hit.expiresAt > now()) return hit.value
    if (inflight.has(slug)) return inflight.get(slug)
    const job = fetchLink(slug).then(value => {
      cache.set(slug, { value, expiresAt: now() + CACHE_TTL_MS })
      if (cache.size > 5000) cache.clear()
      return value
    }).finally(() => inflight.delete(slug))
    inflight.set(slug, job)
    return job
  }

  const miss = (reply, ip, title, message) =>
    (missGuard.rateLimited(ip)
      ? reply.code(429).send(page('Muitos acessos', 'Aguarde um minuto e tente de novo.'))
      : reply.code(404).send(page(title, message)))

  app.get('/g/:slug', async (req, reply) => {
    reply.header('cache-control', 'private, no-store, max-age=0')
    reply.header('x-robots-tag', 'noindex, nofollow')
    reply.type('text/html; charset=utf-8')

    if (guard.rateLimited(req.ip)) return reply.code(429).send(page('Muitos acessos', 'Aguarde um minuto e tente de novo.'))
    const slug = normalizeSlug(req.params.slug)
    if (!slug) return miss(reply, req.ip, 'Link não encontrado', 'Confira o endereço e tente de novo.')

    const link = await loadLink(slug)
    if (!link || !link.enabled) return miss(reply, req.ip, 'Link não encontrado', 'Este link não está disponível.')

    // A reserva é do GRUPO de verdade (o mesmo grupo pode estar em dois links).
    const candidates = link.groups.map(g => ({
      id: g.id, enabled: g.enabled, inviteCode: g.inviteCode, size: g.size,
      reserved: reserve.get(g.groupId, g.sampledAtMs), lastPickedAt: lastPicked.get(g.id) ?? 0,
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
      reserve.add(chosen.groupId, chosen.sampledAtMs)
      lastPicked.set(group.id, now())
      countClick(group.id)
    }
    return reply.redirect(inviteUrl(group.inviteCode), 302)
  })
}
