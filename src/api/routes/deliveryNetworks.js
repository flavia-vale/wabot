// Feature 017 (multicanal) — rotas da tela "Aplicativos"
// (contracts/telegram-surface.md). Guardas em toda rota do Telegram:
// 1. plano (buildFeatureGateError(MULTI_NETWORK), explicação + caminho para
//    mudar de plano); 2. interruptor/robô ausente responde "indisponível",
//    não erro; 3. nenhum segredo do robô sai daqui; 4. a cliente não informa
//    nenhum dado de acesso — o grupo chega pelo link de um toque.
// O Instagram Stories aparece como "tela própria" — decisão T001
// (2026-10-02): continua no caminho dele, em src/instagram/.
import dbDefault from '../../db.js'
import { buildFeatureGateError, FEATURE_CODES, getPlanAccess } from '../../billing/plans.js'
import { DELIVERY_NETWORK, listDeliveryNetworksForAccount } from '../../core/delivery/networks.js'
import { DELIVERY_FAILURE_REASONS } from '../../core/delivery/deliveryFailure.js'
import { getTelegramRuntime as defaultGetTelegramRuntime } from '../../delivery/telegram/runtime.js'
import { buildAddToGroupUrl, ensureTelegramLink, findTelegramLink, newLinkCode } from '../../delivery/telegram/link.js'

const TELEGRAM = DELIVERY_NETWORK.TELEGRAM

function reasonText(motivo) {
  return motivo ? (DELIVERY_FAILURE_REASONS[TELEGRAM]?.[motivo]?.texto ?? null) : null
}

const UNAVAILABLE = Object.freeze({
  disponivel: false,
  texto: 'O Telegram ainda não está ligado no Espelha Grupos. Assim que estiver, esta tela mostra o passo a passo.',
})

export async function deliveryNetworksRoutes(app, { db = dbDefault, env = process.env, getTelegramRuntime = defaultGetTelegramRuntime } = {}) {
  async function multiNetworkAllowed(userId) {
    const { entitlements } = await getPlanAccess(userId, { db })
    return Boolean(entitlements.canUseMultiNetwork)
  }

  async function requirePlan(req, reply) {
    if (await multiNetworkAllowed(req.user.sub)) return true
    reply.code(403).send(buildFeatureGateError(FEATURE_CODES.MULTI_NETWORK))
    return false
  }

  app.get('/', { onRequest: [app.authenticate] }, async (req) => ({
    aplicativos: listDeliveryNetworksForAccount({
      allowMultiNetwork: await multiNetworkAllowed(req.user.sub),
      env,
    }),
  }))

  app.get('/telegram/status', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await requirePlan(req, reply))) return
    const runtime = getTelegramRuntime()
    if (!runtime) return UNAVAILABLE
    const userId = req.user.sub
    const link = await ensureTelegramLink(db, userId)
    let username = null
    try { username = await runtime.adapter.botUsername() } catch { username = null }
    if (!username) return { ...UNAVAILABLE, texto: reasonText('robo_indisponivel') }
    const state = await runtime.adapter.readiness(userId)
    return {
      disponivel: true,
      desligado: Boolean(link.disabledAt),
      pronto: state.pronto && !link.disabledAt,
      motivo: state.motivo,
      texto: link.disabledAt ? reasonText('aplicativo_desligado') : reasonText(state.motivo),
      nomeDoRobo: `@${username}`,
      linkAdicionar: buildAddToGroupUrl(username, link.linkCode),
    }
  })

  app.get('/telegram/destinations', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await requirePlan(req, reply))) return
    const runtime = getTelegramRuntime()
    if (!runtime) return { ...UNAVAILABLE, destinos: [] }
    const destinos = await runtime.adapter.listDestinations(req.user.sub)
    return {
      disponivel: true,
      destinos: destinos.map((d) => ({ groupId: d.groupId, nome: d.nome, pronto: d.pronto, texto: reasonText(d.motivo) })),
      // Lista vazia é estado normal (US2 cenário 2), com explicação.
      texto: destinos.length === 0 ? 'Nenhum grupo do Telegram ainda. Toque em "Adicionar o robô a um grupo" e escolha o grupo.' : null,
    }
  })

  // Desligar: os destinos param; nada é apagado; WhatsApp intacto (FR-019).
  app.post('/telegram/disable', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await requirePlan(req, reply))) return
    const link = await ensureTelegramLink(db, req.user.sub)
    await db.deliveryNetworkLink.update({ where: { id: link.id }, data: { disabledAt: new Date() } })
    return { ok: true, desligado: true }
  })

  app.post('/telegram/enable', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await requirePlan(req, reply))) return
    const link = await ensureTelegramLink(db, req.user.sub)
    await db.deliveryNetworkLink.update({ where: { id: link.id }, data: { disabledAt: null } })
    return { ok: true, desligado: false }
  })

  // Troca o código do link (ex.: a cliente compartilhou o link sem querer).
  // Grupos já cadastrados continuam; só o link antigo deixa de cadastrar.
  app.post('/telegram/new-link', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await requirePlan(req, reply))) return
    const existing = await findTelegramLink(db, req.user.sub)
    if (!existing) await ensureTelegramLink(db, req.user.sub)
    else await db.deliveryNetworkLink.update({ where: { id: existing.id }, data: { linkCode: newLinkCode() } })
    return { ok: true }
  })
}
