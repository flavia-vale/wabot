import { test } from 'node:test'
import assert from 'node:assert/strict'
import { subscribeToMonitorChannels } from '../../src/core/channels.js'

function silentLogger() {
  return { info: () => {}, warn: () => {}, error: () => {} }
}

function makeSock(overrides = {}) {
  const followCalls = []
  const subscribeCalls = []
  return {
    followCalls,
    subscribeCalls,
    newsletterFollow: overrides.newsletterFollow ?? (async (jid) => { followCalls.push(jid) }),
    subscribeNewsletterUpdates:
      overrides.subscribeNewsletterUpdates ?? (async (jid) => { subscribeCalls.push(jid); return { duration: '3600' } }),
  }
}

test('subscribeToMonitorChannels — sem sock retorna contagem zero', async () => {
  const result = await subscribeToMonitorChannels({
    sock: null,
    channelMonitors: [{ waJid: 'a@newsletter' }],
    followedSet: new Set(),
    logger: silentLogger(),
  })
  assert.deepEqual(result, { followed: 0, failed: 0, attempted: 0, skipped: 0 })
})

test('subscribeToMonitorChannels — filtra monitores que não são canal', async () => {
  const sock = makeSock()
  const result = await subscribeToMonitorChannels({
    sock,
    channelMonitors: [
      { waJid: 'group1@g.us' },
      { waJid: 'canal1@newsletter' },
      { waJid: 'lixo@s.whatsapp.net' },
    ],
    followedSet: new Set(),
    logger: silentLogger(),
    delayBetweenMs: 0,
  })
  assert.deepEqual(sock.followCalls, ['canal1@newsletter'])
  assert.deepEqual(sock.subscribeCalls, ['canal1@newsletter'])
  assert.equal(result.followed, 1)
  assert.equal(result.attempted, 1)
})

test('subscribeToMonitorChannels — segue múltiplos canais e marca todos como followed', async () => {
  const sock = makeSock()
  const followedSet = new Set()
  const result = await subscribeToMonitorChannels({
    sock,
    channelMonitors: [
      { waJid: 'c1@newsletter' },
      { waJid: 'c2@newsletter' },
      { waJid: 'c3@newsletter' },
    ],
    followedSet,
    logger: silentLogger(),
    delayBetweenMs: 0,
  })
  assert.deepEqual(sock.followCalls, ['c1@newsletter', 'c2@newsletter', 'c3@newsletter'])
  assert.deepEqual(sock.subscribeCalls, ['c1@newsletter', 'c2@newsletter', 'c3@newsletter'])
  assert.equal(followedSet.size, 3)
  assert.equal(result.followed, 3)
  assert.equal(result.failed, 0)
  assert.equal(result.attempted, 3)
  assert.equal(result.skipped, 0)
})

test('subscribeToMonitorChannels — pula canais já no followedSet', async () => {
  const sock = makeSock()
  const followedSet = new Set(['c1@newsletter'])
  const result = await subscribeToMonitorChannels({
    sock,
    channelMonitors: [
      { waJid: 'c1@newsletter' },
      { waJid: 'c2@newsletter' },
    ],
    followedSet,
    logger: silentLogger(),
    delayBetweenMs: 0,
  })
  assert.deepEqual(sock.followCalls, ['c2@newsletter'])
  assert.equal(result.skipped, 1)
  assert.equal(result.attempted, 1)
  assert.equal(result.followed, 1)
})

test('subscribeToMonitorChannels — falha de um canal não interrompe os outros', async () => {
  const sock = {
    followCalls: [],
    newsletterFollow: async (jid) => {
      sock.followCalls.push(jid)
      if (jid === 'c2@newsletter') throw new Error('boom')
    },
    subscribeNewsletterUpdates: async () => ({ duration: '3600' }),
  }
  const followedSet = new Set()
  const result = await subscribeToMonitorChannels({
    sock,
    channelMonitors: [
      { waJid: 'c1@newsletter' },
      { waJid: 'c2@newsletter' },
      { waJid: 'c3@newsletter' },
    ],
    followedSet,
    logger: silentLogger(),
    delayBetweenMs: 0,
  })
  assert.deepEqual(sock.followCalls, ['c1@newsletter', 'c2@newsletter', 'c3@newsletter'])
  assert.deepEqual([...followedSet], ['c1@newsletter', 'c3@newsletter'])
  assert.equal(result.followed, 2)
  assert.equal(result.failed, 1)
  assert.equal(result.attempted, 3)
})

test('subscribeToMonitorChannels — falha de subscribe não desfaz follow', async () => {
  const sock = {
    followCalls: [],
    subscribeCalls: [],
    newsletterFollow: async (jid) => { sock.followCalls.push(jid) },
    subscribeNewsletterUpdates: async (jid) => {
      sock.subscribeCalls.push(jid)
      throw new Error('subscribe rejected')
    },
  }
  const followedSet = new Set()
  const result = await subscribeToMonitorChannels({
    sock,
    channelMonitors: [{ waJid: 'c1@newsletter' }],
    followedSet,
    logger: silentLogger(),
    delayBetweenMs: 0,
  })
  assert.deepEqual(sock.followCalls, ['c1@newsletter'])
  assert.deepEqual(sock.subscribeCalls, ['c1@newsletter'])
  assert.ok(followedSet.has('c1@newsletter'))
  assert.equal(result.followed, 1)
  assert.equal(result.failed, 0)
})

test('subscribeToMonitorChannels — aplica delay entre follows', async () => {
  const sock = makeSock()
  let jitterCalls = 0
  const start = Date.now()
  await subscribeToMonitorChannels({
    sock,
    channelMonitors: [
      { waJid: 'c1@newsletter' },
      { waJid: 'c2@newsletter' },
      { waJid: 'c3@newsletter' },
    ],
    followedSet: new Set(),
    logger: silentLogger(),
    jitterFn: () => { jitterCalls++; return 5 },
  })
  const elapsed = Date.now() - start
  assert.equal(jitterCalls, 2, 'jitter chamado entre N follows = N-1 vezes')
  assert.ok(elapsed >= 10, `elapsed ${elapsed}ms deve ser ≥ 10ms (2 delays de 5ms)`)
})

test('subscribeToMonitorChannels — entradas inválidas tratadas defensivamente', async () => {
  const sock = makeSock()
  const result = await subscribeToMonitorChannels({
    sock,
    channelMonitors: [
      null,
      undefined,
      { waJid: null },
      { waJid: '' },
      { waJid: 'c1@newsletter' },
    ],
    followedSet: new Set(),
    logger: silentLogger(),
    delayBetweenMs: 0,
  })
  assert.deepEqual(sock.followCalls, ['c1@newsletter'])
  assert.equal(result.followed, 1)
})
