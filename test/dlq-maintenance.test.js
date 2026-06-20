import { test } from 'node:test'
import assert from 'node:assert/strict'

import { pruneAllUserDlqs, getDlqMaintenanceSnapshot } from '../src/jobs/dlqMaintenance.js'

// Mock bullmq injetável — espelha o usado em send-dlq.test.js.
function createMockBullmq(seed = {}) {
  const queues = new Map()
  class Job {
    constructor(id, data, timestamp = Date.now()) {
      this.id = id; this.data = data; this.timestamp = timestamp; this.removed = false
    }
    async remove() { this.removed = true }
  }
  class Queue {
    constructor(name) {
      this.name = name
      this.jobs = (seed[name] || []).map(j => new Job(j.id, j.data, j.timestamp))
      queues.set(name, this)
    }
    async getJobs() { return this.jobs.filter(j => !j.removed) }
    async close() {}
  }
  return { Queue, _queues: queues }
}

function fakeDb(userIds) {
  return { waSession: { findMany: async () => userIds.map(userId => ({ userId })) } }
}

test('pruneAllUserDlqs poda a DLQ de cada usuário e soma removed/remaining', async () => {
  const now = 1_700_000_000_000
  const old = now - 40 * 24 * 60 * 60 * 1000
  const fresh = now - 1 * 24 * 60 * 60 * 1000
  const mock = createMockBullmq({
    'wabot-send-u1-dlq': [{ id: 'a', data: { failedAt: old } }, { id: 'b', data: { failedAt: fresh } }],
    'wabot-send-u2-dlq': [{ id: 'c', data: { failedAt: old } }],
  })
  const res = await pruneAllUserDlqs({
    db: fakeDb(['u1', 'u2']),
    redisUrl: 'redis://fake',
    queueBackendEnv: 'bullmq',
    now,
    bullmqModule: mock,
  })
  assert.equal(res.removed, 2) // 'a' e 'c'
  assert.equal(res.remaining, 1) // só 'b' sobra
  // gauge in-process atualizado para o /metrics
  assert.equal(getDlqMaintenanceSnapshot().lastKnownDlqTotal, 1)
})

test('pruneAllUserDlqs é no-op quando o backend não é bullmq', async () => {
  const res = await pruneAllUserDlqs({
    db: fakeDb(['u1']),
    redisUrl: 'redis://fake',
    queueBackendEnv: 'memory',
  })
  assert.equal(res.skipped, 'backend_not_bullmq')
  assert.equal(res.removed, 0)
})

test('pruneAllUserDlqs sem REDIS_URL é no-op (memory-fallback)', async () => {
  const res = await pruneAllUserDlqs({
    db: fakeDb(['u1']),
    redisUrl: '',
    queueBackendEnv: 'bullmq',
  })
  assert.equal(res.skipped, 'backend_not_bullmq')
})

test('pruneAllUserDlqs com BULLMQ_QUEUE_NAME (fila única) poda só uma vez', async () => {
  const now = 1_700_000_000_000
  const old = now - 40 * 24 * 60 * 60 * 1000
  const mock = createMockBullmq({
    'shared-queue-dlq': [{ id: 'a', data: { failedAt: old } }, { id: 'b', data: { failedAt: old } }],
  })
  let findManyCalls = 0
  const db = { waSession: { findMany: async () => { findManyCalls++; return [] } } }
  const res = await pruneAllUserDlqs({
    db,
    redisUrl: 'redis://fake',
    queueBackendEnv: 'bullmq',
    queueNameOverride: 'shared-queue',
    now,
    bullmqModule: mock,
  })
  assert.equal(res.removed, 2)
  // fila única: não itera usuários
  assert.equal(findManyCalls, 0)
})
