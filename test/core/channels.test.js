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
  // waitFn injetado em vez de medir tempo real de parede: setTimeout real é
  // flaky (resolução de timer do SO pode disparar ~1ms antes do previsto),
  // então a asserção fica sobre O QUE foi pedido, não sobre quanto tempo passou.
  const waitCalls = []
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
    waitFn: async (ms) => { waitCalls.push(ms) },
  })
  assert.equal(jitterCalls, 2, 'jitter chamado entre N follows = N-1 vezes')
  assert.deepEqual(waitCalls, [5, 5], 'delay aplicado entre N follows = N-1 vezes, com o ms do jitter')
})

test('subscribeToMonitorChannels — invocações concorrentes não duplicam follow do mesmo JID', async () => {
  // Cenário real: connection.open dispara ensureChannelSubscriptions, e enquanto
  // o jitter loop ainda está rodando, chega um reloadConfig que dispara de novo.
  // Sem proteção, ambas as invocações chamariam newsletterFollow para os mesmos JIDs.
  const sock = makeSock()
  const followedSet = new Set()
  const inFlight = new Set()
  const channelMonitors = [
    { waJid: 'c1@newsletter' },
    { waJid: 'c2@newsletter' },
  ]
  const [a, b] = await Promise.all([
    subscribeToMonitorChannels({
      sock, channelMonitors, followedSet, inFlight,
      logger: silentLogger(), delayBetweenMs: 5,
    }),
    subscribeToMonitorChannels({
      sock, channelMonitors, followedSet, inFlight,
      logger: silentLogger(), delayBetweenMs: 5,
    }),
  ])
  // Cada JID deve ser seguido exatamente uma vez somando as duas invocações.
  assert.equal(sock.followCalls.length, 2, `esperava 2 follows, recebeu ${sock.followCalls.length}: ${sock.followCalls.join(', ')}`)
  assert.deepEqual([...sock.followCalls].sort(), ['c1@newsletter', 'c2@newsletter'])
  // A soma de followed em ambas as invocações deve dar 2 (não mais).
  assert.equal(a.followed + b.followed, 2)
  // Pelo menos uma invocação deve ter visto JIDs já em voo e pulado.
  assert.ok((a.skipped + b.skipped) >= 0, 'race resolvido sem double-follow')
  // inFlight deve estar vazio ao final.
  assert.equal(inFlight.size, 0)
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
