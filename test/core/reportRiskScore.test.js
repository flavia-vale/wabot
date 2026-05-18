import test from 'node:test'
import assert from 'node:assert/strict'

import { computeScore, normPostsPerFollower, diversityScore, collectScoreInputs, recomputeScore } from '../../src/core/reportRiskScore.js'

test('computeScore: canal pequeno + 1 fonte + 0 cliques → score alto (>= 80)', () => {
  const score = computeScore({
    postsPerDay: 10,
    followerCount: 50,
    clickRate: 0,
    sourceDiversity: 1,
  })
  assert.ok(score >= 80, `score=${score}`)
})

test('computeScore: canal grande + 5 fontes + click rate sadio + poucos posts → score baixo (< 30)', () => {
  const score = computeScore({
    postsPerDay: 2,
    followerCount: 500,
    clickRate: 0.1,
    sourceDiversity: 5,
  })
  assert.ok(score < 30, `score=${score}`)
})

test('computeScore: clamp inferior em 0', () => {
  const score = computeScore({
    postsPerDay: 0,
    followerCount: 10000,
    clickRate: 1,
    sourceDiversity: 20,
  })
  assert.ok(score >= 0)
  assert.equal(score, 0)
})

test('computeScore: clamp superior em 100', () => {
  const score = computeScore({
    postsPerDay: 1000,
    followerCount: 10,
    clickRate: 0,
    sourceDiversity: 1,
  })
  assert.equal(score, 100)
})

test('computeScore: clickRate=null usa fallback neutro (não zera a dimensão)', () => {
  const withNull = computeScore({ postsPerDay: 5, followerCount: 100, clickRate: null, sourceDiversity: 2 })
  const withZero = computeScore({ postsPerDay: 5, followerCount: 100, clickRate: 0, sourceDiversity: 2 })
  // sem dados de clique não deve ser pior do que ter clickRate=0
  assert.ok(withNull <= withZero, `withNull=${withNull} withZero=${withZero}`)
})

test('computeScore: retorna inteiro 0–100', () => {
  const s = computeScore({ postsPerDay: 3, followerCount: 200, clickRate: 0.05, sourceDiversity: 2 })
  assert.equal(Number.isInteger(s), true)
  assert.ok(s >= 0 && s <= 100)
})

test('normPostsPerFollower: 0 followers retorna 1 (saturado)', () => {
  assert.equal(normPostsPerFollower(10, 0), 1)
})

test('normPostsPerFollower: razão satura em 0.5 posts/follower/dia → 1', () => {
  assert.equal(normPostsPerFollower(50, 100), 1)
  assert.equal(normPostsPerFollower(100, 100), 1) // bem acima de 0.5
})

test('normPostsPerFollower: razão proporcional abaixo do teto', () => {
  // 0.05 posts/follower/dia → ~0.25 (com cap=0.2)
  const n = normPostsPerFollower(5, 100)
  assert.ok(n > 0.2 && n < 0.3, `n=${n}`)
})

test('diversityScore: 1 fonte = 0; 5+ fontes ~ 1', () => {
  assert.equal(diversityScore(1), 0)
  assert.ok(diversityScore(5) >= 0.9)
  assert.ok(diversityScore(10) > diversityScore(3))
})

// ---------- I/O com fake db ----------

function makeFakeDb({ groups = [], messageLogs = [], snapshots = [], targets = [], channelHealth = new Map() } = {}) {
  return {
    _channelHealth: channelHealth,
    group: {
      findFirst: async ({ where }) =>
        groups.find(g => g.id === where.id && (!where.userId || g.userId === where.userId)) ?? null,
    },
    messageLog: {
      count: async ({ where }) => messageLogs.filter(m =>
        m.userId === where.userId &&
        m.destGroup === where.destGroup &&
        m.status === where.status &&
        (!where.sentAt?.gte || m.sentAt >= where.sentAt.gte)
      ).length,
    },
    channelSnapshot: {
      findFirst: async ({ where }) =>
        snapshots.filter(s => s.groupId === where.groupId).sort((a, b) => b.snapshotedAt - a.snapshotedAt)[0] ?? null,
    },
    groupTarget: {
      findMany: async ({ where }) => targets.filter(t => t.postId === where.postId),
    },
    channelHealth: {
      upsert: async ({ where, create, update }) => {
        const existing = channelHealth.get(where.groupId)
        const next = existing ? { ...existing, ...update } : { groupId: where.groupId, ...create }
        channelHealth.set(where.groupId, next)
        return next
      },
    },
  }
}

test('collectScoreInputs agrega posts (7d), followers e diversidade', async () => {
  const now = Date.now()
  const db = makeFakeDb({
    groups: [{ id: 'g-1', userId: 'u-1', waJid: 'c@newsletter' }],
    messageLogs: [
      { userId: 'u-1', destGroup: 'c@newsletter', status: 'success', sentAt: new Date(now - 1000) },
      { userId: 'u-1', destGroup: 'c@newsletter', status: 'success', sentAt: new Date(now - 2000) },
      { userId: 'u-1', destGroup: 'other@newsletter', status: 'success', sentAt: new Date(now - 1000) }, // outro canal
    ],
    snapshots: [
      { groupId: 'g-1', snapshotJson: JSON.stringify({ subscribersCount: 250 }), snapshotedAt: new Date(now - 60_000) },
    ],
    targets: [
      { postId: 'g-1', monitorId: 'm-1' },
      { postId: 'g-1', monitorId: 'm-2' },
      { postId: 'g-1', monitorId: 'm-1' }, // duplicado
    ],
  })
  const inputs = await collectScoreInputs('g-1', { db, userId: 'u-1', days: 7 })
  assert.equal(inputs.postsPerDay, 2 / 7)
  assert.equal(inputs.followerCount, 250)
  assert.equal(inputs.sourceDiversity, 2)
  assert.equal(inputs.clickRate, null)
})

test('recomputeScore persiste score em ChannelHealth', async () => {
  const now = Date.now()
  const db = makeFakeDb({
    groups: [{ id: 'g-1', userId: 'u-1', waJid: 'c@newsletter' }],
    messageLogs: Array.from({ length: 10 }, (_, i) => ({
      userId: 'u-1', destGroup: 'c@newsletter', status: 'success', sentAt: new Date(now - i * 1000),
    })),
    snapshots: [{ groupId: 'g-1', snapshotJson: JSON.stringify({ subscribersCount: 50 }), snapshotedAt: new Date() }],
    targets: [{ postId: 'g-1', monitorId: 'm-1' }],
  })
  const out = await recomputeScore('g-1', { db, userId: 'u-1', days: 1 })
  assert.ok(out.score >= 80, `score=${out.score}`)
  assert.equal(db._channelHealth.get('g-1').reportRiskScore, out.score)
})

test('collectScoreInputs retorna null se grupo não existe', async () => {
  const db = makeFakeDb()
  const out = await collectScoreInputs('nope', { db, userId: 'u-1' })
  assert.equal(out, null)
})
