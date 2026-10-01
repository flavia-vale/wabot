import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { evaluateNetwork, findExposedPorts, percentiles } from '../src/supervisor/networkPreflight.js'

const codes = r => r.items.map(i => i.code)
const boa = { secondNode: true, redisUrl: 'redis://:senha@10.0.0.5:6379/0', databaseUrl: 'postgresql://u:p@10.0.0.6:5432/wabot', latenciesMs: [0.4, 0.5, 0.6], clockSkewMs: 20 }

test('MN-08: configuração boa do servidor secundário passa', () => {
  const r = evaluateNetwork(boa)
  assert.equal(r.ok, true, JSON.stringify(r.items))
})

test('MN-08: Redis local no segundo servidor, sem senha ou sem rede privada/TLS', () => {
  assert.ok(codes(evaluateNetwork({ ...boa, redisUrl: 'redis://127.0.0.1:6379/0' })).includes('redis_loopback'))
  assert.equal(evaluateNetwork({ ...boa, redisUrl: 'redis://10.0.0.5:6379/0' }).ok, false)
  const publico = evaluateNetwork({ ...boa, redisUrl: 'redis://:s@203.0.113.9:6379/0' })
  assert.ok(codes(publico).includes('redis_not_private'))
  assert.equal(codes(evaluateNetwork({ ...boa, redisUrl: 'rediss://:s@203.0.113.9:6379/0' })).includes('redis_not_private'), false)
})

test('MN-08: servidor principal com Redis local é normal (não falha)', () => {
  assert.equal(evaluateNetwork({ ...boa, secondNode: false, redisUrl: 'redis://127.0.0.1:6379/0', databaseUrl: 'file:./prod.db' }).ok, true)
})

test('MN-08: banco SQLite/local no segundo servidor e Postgres público sem TLS bloqueiam', () => {
  assert.ok(codes(evaluateNetwork({ ...boa, databaseUrl: 'file:./prisma/prod.db' })).includes('database_sqlite_local'))
  assert.ok(codes(evaluateNetwork({ ...boa, databaseUrl: 'postgresql://u:p@localhost:5432/x' })).includes('database_loopback'))
  assert.ok(codes(evaluateNetwork({ ...boa, databaseUrl: 'postgresql://u:p@203.0.113.7:5432/x' })).includes('database_no_tls'))
  assert.equal(evaluateNetwork({ ...boa, databaseUrl: 'postgresql://u:p@203.0.113.7:5432/x?sslmode=require' }).ok, true)
})

test('MN-08: latência alta e relógio fora bloqueiam; sem medição é aviso, nunca "ok"', () => {
  assert.ok(codes(evaluateNetwork({ ...boa, latenciesMs: [1, 2, 9] })).includes('latency_high'))
  assert.ok(codes(evaluateNetwork({ ...boa, latenciesMs: [3, 3, 3] })).includes('latency_borderline'))
  assert.ok(codes(evaluateNetwork({ ...boa, latenciesMs: [] })).includes('latency_unknown'))
  assert.ok(codes(evaluateNetwork({ ...boa, clockSkewMs: 2500 })).includes('skew_high'))
  assert.ok(codes(evaluateNetwork({ ...boa, clockSkewMs: null })).includes('skew_unknown'))
  assert.equal(codes(evaluateNetwork({ ...boa, latenciesMs: [] })).includes('latency_ok'), false)
})

test('MN-08: percentiles e mensagens sem jargão', () => {
  assert.deepEqual(percentiles([5, 1, 3]), { p50: 3, p99: 5, n: 3 })
  assert.equal(percentiles([]), null)
  const r = evaluateNetwork({ secondNode: true, redisUrl: 'redis://127.0.0.1:6379', databaseUrl: 'file:x', latenciesMs: [9], clockSkewMs: 3000 })
  for (const i of r.items) assert.doesNotMatch(i.message, /bullmq|heartbeat|shard|worker/i, i.message)
})

test('MN-08: findExposedPorts acha só porta aberta em todas as interfaces', () => {
  const ss = [
    'LISTEN 0 511 0.0.0.0:6379 0.0.0.0:*',
    'LISTEN 0 244 127.0.0.1:5432 0.0.0.0:*',
    'LISTEN 0 128 *:22 *:*',
  ].map(l => ` ${l} `).join('\n')
  assert.deepEqual(findExposedPorts(ss), [6379])
  assert.deepEqual(findExposedPorts(''), [])
})

function rodaPortas(ssOut) {
  const dir = mkdtempSync(join(tmpdir(), 'fake-ss-'))
  writeFileSync(join(dir, 'ss'), `#!/usr/bin/env bash\ncat <<'EOF'\n${ssOut}\nEOF\n`)
  chmodSync(join(dir, 'ss'), 0o755)
  return spawnSync('bash', [new URL('../scripts/preflight-portas.sh', import.meta.url).pathname], { env: { PATH: `${dir}:${process.env.PATH}` }, encoding: 'utf8' })
}

test('MN-08 preflight-portas.sh: porta aberta para todos = erro; só local = ok', () => {
  const exposta = rodaPortas('LISTEN 0 511 0.0.0.0:6379 0.0.0.0:*\nLISTEN 0 244 127.0.0.1:5432 0.0.0.0:*')
  assert.equal(exposta.status, 1, exposta.stdout)
  assert.match(exposta.stdout, /porta 6379 está aberta para TODAS/)
  assert.match(exposta.stdout, /porta 5432 está escutando, mas não em todas/)
  const ok = rodaPortas('LISTEN 0 511 10.0.0.5:6379 0.0.0.0:*\nLISTEN 0 244 127.0.0.1:5432 0.0.0.0:*')
  assert.equal(ok.status, 0, ok.stdout)
})

test('MN-06: ecosystem de staging com 2 supervisores: nomes, nós e pastas de login distintos', () => {
  const eco = createRequire(import.meta.url)('../ecosystem.staging-multinode.config.cjs')
  assert.deepEqual(eco.apps.map(a => a.name), ['bot-supervisor-staging-n1', 'bot-supervisor-staging-n2'])
  assert.deepEqual(eco.apps.map(a => a.env.SUPERVISOR_NODE_ID), ['n1', 'n2'])
  assert.notEqual(eco.apps[0].env.AUTH_INFO_DIR, eco.apps[1].env.AUTH_INFO_DIR)
  assert.notEqual(eco.apps[0].env.BOT_LOG_DIR, eco.apps[1].env.BOT_LOG_DIR)
  for (const a of eco.apps) {
    assert.equal(a.env.APP_ENV, 'staging')
    assert.equal(a.env.SUPERVISOR_NODE_ROUTING, 'true')
    assert.ok(Number(a.env.MAX_SESSIONS_PER_PROCESS) <= 10, 'teto pequeno em staging')
  }
})
