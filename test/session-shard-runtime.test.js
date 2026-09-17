import test from 'node:test'
import assert from 'node:assert/strict'
import { BaileysSessionContext } from '../src/core/BaileysSessionContext.js'
import { SessionShardRuntime, SHARD_COMMAND } from '../src/core/sessionShardRuntime.js'
import { createShardOwnershipCoordinator } from '../src/core/shardOwnershipCoordinator.js'
import { createSemaphore } from '../src/core/semaphore.js'

function fakeRuntimeFactory(log, options = {}) {
  return async ({ userId, context }) => ({
    async start() { log.push(`start:${userId}`); context.activeSock = { userId }; if (options.failStart === userId) throw new Error('start failed') },
    async command(type) { log.push(`command:${userId}:${type}`); return userId },
    async drain() { log.push(`drain:${userId}`) },
    async stop() { log.push(`stop:${userId}`) },
    async metrics() { return { queue: { pending: 0 }, userId } },
  })
}

test('contexto isola socket, filas, caches e descarrega recursos ao parar', async () => {
  const log = []
  const a = new BaileysSessionContext({ userId: 'a', runtimeFactory: fakeRuntimeFactory(log) })
  const b = new BaileysSessionContext({ userId: 'b', runtimeFactory: fakeRuntimeFactory(log) })
  await a.start(); await b.start()
  a.allowedChatJids.add('grupo-a'); b.allowedChatJids.add('grupo-b'); a.dedup.set('x', true)
  assert.notEqual(a.activeSock, b.activeSock)
  assert.deepEqual([...a.allowedChatJids], ['grupo-a'])
  assert.deepEqual([...b.allowedChatJids], ['grupo-b'])
  await a.stop()
  assert.equal(a.activeSock, null); assert.equal(a.dedup.size, 0); assert.equal(b.state, 'running')
})

test('shard limita quatro sessões, roteia por userId e para uma sem afetar as demais', async () => {
  const log = []
  const shard = new SessionShardRuntime({ shardId: 'poc', runtimeFactory: fakeRuntimeFactory(log), maxSessions: 99 })
  for (const userId of ['a', 'b', 'c', 'd']) await shard.dispatch({ type: SHARD_COMMAND.START_SESSION, userId })
  await assert.rejects(shard.startSession('e'), /Limite/)
  assert.equal(await shard.dispatch({ type: SHARD_COMMAND.SESSION_COMMAND, userId: 'c', payload: { type: 'ping' } }), 'c')
  await shard.stopSession('b')
  assert.equal((await shard.metrics()).sessions.length, 3)
  assert.equal((await shard.contexts.get('a').snapshot()).state, 'running')
  await shard.shutdown()
})

test('semáforo global limita Sharp a um trabalho simultâneo', async () => {
  const semaphore = createSemaphore(1)
  let active = 0; let peak = 0
  const task = () => semaphore.run(async () => { active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 5)); active-- })
  await Promise.all([task(), task(), task()])
  assert.equal(peak, 1)
  assert.deepEqual(semaphore.stats(), { active: 0, waiting: 0, limit: 1 })
})

function ownershipHarness({ dedicatedExit = true, shardHeartbeat = true, dedicatedHeartbeat = true } = {}) {
  const calls = []
  const row = { userId: 'u1', ownerInstance: 'dedicated-1', lifecycle: 'ready', status: 'connected' }
  let dedicatedRunning = true; let shardRunning = false
  const db = { waSession: {
    findUnique: async () => ({ ...row }),
    updateMany: async ({ where, data }) => {
      if (row.lifecycle !== where.lifecycle || row.ownerInstance !== where.ownerInstance) return { count: 0 }
      Object.assign(row, data); calls.push(`db:${data.lifecycle || data.ownerInstance}`); return { count: 1 }
    },
    update: async ({ data }) => { Object.assign(row, data); calls.push(`db:${data.lifecycle || data.ownerInstance}`); return { ...row } },
  } }
  const dedicated = {
    block: () => calls.push('dedicated:block'), unblock: () => calls.push('dedicated:unblock'), drain: async () => calls.push('dedicated:drain'),
    stop: async () => { calls.push('dedicated:stop'); if (dedicatedExit) dedicatedRunning = false }, waitForExit: async () => dedicatedExit,
    isRunning: async () => dedicatedRunning, start: async () => { calls.push('dedicated:start'); dedicatedRunning = true }, waitForHeartbeat: async () => dedicatedHeartbeat,
  }
  const shard = {
    start: async () => { calls.push('shard:start'); shardRunning = true }, stop: async () => { calls.push('shard:stop'); shardRunning = false },
    drain: async () => calls.push('shard:drain'), isRunning: async () => shardRunning, waitForHeartbeat: async () => shardHeartbeat,
  }
  return { calls, row, db, dedicated, shard, coordinator: createShardOwnershipCoordinator({ db, dedicated, shard, logger: { error() {} } }) }
}

test('handoff só inicia shard depois do exit real do dedicado', async () => {
  const h = ownershipHarness()
  await h.coordinator.moveToShard({ userId: 'u1', shardId: 'poc' })
  assert.ok(h.calls.indexOf('shard:start') > h.calls.indexOf('dedicated:stop'))
  assert.equal(h.row.ownerInstance, 'shard:poc')
})

test('exit não confirmado bloqueia shard e restaura dedicado', async () => {
  const h = ownershipHarness({ dedicatedExit: false })
  await assert.rejects(h.coordinator.moveToShard({ userId: 'u1', shardId: 'poc' }), /não confirmou exit/)
  assert.equal(h.calls.includes('shard:start'), false)
  assert.equal(h.row.lifecycle, 'reconnecting')
})

test('rollback é idempotente e falha parcial não impede restaurar outros membros', async () => {
  const h = ownershipHarness()
  await h.coordinator.moveToShard({ userId: 'u1', shardId: 'poc' })
  const first = await h.coordinator.rollback({ userId: 'u1', shardId: 'poc', dedicatedOwner: 'dedicated-1' })
  const second = await h.coordinator.rollback({ userId: 'u1', shardId: 'poc', dedicatedOwner: 'dedicated-1' })
  assert.equal(first.restored, true); assert.equal(second.idempotent, true); assert.equal(h.row.ownerInstance, 'dedicated-1')

  const failing = ownershipHarness({ dedicatedHeartbeat: false })
  await failing.coordinator.moveToShard({ userId: 'u1', shardId: 'poc' })
  const result = await failing.coordinator.rollbackMany({ members: [{ userId: 'u1' }, { userId: 'missing' }], shardId: 'poc', dedicatedOwner: 'dedicated-1' })
  assert.equal(result.ok, false); assert.equal(result.results.length, 2)
})
