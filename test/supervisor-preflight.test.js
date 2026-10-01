import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { evaluatePreflight, findInvalidNodeIdTokens, nodesWithoutHeartbeat } from '../src/supervisor/preflight.js'

const codes = r => r.items.map(i => i.code)

test('MN-14: nome de servidor inválido na lista é pego (resolveKnownNodeIds descartaria em silêncio)', () => {
  assert.deepEqual(findInvalidNodeIdTokens('n1, n01 ,N:2,'), ['N:2'])
  assert.deepEqual(findInvalidNodeIdTokens('n1,n2'), [])
  const r = evaluatePreflight({ step: 'api', nodeIdsRaw: 'n1,N:2', knownNodeIds: ['n1'], heartbeats: { n1: true }, capacities: { n1: 20 }, legacyBacklog: 0 })
  assert.equal(r.ok, false)
  assert.ok(codes(r).includes('node_ids_invalid'))
})

test('MN-14 passo supervisor: SUPERVISOR_NODE_ID inválido bloqueia (evita loop de restart)', () => {
  const ruim = evaluatePreflight({ step: 'supervisor', nodeIdValid: false, knownNodeIds: ['n1'] })
  assert.equal(ruim.ok, false)
  assert.ok(codes(ruim).includes('node_id_invalid'))
  const bom = evaluatePreflight({ step: 'supervisor', nodeIdValid: true, nodeId: 'n1', knownNodeIds: ['n1'] })
  assert.equal(bom.ok, true)
})

test('MN-14 passo api: sem heartbeat do n1 ou sem teto publicado NÃO pode ligar a flag', () => {
  const semHeartbeat = evaluatePreflight({ step: 'api', knownNodeIds: ['n1'], heartbeats: { n1: false }, capacities: {}, legacyBacklog: 0 })
  assert.equal(semHeartbeat.ok, false)
  assert.ok(codes(semHeartbeat).includes('heartbeat_missing'))
  const semTeto = evaluatePreflight({ step: 'api', knownNodeIds: ['n1'], heartbeats: { n1: true }, capacities: { n1: null }, legacyBacklog: 0 })
  assert.ok(codes(semTeto).includes('capacity_missing'))
  const ok = evaluatePreflight({ step: 'api', knownNodeIds: ['n1'], heartbeats: { n1: true }, capacities: { n1: 80 }, legacyBacklog: 0 })
  assert.equal(ok.ok, true)
})

test('MN-14 passo api: fila antiga com pedidos é aviso (não bloqueia), vazia é ok', () => {
  const base = { step: 'api', knownNodeIds: ['n1'], heartbeats: { n1: true }, capacities: { n1: 80 } }
  assert.ok(codes(evaluatePreflight({ ...base, legacyBacklog: 3 })).includes('legacy_backlog_pending'))
  assert.equal(evaluatePreflight({ ...base, legacyBacklog: 3 }).ok, true)
  assert.ok(codes(evaluatePreflight({ ...base, legacyBacklog: null })).includes('legacy_backlog_unknown'))
})

test('MN-14 passo segundo-no: backfill pendente BLOQUEIA listar o n2 (caminho crítico)', () => {
  const base = { step: 'segundo-no', knownNodeIds: ['n1', 'n2'], heartbeats: { n1: true, n2: true }, capacities: { n1: 80, n2: 40 } }
  const pendente = evaluatePreflight({ ...base, nullNodeIdCount: 12 })
  assert.equal(pendente.ok, false)
  assert.match(pendente.items.find(i => i.code === 'backfill_pending').message, /12 conta/)
  assert.equal(evaluatePreflight({ ...base, nullNodeIdCount: 0 }).ok, true)
  // sem medição NÃO presume que está tudo certo
  assert.equal(evaluatePreflight({ ...base, nullNodeIdCount: null }).ok, false)
})

test('MN-14 passo segundo-no: conta apontando para servidor fora da lista bloqueia', () => {
  const r = evaluatePreflight({ step: 'segundo-no', knownNodeIds: ['n1'], heartbeats: { n1: true }, capacities: { n1: 80 }, nullNodeIdCount: 0, unknownNodeIdsInDb: ['n3'] })
  assert.equal(r.ok, false)
  assert.ok(codes(r).includes('db_node_unknown'))
})

test('MN-14: mensagens em linguagem leiga (sem jargão técnico)', () => {
  const r = evaluatePreflight({ step: 'segundo-no', knownNodeIds: ['n1', 'n2'], nodeIdsRaw: 'n1,N:2', heartbeats: { n1: false, n2: false }, capacities: {}, nullNodeIdCount: 3 })
  for (const item of r.items) assert.doesNotMatch(item.message, /heartbeat|BullMQ|shard|worker|redis|fila de job|queue/i, item.message)
})

test('MN-14: guarda da API lista só os nós sem heartbeat', () => {
  assert.deepEqual(nodesWithoutHeartbeat(['n1', 'n2'], { n1: true, n2: false }), ['n2'])
  assert.deepEqual(nodesWithoutHeartbeat(['n1'], { n1: true }), [])
})

test('MN-14: a guarda da API só loga, nunca derruba, e só roda com a flag ligada', () => {
  const src = readFileSync(new URL('../src/api/server.js', import.meta.url), 'utf8')
  const bloco = src.slice(src.indexOf('async function runNodeRoutingGuardTick'), src.indexOf('function startSessionCapacityAlertSweep'))
  assert.doesNotMatch(bloco, /process\.exit/)
  assert.match(bloco, /if \(SUPERVISOR_MODE !== 'remote' \|\| !isNodeRoutingEnabled\(\)\) return/)
})
