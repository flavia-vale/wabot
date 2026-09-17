import { DESTINATION_TYPES } from './constants.js'
import { enumValue, freezeSnapshot, requiredString } from './validation.js'

/**
 * Referência interna e tipada. `id` aponta para o futuro registro Destination;
 * nunca coloque JID, ig-user-id ou access token nesse campo por convenção.
 */
export function createDestinationRef(input = {}) {
  return freezeSnapshot({
    id: requiredString(input.id, 'destination.id'),
    type: enumValue(input.type, DESTINATION_TYPES, 'destination.type'),
  })
}
