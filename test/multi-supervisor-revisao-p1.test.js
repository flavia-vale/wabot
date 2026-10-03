// Revisão crítica do multi-servidor — 2º lote (C8, C9, C11, C12, C13).
// Flag de roteamento DESLIGADA = nada muda (provas abaixo).
import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createSupervisorClient } from '../src/supervisor/client.js'
import { shouldReplaceUnpaired, withReservations } from '../src/supervisor/placement.js'
import { resolveExpectedApps } from '../src/ops/pm2Guard.js'
import { evaluateVigia } from '../src/ops/vigia/evaluate.js'
import { COMMAND, DUAL_OWNER_STATUS_KEY, placementReservationKey } from '../src/supervisor/protocol.js'

function harness({ store = new Map(), handlers = {} } = {}) {
  class FakeRedis extends EventEmitter {
    async subscribe() { return 1 }
    async unsubscribe() { return 0 }
    async get(key) { return store.get(key) ?? null }
    async set(key, value) { store.set(key, value); return 'OK' }
    async incr(key) { const v = Number(store.get(key) ?? 0) + 1; store.set(key, String(v)); return v }
    async expire() { return 1 }
    async quit() { return 'OK' }
  }
  const added = []
  class FakeQueue {
    constructor(name) { this.name = name }
    async add(name, data) {
      added.push({ queue: this.name, name })
      const h = handlers[this.name]
      return { waitUntilFinished: async () => (h ? h(name, data) : true) }
    }
    async close() {}
  }
  class FakeQueueEvents { async waitUntilReady() {} async close() {} }
  return { store, added, ioredisModule: { default: FakeRedis }, bullmqModule: { Queue: FakeQueue, QueueEvents: FakeQueueEvents } }
}
const alive = (...ids) => new Map(ids.flatMap(id => [[`supervisor:heartbeat:${id}`, '1'], [`supervisor:capacity:${id}`, '20']]))
function mutableDb(rows) {
  return {
    rows,
    waSession: {
      findUnique: async ({ where }) => (rows[where.userId] ? { ...rows[where.userId] } : null),
      updateMany: async ({ where, data }) => {
        const r = rows[where.userId]
        if (!r || (where.nodeId !== undefined && (r.nodeId ?? null) !== where.nodeId)) return { count: 0 }
        Object.assign(r, data)
        return { count: 1 }
      },
      create: async ({ data }) => { rows[data.userId] = { ...data }; return data },
    },
  }
}
const mk = (h, db, extra = {}) => createSupervisorClient({ redisUrl: 'redis://x', ...h, env: {}, nodeRouting: true, nodeIds: ['n1', 'n2'], db, ...extra })

// ---- C8 ----
test('C8: logo após a conta mudar de servidor, o comando recusado pelo antigo vai ao novo (uma vez)', async () => {
  const db = mutableDb({ u1: { nodeId: 'n1' } })
  const h = harness({
    store: alive('n1', 'n2'),
    handlers: { 'supervisor-commands-n1': () => { throw new Error('Session owner mismatch') } },
  })
  const client = mk(h, db)
  await client.sendBroadcast('u1', 'oi', []) .catch(() => {})
  db.rows.u1.nodeId = 'n2' // a conta mudou de servidor; o cache ainda diz n1
  await client.sendBroadcast('u1', 'oi', [])
  assert.deepEqual(h.added.slice(-2).map(a => a.queue), ['supervisor-commands-n1', 'supervisor-commands-n2'])
  await client.close()
})
test('C8: sem mudança de dono, o erro original sobe (não tenta duas vezes no mesmo nó)', async () => {
  const db = mutableDb({ u1: { nodeId: 'n1' } })
  const h = harness({ store: alive('n1', 'n2'), handlers: { 'supervisor-commands-n1': () => { throw new Error('Session owner mismatch') } } })
  const client = mk(h, db)
  await assert.rejects(() => client.sendBroadcast('u1', 'oi', []), /Session owner mismatch/)
  assert.equal(h.added.length, 1)
  await client.close()
})
test('C8: "parar" que voltou falso no nó antigo é repetido no novo dono', async () => {
  const db = mutableDb({ u1: { nodeId: 'n1' } })
  const h = harness({ store: alive('n1', 'n2'), handlers: { 'supervisor-commands-n1': () => false, 'supervisor-commands-n2': () => true } })
  const client = mk(h, db)
  await client.isRunning('u1') // aquece o cache em n1
  db.rows.u1.nodeId = 'n2'
  assert.equal(await client.stopBot('u1'), true)
  assert.equal(h.added.at(-1).queue, 'supervisor-commands-n2')
  await client.close()
})
test('C8: flag OFF não relê nada nem repete', async () => {
  const h = harness({ store: new Map([['supervisor:heartbeat', '1']]), handlers: { 'supervisor-commands': () => false } })
  const client = createSupervisorClient({ redisUrl: 'redis://x', ...h, env: {}, nodeRouting: false })
  assert.equal(await client.stopBot('u1'), false)
  assert.equal(h.added.length, 1)
  await client.close()
})

