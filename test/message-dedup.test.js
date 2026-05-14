import test from 'node:test'
import assert from 'node:assert/strict'

import { buildIncomingDedupKey, hasRecentDedupEntry, pruneDedupStore, rememberDedupEntry } from '../src/messageDedup.js'

test('incoming dedup key includes group jid to avoid cross-group collisions', () => {
  const id = 'SAME_STANZA_ID'
  assert.equal(buildIncomingDedupKey({ key: { remoteJid: '111@g.us', id } }), '111@g.us:SAME_STANZA_ID')
  assert.equal(buildIncomingDedupKey({ key: { remoteJid: '222@g.us', id } }), '222@g.us:SAME_STANZA_ID')
})

test('messages without stanza id are not globally deduped as undefined', () => {
  assert.equal(buildIncomingDedupKey({ key: { remoteJid: '111@g.us' } }), null)
  const store = { msgIds: [] }
  assert.equal(rememberDedupEntry(store, null, 1000), false)
  assert.deepEqual(store.msgIds, [])
})

test('dedup entries expire continuously instead of only at worker start', () => {
  const store = {
    msgIds: [{ id: '111@g.us:old', ts: 1 }, { id: '111@g.us:new', ts: 9_900 }],
    links: { old: 1, fresh: 9_900 },
  }

  pruneDedupStore(store, 10_000, 300)

  assert.deepEqual(store.msgIds, [{ id: '111@g.us:new', ts: 9_900 }])
  assert.deepEqual(store.links, { fresh: 9_900 })
  assert.equal(hasRecentDedupEntry(store.msgIds, '111@g.us:new', 10_000, 300), true)
  assert.equal(hasRecentDedupEntry(store.msgIds, '111@g.us:old', 10_000, 300), false)
})
