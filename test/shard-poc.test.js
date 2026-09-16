import test from 'node:test'
import assert from 'node:assert/strict'
import { selectShardPocCandidates, presentShardRuntimeMetrics } from '../src/ops/shardPoc.js'
import { readFileSync } from 'node:fs'

test('seleciona Flávia e três perfis conectados distintos', () => {
  const rows = [
    { id: 'f', email: 'flavia.vale@usp.br', session: { status: 'connected' } },
    { id: 'a', email: 'a@x', messages24h: 1, mediaMessages24h: 0, session: { status: 'connected' } },
    { id: 'b', email: 'b@x', messages24h: 10, mediaMessages24h: 1, session: { status: 'connected' } },
    { id: 'c', email: 'c@x', messages24h: 5, mediaMessages24h: 9, session: { status: 'connected' } },
  ]
  const result = selectShardPocCandidates(rows)
  assert.equal(result.length, 4)
  assert.equal(result[0].id, 'f')
  assert.equal(new Set(result.map(row => row.id)).size, 4)
})

test('expõe apenas telemetria operacional necessária ao painel', () => {
  const result = presentShardRuntimeMetrics({ runtime: { pid: 7, rssBytes: 10, heapUsedBytes: 2, eventLoopDelayMs: { p95: 4 }, secret: 'no' }, incomingQueue: { queued: 1 } })
  assert.equal(result.pid, 7)
  assert.equal(result.rssBytes, 10)
  assert.equal(result.secret, undefined)
  assert.deepEqual(result.incomingQueue, { queued: 1 })
})

test('painel evita polling sobreposto, protege start por modo e não exibe conteúdo das mensagens', () => {
  const page = readFileSync(new URL('../dashboard/app/admin/teste-shard/page.js', import.meta.url), 'utf8')
  const route = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
  assert.match(page, /loadingRef\.current/)
  assert.match(page, /experimentMode === 'enabled'/)
  assert.match(page, /adminShardPocRollback/)
  assert.match(route, /requireAdmin\(req, reply, 'tech:read'\)/)
  const endpoint = route.slice(route.indexOf("app.get('/shard-poc/overview'"), route.indexOf("app.get('/capacity/current'"))
  assert.doesNotMatch(endpoint, /messageText: true|sourceGroup: true|destGroup: true/)
})
