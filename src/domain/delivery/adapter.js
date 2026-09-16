import { DESTINATION_TYPES } from './constants.js'
import { enumValue } from './validation.js'

/**
 * Contrato da borda de entrega. Implementações de WhatsApp e Instagram vivem
 * fora do domínio e recebem o mesmo DeliveryRequest imutável.
 */
export class DeliveryAdapter {
  constructor(destinationType) {
    this.destinationType = enumValue(destinationType, DESTINATION_TYPES, 'destinationType')
  }

  supports(request) {
    return request?.destination?.type === this.destinationType
  }

  async deliver(_request) {
    throw new Error('DeliveryAdapter.deliver não implementado')
  }
}

export function createDeliveryAdapterRegistry(adapters = []) {
  const byType = new Map()
  for (const adapter of adapters) {
    if (!(adapter instanceof DeliveryAdapter)) throw new TypeError('adapter deve implementar DeliveryAdapter')
    if (byType.has(adapter.destinationType)) throw new TypeError(`adapter duplicado: ${adapter.destinationType}`)
    byType.set(adapter.destinationType, adapter)
  }

  return Object.freeze({
    resolve(request) {
      const type = request?.destination?.type
      const adapter = byType.get(type)
      if (!adapter || !adapter.supports(request)) throw new Error(`adaptador não configurado: ${type || 'desconhecido'}`)
      return adapter
    },
  })
}
