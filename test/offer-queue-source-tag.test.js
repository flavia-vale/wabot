import test from 'node:test'
import assert from 'node:assert/strict'
import {
  OFFER_QUEUE_SOURCE_PREFIX,
  buildOfferQueueSource,
  parseOfferQueueSourceId,
  broadcastSourceGroup,
} from '../src/offerQueue/sourceTag.js'

test('buildOfferQueueSource e parseOfferQueueSourceId são inversos', () => {
  const source = buildOfferQueueSource('q123')
  assert.equal(source, 'offerQueue:q123')
  assert.equal(source.startsWith(OFFER_QUEUE_SOURCE_PREFIX), true)
  assert.equal(parseOfferQueueSourceId(source), 'q123')
})

test('parseOfferQueueSourceId rejeita valores que não são de fila', () => {
  assert.equal(parseOfferQueueSourceId('manual'), null)
  assert.equal(parseOfferQueueSourceId('offerAutomation'), null)
  assert.equal(parseOfferQueueSourceId('offerQueue:'), null)
  assert.equal(parseOfferQueueSourceId('123@g.us'), null)
  assert.equal(parseOfferQueueSourceId(null), null)
  assert.equal(parseOfferQueueSourceId(undefined), null)
})

test('broadcastSourceGroup classifica options de broadcast', () => {
  assert.equal(broadcastSourceGroup({ source: 'offerAutomation' }), 'offerAutomation')
  assert.equal(broadcastSourceGroup({ source: 'offerQueue', queueId: 'q1' }), 'offerQueue:q1')
  // offerQueue sem queueId não pode gerar prefixo órfão — cai em manual
  assert.equal(broadcastSourceGroup({ source: 'offerQueue' }), 'manual')
  assert.equal(broadcastSourceGroup({}), 'manual')
  assert.equal(broadcastSourceGroup(undefined), 'manual')
})
