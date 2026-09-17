import { randomUUID } from 'node:crypto'

import { DELIVERY_CONTRACT_VERSION, DELIVERY_SOURCE_TYPES } from './constants.js'
import { createCanonicalOffer } from './canonicalOffer.js'
import { createDestinationRef } from './destination.js'
import { enumValue, freezeSnapshot, isoDate, optionalString, requiredString } from './validation.js'

export function createDeliveryRequest(input = {}, { idFactory = randomUUID, now = () => new Date() } = {}) {
  const source = input.source ?? {}
  return freezeSnapshot({
    contractVersion: DELIVERY_CONTRACT_VERSION,
    id: optionalString(input.id) || idFactory(),
    userId: requiredString(input.userId, 'userId'),
    source: {
      type: enumValue(source.type, DELIVERY_SOURCE_TYPES, 'source.type'),
      id: requiredString(source.id, 'source.id'),
    },
    offer: createCanonicalOffer(input.offer),
    destination: createDestinationRef(input.destination),
    templateKey: optionalString(input.templateKey),
    templateVersion: optionalString(input.templateVersion),
    idempotencyKey: requiredString(input.idempotencyKey, 'idempotencyKey'),
    requestedAt: isoDate(input.requestedAt ?? now(), 'requestedAt'),
    scheduledFor: isoDate(input.scheduledFor, 'scheduledFor', { optional: true }),
    metadata: input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
      ? { ...input.metadata }
      : {},
  })
}

export function fanOutDeliveryRequests(input = {}, options = {}) {
  if (!Array.isArray(input.destinations) || input.destinations.length === 0) {
    throw new TypeError('destinations deve conter ao menos um destino')
  }
  const baseIdempotencyKey = requiredString(input.idempotencyKey, 'idempotencyKey')
  return Object.freeze(input.destinations.map((destination) => createDeliveryRequest({
    ...input,
    id: null,
    destination,
    idempotencyKey: `${baseIdempotencyKey}:${destination.type}:${destination.id}`,
  }, options)))
}
