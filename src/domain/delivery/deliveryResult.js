import { DELIVERY_STATUSES, RETRY_DISPOSITIONS } from './constants.js'
import { enumValue, freezeSnapshot, isoDate, optionalString, requiredString } from './validation.js'

export function createDeliveryResult(input = {}, { now = () => new Date() } = {}) {
  const status = enumValue(input.status, DELIVERY_STATUSES, 'status')
  const retry = enumValue(input.retry ?? 'none', RETRY_DISPOSITIONS, 'retry')
  if (status === 'published' && retry !== 'none') {
    throw new TypeError('entrega publicada não pode solicitar retry')
  }
  if (status === 'failed' && !optionalString(input.errorCode)) {
    throw new TypeError('errorCode obrigatório para entrega com falha')
  }

  return freezeSnapshot({
    requestId: requiredString(input.requestId, 'requestId'),
    status,
    retry,
    providerReference: optionalString(input.providerReference),
    errorCode: optionalString(input.errorCode),
    errorMessage: optionalString(input.errorMessage),
    completedAt: isoDate(input.completedAt ?? now(), 'completedAt'),
  })
}
