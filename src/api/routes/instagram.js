import dbDefault from '../../db.js'
import { randomUUID } from 'node:crypto'
import { buildFeatureGateError, FEATURE_CODES } from '../../billing/plans.js'
import { createInstagramOAuthClient } from '../../instagram/oauth/client.js'
import { instagramOAuthConfig } from '../../instagram/oauth/config.js'
import { beginInstagramOAuth, completeInstagramOAuth, disconnectInstagram, listInstagramConnections, refreshInstagramConnection } from '../../instagram/oauth/service.js'
import { getInstagramPublishingRuntime } from '../../instagram/publishing/runtime.js'
import { createAndEnqueueStory, prepareStoryAsset } from '../../instagram/storyDeliveryService.js'
import { DELIVERY_SOURCE_TYPE } from '../../domain/delivery/constants.js'
import { getPlanAccess } from '../../billing/plans.js'
import { getInstagramHealth } from '../../instagram/health.js'
import { friendlyInstagramError } from '../../instagram/errorMessages.js'
import { ensureDefaultStoryTemplate } from '../../instagram/repository.js'

function configOrReply(reply, env) {
  try { return instagramOAuthConfig(env) } catch { reply.code(503).send({ error: friendlyInstagramError({ code: 'INSTAGRAM_CONFIG_MISSING' }), code: 'INSTAGRAM_CONFIG_MISSING' }); return null }
}

// Toda resposta de erro sai traduzida: a mensagem crua do backend ("Meta HTTP
// 400", "Container ERROR") ia direto para a tela da cliente.
function sendError(reply, error) {
  return reply.code(statusFor(error)).send({ error: friendlyInstagramError(error), code: error.code || 'INSTAGRAM_FAILED' })
}

function statusFor(error) {
  if (error.code === 'FEATURE_REQUIRES_PREMIUM') return 403
  if (error.code === 'NOT_FOUND') return 404
  if (error.code === 'INVALID_OAUTH_STATE') return 400
  if (error.code === 'INSTAGRAM_RUNTIME_UNAVAILABLE') return 503
  if (error.code === 'IDEMPOTENCY_CONFLICT') return 409
  if (['DESTINATION_UNAVAILABLE', 'TEMPLATE_UNAVAILABLE'].includes(error.code)) return 409
  if (error instanceof TypeError || error instanceof RangeError) return 400
  return 502
}

