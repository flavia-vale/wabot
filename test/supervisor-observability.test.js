import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveNodeLogBase } from '../src/core/nodeLogBinding.js'
import { renderPrometheusMetrics } from '../src/api/metrics.js'

const opts = { pid: 1, host: 'h' }

test('MN-15: log só leva o nome do servidor com a flag ligada E SUPERVISOR_NODE_ID definido', () => {
  assert.equal(resolveNodeLogBase({}, opts), null)
  assert.equal(resolveNodeLogBase({ SUPERVISOR_NODE_ID: 'n2' }, opts), null)
  assert.equal(resolveNodeLogBase({ SUPERVISOR_NODE_ROUTING: '1' }, opts), null)
  assert.deepEqual(resolveNodeLogBase({ SUPERVISOR_NODE_ROUTING: '1', SUPERVISOR_NODE_ID: 'n2' }, opts), { pid: 1, hostname: 'h', nodeId: 'n2' })
})

test('MN-15: id inválido não lança no logger (quem aborta é o supervisor)', () => {
  assert.equal(resolveNodeLogBase({ SUPERVISOR_NODE_ROUTING: '1', SUPERVISOR_NODE_ID: 'N:2' }, opts), null)
})

test('MN-15: logger.js só acrescenta `base` quando há nome de servidor', () => {
  const src = readFileSync(new URL('../src/logger.js', import.meta.url), 'utf8')
  assert.match(src, /const baseOption = nodeBase \? \{ base: nodeBase \} : \{\}/)
  assert.equal((src.match(/\.\.\.baseOption/g) ?? []).length, 2)
})

test('MN-15: /metrics por servidor; não medido é OMITIDO (nunca 0); sem lista nada muda', () => {
  const sem = renderPrometheusMetrics({})
  assert.doesNotMatch(sem, /wabot_supervisor_node_/)
  const text = renderPrometheusMetrics({
    supervisorNodes: [
      { nodeId: 'n1', alive: true, running: 12, capacity: 80 },
      { nodeId: 'n2', alive: false, running: null, capacity: null },
    ],
    sessionDualOwnerTotal: 2,
  })
  assert.match(text, /wabot_supervisor_node_alive\{node="n1"\} 1/)
  assert.match(text, /wabot_supervisor_node_alive\{node="n2"\} 0/)
  assert.match(text, /wabot_supervisor_node_running_bots\{node="n1"\} 12/)
  assert.doesNotMatch(text, /wabot_supervisor_node_running_bots\{node="n2"\}/)
  assert.match(text, /wabot_supervisor_node_capacity\{node="n1"\} 80/)
  assert.doesNotMatch(text, /wabot_supervisor_node_capacity\{node="n2"\}/)
  assert.match(text, /wabot_supervisor_session_dual_owner_total 2/)
})

test('MN-15: aviso de código desatualizado é avaliado por servidor quando há roteamento', () => {
  const src = readFileSync(new URL('../src/api/server.js', import.meta.url), 'utf8')
  assert.match(src, /for \(const nodeId of resolveKnownNodeIds\(\)\)/)
  assert.match(src, /warnStaleCodeForBoot\(await getSupervisorBootedAtMs\(nodeId\), codeChangedAtMs, nodeId\)/)
  // sem a flag segue o caminho de sempre (um boot só)
  assert.match(src, /await warnStaleCodeForBoot\(supervisorBootedAtMs, codeChangedAtMs, null\)/)
})

test('MN-15: contadores do supervisor ganham o servidor na chave só com a flag', () => {
  const src = readFileSync(new URL('../src/supervisor/index.js', import.meta.url), 'utf8')
  assert.match(src, /const COUNTER_TAG = NODE_ROUTING \? `\$\{SHARD_TAG\}:\$\{NODE_ID\}` : SHARD_TAG/)
})
