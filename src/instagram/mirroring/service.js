import dbDefault from '../../db.js'
import { createAndEnqueueStory } from '../storyDeliveryService.js'
import { getInstagramDeliveryRuntime } from '../publishing/runtime.js'
import { DELIVERY_SOURCE_TYPE } from '../../domain/delivery/constants.js'
import { fetchProductImage } from '../../converters/imageScrapers.js'
import { parseCredentialData } from '../../credentialHealth.js'

export async function processInstagramMirrorIngress({ db = dbDefault, runtime = getInstagramDeliveryRuntime(), storyCreator = createAndEnqueueStory, imageResolver = fetchProductImage, now = () => new Date(), limit = 20 } = {}) {
  if (!runtime) return { skipped: 'runtime_unavailable' }
  const staleBefore = new Date(now().getTime() - 10 * 60_000)
  await db.instagramStoryIngress.updateMany({ where: { status: 'processing', OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }] }, data: { status: 'pending', claimedAt: null, nextAttemptAt: now(), lastError: 'Processamento anterior interrompido; recuperado automaticamente' } })
  const rows = await db.instagramStoryIngress.findMany({ where: { status: 'pending', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now() } }] }, orderBy: { createdAt: 'asc' }, take: limit })
  let processed = 0
  for (const row of rows) {
    const claimed = await db.instagramStoryIngress.updateMany({ where: { id: row.id, status: 'pending' }, data: { status: 'processing', claimedAt: now(), attemptCount: { increment: 1 } } })
    if (!claimed.count) continue
    try {
      const offer = JSON.parse(row.offerSnapshotJson)
      if (!offer.imageUrl) {
        const platform = offer.attributes?.sourcePlatform
        const credential = platform ? await db.credential.findUnique({ where: { userId_platform: { userId: row.userId, platform } } }) : null
        const credentials = credential ? parseCredentialData(credential.data) : {}
        offer.imageUrl = await imageResolver(platform, offer.attributes?.sourceUrl || offer.productUrl, credentials)
        if (!offer.imageUrl) throw Object.assign(new Error('Imagem da oferta espelhada indisponível'), { code: 'IMAGE_UNAVAILABLE' })
      }
      await storyCreator({ userId: row.userId, destinationId: row.destinationId, offer, imageUrl: offer.imageUrl, sourceType: DELIVERY_SOURCE_TYPE.MIRROR, sourceId: row.sourceMessageKey, idempotencyKey: `mirror:${row.destinationId}:${row.sourceMessageKey}` }, runtime)
      await db.instagramStoryIngress.update({ where: { id: row.id }, data: { status: 'processed', processedAt: now(), claimedAt: null, lastError: null } })
      processed++
    } catch (error) {
      const attempt = row.attemptCount + 1
      const data = attempt >= 5
        ? { status: 'failed', lastError: String(error.message).slice(0, 500) }
        : {
            status: 'pending',
            nextAttemptAt: new Date(now().getTime() + Math.min(60_000 * 2 ** attempt, 3_600_000)),
            lastError: String(error.message).slice(0, 500),
          }
      await db.instagramStoryIngress.update({ where: { id: row.id }, data: { ...data, claimedAt: null } })
    }
  }
  return { processed }
}

export function startInstagramMirrorIngressCron(options = {}) {
  const timer = setInterval(() => processInstagramMirrorIngress(options).catch(error => console.error('[instagram-mirror] ingress failed:', error.message)), 30_000)
  timer.unref()
  return timer
}
