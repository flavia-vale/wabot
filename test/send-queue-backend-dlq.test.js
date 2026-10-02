import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'events'

import { createBullmqSendBackend } from '../src/sendQueueBackend.js'

// Mocks injetados via parâmetro `bullmqModule` — não precisa de Redis.
function createMockBullmq() {
  const queues = new Map()
  const workers = []

  class Queue {
    constructor(name, opts) {
      this.name = name
      this.opts = opts
      this.added = []
      this.closed = false
      queues.set(name, this)
    }
    async add(name, data, options) {
      const id = String(this.added.length + 1)
      this.added.push({ id, name, data, options })
      return { id }
    }
    async close() { this.closed = true }
    async getWaitingCount() {
      return this.added.filter(a => !a.processed).length
    }
    async getJobCountByTypes() { return this.added.length }
  }

  class Worker extends EventEmitter {
    constructor(queueName, handler, opts) {
      super()
      this.queueName = queueName
      this.handler = handler
      this.opts = opts
      this.closed = false
      workers.push(this)
    }
    async close() { this.closed = true }
  }

  return { Queue, Worker, _queues: queues, _workers: workers }
}

test('createBullmqSendBackend cria fila principal e DLQ com nomes canônicos', async () => {
  const mock = createMockBullmq()
  const backend = await createBullmqSendBackend({
    redisUrl: 'redis://fake',
    queueName: 'wabot-send-user1',
    onRejected: () => {},
    onDequeued: async () => {},
    bullmqModule: mock,
  })
  assert.equal(backend.backend, 'bullmq')
  assert.equal(backend.queueName, 'wabot-send-user1')
  assert.equal(backend.dlqQueueName, 'wabot-send-user1-dlq')
  assert.ok(mock._queues.has('wabot-send-user1'), 'fila principal foi criada')
  assert.ok(mock._queues.has('wabot-send-user1-dlq'), 'DLQ foi criada')
  await backend.close()
})

test('enqueue adiciona à fila principal com jobId baseado em logId', async () => {
  const mock = createMockBullmq()
  const backend = await createBullmqSendBackend({
    redisUrl: 'redis://fake',
    queueName: 'wabot-send-u',
    onRejected: () => {},
    onDequeued: async () => {},
    bullmqModule: mock,
  })
  const ok = await backend.enqueue({ logId: 42, type: 'converted', destJid: 'a@s.whatsapp.net' })
  assert.equal(ok, true)
  const main = mock._queues.get('wabot-send-u')
  assert.equal(main.added.length, 1)
  assert.equal(main.added[0].name, 'send')
  assert.equal(main.added[0].options.jobId, '42')
  await backend.close()
})

test('quando worker emite "failed", o payload vai para a DLQ', async () => {
  const mock = createMockBullmq()
  const backend = await createBullmqSendBackend({
    redisUrl: 'redis://fake',
    queueName: 'wabot-send-u2',
    onRejected: () => {},
    onDequeued: async () => {},
    bullmqModule: mock,
  })
  const worker = mock._workers[0]
  const fakeJob = {
    id: 'job-7',
    data: { logId: 99, destJid: 'b@s.whatsapp.net', type: 'broadcast' },
  }
  // Dispara o evento failed manualmente (BullMQ real chamaria isso após
  // exhausting retries).
  worker.emit('failed', fakeJob, new Error('whatsapp recusou destino'))
  // Aguarda microtask do listener async
  await new Promise(r => setImmediate(r))
  const dlq = mock._queues.get('wabot-send-u2-dlq')
  assert.equal(dlq.added.length, 1, 'DLQ recebeu o job')
  const entry = dlq.added[0]
  assert.equal(entry.name, 'failed')
  assert.equal(entry.data.originalQueue, 'wabot-send-u2')
  assert.equal(entry.data.originalJobId, 'job-7')
  assert.equal(entry.data.originalData.logId, 99)
  assert.equal(entry.data.error, 'whatsapp recusou destino')
  assert.ok(entry.data.failedAt > 0)
  // DLQ não auto-expira: removeOnComplete/Fail desligados.
  assert.equal(entry.options.removeOnComplete, false)
  assert.equal(entry.options.removeOnFail, false)
  await backend.close()
})

test('close() fecha worker, fila principal e DLQ', async () => {
  const mock = createMockBullmq()
  const backend = await createBullmqSendBackend({
    redisUrl: 'redis://fake',
    queueName: 'wabot-send-u3',
    onRejected: () => {},
    onDequeued: async () => {},
    bullmqModule: mock,
  })
  await backend.close()
  assert.equal(mock._workers[0].closed, true)
  assert.equal(mock._queues.get('wabot-send-u3').closed, true)
  assert.equal(mock._queues.get('wabot-send-u3-dlq').closed, true)
})

test('getDlqSize expõe contagem de entradas na DLQ', async () => {
  const mock = createMockBullmq()
  const backend = await createBullmqSendBackend({
    redisUrl: 'redis://fake',
    queueName: 'wabot-send-u4',
    onRejected: () => {},
    onDequeued: async () => {},
    bullmqModule: mock,
  })
  const worker = mock._workers[0]
  for (let i = 0; i < 3; i++) {
    worker.emit('failed', { id: `j${i}`, data: { logId: i } }, new Error('x'))
  }
  await new Promise(r => setImmediate(r))
  const size = await backend.getDlqSize()
  assert.equal(size, 3)
  await backend.close()
})
