// Revisão crítica do multi-servidor (C1–C7, C10). Regra: com a flag
// SUPERVISOR_NODE_ROUTING DESLIGADA nada muda — cada item tem prova disso.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { fileURLToPath } from 'node:url'
import { isOwnerLeaseEnabled, shouldActLocally } from '../src/supervisor/nodeRouting.js'
import { buildNodeIdentity, decideNodeBoot } from '../src/supervisor/bootGuard.js'
import { buildRsyncCommand, planAccountMove } from '../src/supervisor/accountMove.js'
import { createSupervisorClient } from '../src/supervisor/client.js'
import { identityKey } from '../src/supervisor/protocol.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8')

// ---- C1: parar / "está rodando?" pela verdade local ----
test('C1: flag OFF decide só pela posse (idêntico ao antes)', () => {
  for (const runningHere of [true, false]) {
    assert.equal(shouldActLocally({ routing: false, owns: true, runningHere }), true)
    assert.equal(shouldActLocally({ routing: false, owns: false, runningHere }), false)
  }
})
test('C1: flag ON para o robô que roda AQUI mesmo sem ser o dono', () => {
  assert.equal(shouldActLocally({ routing: true, owns: false, runningHere: true }), true)
  assert.equal(shouldActLocally({ routing: true, owns: false, runningHere: false }), false)
  assert.equal(shouldActLocally({ routing: true, owns: true, runningHere: false }), true)
})
test('C1: o supervisor usa a regra no STOP_BOT e no IS_RUNNING', () => {
  const s = read('src/supervisor/index.js')
  assert.match(s, /function stopBotWithBridge\(userId\) \{[\s\S]{0,400}shouldActLocally\(\{ routing: NODE_ROUTING/)
  assert.match(s, /\[COMMAND\.IS_RUNNING\]: \(\{ userId \}\) => shouldActLocally\(\{ routing: NODE_ROUTING/)
})

// ---- C2: cadeado de posse ligado por padrão com roteamento ----
test('C2: cadeado nasce ligado com roteamento; off sem roteamento; =0 desliga', () => {
  assert.equal(isOwnerLeaseEnabled({}), false)
  assert.equal(isOwnerLeaseEnabled({ SUPERVISOR_OWNER_LEASE: '1' }), false)
  assert.equal(isOwnerLeaseEnabled({ SUPERVISOR_NODE_ROUTING: '1' }), true)
  assert.equal(isOwnerLeaseEnabled({ SUPERVISOR_NODE_ROUTING: '1', SUPERVISOR_OWNER_LEASE: '0' }), false)
})

// ---- C3/C4: guarda de boot ----
test('C3: outra máquina com o mesmo nome de nó = bloqueia; mesma máquina (reinício) = ok', () => {
  const eu = buildNodeIdentity({ hostname: 'vps-a', machineId: 'abc' })
  const outro = buildNodeIdentity({ hostname: 'vps-b', machineId: 'def' })
  assert.equal(decideNodeBoot({ nodeId: 'n2', databaseUrl: 'postgresql://x', ownIdentity: eu, existingIdentity: outro }).reason, 'node_id_in_use')
  assert.equal(decideNodeBoot({ nodeId: 'n2', databaseUrl: 'postgresql://x', ownIdentity: eu, existingIdentity: eu }).ok, true)
  assert.equal(decideNodeBoot({ nodeId: 'n2', databaseUrl: 'postgresql://x', ownIdentity: eu, existingIdentity: null }).ok, true)
})
test('C4: nó ≠ n1 com SQLite local = bloqueia; o n1 com SQLite (produção de hoje) segue', () => {
  assert.equal(decideNodeBoot({ nodeId: 'n2', databaseUrl: 'file:./prod.db' }).reason, 'sqlite_local')
  assert.equal(decideNodeBoot({ nodeId: 'n1', databaseUrl: 'file:./prod.db' }).ok, true)
})
test('C3/C4: o guarda só entra com roteamento; flag OFF chama startRemoteSupervisor direto', () => {
  const s = read('src/supervisor/index.js')
  assert.match(s, /\} else if \(NODE_ROUTING\) \{\n[\s\S]{0,300}void guardThenStartRemoteSupervisor\(\)\n\} else \{\n  startRemoteSupervisor\(\)\n\}/)
  assert.match(s, /await publisher\.set\(identityKey\(NODE_ID\), NODE_IDENTITY/)
  assert.equal(identityKey('n2'), 'supervisor:identity:n2')
})

// ---- C5: API roteada + supervisor n1 no modo antigo ----
function harness(store) {
  class FakeRedis extends EventEmitter {
    async subscribe() { return 1 }
    async unsubscribe() { return 0 }
    async get(key) { return store.get(key) ?? null }
    async quit() { return 'OK' }
  }
  const added = []
  class FakeQueue {
    constructor(name) { this.name = name }
    async add(name, data) { added.push({ queue: this.name, name }); return { waitUntilFinished: async () => true } }
    async close() {}
  }
  class FakeQueueEvents { async waitUntilReady() {} async close() {} }
  return { added, ioredisModule: { default: FakeRedis }, bullmqModule: { Queue: FakeQueue, QueueEvents: FakeQueueEvents } }
}
const db = { waSession: { findUnique: async () => ({ nodeId: null }) } }

test('C5: n1 só com heartbeat ANTIGO → comandos vão pela fila legada (painel não quebra)', async () => {
  const store = new Map([['supervisor:heartbeat', '1']])
  const h = harness(store)
  const client = createSupervisorClient({ redisUrl: 'redis://x', ...h, env: {}, nodeRouting: true, nodeIds: ['n1'], db })
  assert.equal(await client.isSupervisorAlive('n1'), true)
  await client.sendBroadcast('u1', 'oi', [])
  assert.deepEqual(h.added.map(a => a.queue), ['supervisor-commands'])
  await client.close()
})
test('C5: n1 com heartbeat NOVO usa a fila do nó; nenhum heartbeat = indisponível', async () => {
  const h = harness(new Map([['supervisor:heartbeat:n1', '1'], ['supervisor:heartbeat', '1']]))
  const client = createSupervisorClient({ redisUrl: 'redis://x', ...h, env: {}, nodeRouting: true, nodeIds: ['n1'], db })
  await client.sendBroadcast('u1', 'oi', [])
  assert.deepEqual(h.added.map(a => a.queue), ['supervisor-commands-n1'])
  await client.close()
  const h2 = harness(new Map())
  const c2 = createSupervisorClient({ redisUrl: 'redis://x', ...h2, env: {}, nodeRouting: true, nodeIds: ['n1'], db })
  await assert.rejects(() => c2.sendBroadcast('u1', 'oi', []), err => err.code === 'WA_NODE_UNAVAILABLE')
  await c2.close()
})
test('C5: o desvio para a fila legada é só para o n1 (n2 sem heartbeat continua indisponível)', async () => {
  const h = harness(new Map([['supervisor:heartbeat', '1']]))
  const client = createSupervisorClient({ redisUrl: 'redis://x', ...h, env: {}, nodeRouting: true, nodeIds: ['n1', 'n2'], db: { waSession: { findUnique: async () => ({ nodeId: 'n2' }) } } })
  await assert.rejects(() => client.sendBroadcast('u1', 'oi', []), err => err.code === 'WA_NODE_UNAVAILABLE')
  await client.close()
})
test('C5/C6: parar e "está rodando?" aceitam um nó explícito; flag OFF ignora', async () => {
  const h = harness(new Map([['supervisor:heartbeat:n2', '1']]))
  const client = createSupervisorClient({ redisUrl: 'redis://x', ...h, env: {}, nodeRouting: true, nodeIds: ['n1', 'n2'], db })
  await client.stopBot('u1', { nodeId: 'n2' })
  await client.isRunning('u1', { nodeId: 'n2' })
  assert.deepEqual(h.added.map(a => a.queue), ['supervisor-commands-n2', 'supervisor-commands-n2'])
  await client.close()
  const h2 = harness(new Map([['supervisor:heartbeat', '1']]))
  const off = createSupervisorClient({ redisUrl: 'redis://x', ...h2, env: {}, nodeRouting: false })
  await off.stopBot('u1', { nodeId: 'n2' })
  assert.deepEqual(h2.added.map(a => a.queue), ['supervisor-commands'])
  await off.close()
})

// ---- C6: mudança de servidor ----
test('C6: rsync com --delete (sem login velho misturado)', () => {
  assert.match(buildRsyncCommand({ authDir: '/a/u1', sourceHost: 'deploy@x' }), /^rsync -a --checksum --delete deploy@x:\/a\/u1\/ \/a\/u1\/$/)
})
test('C6: retomada do "trocar" só com a conta marcada moving_node', () => {
  const nodes = [{ nodeId: 'n1', alive: true, running: 1, max: 20 }, { nodeId: 'n2', alive: true, running: 1, max: 20 }]
  const row = { nodeId: 'n2', status: 'disconnected', lifecycle: 'moving_node' }
  assert.equal(planAccountMove({ userId: 'u', targetNode: 'n2', sessionRow: row, nodes, resuming: true }).ok, true)
  assert.equal(planAccountMove({ userId: 'u', targetNode: 'n2', sessionRow: row, nodes }).ok, false)
  assert.equal(planAccountMove({ userId: 'u', targetNode: 'n2', sessionRow: { ...row, lifecycle: 'ready' }, nodes, resuming: true }).ok, false)
})
test('C6: script marca moving_node, desfaz parando o destino e religando a origem', () => {
  const s = read('scripts/mover-conta-no.mjs')
  assert.match(s, /lifecycle: MOVING_NODE_LIFECYCLE/)
  // V1: para TODOS os processos da conta no destino (principal + reserva).
  assert.match(s, /client\.stopBot\(k, \{ nodeId: para \}\)/)
  assert.ok(s.indexOf('client.stopBot(k, { nodeId: para })') < s.indexOf("data: { nodeId: antes"), 'para o destino ANTES de voltar o servidor')
})
test('C6: ligar e pedir código recusam durante a mudança (valor que nenhum fluxo de hoje grava)', () => {
  const s = read('src/api/routes/session.js')
  assert.match(s, /previousSession\?\.lifecycle === MOVING_NODE_LIFECYCLE\) return reply\.code\(409\)/)
  assert.match(s, /if \(await isMovingNode\(userId\)\) return reply\.code\(409\)/)
  const writers = s.match(/MOVING_NODE_LIFECYCLE/g).length
  assert.ok(writers >= 3)
})

// ---- C7: deploy do nó ----
test('C7: deploy do nó não roda npm ci na pasta em uso nem restart --update-env', () => {
  const s = read('scripts/deploy_node.sh')
  assert.doesNotMatch(s.replace(/^\s*#.*$/gm, ''), /^npm ci$/m)
  assert.match(s, /\(cd "\$NOVO" && npm ci\)/)
  assert.doesNotMatch(s.replace(/^\s*#.*$/gm, ''), /pm2 restart bot-supervisor/)
  assert.match(s, /pm2 start ecosystem\.node\.config\.cjs --only bot-supervisor/)
  assert.match(s, /wabot_deploy_lock bash "\$0" "\$@"/)
})

// ---- C10 ----
test('C10: servidor sem resposta = 503 e não conta como "FALHA DA API"', async () => {
  const { classifyApiError } = await import('../src/ops/apiErrorSignal.js')
  const err = Object.assign(new Error('x'), { code: 'WA_NODE_UNAVAILABLE', statusCode: 503 })
  assert.deepEqual(classifyApiError(err, { statusCode: 503 }), { signal: false, kind: null, alert: false })
  assert.equal(classifyApiError(new Error('boom'), { statusCode: 500 }).signal, true, 'outros 5xx seguem como antes')
  const h = harness(new Map())
  const c = createSupervisorClient({ redisUrl: 'redis://x', ...h, env: {}, nodeRouting: true, nodeIds: ['n1'], db })
  await assert.rejects(() => c.sendBroadcast('u1', 'oi', []), e => e.code === 'WA_NODE_UNAVAILABLE' && e.statusCode === 503)
  await c.close()
})
