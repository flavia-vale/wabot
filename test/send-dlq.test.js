import { test } from 'node:test'
import assert from 'node:assert/strict'

import { retryDlqJob, pruneDlqOlderThan } from '../src/jobs/sendDlq.js'

// Mock bullmq injetável — sem Redis. Cada Queue guarda jobs num array.
function createMockBullmq(seed = {}) {
  const queues = new Map()
  class Job {
    constructor(id, data, timestamp = Date.now()) {
      this.id = id
      this.data = data
      this.timestamp = timestamp
      this.removed = false
    }
    async remove() { this.removed = true }
  }
  class Queue {
    constructor(name) {
      this.name = name
      this.jobs = (seed[name] || []).map(j => new Job(j.id, j.data, j.timestamp))
      this.added = []
      queues.set(name, this)
    }
    async getJob(id) { return this.jobs.find(j => j.id === id && !j.removed) || null }
    async getJobs() { return this.jobs.filter(j => !j.removed) }
    async add(name, data, options) { this.added.push({ name, data, options }); return { id: options?.jobId ?? 'auto' } }
    async close() {}
  }
  return { Queue, _queues: queues, Job }
}

test('retryDlqJob usa jobId único (não o logId) para evitar colisão no histórico (P2-3)', async () => {
  const mock = createMockBullmq({
    'wabot-send-u1-dlq': [
      { id: 'dlq-1', data: { originalQueue: 'wabot-send-u1', originalData: { logId: 42, destJid: 'a@s' }, failedAt: 1000 } },
    ],
  })
  const res = await retryDlqJob({ redisUrl: 'redis://fake', userId: 'u1', dlqJobId: 'dlq-1', bullmqModule: mock })
  assert.equal(res.ok, true)
  assert.equal(res.requeuedTo, 'wabot-send-u1')
  assert.equal(res.logId, 42)

  const main = mock._queues.get('wabot-send-u1')
  assert.equal(main.added.length, 1)
  const opts = main.added[0].options
  // jobId NÃO pode ser '42' (colidiria com a linha do envio original no histórico)
  assert.notEqual(opts.jobId, '42')
  assert.equal(opts.jobId, 'dlq-retry:42:dlq-1')
  // mas o logId real continua no data, pro processSendJob atualizar o MessageLog certo
  assert.equal(main.added[0].data.logId, 42)

  // a entrada da DLQ foi removida
  const dlq = mock._queues.get('wabot-send-u1-dlq')
  assert.equal(dlq.jobs[0].removed, true)
})

test('retryDlqJob sem originalData/originalQueue não reenfileira', async () => {
  const mock = createMockBullmq({
    'wabot-send-u2-dlq': [{ id: 'dlq-x', data: { failedAt: 1 } }],
  })
  const res = await retryDlqJob({ redisUrl: 'redis://fake', userId: 'u2', dlqJobId: 'dlq-x', bullmqModule: mock })
  assert.equal(res.ok, false)
})

test('pruneDlqOlderThan remove só jobs além da janela de retenção (P2-1)', async () => {
  const now = 1_700_000_000_000
  const mock = createMockBullmq({
    'wabot-send-u3-dlq': [
      { id: 'old', data: { failedAt: now - 40 * 24 * 60 * 60 * 1000 } }, // 40d atrás
      { id: 'fresh', data: { failedAt: now - 1 * 24 * 60 * 60 * 1000 } }, // 1d atrás
    ],
  })
  const res = await pruneDlqOlderThan({ redisUrl: 'redis://fake', userId: 'u3', now, bullmqModule: mock })
  assert.equal(res.ok, true)
  assert.equal(res.removed, 1)
  const dlq = mock._queues.get('wabot-send-u3-dlq')
  assert.equal(dlq.jobs.find(j => j.id === 'old').removed, true)
  assert.equal(dlq.jobs.find(j => j.id === 'fresh').removed, false)
})

test('pruneDlqOlderThan com retenção 0 é no-op', async () => {
  const mock = createMockBullmq({ 'wabot-send-u4-dlq': [{ id: 'x', data: { failedAt: 1 } }] })
  const res = await pruneDlqOlderThan({ redisUrl: 'redis://fake', userId: 'u4', olderThanMs: 0, bullmqModule: mock })
  assert.equal(res.removed, 0)
  assert.equal(res.skipped, 'retention_disabled')
})
