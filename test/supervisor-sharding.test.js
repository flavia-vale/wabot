import test from 'node:test'
import assert from 'node:assert/strict'
import { buildShardTag, computeShardIndex, normalizeShardCount, shouldHandleUserOnShard } from '../src/supervisor/sharding.js'

test('normalizeShardCount aplica fallback seguro', () => {
  assert.equal(normalizeShardCount(undefined, 2), 2)
  assert.equal(normalizeShardCount('3'), 3)
  assert.equal(normalizeShardCount(0, 2), 2)
})

test('computeShardIndex é determinístico', () => {
  const a = computeShardIndex('user-123', 8)
  const b = computeShardIndex('user-123', 8)
  assert.equal(a, b)
  assert.ok(a >= 0 && a < 8)
})

test('buildShardTag cria tag canônica', () => {
  const tag = buildShardTag('user-123', 4)
  assert.match(tag, /^shard-[1-4]-of-4$/)
})

test('shouldHandleUserOnShard respeita índice', () => {
  const idx = computeShardIndex('abc', 4)
  assert.equal(shouldHandleUserOnShard('abc', 4, idx), true)
  assert.equal(shouldHandleUserOnShard('abc', 4, (idx + 1) % 4), false)
})

// ---- Roteamento por nó: o hash legado NÃO muda e os helpers novos são puros ----
import {
  buildResumeWhere,
  commandNeedsFreshOwnership,
  createNodeOwnershipCache,
  isNodeRoutingEnabled,
  nodeIdWhere,
  ownsLegacyQueue,
  resolveKnownNodeIds,
  resolveSupervisorNodeId,
} from '../src/supervisor/nodeRouting.js'

test('hash legado segue igual (regressão: realocaria contas)', () => {
  assert.equal(computeShardIndex('user-123', 2), computeShardIndex('user-123', 2))
  assert.equal(computeShardIndex('user-123', 1), 0)
})

test('flag SUPERVISOR_NODE_ROUTING: default off', () => {
  assert.equal(isNodeRoutingEnabled({}), false)
  assert.equal(isNodeRoutingEnabled({ SUPERVISOR_NODE_ROUTING: '0' }), false)
  assert.equal(isNodeRoutingEnabled({ SUPERVISOR_NODE_ROUTING: 'false' }), false)
  assert.equal(isNodeRoutingEnabled({ SUPERVISOR_NODE_ROUTING: 'true' }), true)
  assert.equal(isNodeRoutingEnabled({ SUPERVISOR_NODE_ROUTING: '1' }), true)
})

test('SUPERVISOR_NODE_ID: default n1, inválido lança', () => {
  assert.equal(resolveSupervisorNodeId({}), 'n1')
  assert.equal(resolveSupervisorNodeId({ SUPERVISOR_NODE_ID: 'n2' }), 'n2')
  assert.throws(() => resolveSupervisorNodeId({ SUPERVISOR_NODE_ID: 'N:2' }), /inválido/)
})

test('nós conhecidos: default [n1], ordena, descarta inválidos', () => {
  assert.deepEqual(resolveKnownNodeIds({}), ['n1'])
  assert.deepEqual(resolveKnownNodeIds({ SUPERVISOR_NODE_IDS: 'n2, n1,N:3' }), ['n1', 'n2'])
})

test('só o n1 consome a fila legada', () => {
  assert.equal(ownsLegacyQueue('n1'), true)
  assert.equal(ownsLegacyQueue('n2'), false)
})

test('resume filtrado por nó: flag off devolve o where intacto', () => {
  const base = { OR: [{ status: 'connected' }] }
  assert.equal(buildResumeWhere({ base, nodeId: 'n1', routing: false }), base)
})

test('resume filtrado por nó: n1 herda nodeId nulo; n2 só o próprio', () => {
  const base = { status: { in: ['connected'] } }
  assert.deepEqual(buildResumeWhere({ base, nodeId: 'n1', routing: true }), { AND: [base, { OR: [{ nodeId: null }, { nodeId: 'n1' }] }] })
  assert.deepEqual(buildResumeWhere({ base, nodeId: 'n2', routing: true }), { AND: [base, { nodeId: 'n2' }] })
  assert.deepEqual(nodeIdWhere('n3'), { nodeId: 'n3' })
})

test('cache de posse: lê o banco só em miss/expirado e guarda a última posse', async () => {
  let t = 0
  let loads = 0
  const cache = createNodeOwnershipCache({ loadNodeId: async () => { loads++; return 'n2' }, ttlMs: 1000, now: () => t })
  assert.equal(cache.peek('u'), null)
  assert.equal(await cache.get('u'), 'n2')
  assert.equal(await cache.get('u'), 'n2')
  assert.equal(loads, 1)
  t = 1500
  await cache.get('u')
  assert.equal(loads, 2)
  assert.equal(cache.peek('u'), 'n2')
})

test('MN-02: só START_BOT e STOP_BOT exigem posse fresca do banco', () => {
  assert.equal(commandNeedsFreshOwnership('startBot'), true)
  assert.equal(commandNeedsFreshOwnership('stopBot'), true)
  assert.equal(commandNeedsFreshOwnership('sendBroadcast'), false)
})
