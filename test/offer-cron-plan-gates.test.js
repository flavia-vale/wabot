import test from 'node:test'
import assert from 'node:assert/strict'
import { tickOfferAutomations } from '../src/offerAutomation/cron.js'
import { tickOfferQueues } from '../src/offerQueue/cron.js'
import { __resetCacheForTests } from '../src/billing/plans.js'

// userIds únicos por teste: getPlanAccess cacheia por userId (TTL 60s) e o
// Map é compartilhado no módulo.
let userCounter = 0
function nextUserId(prefix) {
  return `${prefix}-${++userCounter}-${Math.random().toString(16).slice(2)}`
}

function buildAutomationDeps({ plan, accessExpiresAt = null, userId }) {
  const calls = { ran: [] }
  const db = {
    offerAutomation: {
      findMany: async () => [{ id: 'a1', userId, enabled: true, intervalMinutes: 15, dailyRunTime: null, lastSentAt: null }],
    },
    user: { findUnique: async () => ({ plan, accessExpiresAt }) },
  }
  const deps = {
    db,
    runAutomationFn: async (automation) => { calls.ran.push(automation.id) },
  }
  return { deps, calls }
}

function buildQueueDeps({ plan, accessExpiresAt = null, userId }) {
  const calls = { sent: [] }
  const queue = { id: 'q1', userId, enabled: true, intervalEnabled: false, hourlyCapEnabled: false, dailyCapEnabled: false, lastSentAt: null }
  const item = { id: 'i1', queueId: 'q1', userId, status: 'pending', position: 1, text: 'Oferta', targetJids: '["grupo@g.us"]', imageUrl: null, imageRefererUrl: null }
  const db = {
    offerQueue: {
      findMany: async () => [queue],
      findFirst: async () => queue,
      updateMany: async () => ({ count: 1 }),
    },
    offerQueueItem: {
      count: async () => 0,
      findFirst: async () => item,
      updateMany: async () => ({ count: 1 }),
    },
    user: { findUnique: async () => ({ plan, accessExpiresAt }) },
    $transaction: async () => {},
  }
  const deps = {
    db,
    isRunning: () => true,
    sendBroadcast: async (...args) => { calls.sent.push(args) },
  }
  return { deps, calls }
}

test('tickOfferAutomations pula automação de dono Basic', async () => {
  __resetCacheForTests()
  const userId = nextUserId('basic-auto')
  const { deps, calls } = buildAutomationDeps({ plan: 'basic', userId })
  await tickOfferAutomations(deps)
  assert.deepEqual(calls.ran, [])
})

test('tickOfferAutomations pula automação de Trial expirado', async () => {
  __resetCacheForTests()
  const userId = nextUserId('expired-auto')
  const { deps, calls } = buildAutomationDeps({
    plan: 'trial',
    accessExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    userId,
  })
  await tickOfferAutomations(deps)
  assert.deepEqual(calls.ran, [])
})

test('tickOfferAutomations executa automação de dono Pro', async () => {
  __resetCacheForTests()
  const userId = nextUserId('pro-auto')
  const { deps, calls } = buildAutomationDeps({ plan: 'pro', userId })
  await tickOfferAutomations(deps)
  assert.deepEqual(calls.ran, ['a1'])
})

test('tickOfferAutomations executa automação de Trial ativo', async () => {
  __resetCacheForTests()
  const userId = nextUserId('trial-auto')
  const { deps, calls } = buildAutomationDeps({
    plan: 'trial',
    accessExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    userId,
  })
  await tickOfferAutomations(deps)
  assert.deepEqual(calls.ran, ['a1'])
})

test('tickOfferQueues pula fila de dono Basic', async () => {
  __resetCacheForTests()
  const userId = nextUserId('basic-queue')
  const { deps, calls } = buildQueueDeps({ plan: 'basic', userId })
  await tickOfferQueues(deps)
  assert.equal(calls.sent.length, 0)
})

test('tickOfferQueues pula fila de Trial expirado', async () => {
  __resetCacheForTests()
  const userId = nextUserId('expired-queue')
  const { deps, calls } = buildQueueDeps({
    plan: 'trial',
    accessExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    userId,
  })
  await tickOfferQueues(deps)
  assert.equal(calls.sent.length, 0)
})

test('tickOfferQueues drena fila de dono Pro', async () => {
  __resetCacheForTests()
  const userId = nextUserId('pro-queue')
  const { deps, calls } = buildQueueDeps({ plan: 'pro', userId })
  await tickOfferQueues(deps)
  assert.equal(calls.sent.length, 1)
  assert.deepEqual(calls.sent[0][2], ['grupo@g.us'])
})
