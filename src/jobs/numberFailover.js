// Troca automática para o número reserva (docs/rca/multi-numero.md, Fase 1).
// Passada a cada minuto, na API (in-process, sem processo PM2 novo). Com a
// flag desligada não lê nada.
import { randomUUID } from 'node:crypto'
import { multiNumberEnabled } from '../domain/session/multiNumberFlag.js'
import { extraNumberAccess } from '../domain/session/extraNumberAccess.js'
import { decideFailover, failoverSettings } from '../domain/session/failoverPolicy.js'
import { STANDBY_PROCESS_SLOT } from '../domain/session/workerIdentity.js'
import { switchActiveNumber } from '../core/numberSwitch.js'
import { writeAnalyticsEvent } from '../events/store.js'

export const NUMBER_SWITCHED_EVENT = 'multi_number_switched'

const SESSION_SELECT = { status: true, lifecycle: true, lastDisconnectCode: true, lastHeartbeatAt: true, phone: true }

export function createNumberFailoverSweep({ db, manager, notify = async () => {}, env = process.env, logger = console, clock = () => new Date() } = {}) {
  // "Caído desde": o heartbeat do banco segue andando com o robô desconectado,
  // então a passada guarda quando viu o ativo cair. Restart da API zera — fica
  // mais conservador (espera de novo), nunca mais apressado.
  const downSince = new Map()
  let running = false

  return async function tick() {
    if (!multiNumberEnabled(env) || running) return { checked: 0, switched: 0 }
    running = true
    try {
      const now = clock()
      const settings = failoverSettings(env)
      const users = await db.user.findMany({
        where: { extraNumbers: { gt: 0 }, waExtraSessions: { some: { slot: STANDBY_PROCESS_SLOT, status: 'connected' } } },
        select: {
          id: true, name: true, email: true, plan: true, accessExpiresAt: true, extraNumbers: true,
          activeWaSlot: true, waSlotSwitchedAt: true,
          waSession: { select: SESSION_SELECT },
          waExtraSessions: { where: { slot: STANDBY_PROCESS_SLOT }, select: SESSION_SELECT },
        },
      })
      const seen = new Set()
      let switched = 0
      for (const user of users) {
        seen.add(user.id)
        if (!extraNumberAccess(user, { now, env }).allowed) continue
        const active = user.waSession
        if (!active || active.status === 'connected') { downSince.delete(user.id); continue }
        if (!downSince.has(user.id)) downSince.set(user.id, now.getTime())
        const decision = decideFailover({
          active,
          standby: user.waExtraSessions[0],
          user,
          downSinceMs: downSince.get(user.id),
          now: now.getTime(),
          ...settings,
        })
        if (!decision.promote) continue
        const result = await switchActiveNumber({
          db, manager, userId: user.id, expectedActiveSlot: user.activeWaSlot, reason: decision.reason,
          minIntervalMs: settings.minSwitchIntervalMs, now, logger,
        }).catch(err => {
          logger.error?.({ userId: user.id, err: err?.message }, 'Troca automática de número falhou')
          return { switched: false, reason: 'error' }
        })
        if (!result.switched) continue
        switched++
        downSince.delete(user.id)
        await writeAnalyticsEvent({
          id: randomUUID(), userId: user.id, event: NUMBER_SWITCHED_EVENT, createdAt: now,
          metadata: JSON.stringify({ from: result.from, to: result.to, reason: decision.reason, mode: 'auto' }),
        }, { db }).catch(() => {})
        await notify({ user, from: result.from, to: result.to, reason: decision.reason }).catch(err => {
          logger.warn?.({ userId: user.id, err: err?.message }, 'Aviso da troca de número não saiu')
        })
      }
      for (const id of downSince.keys()) if (!seen.has(id)) downSince.delete(id)
      return { checked: users.length, switched }
    } finally {
      running = false
    }
  }
}
