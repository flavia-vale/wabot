import test from 'node:test'
import assert from 'node:assert/strict'
import { getInstagramHealth } from '../src/instagram/health.js'

test('saúde do Instagram agrega fila, reconciliação e ingressos sem expor registros', async () => {
  const calls = []
  const publicationCount = async ({ where }) => {
    calls.push(where)
    if (where.status === 'failed') return 2
    if (where.status === 'reconciliation_required') return 1
    if (where.status === 'published') return 8
    if (where.status?.in?.includes('queued')) return 4
    if (where.status?.in?.includes('processing')) return 2
    return 0
  }
  const ingressCount = async ({ where }) => { calls.push(where); if (where.status === 'pending') return 3; if (where.status === 'failed') return 0; if (where.status === 'processing') return 1; return 0 }
  const connectionCount = async ({ where }) => { calls.push(where); return 1 }
  const db = { instagramConnection: { count: connectionCount }, storyPublication: { count: publicationCount }, instagramStoryIngress: { count: ingressCount } }
  const health = await getInstagramHealth('u1', { db, now: () => new Date('2026-09-11T12:00:00Z') })
  assert.equal(health.connections, 1)
  assert.equal(health.publications.reconciliation, 1)
  assert.equal(health.mirroring.pending, 3)
  assert.equal(health.requiresAttention, 4)
  assert.ok(calls.every((where) => where.userId === 'u1'))
})
