import { createHash, randomUUID } from 'node:crypto'
import { assertPublicUrl } from '../core/ssrfGuard.js'
import { createDeliveryRequest } from '../domain/delivery/deliveryRequest.js'
import { DELIVERY_SOURCE_TYPE, DESTINATION_TYPE } from '../domain/delivery/constants.js'
import { createStoryPublication, ensureDefaultStoryTemplate } from './repository.js'
import { renderAndStoreStory } from './storage/storyAssetService.js'
import { getPlanAccess } from '../billing/plans.js'

const MAX_IMAGE_BYTES = 15 * 1024 * 1024

export function scopeStoryIdempotencyKey(userId, rawKey) {
  const prefix = `igv1:${userId}:`
  const value = String(rawKey || randomUUID())
  if (value.startsWith(prefix) && /^[a-f0-9]{64}$/.test(value.slice(prefix.length))) return value
  return `${prefix}${createHash('sha256').update(value).digest('hex')}`
}

export async function downloadStoryImage(url, { fetchImpl = fetch } = {}) {
  await assertPublicUrl(url)
  let current = String(url)
  for (let redirects = 0; redirects <= 3; redirects++) {
    await assertPublicUrl(current)
    const response = await fetchImpl(current, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location'); if (!location) throw new Error('Redirect de imagem sem destino')
      current = new URL(location, current).toString(); continue
    }
    if (!response.ok) throw new Error(`Imagem respondeu HTTP ${response.status}`)
    const length = Number(response.headers.get('content-length') || 0)
    if (length > MAX_IMAGE_BYTES) throw new Error('Imagem excede 15 MB')
    const reader = response.body?.getReader(); if (!reader) throw new Error('Imagem sem conteúdo')
    const chunks = []; let total = 0
    while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > MAX_IMAGE_BYTES) { await reader.cancel(); throw new Error('Imagem excede 15 MB') }; chunks.push(Buffer.from(value)) }
    return Buffer.concat(chunks, total)
  }
  throw new Error('Imagem excedeu o limite de redirects')
}

export async function createAndEnqueueStory({ userId, destinationId, offer, imageUrl, sourceType = DELIVERY_SOURCE_TYPE.MANUAL, sourceId, idempotencyKey, scheduledFor = null }, { db, storage, publishingQueue, fetchImpl, now = () => new Date() } = {}) {
  if (!publishingQueue) throw Object.assign(new Error('Fila de Instagram indisponível'), { code: 'INSTAGRAM_RUNTIME_UNAVAILABLE' })
  if (!db || !storage) throw Object.assign(new Error('Runtime de Instagram incompleto'), { code: 'INSTAGRAM_RUNTIME_UNAVAILABLE' })
  const { entitlements } = await getPlanAccess(userId, { db, now: now().getTime() })
  if (!entitlements.canUseInstagramStories) throw Object.assign(new Error('Instagram Stories exige o plano acima do Pro'), { code: 'FEATURE_REQUIRES_PREMIUM' })
  const template = await ensureDefaultStoryTemplate({ db })
  const version = await db.storyTemplateVersion.findUnique({ where: { templateId_version: { templateId: template.id, version: template.currentVersion } } })
  const request = createDeliveryRequest({ userId, source: { type: sourceType, id: sourceId || randomUUID() }, offer: { ...offer, imageUrl: imageUrl || offer?.imageUrl }, destination: { id: destinationId, type: DESTINATION_TYPE.INSTAGRAM_STORY }, templateKey: template.key, templateVersion: String(version.version), idempotencyKey: scopeStoryIdempotencyKey(userId, idempotencyKey), scheduledFor }, { now })
  const publication = await createStoryPublication({ request, templateId: template.id, templateVersionId: version.id }, { db })
  if (publication.status === 'published') return publication
  try {
    const existingAsset = publication.renderedAssetId ? await db.renderedAsset.findUnique({ where: { id: publication.renderedAssetId } }) : null
    const assetAvailable = existingAsset && !existingAsset.deletedAt && existingAsset.expiresAt > now()
    if (!assetAvailable) {
      const productImage = await downloadStoryImage(request.offer.imageUrl, { fetchImpl })
      const minimumExpiresAt = scheduledFor ? new Date(new Date(scheduledFor).getTime() + 2 * 24 * 60 * 60_000) : null
      await renderAndStoreStory({ userId, offer: request.offer, productImage, template: JSON.parse(version.definitionJson), publicationId: publication.id, minimumExpiresAt }, { db, storage, now })
    }
    const isManualRetry = ['failed', 'retry_scheduled'].includes(publication.status)
    if (isManualRetry) await db.storyPublication.update({ where: { id: publication.id }, data: { status: 'queued', providerContainerId: null, providerMediaId: null, lastErrorCode: null, lastErrorMessage: null } })
    const delay = scheduledFor ? Math.max(0, new Date(scheduledFor).getTime() - now().getTime()) : 0
    if (isManualRetry && publishingQueue.reenqueue) await publishingQueue.reenqueue(publication.id, { delay })
    else await publishingQueue.enqueue(publication.id, { delay })
    return publication
  } catch (error) {
    await db.storyPublication.update({ where: { id: publication.id }, data: { status: 'failed', lastErrorCode: error.code || 'PREPARE_FAILED', lastErrorMessage: String(error.message).slice(0, 500) } }).catch(() => {})
    throw error
  }
}
