import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  listDlq,
  retryDlqJob,
  discardDlqJob,
  purgeDlq,
} from '../src/jobs/sendDlq.js'

/**
 * Mock de bullmq compartilhado para todos os testes — simula um conjunto
 * de Queues em memória. Cada Queue mantém os jobs adicionados com .add()
 * e suporta getJob/getJobs/remove conforme o módulo sendDlq.js usa.
 */
function createMockBullmq(seedJobs = {}) {
  const queues = new Map()

  class Job {
    constructor(id, data, queueName) {
      this.id = id
      this.data = data
      this._queueName = queueName
      this.removed = false
    }
    async remove() {
      this.removed = true
      const q = queues.get(this._queueName)
      q._jobs = q._jobs.filter(j => j.id !== this.id)
    }
  }

  class Queue {
    constructor(name) {
      this.name = name
      this._jobs = []
      this.added = []
      this.closed = false
      // popula seed se houver
      if (seedJobs[name]) {
        for (const seed of seedJobs[name]) {
          this._jobs.push(new Job(seed.id, seed.data, name))
        }
      }
      queues.set(name, this)
    }
    async add(jobName, data, options) {
      const id = options?.jobId ?? String(this._jobs.length + 1)
      const job = new Job(id, data, this.name)
      this._jobs.push(job)
      this.added.push({ jobName, data, options, id })
      return job
    }
    async getJob(id) {
      return this._jobs.find(j => j.id === String(id)) ?? null
    }
    async getJobs(_states, start, end, _asc) {
      const e = end === -1 ? this._jobs.length : end + 1
      return this._jobs.slice(start, e)
    }
    async close() { this.closed = true }
  }

  return { Queue, _queues: queues }
}

// ---------- erros de input ----------

test('listDlq rejeita quando REDIS_URL ausente', async () => {
  await assert.rejects(
    () => listDlq({ userId: 'u1', bullmqModule: createMockBullmq() }),
    /REDIS_URL ausente/,
  )
})

test('listDlq rejeita quando userId ausente', async () => {
  await assert.rejects(
    () => listDlq({ redisUrl: 'redis://x', bullmqModule: createMockBullmq() }),
    /userId obrigatório/,
  )
})

test('retryDlqJob exige dlqJobId', async () => {
  await assert.rejects(
    () => retryDlqJob({ redisUrl: 'redis://x', userId: 'u1', bullmqModule: createMockBullmq() }),
    /dlqJobId obrigatório/,
  )
})

test('discardDlqJob exige dlqJobId', async () => {
  await assert.rejects(
    () => discardDlqJob({ redisUrl: 'redis://x', userId: 'u1', bullmqModule: createMockBullmq() }),
    /dlqJobId obrigatório/,
  )
})

// ---------- listDlq ----------

test('listDlq devolve mapping com id/data/failedAt/error/originalJobId', async () => {
  const mock = createMockBullmq({
    'wabot-send-u1-dlq': [
      { id: '1', data: { originalQueue: 'wabot-send-u1', originalJobId: 'a', originalData: { logId: 10 }, error: 'fail-a', failedAt: 1000 } },
      { id: '2', data: { originalQueue: 'wabot-send-u1', originalJobId: 'b', originalData: { logId: 11 }, error: 'fail-b', failedAt: 2000 } },
    ],
  })
  const result = await listDlq({ redisUrl: 'redis://x', userId: 'u1', bullmqModule: mock })
  assert.equal(result.queue, 'wabot-send-u1-dlq')
  assert.equal(result.total, 2)
  assert.equal(result.jobs[0].id, '1')
  assert.equal(result.jobs[0].error, 'fail-a')
  assert.equal(result.jobs[0].failedAt, 1000)
  assert.equal(result.jobs[0].originalJobId, 'a')
  assert.equal(result.jobs[1].error, 'fail-b')
})

test('listDlq respeita limit', async () => {
  const mock = createMockBullmq({
    'wabot-send-u2-dlq': Array.from({ length: 50 }, (_, i) => ({
      id: String(i + 1),
      data: { originalQueue: 'q', originalData: { logId: i }, failedAt: i, error: 'x' },
    })),
  })
  const result = await listDlq({ redisUrl: 'redis://x', userId: 'u2', limit: 10, bullmqModule: mock })
  assert.equal(result.total, 10)
})

test('listDlq fecha a Queue após uso', async () => {
  const mock = createMockBullmq({ 'wabot-send-u3-dlq': [] })
  await listDlq({ redisUrl: 'redis://x', userId: 'u3', bullmqModule: mock })
  const dlq = mock._queues.get('wabot-send-u3-dlq')
  assert.equal(dlq.closed, true)
})

