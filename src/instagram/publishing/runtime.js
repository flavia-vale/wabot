import { createInstagramPublishingQueue } from './queue.js'
import { processInstagramPublication } from './processor.js'

let runtime = null
let deliveryRuntime = null

export async function startInstagramPublishingRuntime({ db, storage, config, redisUrl, logger = console, queueFactory = createInstagramPublishingQueue } = {}) {
  if (runtime) return runtime
  runtime = await queueFactory({
    redisUrl,
    logger,
    processor: publicationId => processInstagramPublication(publicationId, { db, storage, config }),
    onFinalFailure: (publicationId, error) => db.storyPublication.updateMany({
      where: { id: publicationId, status: { notIn: ['published', 'cancelled', 'reconciliation_required', 'failed'] } },
      data: { status: 'failed', lastErrorCode: error?.code || 'RETRIES_EXHAUSTED', lastErrorMessage: String(error?.message || error).slice(0, 500) },
    }),
  })
  deliveryRuntime = { db, storage, publishingQueue: runtime }
  return runtime
}

export function getInstagramPublishingRuntime() { return runtime }
export function getInstagramDeliveryRuntime() { return deliveryRuntime }
export function resetInstagramPublishingRuntimeForTests() { runtime = null; deliveryRuntime = null }
