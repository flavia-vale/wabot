import test from 'node:test'
import assert from 'node:assert/strict'
import { needsWhatsappSession, splitTargetsByDeliveryNetwork, withDeliveryNetworkHandOff } from '../src/deliveryOutbox/handOff.js'

// Feature 017, T051: filas e ofertas automáticas entregam no Telegram pela
// caixa de saída; o caminho do WhatsApp continua igual.

test('separa os destinos pelo prefixo do aplicativo', () => {
  const r = splitTargetsByDeliveryNetwork(['1@g.us', 'tg:-100', '2@newsletter'])
  assert.deepEqual(r.whatsapp, ['1@g.us', '2@newsletter'])
  assert.deepEqual(r.outros, [{ deliveryNetwork: 'telegram', destinationId: 'tg:-100' }])
  assert.equal(needsWhatsappSession(['tg:-1']), false)
  assert.equal(needsWhatsappSession(['tg:-1', '1@g.us']), true)
})

test('só WhatsApp: chama o sendBroadcast de sempre, com os mesmos argumentos, e não enfileira nada', async () => {
  const calls = []
  const enq = []
  const send = withDeliveryNetworkHandOff(async (...a) => { calls.push(a); return 'ok' }, { enqueue: async (x) => enq.push(x), env: { DELIVERY_NETWORKS_ENABLED: 'whatsapp,telegram' } })
  const opts = { imageUrl: 'https://i', source: 'offerQueue', queueId: 'q1' }
  assert.equal(await send('u1', 'texto', ['1@g.us'], opts), 'ok')
  assert.deepEqual(calls, [['u1', 'texto', ['1@g.us'], opts]])
  assert.equal(enq.length, 0)
})

test('destino do Telegram vai para a caixa de saída com a oferta e a origem da fila', async () => {
  const calls = []
  const enq = []
  const send = withDeliveryNetworkHandOff(async (...a) => { calls.push(a) }, { enqueue: async (x) => enq.push(x), env: { DELIVERY_NETWORKS_ENABLED: 'whatsapp,telegram' } })
  await send('u1', 'texto', ['1@g.us', 'tg:-100'], { imageUrl: 'https://i', source: 'offerQueue', queueId: 'q1' })
  assert.deepEqual(calls[0][2], ['1@g.us'])
  assert.equal(enq.length, 1)
  assert.equal(enq[0].destinationId, 'tg:-100')
  assert.equal(enq[0].deliveryNetwork, 'telegram')
  assert.equal(enq[0].offer.texto, 'texto')
  assert.deepEqual(enq[0].offer.imagem, { url: 'https://i' })
  assert.match(enq[0].sourceId, /q1/)
})

test('WhatsApp falhou: o Telegram não é enfileirado (a nova tentativa não duplica)', async () => {
  const enq = []
  const send = withDeliveryNetworkHandOff(async () => { throw new Error('Bot não está rodando') }, { enqueue: async (x) => enq.push(x), env: { DELIVERY_NETWORKS_ENABLED: 'whatsapp,telegram' } })
  await assert.rejects(send('u1', 't', ['1@g.us', 'tg:-1'], {}))
  assert.equal(enq.length, 0)
})

test('Telegram desligado no servidor: nada é enfileirado', async () => {
  const enq = []
  const send = withDeliveryNetworkHandOff(async () => {}, { enqueue: async (x) => enq.push(x), env: {} })
  await send('u1', 't', ['tg:-1'], {})
  assert.equal(enq.length, 0)
})
