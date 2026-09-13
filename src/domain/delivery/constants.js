export const DELIVERY_CONTRACT_VERSION = 1

export const DESTINATION_TYPE = Object.freeze({
  WHATSAPP_GROUP: 'whatsapp_group',
  WHATSAPP_CHANNEL: 'whatsapp_channel',
  INSTAGRAM_STORY: 'instagram_story',
})

export const DELIVERY_SOURCE_TYPE = Object.freeze({
  MANUAL: 'manual',
  SCHEDULED: 'scheduled',
  OFFER_QUEUE: 'offer_queue',
  OFFER_AUTOMATION: 'offer_automation',
  MIRROR: 'mirror',
})

export const DELIVERY_STATUS = Object.freeze({
  ACCEPTED: 'accepted',
  PUBLISHED: 'published',
  SKIPPED: 'skipped',
  FAILED: 'failed',
})

export const RETRY_DISPOSITION = Object.freeze({
  NONE: 'none',
  RETRYABLE: 'retryable',
  RECONCILE: 'reconcile',
  PERMANENT: 'permanent',
})

export const DESTINATION_TYPES = Object.freeze(Object.values(DESTINATION_TYPE))
export const DELIVERY_SOURCE_TYPES = Object.freeze(Object.values(DELIVERY_SOURCE_TYPE))
export const DELIVERY_STATUSES = Object.freeze(Object.values(DELIVERY_STATUS))
export const RETRY_DISPOSITIONS = Object.freeze(Object.values(RETRY_DISPOSITION))
