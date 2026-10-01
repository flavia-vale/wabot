import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { NODE_STATUS, buildNodesCapacityView, nodesViewDisabled } from '../src/ops/capacity/nodesView.js'

const n = (nodeId, over = {}) => ({ nodeId, alive: true, running: 10, capacity: 80, ...over })

test('MN-17: classifica ok / apertado / lotado / fora do ar / sem medição', () => {
  const v = buildNodesCapacityView({ nodes: [n('n1'), n('n2', { running: 79 }), n('n3', { running: 40, capacity: 40 }), n('n4', { alive: false }), n('n5', { running: null })] })
  assert.deepEqual(v.nodes.map(i => i.status), [NODE_STATUS.OK, NODE_STATUS.TIGHT, NODE_STATUS.FULL, NODE_STATUS.DOWN, NODE_STATUS.UNMEASURED])
  assert.equal(v.nodes[1].free, 1)
  assert.equal(v.nodes[2].free, 0)
})

test('MN-17: não medido NUNCA vira zero nem "vagas livres"', () => {
  const v = buildNodesCapacityView({ nodes: [n('n1', { running: null }), n('n2', { capacity: null }), n('n3', { capacity: 0 })] })
  for (const i of v.nodes) { assert.equal(i.status, NODE_STATUS.UNMEASURED); assert.equal(i.free, null) }
  assert.equal(v.nodes[0].running, null)
})

test('MN-17: total só existe se TODOS os servidores vivos foram medidos; fora do ar é contado à parte', () => {
  const ok = buildNodesCapacityView({ nodes: [n('n1', { running: 10, capacity: 80 }), n('n2', { running: 5, capacity: 40 }), n('n3', { alive: false, running: null })] })
  assert.deepEqual(ok.totals, { running: 15, capacity: 120, free: 105, downNodes: 1 })
  const parcial = buildNodesCapacityView({ nodes: [n('n1'), n('n2', { running: null })] })
  assert.equal(parcial.totals, null)
  assert.equal(buildNodesCapacityView({ nodes: [n('n1', { alive: false })] }).totals, null)
  assert.equal(buildNodesCapacityView({ nodes: [] }).totals, null)
})

test('MN-17: limite de "apertado" configurável; boot e contas no banco aparecem', () => {
  const v = buildNodesCapacityView({ nodes: [n('n1', { running: 75 })], tightFreeSlots: 5, bootedAtMs: { n1: 1_700_000_000_000 }, dbSessions: { n1: 12 } })
  assert.equal(v.nodes[0].status, NODE_STATUS.TIGHT)
  assert.equal(v.nodes[0].bootedAt, '2023-11-14T22:13:20.000Z')
  assert.equal(v.nodes[0].dbSessions, 12)
  assert.equal(buildNodesCapacityView({ nodes: [n('n1')], bootedAtMs: { n1: null } }).nodes[0].bootedAt, null)
})

test('MN-17: textos em linguagem leiga e roteamento desligado devolve vazio', () => {
  const v = buildNodesCapacityView({ nodes: [n('n1'), n('n2', { running: 80 }), n('n3', { alive: false }), n('n4', { running: null })] })
  for (const i of v.nodes) assert.doesNotMatch(i.statusLabel, /heartbeat|shard|worker|redis|bullmq|supervisor/i, i.statusLabel)
  assert.deepEqual(nodesViewDisabled(), { routing: false, nodes: [], totals: null })
})

test('MN-17: rota /capacity/nodes exige tech:read, não audita polling e só responde com a flag ligada', async () => {
  const routes = await readFile(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
  const handler = routes.match(/app\.get\('\/capacity\/nodes'[\s\S]*?\n  \}\)\n/)?.[0] ?? ''
  assert.match(handler, /requireAdmin\(req, reply, 'tech:read'\)/)
  assert.doesNotMatch(handler, /writeAdminAuditLog/)
  assert.match(handler, /if \(SUPERVISOR_MODE !== 'remote' \|\| !isNodeRoutingEnabled\(\)\) return nodesViewDisabled\(\)/)
})
