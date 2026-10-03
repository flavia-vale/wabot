// Revisão V1–V3 (2026-10-03): vários números por conta × vários servidores.
// docs/ops/multi-supervisor-ativacao.md ("Revisão multi-número").
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { fileURLToPath } from 'node:url'
import { nodeOwnerKey } from '../src/supervisor/nodeRouting.js'
import { accountAuthKeys, accountProcessKeys, planAccountMove, shouldCarryStandby } from '../src/supervisor/accountMove.js'
import { createSupervisorClient } from '../src/supervisor/client.js'
import { placementReservationKey } from '../src/supervisor/protocol.js'
import { decideFailover } from '../src/domain/session/failoverPolicy.js'
import { switchActiveNumber } from '../src/core/numberSwitch.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8')

// ---- V2: dono do número reserva = dono da conta ----
test('V2: a chave de posse do número reserva é a da conta; chave comum fica igual', () => {
  assert.equal(nodeOwnerKey('u1~n2'), 'u1')
  assert.equal(nodeOwnerKey('u1'), 'u1')
  assert.equal(nodeOwnerKey('u1~n9'), 'u1~n9') // malformada: não vira outra conta
})

test('V2: o supervisor aquece/invalida a posse e lê o banco pela CONTA', () => {
  const src = read('src/supervisor/index.js')
  assert.match(src, /const owner = nodeOwnerKey\(data\.userId\)/)
  assert.match(src, /nodeOwnership\.invalidate\(owner\)/)
  assert.match(src, /await nodeOwnership\.get\(owner\)/)
  assert.doesNotMatch(src, /nodeOwnership\.(get|invalidate)\(data\.userId\)/)
  assert.match(src, /findUnique\(\{ where: \{ userId: nodeOwnerKey\(userId\) \}/)
  assert.match(src, /const userId = nodeOwnerKey\(sessionKey\)/)
  assert.doesNotMatch(src, /nodeOwnership\.set\(s\.userId/)
})

// ---- V1 (cliente): o nó em cache é o da conta ----
function harness(store) {
  class FakeRedis extends EventEmitter {
    async subscribe() { return 1 }
    async unsubscribe() { return 0 }
    async get(key) { return store.get(key) ?? null }
    async incr(key) { const v = Number(store.get(key) ?? 0) + 1; store.set(key, String(v)); return v }
    async expire() { return 1 }
    async quit() { return 'OK' }
  }
  const added = []
  class FakeQueue {
    constructor(name) { this.name = name }
    async add(name, data) { added.push({ queue: this.name, name, userId: data?.userId }); return { waitUntilFinished: async () => true } }
    async close() {}
  }
  class FakeQueueEvents { async waitUntilReady() {} async close() {} }
  return { added, ioredisModule: { default: FakeRedis }, bullmqModule: { Queue: FakeQueue, QueueEvents: FakeQueueEvents } }
}

test('V1: esquecer o nó da conta também esquece o do número reserva (não vai para o servidor antigo)', async () => {
  const row = { nodeId: null }
  const queried = []
  const db = { waSession: { findUnique: async ({ where }) => { queried.push(where.userId); return { ...row } } } }
  const h = harness(new Map([['supervisor:heartbeat:n1', '1'], ['supervisor:heartbeat:n2', '1']]))
  const client = createSupervisorClient({ redisUrl: 'redis://x', ...h, env: {}, nodeRouting: true, nodeIds: ['n1', 'n2'], db })
  assert.equal(await client.resolveNodeId('u1~n2'), 'n1')
  assert.equal(await client.resolveNodeId('u1'), 'n1')
  assert.deepEqual(queried, ['u1'], 'um cache só, pela conta')
  row.nodeId = 'n2' // a conta mudou de servidor
  client.forgetNode('u1')
  assert.equal(await client.resolveNodeId('u1~n2'), 'n2')
  await client.stopBot('u1~n2')
  assert.deepEqual(h.added.map(a => a.queue), ['supervisor-commands-n2'])
  await client.close()
})

// ---- V3: vaga por número ----
test('V3: mover conta com reserva ligada exige 2 vagas no destino', () => {
  const nodes = [{ nodeId: 'n1', alive: true, running: 5, max: 20 }, { nodeId: 'n2', alive: true, running: 19, max: 20 }]
  const base = { userId: 'u1', targetNode: 'n2', sessionRow: { nodeId: null, status: 'disconnected', lifecycle: 'manual_start' }, nodes }
  assert.equal(planAccountMove(base).ok, true)
  assert.equal(planAccountMove({ ...base, slots: 1 }).ok, true)
  const two = planAccountMove({ ...base, slots: 2 })
  assert.equal(two.ok, false)
  assert.match(two.errors.join(' '), /2 vaga/)
})

test('V3: o cliente expõe as vagas prometidas e reservar soma 1', async () => {
  const store = new Map([['supervisor:heartbeat:n2', '1'], [placementReservationKey('n2'), '2']])
  const h = harness(store)
  const client = createSupervisorClient({ redisUrl: 'redis://x', ...h, env: {}, nodeRouting: true, nodeIds: ['n1', 'n2'], db: { waSession: { findUnique: async () => ({ nodeId: 'n2' }) } } })
  await client.isSupervisorAlive('n2') // inicializa a conexão
  assert.equal(await client.getPlacementReservation('n2'), 2)
  await client.reservePlacement('n2')
  assert.equal(await client.getPlacementReservation('n2'), 3)
  assert.equal(await client.getPlacementReservation('n1'), 0)
  await client.close()
})

test('V3: ligar a reserva soma as vagas prometidas e segura a vaga; flag OFF segue o caminho antigo', () => {
  const route = read('src/api/routes/multiNumber.js')
  assert.match(route, /getNodeRoutingInfo\(userId, \{ includeReservations: true \}\)/)
  assert.match(route, /manager\.reserveNodeSlot\(node\.nodeId\)/)
  const manager = read('src/manager.js')
  assert.match(manager, /if \(includeReservations && running !== null\) running \+= await remoteClient\.getPlacementReservation\(nodeId\)/)
  // Flag OFF / inline: getNodeRoutingInfo e reserveNodeSlot não fazem nada.
  assert.match(manager, /export async function reserveNodeSlot\(nodeId\) \{\n {2}if \(MODE !== 'remote' \|\| !remoteClient\?\.nodeRouting \|\| !nodeId\) return/)
})

// ---- V1: mover a conta com o número reserva ----
test('V1: a reserva vai junto se ligada, ressuscitável ou já marcada; parada pela cliente não', () => {
  assert.equal(shouldCarryStandby({ extraRow: null, running: false }), false)
  assert.equal(shouldCarryStandby({ extraRow: { status: 'connected', lifecycle: 'ready' } }), true)
  assert.equal(shouldCarryStandby({ extraRow: { status: 'disconnected', lifecycle: 'reconnecting' } }), true)
  assert.equal(shouldCarryStandby({ extraRow: { status: 'disconnected', lifecycle: 'moving_node' } }), true)
  assert.equal(shouldCarryStandby({ extraRow: { status: 'disconnected', lifecycle: 'stopped_by_user' } }), false)
  assert.equal(shouldCarryStandby({ extraRow: { status: 'disconnected', lifecycle: 'stopped_by_user' }, running: true }), true)
})

test('V1: copia as DUAS pastas de login (o ativo pode estar usando a do número 2)', () => {
  assert.deepEqual(accountAuthKeys({ userId: 'u1' }), ['u1'])
  assert.deepEqual(accountAuthKeys({ userId: 'u1', hasStandbyLogin: true }), ['u1', 'u1~n2'])
  assert.deepEqual(accountProcessKeys({ userId: 'u1' }), ['u1'])
  assert.deepEqual(accountProcessKeys({ userId: 'u1', carryStandby: true }), ['u1', 'u1~n2'])
})

test('V1: não move no meio de uma troca de número', () => {
  const p = planAccountMove({ userId: 'u1', targetNode: 'n2', sessionRow: { nodeId: null, status: 'disconnected', lifecycle: 'switching' }, nodes: [{ nodeId: 'n1', alive: true, running: 1, max: 20 }, { nodeId: 'n2', alive: true, running: 1, max: 20 }] })
  assert.equal(p.ok, false)
})

test('V1: o script para, confere, copia e religa todos os números da conta', () => {
  const src = read('scripts/mover-conta-no.mjs')
  assert.match(src, /accountAuthKeys\(\{ userId: user\.id, hasStandbyLogin: Boolean\(reserva\) \}\)/)
  assert.match(src, /for \(const k of \[\.\.\.chaves\]\.reverse\(\)\) await client\.stopBot\(k\)/)
  assert.match(src, /for \(const k of \[\.\.\.chaves\]\.reverse\(\)\) await client\.stopBot\(k, \{ nodeId: para \}\)/)
  assert.match(src, /await marcarReserva\(mudando\)/)
  assert.match(src, /client\.startBot\(reservaKey\)/)
  assert.match(src, /slots: chaves\.length/)
  assert.doesNotMatch(src, /getAuthInfoDir\(user\.id\)/)
})

test('V1: troca automática não age em conta mudando de servidor', () => {
  const now = Date.now()
  const d = decideFailover({
    active: { status: 'disconnected', lifecycle: 'moving_node', lastDisconnectCode: '401' },
    standby: { status: 'connected', lastHeartbeatAt: new Date(now) },
    user: {},
    downSinceMs: now - 60 * 60_000,
    now,
  })
  assert.deepEqual(d, { promote: false, reason: 'moving_node' })
})

test('V1: switchActiveNumber recusa conta mudando de servidor sem parar nada', async () => {
  const calls = []
  const db = {
    waSession: { findUnique: async () => ({ lifecycle: 'moving_node' }), updateMany: async () => { calls.push('waSession.updateMany'); return { count: 1 } } },
    waExtraSession: { updateMany: async () => { calls.push('extra.updateMany'); return { count: 1 } } },
    user: { updateMany: async () => { calls.push('claim'); return { count: 1 } } },
  }
  const manager = { stopBot: async () => calls.push('stop'), startBot: async () => calls.push('start'), isRunning: async () => false }
  const r = await switchActiveNumber({ db, manager, userId: 'u1', expectedActiveSlot: 1, reason: 'logged_out', logger: { error() {}, warn() {}, info() {} } })
  assert.deepEqual(r, { switched: false, reason: 'moving_node' })
  assert.deepEqual(calls, [])
})

test('V1: ligar a reserva recusa durante a mudança de servidor', () => {
  assert.match(read('src/api/routes/multiNumber.js'), /state\.active\.lifecycle === MOVING_NODE_LIFECYCLE[\s\S]{0,200}WA_SESSION_MOVING/)
})
