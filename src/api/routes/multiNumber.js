import { randomUUID } from 'node:crypto'
import db from '../../db.js'
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
export async function multiNumberRoutes(app) {
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
}