export async function instagramRoutes(app, deps = {}) {
  const db = deps.db || dbDefault
  const env = deps.env || process.env
  const clientFactory = deps.clientFactory || createInstagramOAuthClient
  const storage = deps.storage
  const storyCreator = deps.createAndEnqueueStory || createAndEnqueueStory

  app.get('/oauth/start', { onRequest: [app.authenticate] }, async (req, reply) => {
    const config = configOrReply(reply, env); if (!config) return
    try { return await beginInstagramOAuth(req.user.sub, config, { db }) } catch (error) {
      if (error.code === 'FEATURE_REQUIRES_PREMIUM') return reply.code(403).send(buildFeatureGateError(FEATURE_CODES.INSTAGRAM_STORIES))
      throw error
    }
  })

  app.get('/oauth/callback', async (req, reply) => {
    const dashboard = String(env.DASHBOARD_URL || '').replace(/\/$/, '')
    const config = configOrReply(reply, env); if (!config) return
    if (!req.query?.code || !req.query?.state || req.query?.error) return reply.redirect(`${dashboard}/painel/configuracoes?instagram=error`)
    try {
      await completeInstagramOAuth(req.query, config, { db, client: clientFactory(config) })
      return reply.redirect(`${dashboard}/painel/configuracoes?instagram=success`)
    } catch (error) {
      req.log.warn({ code: error.code, status: error.status }, 'Falha no callback OAuth Instagram')
      return reply.redirect(`${dashboard}/painel/configuracoes?instagram=error`)
    }
  })

  // Conta sem o plano não tem o que listar nem o que monitorar. Sem esta
  // guarda, TODA cliente que abria Configurações disparava a listagem de
  // conexões e a saúde do Instagram — só o /health são nove contagens no
  // SQLite por abertura de tela, para um recurso que ela não pode usar.
  async function requirePlan(req, reply) {
    const { entitlements } = await getPlanAccess(req.user.sub, { db })
    if (entitlements.canUseInstagramStories) return true
    reply.code(403).send(buildFeatureGateError(FEATURE_CODES.INSTAGRAM_STORIES))
    return false
  }

  app.get('/connections', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!await requirePlan(req, reply)) return
    return listInstagramConnections(req.user.sub, { db })
  })

  app.get('/health', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!await requirePlan(req, reply)) return
    return getInstagramHealth(req.user.sub, { db })
  })

  app.get('/mirror-targets', { onRequest: [app.authenticate] }, req => db.instagramMirrorDestination.findMany({ where: { sourceGroup: { userId: req.user.sub } }, select: { sourceGroupId: true, destinationId: true } }))

  app.put('/mirror-targets/:sourceGroupId', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { entitlements } = await getPlanAccess(req.user.sub, { db })
    if (!entitlements.canUseInstagramStories) return reply.code(403).send(buildFeatureGateError(FEATURE_CODES.INSTAGRAM_STORIES))
    const ids = [...new Set(Array.isArray(req.body?.destinationIds) ? req.body.destinationIds.filter(Boolean) : [])]
    const [source, destinations] = await Promise.all([
      db.group.findFirst({ where: { id: req.params.sourceGroupId, userId: req.user.sub, role: 'monitor' }, select: { id: true } }),
      db.destination.findMany({ where: { id: { in: ids }, userId: req.user.sub, type: 'instagram_story', enabled: true }, select: { id: true } }),
    ])
    if (!source) return reply.code(404).send({ error: 'Grupo monitorado não encontrado' })
    if (destinations.length !== ids.length) return reply.code(400).send({ error: 'Destino Instagram inválido' })
    await db.$transaction(async tx => {
      await tx.instagramMirrorDestination.deleteMany({ where: { sourceGroupId: source.id } })
      if (ids.length) await tx.instagramMirrorDestination.createMany({ data: ids.map(destinationId => ({ sourceGroupId: source.id, destinationId })) })
    })
    return { sourceGroupId: source.id, destinationIds: ids }
  })

  app.post('/connections/:id/refresh', { onRequest: [app.authenticate] }, async (req, reply) => {
    const config = configOrReply(reply, env); if (!config) return
    try { return await refreshInstagramConnection(req.user.sub, req.params.id, config, { db, client: clientFactory(config) }) } catch (error) { return sendError(reply, error) }
  })

  app.delete('/connections/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    try { return await disconnectInstagram(req.user.sub, req.params.id, { db, queue: deps.publishingQueue || getInstagramPublishingRuntime() }) } catch (error) { return sendError(reply, error) }
  })

  app.post('/stories', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { destinationIds, offer, imageUrl, scheduledFor, idempotencyKey } = req.body || {}
    const destinations = [...new Set(Array.isArray(destinationIds) ? destinationIds.filter(Boolean) : [])]
    if (!destinations.length || destinations.length > 10 || !offer?.title || !(imageUrl || offer?.imageUrl)) return reply.code(400).send({ error: 'Informe oferta, imagem e de 1 a 10 destinos Instagram' })
    const when = scheduledFor ? new Date(scheduledFor) : null
    if (when && (Number.isNaN(when.getTime()) || when <= new Date())) return reply.code(400).send({ error: 'scheduledFor deve ser uma data futura' })
    if (when && when.getTime() > Date.now() + 30 * 24 * 60 * 60_000) return reply.code(400).send({ error: 'O agendamento de Stories aceita no máximo 30 dias' })
    const queue = deps.publishingQueue || getInstagramPublishingRuntime()
    if (!storage || !queue) return reply.code(503).send({ error: friendlyInstagramError({ code: 'INSTAGRAM_RUNTIME_UNAVAILABLE' }), code: 'INSTAGRAM_RUNTIME_UNAVAILABLE' })
    const baseKey = idempotencyKey || randomUUID()
    const publications = []; const errors = []
    // A imagem é a MESMA para todos os destinos (mesma oferta, mesmo modelo).
    // Preparar uma vez evita repetir download + render do sharp por destino:
    // com 10 destinos eram 10 renders de 1080x1920 em série dentro do request.
    // Best-effort: se falhar aqui, cada destino tenta por conta própria e
    // reporta o próprio erro, como antes.
    let preparedAsset = null
    try {
      const { entitlements } = await getPlanAccess(req.user.sub, { db })
      if (!entitlements.canUseInstagramStories) return reply.code(403).send(buildFeatureGateError(FEATURE_CODES.INSTAGRAM_STORIES))
      if (destinations.length > 1 && !deps.createAndEnqueueStory) {
        const template = await ensureDefaultStoryTemplate({ db })
        const version = await db.storyTemplateVersion.findUnique({ where: { templateId_version: { templateId: template.id, version: template.currentVersion } } })
        preparedAsset = await prepareStoryAsset({ userId: req.user.sub, offer: { ...offer, imageUrl: imageUrl || offer?.imageUrl }, template: JSON.parse(version.definitionJson), imageRefererUrl: req.body?.imageRefererUrl || offer?.productUrl || null, scheduledFor: when }, { db, storage })
      }
    } catch (error) {
      req.log.warn({ err: error.message }, 'Preparo compartilhado do Story falhou; cada destino tentará sozinho')
    }
    for (const destinationId of destinations) {
      try {
        const row = await storyCreator({ userId: req.user.sub, destinationId, offer, imageUrl, imageRefererUrl: req.body?.imageRefererUrl || offer?.productUrl || null, preparedAsset, scheduledFor: when, sourceType: when ? DELIVERY_SOURCE_TYPE.SCHEDULED : DELIVERY_SOURCE_TYPE.MANUAL, sourceId: baseKey, idempotencyKey: `${baseKey}:${destinationId}` }, { db, storage, publishingQueue: queue })
        publications.push({ id: row.id, destinationId, status: row.status, scheduledFor: row.scheduledFor })
      } catch (error) { errors.push({ destinationId, error: friendlyInstagramError(error), code: error.code || 'INSTAGRAM_PREPARE_FAILED' }) }
    }
    return reply.code(publications.length ? 202 : statusFor(errors[0] || {})).send({ publications, errors })
  })

  app.get('/stories', { onRequest: [app.authenticate] }, req => db.storyPublication.findMany({ where: { userId: req.user.sub }, select: { id: true, sourceType: true, status: true, scheduledFor: true, publishedAt: true, lastErrorCode: true, lastErrorMessage: true, createdAt: true, destination: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }))

  app.delete('/stories/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const changed = await db.storyPublication.updateMany({ where: { id: req.params.id, userId: req.user.sub, status: 'queued', scheduledFor: { gt: new Date() } }, data: { status: 'cancelled' } })
    if (!changed.count) return reply.code(409).send({ error: 'Só dá para cancelar um Story agendado que ainda não começou a publicar.' })
    await (deps.publishingQueue || getInstagramPublishingRuntime())?.cancel(req.params.id).catch(() => {})
    return { ok: true }
  })

  app.post('/stories/:id/retry', { onRequest: [app.authenticate] }, async (req, reply) => {
    // `reconciliation_required` entra aqui: era um beco sem saída (nem retry,
    // nem varredura, nem botão). Reenfileirar é SEGURO porque o processor
    // relê o container existente antes de publicar de novo — se a Meta já
    // publicou, ele apenas marca `published`, sem duplicar o Story.
    const publication = await db.storyPublication.findFirst({ where: { id: req.params.id, userId: req.user.sub, status: { in: ['failed', 'retry_scheduled', 'reconciliation_required'] } } })
    if (!publication) return reply.code(409).send({ error: 'Só dá para reenviar publicações que falharam ou que estão aguardando conferência.' })
    const queue = deps.publishingQueue || getInstagramPublishingRuntime()
    if (!storage || !queue) return reply.code(503).send({ error: friendlyInstagramError({ code: 'INSTAGRAM_RUNTIME_UNAVAILABLE' }), code: 'INSTAGRAM_RUNTIME_UNAVAILABLE' })
    try {
      const offer = JSON.parse(publication.offerSnapshotJson)
      const row = await storyCreator({ userId: req.user.sub, destinationId: publication.destinationId, offer, imageUrl: offer.imageUrl, imageRefererUrl: offer.attributes?.sourceUrl || offer.productUrl || null, sourceType: publication.sourceType, sourceId: publication.sourceId, idempotencyKey: publication.idempotencyKey }, { db, storage, publishingQueue: queue })
      return reply.code(202).send({ id: row.id, status: 'queued' })
    } catch (error) { return sendError(reply, error) }
  })
}