// ---- C9 ----
test('C9: só conta NUNCA pareada e parada troca de nó, e só se o dela está fora ou lotado', () => {
  const row = { nodeId: 'n2', phone: null, status: 'disconnected' }
  assert.equal(shouldReplaceUnpaired({ row, node: { alive: false } }), true)
  assert.equal(shouldReplaceUnpaired({ row, node: { alive: true, running: 20, max: 20 } }), true)
  assert.equal(shouldReplaceUnpaired({ row, node: { alive: true, running: 3, max: 20 } }), false)
  assert.equal(shouldReplaceUnpaired({ row: { ...row, phone: '5511' }, node: { alive: false } }), false, 'conta pareada nunca troca sozinha')
  assert.equal(shouldReplaceUnpaired({ row: { ...row, status: 'connecting' }, node: { alive: false } }), false)
  assert.equal(shouldReplaceUnpaired({ row, node: { alive: true, running: null, max: 20 } }), false, 'sem medição não presume lotado')
})
test('C9: reservas somam ao medido; sem medição continua sem medição', () => {
  const out = withReservations([{ nodeId: 'n1', running: 5 }, { nodeId: 'n2', running: null }], { n1: 3, n2: 4 })
  assert.deepEqual(out.map(n => n.running), [8, null])
})
test('C9: conta nova presa a nó fora do ar vai para o vivo ao ligar; reserva gravada', async () => {
  const db = mutableDb({ u1: { nodeId: 'n2', phone: null, status: 'disconnected', lifecycle: 'idle' } })
  const h = harness({ store: alive('n1'), handlers: { 'supervisor-commands-n1': name => (name === COMMAND.LIST_RUNNING_BOTS ? [] : true) } })
  const client = mk(h, db)
  await client.startBot('u1')
  assert.equal(db.rows.u1.nodeId, 'n1')
  assert.equal(h.store.get(placementReservationKey('n1')), '1')
  assert.equal(h.added.at(-1).queue, 'supervisor-commands-n1')
  await client.close()
})
test('C9: conta PAREADA presa a nó fora do ar não muda (recusa "servidor fora")', async () => {
  const db = mutableDb({ u1: { nodeId: 'n2', phone: '5511', status: 'disconnected', lifecycle: 'idle' } })
  const h = harness({ store: alive('n1'), handlers: { 'supervisor-commands-n1': () => [] } })
  const client = mk(h, db)
  await assert.rejects(() => client.startBot('u1'), err => err.code === 'WA_NODE_UNAVAILABLE')
  assert.equal(db.rows.u1.nodeId, 'n2')
  await client.close()
})

// ---- C11 ----
test('C11: varredura acha o mesmo robô em dois nós e grava o resultado para o vigia', async () => {
  const lists = { 'supervisor-commands-n1': () => ['u1', 'u2'], 'supervisor-commands-n2': () => ['u2'] }
  const h = harness({ store: alive('n1', 'n2'), handlers: lists })
  const client = mk(h, mutableDb({}))
  const dual = await client.checkDualOwners()
  assert.deepEqual(dual, [{ userId: 'u2', nodes: ['n1', 'n2'] }])
  assert.equal(JSON.parse(h.store.get(DUAL_OWNER_STATUS_KEY)).count, 1)
  assert.equal(client.getDualOwnerTotal(), 1, 'o contador do /metrics agora sai do cliente')
  await client.close()
})
test('C11: vigia só mostra a linha com a flag (undefined = sem linha); >0 = vermelho', () => {
  assert.equal(evaluateVigia({}).checks.some(c => c.id === 'dual'), false)
  const r = evaluateVigia({ dualOwners: { count: 2 } })
  assert.equal(r.checks.find(c => c.id === 'dual').level, 'red')
  assert.equal(evaluateVigia({ dualOwners: { count: 0 } }).checks.find(c => c.id === 'dual').level, 'ok')
})

// ---- C12 ----
test('C12: vigia no servidor secundário exige só o supervisor', () => {
  assert.deepEqual(resolveExpectedApps({ SUPERVISOR_NODE_ROUTING: '1', SUPERVISOR_NODE_ID: 'n2', BOT_SUPERVISOR_MODE: 'remote' }), ['bot-supervisor'])
  assert.deepEqual(resolveExpectedApps({ SUPERVISOR_NODE_ROUTING: '1', SUPERVISOR_NODE_ID: 'n1', BOT_SUPERVISOR_MODE: 'remote' }), ['api', 'dashboard', 'bot-supervisor'])
  assert.deepEqual(resolveExpectedApps({ SUPERVISOR_NODE_ID: 'n2', BOT_SUPERVISOR_MODE: 'remote' }), ['api', 'dashboard', 'bot-supervisor'], 'sem a flag nada muda')
})

// ---- C13 ----
test('C13: contagem por nó fica 15 s em cache (só resultado completo)', async () => {
  let t = 0
  const h = harness({ store: alive('n1', 'n2'), handlers: { 'supervisor-commands-n1': () => ['a'], 'supervisor-commands-n2': () => [] } })
  const client = mk(h, mutableDb({}), { now: () => t })
  await client.listRunningBotsByNode()
  const n = h.added.length
  t = 10_000
  await client.listRunningBotsByNode()
  assert.equal(h.added.length, n, 'dentro de 15 s não pergunta de novo')
  t = 16_000
  await client.listRunningBotsByNode()
  assert.ok(h.added.length > n)
  await client.close()
})
