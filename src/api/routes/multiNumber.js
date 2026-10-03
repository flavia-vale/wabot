import { randomUUID } from 'node:crypto'
import db from '../../db.js'
import * as defaultManager from '../../manager.js'
import { extraNumberAccess } from '../../domain/session/extraNumberAccess.js'
import { multiNumberEnabled } from '../../domain/session/multiNumberFlag.js'
import { standbyProcessKey, STANDBY_PROCESS_SLOT, otherSlot } from '../../domain/session/workerIdentity.js'
import { canStartReserve, reserveHeadroom } from '../../domain/session/reserveCapacity.js'
import { normalizePairingPhone } from '../../domain/session/service.js'
import { switchActiveNumber } from '../../core/numberSwitch.js'
import { MOVING_NODE_LIFECYCLE } from '../../supervisor/accountMove.js'
import { NUMBER_SWITCHED_EVENT } from '../../jobs/numberFailover.js'
import { missingDestinations, sourceCoverage, channelFollowState } from '../../domain/session/groupMembership.js'
import { rotationEnabledByEnv } from '../../domain/session/senderRouting.js'
import { writeAnalyticsEvent } from '../../events/store.js'
import {
  MULTI_NUMBER_WAITLIST_EVENTS,
  MULTI_NUMBER_WAITLIST_JOINED,
  MULTI_NUMBER_WAITLIST_LEFT,
  EXTRA_NUMBER_PRICE_CENTS,
  EXTRA_NUMBER_PRICE_LABEL,
  EXTRA_NUMBER_OPTIONS,
  WAITLIST_REASONS,
  validateWaitlistInput,
  waitlistPlanStatus,
  currentWaitlistEntry,
} from '../../domain/multiNumber/waitlist.js'

// Lista de espera do "vários números por conta" (Fase 0 — docs/rca/multi-numero.md).
// Não liga sessão nem reserva vaga: só registra a intenção.
const SESSION_VIEW = { phone: true, status: true, lifecycle: true, lastHeartbeatAt: true, blockNotice: true }
const MANUAL_SWITCH_MIN_INTERVAL_MS = 60_000
// Pertença gravada há menos de 2 h vale (o robô regrava a cada hora).
const MEMBERSHIP_FRESH_MS = 2 * 60 * 60_000
// Canais de origem (Fase 2.1): consulta ao vivo no número reserva, com teto
// para a tela não pendurar. Seguir vai em lotes pequenos e espaçados (anti-ban:
// número novo seguindo muitos canais de uma vez chama atenção).
const CHANNEL_CHECK_MAX = 20
const CHANNEL_CHECK_TIMEOUT_MS = 5_000
const FOLLOW_BATCH = 5
const FOLLOW_GAP_MS = 3_000
const FOLLOW_MIN_INTERVAL_MS = 30_000

function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise(resolve => { timer = setTimeout(() => resolve(null), ms) })
  return Promise.race([Promise.resolve(promise).finally(() => clearTimeout(timer)), timeout])
}

function parseBlockNotice(raw) {
  try { return raw ? JSON.parse(raw) : null } catch { return null }
}

