import test from 'node:test'
import assert from 'node:assert/strict'
import { createOwnerLease } from '../src/supervisor/ownerLease.js'
import { capacityKey, ownerLeaseKey } from '../src/supervisor/protocol.js'
import { isOwnerLeaseEnabled } from '../src/supervisor/nodeRouting.js'

function fakeRedis() {
  const store = new Map()
  return {
    store,
    async set(key, value, _ex, _ttl, nx) {
      if (nx === 'NX' && store.has(key)) return null
      store.set(key, value)
      return 'OK'
    },
    async get(key) { return store.get(key) ?? null },
    async del(key) { return store.delete(key) ? 1 : 0 },
  }
}

test('nomes de chave: por usuário e por nó', () => {
  assert.equal(ownerLeaseKey('u1'), 'supervisor:owner:u1')
  assert.equal(capacityKey('n2'), 'supervisor:capacity:n2')
  assert.throws(() => capacityKey('N:2'), /nodeId inválido/)
})

test('flag: só existe com roteamento ligado E SUPERVISOR_OWNER_LEASE, default off', () => {
  assert.equal(isOwnerLeaseEnabled({}), false)
  assert.equal(isOwnerLeaseEnabled({ SUPERVISOR_OWNER_LEASE: '1' }), false)
  assert.equal(isOwnerLeaseEnabled({ SUPERVISOR_NODE_ROUTING: '1' }), false)
  assert.equal(isOwnerLeaseEnabled({ SUPERVISOR_NODE_ROUTING: '1', SUPERVISOR_OWNER_LEASE: '1' }), true)
})

test('MN-10: o segundo nó não consegue o cadeado de uma conta que o n1 segura', async () => {
  const redis = fakeRedis()
  const n1 = createOwnerLease({ redis, nodeId: 'n1' })
  const n2 = createOwnerLease({ redis, nodeId: 'n2' })
  assert.deepEqual(await n1.acquire('u1'), { ok: true, holder: 'n1' })
  assert.deepEqual(await n2.acquire('u1'), { ok: false, holder: 'n1' })
  assert.deepEqual(await n1.acquire('u1'), { ok: true, holder: 'n1' }) // reinício do mesmo nó
})

test('MN-10: depois de soltar (STOP_BOT), o outro nó assume', async () => {
  const redis = fakeRedis()
  const n1 = createOwnerLease({ redis, nodeId: 'n1' })
  const n2 = createOwnerLease({ redis, nodeId: 'n2' })
  await n1.acquire('u1')
  await n2.release('u1') // não é dele: não solta
  assert.equal(await redis.get('supervisor:owner:u1'), 'n1')
  await n1.release('u1')
  assert.equal((await n2.acquire('u1')).ok, true)
})

test('MN-10: cadeado expirado (chave sumiu) é reassumido; renovar nunca toma o de outro nó', async () => {
  const redis = fakeRedis()
  const n1 = createOwnerLease({ redis, nodeId: 'n1' })
  const n2 = createOwnerLease({ redis, nodeId: 'n2' })
  assert.equal((await n1.renew('u1')).ok, true) // chave ausente: renova = assume
  assert.deepEqual(await n2.renew('u1'), { ok: false, holder: 'n1' })
})

test('MN-10: Redis fora do ar falha ABERTO (o banco é a verdade), sem lançar', async () => {
  const quebrado = { set: async () => { throw new Error('fora') }, get: async () => { throw new Error('fora') }, del: async () => { throw new Error('fora') } }
  const lease = createOwnerLease({ redis: quebrado, nodeId: 'n1' })
  assert.deepEqual(await lease.acquire('u1'), { ok: true, holder: null, degraded: true })
  assert.equal((await lease.renew('u1')).ok, true)
  await lease.release('u1')
})
