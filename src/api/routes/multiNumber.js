import { randomUUID } from 'node:crypto'
import db from '../../db.js'
import * as defaultManager from '../../manager.js'
import { extraNumberAccess } from '../../domain/session/extraNumberAccess.js'
import { multiNumberEnabled } from '../../domain/session/multiNumberFlag.js'
import { standbyProcessKey, STANDBY_PROCESS_SLOT, otherSlot } from '../../domain/session/workerIdentity.js'
import { canStartReserve, reserveHeadroom } from '../../domain/session/reserveCapacity.js'
import { normalizePairingPhone } from '../../domain/session/service.js'
import { switchActiveNumber } from '../../core/numberSwitch.js'
import { NUMBER_SWITCHED_EVENT } from '../../jobs/numberFailover.js'
import { missingDestinations } from '../../domain/session/groupMembership.js'
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

function parseBlockNotice(raw) {
  try { return raw ? JSON.parse(raw) : null } catch { return null }
}

export async function multiNumberRoutes(app, opts = {}) {
  const manager = opts.manager ?? defaultManager
  const env = opts.env ?? process.env
  const maxSessions = () => Math.max(1, Number(env.MAX_SESSIONS_PER_PROCESS || 20))

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
    // Principal tem prioridade na vaga (Regra #1 — docs/rca/memoria-e-capacidade.md).
    const node = manager.getNodeRoutingInfo ? await manager.getNodeRoutingInfo(userId).catch(() => null) : null
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
    return { total: destinations.length, missing: missingDestinations({ destinations, memberJids }), source }
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
}
