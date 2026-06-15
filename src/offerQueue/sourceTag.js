/* Fonte única do formato de MessageLog.sourceGroup para envios originados
 * das filas de ofertas: 'offerQueue:<queueId>'. Guardamos o ID (não o nome)
 * para sobreviver a renomes; a rota /api/logs resolve o nome na leitura. */

export const OFFER_QUEUE_SOURCE_PREFIX = 'offerQueue:'

export function buildOfferQueueSource(queueId) {
  return `${OFFER_QUEUE_SOURCE_PREFIX}${queueId}`
}

export function parseOfferQueueSourceId(sourceGroup) {
  if (typeof sourceGroup !== 'string' || !sourceGroup.startsWith(OFFER_QUEUE_SOURCE_PREFIX)) return null
  const id = sourceGroup.slice(OFFER_QUEUE_SOURCE_PREFIX.length)
  return id || null
}

export function broadcastSourceGroup(options) {
  if (options?.source === 'offerAutomation') return 'offerAutomation'
  if (options?.source === 'offerQueue' && options.queueId) return buildOfferQueueSource(options.queueId)
  return 'manual'
}