export async function multiNumberRoutes(app, opts = {}) {
  const manager = opts.manager ?? defaultManager
  const env = opts.env ?? process.env
  const maxSessions = () => Math.max(1, Number(env.MAX_SESSIONS_PER_PROCESS || 20))
  const sleep = opts.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))
  const followInFlight = new Set()
  const lastFollowAt = new Map()

  // jid → 'ok' | 'missing' | 'unknown', perguntando ao número reserva.
  async function readChannelStates(processKey, jids) {
    const states = {}
    for (const jid of jids.slice(0, CHANNEL_CHECK_MAX)) {
      const meta = await withTimeout(Promise.resolve(manager.channelMetadata?.(processKey, { jid })).catch(() => null), CHANNEL_CHECK_TIMEOUT_MS)
      states[jid] = channelFollowState(meta?.viewerRole)
    }
    return states
  }

  async function sourceChannels(userId) {
    const rows = await db.group.findMany({ where: { userId, role: 'monitor', kind: 'channel' }, select: { waJid: true, name: true } })
    const seen = new Set()
    return rows.filter(r => r.waJid.endsWith('@newsletter') && !seen.has(r.waJid) && seen.add(r.waJid))
  }

  async function loadState(userId) {
    const [user, events] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { plan: true, accessExpiresAt: true } }),
      db.analyticsEvent.findMany({
        where: { userId, event: { in: [...MULTI_NUMBER_WAITLIST_EVENTS] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { event: true, metadata: true, createdAt: true },
      }),
    ])
    return {
      ...currentWaitlistEntry(events),
      ...waitlistPlanStatus(user ?? {}),
      priceCents: EXTRA_NUMBER_PRICE_CENTS,
      priceLabel: EXTRA_NUMBER_PRICE_LABEL,
      extraNumberOptions: EXTRA_NUMBER_OPTIONS,
      reasons: WAITLIST_REASONS,
    }
  }

  app.get('/waitlist', { onRequest: [app.authenticate] }, async (req) => loadState(req.user.sub))

  app.post('/waitlist', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const parsed = validateWaitlistInput(req.body)
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error })
    const user = await db.user.findUnique({ where: { id: userId }, select: { plan: true, accessExpiresAt: true } })
    const { plan, requiresUpgrade } = waitlistPlanStatus(user ?? {})
    await writeAnalyticsEvent({
      id: randomUUID(),
      userId,
      event: MULTI_NUMBER_WAITLIST_JOINED,
      metadata: JSON.stringify({ ...parsed.value, plan, requiresUpgrade }),
      createdAt: new Date(),
    }, { db })
    return reply.code(201).send(await loadState(userId))
  })

  app.delete('/waitlist', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub
    const current = await loadState(userId)
    if (current.joined) {
      await writeAnalyticsEvent({
        id: randomUUID(),
        userId,
        event: MULTI_NUMBER_WAITLIST_LEFT,
        metadata: '{}',
        createdAt: new Date(),
      }, { db })
    }
    return loadState(userId)
  })

  // ---------------------------------------------------------------------------
  // Número reserva (Fase 1). Flag desligada = 404 em tudo (a tela nem mostra).
  // ---------------------------------------------------------------------------
  async function loadReserveState(userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        plan: true, accessExpiresAt: true, extraNumbers: true, activeWaSlot: true, waSlotSwitchedAt: true,
        waSession: { select: SESSION_VIEW },
        waExtraSessions: { where: { slot: STANDBY_PROCESS_SLOT }, select: SESSION_VIEW },
      },
    })
    if (!user) return null
    const standby = user.waExtraSessions[0] ?? null
    const access = extraNumberAccess(user, { env })
    const running = access.allowed ? Boolean(await Promise.resolve(manager.isRunning(standbyProcessKey(userId))).catch(() => false)) : false
    return {
      access,
      activeWaSlot: user.activeWaSlot,
      switchedAt: user.waSlotSwitchedAt,
      active: user.waSession ? { phone: user.waSession.phone, status: user.waSession.status, lifecycle: user.waSession.lifecycle } : null,
      standby: standby ? {
        phone: standby.phone, status: standby.status, lifecycle: standby.lifecycle,
        lastHeartbeatAt: standby.lastHeartbeatAt, blockNotice: parseBlockNotice(standby.blockNotice),
      } : null,
      running,
    }
  }

  async function requireReserve(req, reply) {
    if (!multiNumberEnabled(env)) { reply.code(404).send({ error: 'Recurso indisponível' }); return null }
    const state = await loadReserveState(req.user.sub)
    if (!state) { reply.code(404).send({ error: 'Conta não encontrada' }); return null }
    if (!state.access.allowed) {
      const messages = {
        requires_pro: 'O número reserva é do plano PRO.',
        access_expired: 'Seu acesso venceu. Renove o plano para usar o número reserva.',
        not_purchased: 'Contrate o número reserva para usar este recurso.',
      }
      reply.code(403).send({ error: messages[state.access.reason] ?? 'Recurso indisponível', code: 'RESERVE_NOT_ALLOWED', reason: state.access.reason })
      return null
    }
    return state
  }

  app.get('/reserve', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!multiNumberEnabled(env)) return reply.code(404).send({ error: 'Recurso indisponível' })
    const state = await loadReserveState(req.user.sub)
    if (!state) return reply.code(404).send({ error: 'Conta não encontrada' })
    return state
  })

  app.post('/reserve/start', { onRequest: [app.authenticate] }, async (req, reply) => {
    const state = await requireReserve(req, reply)
    if (!state) return
    const userId = req.user.sub
    const key = standbyProcessKey(userId)
    if (state.running) return { ok: true, alreadyRunning: true }
    if (!state.active || !state.active.phone) {
      return reply.code(409).send({ error: 'Conecte primeiro o número principal.', code: 'PRIMARY_NOT_CONNECTED' })
    }
    // Revisão V1 (multi-servidor): conta mudando de servidor não liga nada.
    if (state.active.lifecycle === MOVING_NODE_LIFECYCLE) {
      return reply.code(409).send({ error: 'Seu WhatsApp está mudando de servidor. Tente de novo em alguns minutos.', code: 'WA_SESSION_MOVING' })
    }
    // Principal tem prioridade na vaga (Regra #1 — docs/rca/memoria-e-capacidade.md).
    // Revisão V3: com roteamento, soma as vagas prometidas a contas novas.
    const node = manager.getNodeRoutingInfo ? await manager.getNodeRoutingInfo(userId, { includeReservations: true }).catch(() => null) : null
    let runningCount = node?.running ?? null
    let max = node?.max ?? null
    if (!node) {
      const list = await Promise.resolve(manager.listRunningBots()).catch(() => null)
      runningCount = Array.isArray(list) ? list.length : null
      max = maxSessions()
    }
    const capacity = canStartReserve({ runningCount, maxSessions: max, headroom: reserveHeadroom(env) })
    if (!capacity.ok) {
      req.log.warn({ userId, runningCount, max, reason: capacity.reason }, 'Número reserva recusado por vaga')
      return reply.code(503).send({ error: 'Servidor sem vaga para o número reserva agora. Tente mais tarde.', code: 'RESERVE_NO_CAPACITY' })
    }
    // Revisão V3: segura a vaga (a contagem tem cache de 15 s) — dois pedidos
    // seguidos não passam juntos pela mesma medição.
    if (node?.nodeId && manager.reserveNodeSlot) await Promise.resolve(manager.reserveNodeSlot(node.nodeId)).catch(() => {})
    await db.waExtraSession.upsert({
      where: { userId_slot: { userId, slot: STANDBY_PROCESS_SLOT } },
      update: { status: 'connecting', lifecycle: 'authenticating', blockNotice: null },
      create: { userId, slot: STANDBY_PROCESS_SLOT, status: 'connecting', lifecycle: 'authenticating' },
    })
    const accepted = await Promise.resolve(manager.startBot(key)).catch(() => false)
    if (accepted === false && !(await Promise.resolve(manager.isRunning(key)).catch(() => false))) {
      return reply.code(503).send({ error: 'Não foi possível ligar o número reserva agora. Tente mais tarde.', code: 'RESERVE_START_REFUSED' })
    }
    return { ok: true }
  })

  app.post('/reserve/stop', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!multiNumberEnabled(env)) return reply.code(404).send({ error: 'Recurso indisponível' })
    const userId = req.user.sub
    await Promise.resolve(manager.stopBot(standbyProcessKey(userId))).catch(() => false)
    await db.waExtraSession.updateMany({
      where: { userId, slot: STANDBY_PROCESS_SLOT },
      data: { status: 'disconnected', lifecycle: 'stopped_by_user' },
    })
    return { ok: true }
  })

  app.get('/reserve/qr', { onRequest: [app.authenticate] }, async (req, reply) => {
    const state = await requireReserve(req, reply)
    if (!state) return
    const key = standbyProcessKey(req.user.sub)
    if (!state.running) return reply.code(400).send({ error: 'Número reserva não está ligado' })
    return { qr: (await Promise.resolve(manager.getLastQR(key)).catch(() => null)) ?? null }
  })

  app.post('/reserve/pairing-code', { onRequest: [app.authenticate] }, async (req, reply) => {
    const state = await requireReserve(req, reply)
    if (!state) return
    const normalized = normalizePairingPhone(req.body?.phone)
    if (!normalized.ok) return reply.code(400).send({ error: normalized.message })
    if (!state.running) return reply.code(400).send({ error: 'Ligue o número reserva antes de pedir o código.' })
    if (state.active?.phone && state.active.phone === normalized.phone) {
      return reply.code(400).send({ error: 'Esse já é o número principal. Use outro celular para a reserva.', code: 'SAME_NUMBER' })
    }
    try {
      const code = await manager.requestPairingCode(standbyProcessKey(req.user.sub), normalized.phone)
      return { code }
    } catch (err) {
      return reply.code(502).send({ error: err?.message || 'Falha ao gerar o código' })
    }
  })

  // Grupos de destino em que o número reserva NÃO está — nesses ele não
  // consegue enviar se assumir.
  app.get('/reserve/missing-groups', { onRequest: [app.authenticate] }, async (req, reply) => {
    const state = await requireReserve(req, reply)
    if (!state) return
    if (state.standby?.status !== 'connected') return reply.code(409).send({ error: 'O número reserva ainda não está conectado.' })
    const userId = req.user.sub
    const destinations = await db.group.findMany({ where: { userId, role: 'post', kind: 'group' }, select: { waJid: true, name: true } })
    // Fase 2: lê a pertença gravada pelo próprio robô (WaGroupMembership) do
    // número que está de prontidão; sem dado recente, pergunta ao robô ao vivo.
    const standbySlot = otherSlot(state.activeWaSlot)
    const stored = await db.waGroupMembership.findMany({
      where: { userId, slot: standbySlot, refreshedAt: { gte: new Date(Date.now() - MEMBERSHIP_FRESH_MS) } },
      select: { waJid: true },
    })
    let memberJids = stored.map(r => r.waJid)
    let source = 'stored'
    if (!stored.length) {
      const live = await Promise.resolve(manager.listGroups(standbyProcessKey(userId))).catch(() => null)
      if (!Array.isArray(live)) return reply.code(502).send({ error: 'Não foi possível ler os grupos do número reserva agora.' })
      memberJids = live.map(g => g.waJid)
      source = 'live'
    }
    // Origens (Fase 2.1): grupos pela pertença; canais perguntando ao número.
    const sources = await db.group.findMany({ where: { userId, role: 'monitor' }, select: { waJid: true, name: true } })
    const channelJids = [...new Set(sources.map(r => r.waJid).filter(j => j.endsWith('@newsletter')))]
    const channelStates = channelJids.length ? await readChannelStates(standbyProcessKey(userId), channelJids) : {}
    return {
      total: destinations.length,
      missing: missingDestinations({ destinations, memberJids }),
      source,
      sources: sourceCoverage({ sources, memberJids, channelStates }),
    }
  })

  // A reserva segue os canais de origem que ainda não segue. Lote pequeno e
  // espaçado; a tela chama de novo se sobrar (`remaining`).
  app.post('/reserve/follow-source-channels', { onRequest: [app.authenticate] }, async (req, reply) => {
    const state = await requireReserve(req, reply)
    if (!state) return
    if (state.standby?.status !== 'connected') return reply.code(409).send({ error: 'O número reserva ainda não está conectado.' })
    const userId = req.user.sub
    if (followInFlight.has(userId)) return reply.code(429).send({ error: 'Já estamos seguindo os canais. Aguarde.', code: 'FOLLOW_IN_FLIGHT' })
    const last = lastFollowAt.get(userId) ?? 0
    if (Date.now() - last < FOLLOW_MIN_INTERVAL_MS) {
      return reply.code(429).send({ error: 'Aguarde meio minuto antes de seguir mais canais.', code: 'FOLLOW_TOO_SOON' })
    }
    followInFlight.add(userId)
    try {
      const key = standbyProcessKey(userId)
      const channels = await sourceChannels(userId)
      const states = await readChannelStates(key, channels.map(c => c.waJid))
      const pending = channels.filter(c => states[c.waJid] !== 'ok')
      const batch = pending.slice(0, FOLLOW_BATCH)
      const followed = []
      const failed = []
      for (const [i, ch] of batch.entries()) {
        if (i > 0) await sleep(FOLLOW_GAP_MS)
        try {
          await manager.followChannelImmediate(key, ch.waJid)
          followed.push(ch)
        } catch (err) {
          req.log.warn({ err: err?.message, jid: ch.waJid }, 'reserva: seguir canal de origem falhou')
          failed.push(ch)
        }
      }
      lastFollowAt.set(userId, Date.now())
      return { followed, failed, remaining: pending.length - batch.length }
    } finally {
      followInFlight.delete(userId)
    }
  })

  // Troca manual (ex.: "voltar para o número 1"). Só com o outro número
  // conectado — senão a conta ficaria sem nenhum número enviando.
  app.post('/reserve/switch', { onRequest: [app.authenticate] }, async (req, reply) => {
    const state = await requireReserve(req, reply)
    if (!state) return
    if (state.standby?.status !== 'connected') {
      return reply.code(409).send({ error: 'O outro número precisa estar conectado para assumir.', code: 'STANDBY_NOT_CONNECTED' })
    }
    const userId = req.user.sub
    const result = await switchActiveNumber({
      db, manager, userId, expectedActiveSlot: state.activeWaSlot, reason: 'manual',
      minIntervalMs: MANUAL_SWITCH_MIN_INTERVAL_MS, logger: req.log,
    })
    if (!result.switched) {
      const status = result.reason === 'not_claimed' ? 429 : 503
      return reply.code(status).send({ error: result.reason === 'not_claimed' ? 'Uma troca acabou de acontecer. Aguarde um minuto.' : 'Não foi possível trocar agora. Tente de novo.', code: 'SWITCH_FAILED', reason: result.reason })
    }
    await writeAnalyticsEvent({
      id: randomUUID(), userId, event: NUMBER_SWITCHED_EVENT, createdAt: new Date(),
      metadata: JSON.stringify({ from: result.from, to: result.to, reason: 'manual', mode: 'manual' }),
    }, { db }).catch(() => {})
    return { ok: true, activeWaSlot: result.to, previousSlot: otherSlot(result.to) }
  })

  // ---------------------------------------------------------------------------
  // Rodízio de envio (Fase 2): ligar/desligar por conta e ver quem envia cada
  // grupo. Sem MULTI_NUMBER_ROTATION_ENABLED = 404 (a tela não mostra).
  // ---------------------------------------------------------------------------
  app.get('/rotation', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!multiNumberEnabled(env) || !rotationEnabledByEnv(env)) return reply.code(404).send({ error: 'Recurso indisponível' })
    const state = await loadReserveState(req.user.sub)
    if (!state?.access?.allowed) return reply.code(403).send({ error: 'Recurso indisponível', code: 'RESERVE_NOT_ALLOWED' })
    const userId = req.user.sub
    const [user, groups, owners, members, sent] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { rotationEnabled: true } }),
      db.group.findMany({ where: { userId, role: 'post', kind: 'group' }, select: { waJid: true, name: true } }),
      db.destinationSender.findMany({ where: { userId }, select: { destJid: true, slot: true } }),
      db.waGroupMembership.findMany({ where: { userId }, select: { slot: true, waJid: true } }),
      db.messageLog.groupBy({
        by: ['senderSlot'],
        where: { userId, status: 'success', sentAt: { gte: new Date(Date.now() - 86400_000) } },
        _count: { _all: true },
      }),
    ])
    const ownerBy = new Map(owners.map(o => [o.destJid, o.slot]))
    const memberOf = slot => new Set(members.filter(m => m.slot === slot).map(m => m.waJid))
    const in1 = memberOf(1)
    const in2 = memberOf(2)
    const seen = new Set()
    const list = groups.filter(g => !seen.has(g.waJid) && seen.add(g.waJid)).map(g => ({
      waJid: g.waJid,
      name: g.name,
      senderSlot: ownerBy.get(g.waJid) ?? null,
      members: { 1: in1.has(g.waJid), 2: in2.has(g.waJid) },
    }))
    const sent24h = Object.fromEntries(sent.filter(r => r.senderSlot != null).map(r => [r.senderSlot, r._count._all]))
    // 2b (espelhamento no rodízio) tem flag própria; a tela diz a verdade sobre ela.
    const mirrorRotation = String(env.MULTI_NUMBER_ROTATION_RELAY ?? '').trim().toLowerCase() === 'true'
    return { enabled: Boolean(user?.rotationEnabled), activeWaSlot: state.activeWaSlot, groups: list, sent24h, mirrorRotation }
  })

  app.post('/rotation', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!multiNumberEnabled(env) || !rotationEnabledByEnv(env)) return reply.code(404).send({ error: 'Recurso indisponível' })
    const state = await requireReserve(req, reply)
    if (!state) return
    const enabled = req.body?.enabled === true
    await db.user.update({ where: { id: req.user.sub }, data: { rotationEnabled: enabled } })
    await writeAnalyticsEvent({
      id: randomUUID(), userId: req.user.sub, event: 'multi_number_rotation_toggled', createdAt: new Date(),
      metadata: JSON.stringify({ enabled }),
    }, { db }).catch(() => {})
    return { ok: true, enabled }
  })
}
