import dbDefault from '../../db.js'
import { canUseOfferAutomations } from '../../billing/plans.js'
import { loadUserPlanSubject } from './broadcastTargets.js'
import { canUseReview } from '../../offerAutomation/reviewFlags.js'
import { discoverReviewItems } from '../../offerAutomation/reviewDiscoveryService.js'
import { listReviewItems, reviewCounts, transitionReviewItems } from '../../offerAutomation/reviewRepository.js'
import { REVIEW_STATUS } from '../../offerAutomation/reviewState.js'

const PUBLIC_STATUSES = new Set(Object.values(REVIEW_STATUS))

export async function offerAutomationReviewRoutes(app, opts = {}) {
  const db = opts.db ?? dbDefault
  const env = opts.env ?? process.env
  async function owned(req, reply, includeDestinations = false) {
    const automation = await db.offerAutomation.findFirst({ where: { id: req.params.id, userId: req.user.sub }, ...(includeDestinations ? { include: { instagramDestinations: { include: { destination: true } } } } : {}) })
    if (!automation) reply.code(404).send({ error: 'Automação não encontrada' })
    return automation
  }
  async function allowed(req, reply) {
    if (!canUseReview(req.user.sub, env)) { reply.code(403).send({ error: 'Fila de revisão ainda não está liberada para esta conta' }); return false }
    if (!canUseOfferAutomations(await loadUserPlanSubject(db, req.user.sub))) { reply.code(403).send({ error: 'As ofertas automáticas exigem Trial ativo ou plano Pro' }); return false }
    return true
  }

  app.get('/review-capability', { onRequest: [app.authenticate] }, async (req) => ({ enabled: canUseReview(req.user.sub, env) }))

  app.get('/:id/review-items', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!await owned(req, reply)) return reply
    const statuses = String(req.query?.status || '').split(',').filter(status => PUBLIC_STATUSES.has(status))
    const limit = Math.min(50, Math.max(1, Number(req.query?.limit) || 30))
    const rows = await listReviewItems(db, { userId: req.user.sub, automationId: req.params.id, statuses, cursor: req.query?.cursor, limit })
    const hasMore = rows.length > limit
    const items = rows.slice(0, limit).map(item => ({ ...item, productSnapshot: JSON.parse(item.productSnapshot), targetSnapshot: JSON.parse(item.targetSnapshot), deliverySnapshot: undefined, lastError: item.lastError ? 'Não foi possível concluir o envio' : null }))
    return { items, counts: await reviewCounts(db, req.user.sub, req.params.id), nextCursor: hasMore ? items.at(-1)?.id : null }
  })

  app.post('/:id/review-items/discover', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!await allowed(req, reply)) return reply
    const automation = await owned(req, reply, true)
    if (!automation) return reply
    if (automation.publicationMode !== 'review') return reply.code(409).send({ error: 'Ative a revisão nesta automação primeiro' })
    if (automation.lastDiscoveryAt && Date.now() - new Date(automation.lastDiscoveryAt).getTime() < 60_000) return reply.code(429).send({ error: 'Aguarde um minuto antes de buscar novamente' })
    return discoverReviewItems(automation, { db })
  })

  async function mutate(req, reply, from, to, ids) {
    if (!await allowed(req, reply)) return reply
    if (!await owned(req, reply)) return reply
    const safeIds = [...new Set(ids.filter(id => typeof id === 'string'))].slice(0, 50)
    const changed = await transitionReviewItems(db, { userId: req.user.sub, automationId: req.params.id, ids: safeIds, from, to })
    return { changed, unchanged: safeIds.length - changed }
  }
  app.post('/:id/review-items/:itemId/approve', { onRequest: [app.authenticate] }, (req, reply) => mutate(req, reply, [REVIEW_STATUS.AWAITING], REVIEW_STATUS.APPROVED, [req.params.itemId]))
  app.post('/:id/review-items/:itemId/remove', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!canUseReview(req.user.sub, env)) return reply.code(403).send({ error: 'Fila de revisão indisponível' })
    if (!await owned(req, reply)) return reply
    const changed = await transitionReviewItems(db, { userId: req.user.sub, automationId: req.params.id, ids: [req.params.itemId], from: [REVIEW_STATUS.AWAITING, REVIEW_STATUS.APPROVED], to: REVIEW_STATUS.REMOVED })
    return { changed, unchanged: 1 - changed }
  })
  app.post('/:id/review-items/bulk-approve', { onRequest: [app.authenticate] }, (req, reply) => mutate(req, reply, [REVIEW_STATUS.AWAITING], REVIEW_STATUS.APPROVED, Array.isArray(req.body?.ids) ? req.body.ids : []))
  app.post('/:id/review-items/bulk-remove', { onRequest: [app.authenticate] }, (req, reply) => mutate(req, reply, [REVIEW_STATUS.AWAITING, REVIEW_STATUS.APPROVED], REVIEW_STATUS.REMOVED, Array.isArray(req.body?.ids) ? req.body.ids : []))
  app.post('/:id/review-items/:itemId/retry', { onRequest: [app.authenticate] }, (req, reply) => mutate(req, reply, [REVIEW_STATUS.FAILED], REVIEW_STATUS.APPROVED, [req.params.itemId]))
}
