// Rodízio de envio — lado com banco (vários números, Fase 2 —
// docs/rca/multi-numero.md). Roda SÓ no processo ativo (o que escuta e
// deduplica). A regra em si é pura: src/domain/session/senderRouting.js.
import { assignOwners, pickSender, senderHourlyCap, ROTATION_SLOTS } from '../domain/session/senderRouting.js'
import { otherSlot, STANDBY_PROCESS_SLOT } from '../domain/session/workerIdentity.js'

const PLAN_TTL_MS = 60_000
const VOLUME_TTL_MS = 30 * 60_000
const VOLUME_WINDOW_MS = 7 * 86400_000
const STANDBY_FRESH_MS = 3 * 60_000

export function createRotationRouter({ db, userId, localSlot, env = process.env, logger = console, clock = () => Date.now() } = {}) {
  let plan = null
  let planAt = 0
  let volumes = null
  let volumesAt = 0

  async function loadVolumes(now) {
    if (volumes && now - volumesAt < VOLUME_TTL_MS) return volumes
    const rows = await db.messageLog.groupBy({
      by: ['destGroup'],
      where: { userId, status: 'success', sentAt: { gte: new Date(now - VOLUME_WINDOW_MS) } },
      _count: { _all: true },
    })
    volumes = new Map(rows.map(r => [r.destGroup, r._count._all]))
    volumesAt = now
    return volumes
  }

  async function buildPlan(now) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        rotationEnabled: true, extraNumbers: true,
        waExtraSessions: { where: { slot: STANDBY_PROCESS_SLOT }, select: { status: true, lastHeartbeatAt: true } },
      },
    })
    if (!user?.rotationEnabled || !(user.extraNumbers > 0)) return { enabled: false }
    const standby = user.waExtraSessions[0]
    const remoteSlot = otherSlot(localSlot)
    const remoteUp = standby?.status === 'connected' && standby.lastHeartbeatAt && now - new Date(standby.lastHeartbeatAt).getTime() <= STANDBY_FRESH_MS
    const connected = { [localSlot]: true, [remoteSlot]: Boolean(remoteUp) }

    const [groups, memberRows, currentRows, vol, hourly] = await Promise.all([
      db.group.findMany({ where: { userId, role: 'post', kind: 'group' }, select: { waJid: true } }),
      db.waGroupMembership.findMany({ where: { userId }, select: { slot: true, waJid: true } }),
      db.destinationSender.findMany({ where: { userId }, select: { destJid: true, slot: true } }),
      loadVolumes(now),
      db.messageLog.groupBy({
        by: ['senderSlot'],
        where: { userId, status: 'success', sentAt: { gte: new Date(now - 3600_000) } },
        _count: { _all: true },
      }),
    ])
    const memberships = Object.fromEntries(ROTATION_SLOTS.map(slot => [slot, new Set(memberRows.filter(r => r.slot === slot).map(r => r.waJid))]))
    const current = new Map(currentRows.filter(r => r.slot != null).map(r => [r.destJid, r.slot]))
    const destinations = [...new Set(groups.map(g => g.waJid))].map(waJid => ({ waJid, volume: vol.get(waJid) ?? 0 }))
    const owners = assignOwners({ destinations, memberships, connected, current })

    // Grava só o que mudou (estável entre passadas; base do painel). Com um
    // número fora do ar o plano vale só em memória: gravar faria o número que
    // ficou "herdar" os grupos para sempre, sem redistribuir quando o outro
    // voltar.
    const previous = new Map(currentRows.map(r => [r.destJid, r.slot]))
    const allUp = ROTATION_SLOTS.every(slot => connected[slot])
    const changed = allUp ? [...owners.entries()].filter(([jid, slot]) => previous.get(jid) !== slot || !previous.has(jid)) : []
    for (const [destJid, slot] of changed) {
      await db.destinationSender.upsert({
        where: { userId_destJid: { userId, destJid } },
        update: { slot, assignedAt: new Date(now) },
        create: { userId, destJid, slot, assignedAt: new Date(now) },
      }).catch(err => logger.warn?.({ err: err?.message, destJid }, 'Falha ao gravar o dono do grupo no rodízio'))
    }
    const hourlyCounts = Object.fromEntries(hourly.filter(r => r.senderSlot != null).map(r => [r.senderSlot, r._count._all]))
    return { enabled: true, owners, memberships, connected, hourlyCounts, remoteSlot }
  }

  async function getPlan() {
    const now = clock()
    if (plan && now - planAt < PLAN_TTL_MS) return plan
    try {
      plan = await buildPlan(now)
    } catch (err) {
      logger.warn?.({ err: err?.message }, 'Rodízio: falha ao montar o plano; envio fica no número ativo')
      plan = { enabled: false }
    }
    planAt = now
    return plan
  }

  // Devolve o slot que deve enviar `waJid` (o local quando o rodízio está
  // desligado, sem dono possível ou o outro número caiu).
  async function chooseSlot(waJid) {
    const p = await getPlan()
    if (!p.enabled) return localSlot
    return pickSender({
      waJid,
      owners: p.owners,
      memberships: p.memberships,
      connected: p.connected,
      hourlyCounts: p.hourlyCounts,
      hourlyCap: senderHourlyCap(env),
      fallbackSlot: localSlot,
    })
  }

  // Envio foi para o outro número: conta na hora (não espera o próximo plano).
  function noteRouted(slot) {
    if (plan?.hourlyCounts) plan.hourlyCounts[slot] = (plan.hourlyCounts[slot] ?? 0) + 1
  }

  function remoteIsUp() {
    return Boolean(plan?.enabled && plan.connected?.[plan.remoteSlot])
  }

  return { getPlan, chooseSlot, noteRouted, remoteIsUp, invalidate: () => { planAt = 0 } }
}
