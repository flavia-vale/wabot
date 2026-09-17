import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DELIVERY_SOURCE_TYPE,
  DELIVERY_STATUS,
  DESTINATION_TYPE,
  DeliveryAdapter,
  RETRY_DISPOSITION,
  createCanonicalOffer,
  createDeliveryAdapterRegistry,
  createDeliveryRequest,
  createDeliveryResult,
  fanOutDeliveryRequests,
} from '../src/domain/delivery/index.js'

const offer = {
  offerKey: 'shopee:123',
  title: 'Cafeteira elétrica',
  oldPriceCents: 15990,
  priceCents: 9990,
  productUrl: 'https://loja.example/produto',
  imageUrl: 'https://cdn.example/produto.jpg',
}

test('CanonicalOffer normaliza dados e congela profundamente o snapshot', () => {
  const canonical = createCanonicalOffer({ ...offer, currency: 'brl', attributes: { seller: 'Loja A' } })
  assert.equal(canonical.currency, 'BRL')
  assert.equal(canonical.productUrl, 'https://loja.example/produto')
  assert.equal(Object.isFrozen(canonical), true)
  assert.equal(Object.isFrozen(canonical.attributes), true)
  assert.throws(() => { canonical.attributes.seller = 'outra' }, TypeError)
})

test('CanonicalOffer recusa preço anterior menor e URL fora de HTTP(S)', () => {
  assert.throws(() => createCanonicalOffer({ ...offer, oldPriceCents: 100, priceCents: 200 }), /oldPriceCents/)
  assert.throws(() => createCanonicalOffer({ ...offer, imageUrl: 'file:\/\/segredo.jpg' }), /HTTP\(S\)/)
})

test('DeliveryRequest usa a mesma oferta para um destino tipado, sem endereço do provedor', () => {
  const request = createDeliveryRequest({
    userId: 'user-1',
    source: { type: DELIVERY_SOURCE_TYPE.MANUAL, id: 'manual-1' },
    offer,
    destination: { type: DESTINATION_TYPE.INSTAGRAM_STORY, id: 'destination-1' },
    idempotencyKey: 'manual-1:v1',
    templateKey: 'instagram-classico',
  }, { idFactory: () => 'request-1', now: () => new Date('2026-09-08T12:00:00Z') })

  assert.deepEqual(request.destination, { type: 'instagram_story', id: 'destination-1' })
  assert.equal(request.contractVersion, 1)
  assert.equal(request.id, 'request-1')
  assert.equal(request.requestedAt, '2026-09-08T12:00:00.000Z')
  assert.equal(Object.isFrozen(request.offer), true)
})

test('fan-out cria uma solicitação e uma chave idempotente por destino', () => {
  let sequence = 0
  const requests = fanOutDeliveryRequests({
    userId: 'user-1',
    source: { type: DELIVERY_SOURCE_TYPE.MIRROR, id: 'message-1' },
    offer,
    destinations: [
      { type: DESTINATION_TYPE.WHATSAPP_GROUP, id: 'destination-wa' },
      { type: DESTINATION_TYPE.INSTAGRAM_STORY, id: 'destination-ig' },
    ],
    idempotencyKey: 'message-1:offer-v1',
  }, { idFactory: () => `request-${++sequence}`, now: () => new Date('2026-09-08T12:00:00Z') })

  assert.equal(requests.length, 2)
  assert.deepEqual(requests.map(item => item.idempotencyKey), [
    'message-1:offer-v1:whatsapp_group:destination-wa',
    'message-1:offer-v1:instagram_story:destination-ig',
  ])
})

test('registro resolve adaptador por tipo e impede configuração duplicada', async () => {
  class InstagramAdapter extends DeliveryAdapter {
    constructor() { super(DESTINATION_TYPE.INSTAGRAM_STORY) }
    async deliver(request) { return request.id }
  }
  const adapter = new InstagramAdapter()
  const registry = createDeliveryAdapterRegistry([adapter])
  const request = createDeliveryRequest({
    userId: 'user-1',
    source: { type: DELIVERY_SOURCE_TYPE.SCHEDULED, id: 'schedule-1' },
    offer,
    destination: { type: DESTINATION_TYPE.INSTAGRAM_STORY, id: 'destination-ig' },
    idempotencyKey: 'schedule-1:v1',
  }, { idFactory: () => 'request-ig' })

  assert.equal(await registry.resolve(request).deliver(request), 'request-ig')
  assert.throws(() => createDeliveryAdapterRegistry([adapter, new InstagramAdapter()]), /duplicado/)
})

test('DeliveryResult representa retry e exige código em falha', () => {
  const result = createDeliveryResult({
    requestId: 'request-1',
    status: DELIVERY_STATUS.FAILED,
    retry: RETRY_DISPOSITION.RECONCILE,
    errorCode: 'PROVIDER_RESULT_UNKNOWN',
  }, { now: () => new Date('2026-09-08T12:05:00Z') })
  assert.equal(result.retry, 'reconcile')
  assert.throws(() => createDeliveryResult({ requestId: 'r', status: DELIVERY_STATUS.FAILED }), /errorCode/)
  assert.throws(() => createDeliveryResult({
    requestId: 'r',
    status: DELIVERY_STATUS.PUBLISHED,
    retry: RETRY_DISPOSITION.RETRYABLE,
  }), /publicada/)
})
