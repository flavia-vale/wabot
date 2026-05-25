import test from 'node:test'
import assert from 'node:assert/strict'

import {
  recordProbeSeen,
  runProbeWatchdog,
  PROBE_STALE_WINDOW_MS,
} from '../../src/core/channelProbe.js'
import { __resetCacheForTests } from '../../src/billing/plans.js'

function makeFakeDb({ channels = [], channelHealth = new Map(), usersByPlan = new Map() } = {}) {
  return {
    _health: channelHealth,
    group: {
      findMany: async ({ where }) => channels.filter(c => c.kind === 'channel' && c.role === 'post'),
    },
    channelHealth: {
      findUnique: async ({ where }) => channelHealth.get(where.groupId) ?? null,
      upsert: async ({ where, create, update }) => {
        const existing = channelHealth.get(where.groupId)
        const next = existing ? { ...existing, ...update } : { groupId: where.groupId, ...create }
        channelHealth.set(where.groupId, next)
        return next
      },
      updateMany: async ({ where, data }) => {
        const ids = new Set(where.groupId?.in ?? [])
        let count = 0
        for (const [gid, row] of channelHealth) {
          if (ids.has(gid)) {
            channelHealth.set(gid, { ...row, ...data })
            count++
          }
        }
        return { count }
      },
    },
    user: {
      findUnique: async ({ where }) => usersByPlan.get(where.id) ?? { plan: 'pro', accessExpiresAt: null },
    },
  }
}

test('recordProbeSeen atualiza lastProbeSeenAt no ChannelHealth', async () => {
  const db = makeFakeDb()
  const now = Date.now()
  await recordProbeSeen('g-1', { db, now })
  const row = db._health.get('g-1')
  assert.ok(row)
  assert.equal(new Date(row.lastProbeSeenAt).getTime(), now)
})

test('recordProbeSeen é idempotente (sobrescreve com timestamp novo)', async () => {
  const db = makeFakeDb()
  await recordProbeSeen('g-1', { db, now: 1000 })
  await recordProbeSeen('g-1', { db, now: 2000 })
  assert.equal(new Date(db._health.get('g-1').lastProbeSeenAt).getTime(), 2000)
})

test('runProbeWatchdog não altera canal sem post recente', async () => {
  __resetCacheForTests()
  const channelHealth = new Map([
    ['g-1', { groupId: 'g-1', status: 'green', lastPostedAt: null, lastProbeSeenAt: null }],
  ])
  const db = makeFakeDb({
    channels: [{ id: 'g-1', userId: 'u', kind: 'channel', role: 'post' }],
    channelHealth,
  })
  const summary = await runProbeWatchdog({ db, now: Date.now() })
  assert.equal(summary.flagged, 0)
  assert.equal(channelHealth.get('g-1').status, 'green')
})

test('runProbeWatchdog flag yellow quando lastPostedAt > stale window e probe não viu', async () => {
  __resetCacheForTests()
  const now = Date.now()
  const channelHealth = new Map([
    ['g-1', {
      groupId: 'g-1', status: 'green',
      lastPostedAt: new Date(now - (PROBE_STALE_WINDOW_MS + 60_000)),
      lastProbeSeenAt: null,
    }],
  ])
  const db = makeFakeDb({
    channels: [{ id: 'g-1', userId: 'u', kind: 'channel', role: 'post' }],
    channelHealth,
  })
  const summary = await runProbeWatchdog({ db, now })
  assert.equal(summary.flagged, 1)
  assert.equal(channelHealth.get('g-1').status, 'yellow')
})

test('runProbeWatchdog flag yellow quando probe viu ANTES do último post (stale)', async () => {
  __resetCacheForTests()
  const now = Date.now()
  const channelHealth = new Map([
    ['g-1', {
      groupId: 'g-1', status: 'green',
      lastPostedAt: new Date(now - (PROBE_STALE_WINDOW_MS + 60_000)),
      lastProbeSeenAt: new Date(now - (PROBE_STALE_WINDOW_MS + 120_000)),
    }],
  ])
  const db = makeFakeDb({
    channels: [{ id: 'g-1', userId: 'u', kind: 'channel', role: 'post' }],
    channelHealth,
  })
  const summary = await runProbeWatchdog({ db, now })
  assert.equal(summary.flagged, 1)
})

test('runProbeWatchdog NÃO mexe em canais já em red/critical', async () => {
  __resetCacheForTests()
  const now = Date.now()
  const channelHealth = new Map([
    ['g-1', {
      groupId: 'g-1', status: 'red',
      lastPostedAt: new Date(now - (PROBE_STALE_WINDOW_MS + 60_000)),
      lastProbeSeenAt: null,
    }],
  ])
  const db = makeFakeDb({
    channels: [{ id: 'g-1', userId: 'u', kind: 'channel', role: 'post' }],
    channelHealth,
  })
  await runProbeWatchdog({ db, now })
  assert.equal(channelHealth.get('g-1').status, 'red') // mantém
})

test('runProbeWatchdog: probe viu DEPOIS do post → mantém verde', async () => {
  __resetCacheForTests()
  const now = Date.now()
  const channelHealth = new Map([
    ['g-1', {
      groupId: 'g-1', status: 'green',
      lastPostedAt: new Date(now - (PROBE_STALE_WINDOW_MS + 60_000)),
      lastProbeSeenAt: new Date(now - (PROBE_STALE_WINDOW_MS + 30_000)), // 30s depois do post
    }],
  ])
  const db = makeFakeDb({
    channels: [{ id: 'g-1', userId: 'u', kind: 'channel', role: 'post' }],
    channelHealth,
  })
  const summary = await runProbeWatchdog({ db, now })
  assert.equal(summary.flagged, 0)
  assert.equal(channelHealth.get('g-1').status, 'green')
})

test('runProbeWatchdog pula canais de usuários sem preservação avançada', async () => {
  __resetCacheForTests()
  const now = Date.now()
  const stalePosted = new Date(now - (PROBE_STALE_WINDOW_MS + 60_000))
  const channelHealth = new Map([
    ['g-pro', { groupId: 'g-pro', status: 'green', lastPostedAt: stalePosted, lastProbeSeenAt: null }],
    ['g-basic', { groupId: 'g-basic', status: 'green', lastPostedAt: stalePosted, lastProbeSeenAt: null }],
  ])
  const usersByPlan = new Map([
    ['u-pro', { plan: 'pro', accessExpiresAt: null }],
    ['u-basic', { plan: 'basic', accessExpiresAt: null }],
  ])
  const db = makeFakeDb({
    channels: [
      { id: 'g-pro', userId: 'u-pro', kind: 'channel', role: 'post' },
      { id: 'g-basic', userId: 'u-basic', kind: 'channel', role: 'post' },
    ],
    channelHealth,
    usersByPlan,
  })
  const summary = await runProbeWatchdog({ db, now })
  assert.equal(summary.flagged, 1, 'só o canal do usuário pro foi flaggado')
  assert.equal(channelHealth.get('g-pro').status, 'yellow')
  assert.equal(channelHealth.get('g-basic').status, 'green', 'canal do basic não é tocado')
})