test('listDlq usa queueNameOverride quando fornecido', async () => {
  const mock = createMockBullmq({ 'custom-queue-dlq': [{ id: '99', data: { error: 'x', failedAt: 1 } }] })
  const result = await listDlq({ redisUrl: 'redis://x', userId: 'irrelevant', queueNameOverride: 'custom-queue', bullmqModule: mock })
  assert.equal(result.queue, 'custom-queue-dlq')
  assert.equal(result.total, 1)
})

// ---------- retryDlqJob ----------

test('retryDlqJob reenfileira na fila original e remove da DLQ', async () => {
  const mock = createMockBullmq({
    'wabot-send-u4-dlq': [
      { id: '7', data: { originalQueue: 'wabot-send-u4', originalJobId: 'orig-7', originalData: { logId: 42, destJid: 'a@x' }, error: 'whatever', failedAt: 1000 } },
    ],
  })
  const result = await retryDlqJob({ redisUrl: 'redis://x', userId: 'u4', dlqJobId: '7', bullmqModule: mock })
  assert.equal(result.ok, true)
  assert.equal(result.requeuedTo, 'wabot-send-u4')
  assert.equal(result.logId, 42)
  // Fila principal recebeu o job
  const main = mock._queues.get('wabot-send-u4')
  assert.equal(main.added.length, 1)
  assert.equal(main.added[0].data.logId, 42)
  assert.equal(main.added[0].options.jobId, '42')
  // Job removido da DLQ
  const dlq = mock._queues.get('wabot-send-u4-dlq')
  assert.equal(dlq._jobs.length, 0)
})

test('retryDlqJob devolve {ok:false} quando job não existe', async () => {
  const mock = createMockBullmq({ 'wabot-send-u5-dlq': [] })
  const result = await retryDlqJob({ redisUrl: 'redis://x', userId: 'u5', dlqJobId: 'missing', bullmqModule: mock })
  assert.equal(result.ok, false)
  assert.match(result.reason, /não encontrado/)
})

test('retryDlqJob devolve {ok:false} quando payload está incompleto', async () => {
  const mock = createMockBullmq({
    'wabot-send-u6-dlq': [
      { id: '1', data: { error: 'x', failedAt: 1 } }, // sem originalData/originalQueue
    ],
  })
  const result = await retryDlqJob({ redisUrl: 'redis://x', userId: 'u6', dlqJobId: '1', bullmqModule: mock })
  assert.equal(result.ok, false)
  assert.match(result.reason, /originalData/)
})

// ---------- discardDlqJob ----------

test('discardDlqJob remove o job da DLQ', async () => {
  const mock = createMockBullmq({
    'wabot-send-u7-dlq': [
      { id: '1', data: { error: 'x', failedAt: 1 } },
      { id: '2', data: { error: 'y', failedAt: 2 } },
    ],
  })
  const result = await discardDlqJob({ redisUrl: 'redis://x', userId: 'u7', dlqJobId: '1', bullmqModule: mock })
  assert.equal(result.ok, true)
  const dlq = mock._queues.get('wabot-send-u7-dlq')
  assert.equal(dlq._jobs.length, 1)
  assert.equal(dlq._jobs[0].id, '2')
})

test('discardDlqJob devolve {ok:false} quando job ausente', async () => {
  const mock = createMockBullmq({ 'wabot-send-u8-dlq': [] })
  const result = await discardDlqJob({ redisUrl: 'redis://x', userId: 'u8', dlqJobId: 'nope', bullmqModule: mock })
  assert.equal(result.ok, false)
})

// ---------- purgeDlq ----------

test('purgeDlq remove todos os jobs e devolve contagem', async () => {
  const mock = createMockBullmq({
    'wabot-send-u9-dlq': [
      { id: '1', data: { error: 'a', failedAt: 1 } },
      { id: '2', data: { error: 'b', failedAt: 2 } },
      { id: '3', data: { error: 'c', failedAt: 3 } },
    ],
  })
  const result = await purgeDlq({ redisUrl: 'redis://x', userId: 'u9', bullmqModule: mock })
  assert.equal(result.ok, true)
  assert.equal(result.removed, 3)
  const dlq = mock._queues.get('wabot-send-u9-dlq')
  assert.equal(dlq._jobs.length, 0)
})

test('purgeDlq em DLQ vazia devolve removed: 0', async () => {
  const mock = createMockBullmq({ 'wabot-send-u10-dlq': [] })
  const result = await purgeDlq({ redisUrl: 'redis://x', userId: 'u10', bullmqModule: mock })
  assert.equal(result.ok, true)
  assert.equal(result.removed, 0)
})
