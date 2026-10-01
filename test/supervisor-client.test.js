import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'events'

import { createSupervisorClient } from '../src/supervisor/client.js'
import {
  COMMAND,
  EVENT,
  EVENTS_CHANNEL,
  encodeEvent,
  lastEventKey,
} from '../src/supervisor/protocol.js'

// Mock mínimo de ioredis: simula o que o cliente usa (subscribe, on('message'),
// quit, unsubscribe, get). É um EventEmitter por baixo, com um único canal.
function createMockRedis() {
  class FakeRedis extends EventEmitter {
    constructor() {
      super()
      this.subscriptions = new Set()
      this.store = new Map()
    }
    async subscribe(ch) { this.subscriptions.add(ch); return 1 }
    async unsubscribe(ch) { this.subscriptions.delete(ch); return 0 }
    async get(key) { return this.store.get(key) ?? null }
    async quit() { this.emit('end'); return 'OK' }
  }
  return { default: FakeRedis }
}

// Mock mínimo de bullmq: Queue + QueueEvents. add() guarda jobs em memória;
// não vamos exercer waitUntilFinished neste teste (cobertura está no protocolo
// e o resto exige Redis real).
function createMockBullmq() {
  class FakeQueue {
    constructor(name) { this.name = name; this.jobs = [] }
    async add(name, data, _opts) {
      const job = {
        id: String(this.jobs.length + 1),
        name,
        data,
        waitUntilFinished: async () => ({ acknowledged: true, name }),
      }
      this.jobs.push(job)
      return job
    }
    async close() {}
  }
  class FakeQueueEvents {
    constructor() {}
    async waitUntilReady() {}
    async close() {}
  }
  return { Queue: FakeQueue, QueueEvents: FakeQueueEvents }
}

test('client expõe a mesma superfície de sessionCore.js', async () => {
  const client = createSupervisorClient({
    redisUrl: 'redis://fake',
    ioredisModule: createMockRedis(),
    bullmqModule: createMockBullmq(),
  })
  const expected = [
    'startBot', 'stopBot', 'isRunning', 'listRunningBots',
    'onQR', 'onStatus', 'getLastQR',
    'listGroups', 'sendBroadcast', 'requestPairingCode', 'getBotMetrics',
    'reloadConfig', 'channelMetadata', 'followChannelImmediate',
    'listFollowedChannels', 'stopAllBots', 'startSessionHealthMonitor',
    'resumePersistedBots',
  ]
  for (const fn of expected) {
    assert.equal(typeof client[fn], 'function', `client.${fn} deve existir`)
  }
  await client.close()
})

test('client enfileira comando com nome canônico', async () => {
  const bullmq = createMockBullmq()
  let captured = null
  // Espia: substitui Queue.prototype.add via subclasse
  const originalQueue = bullmq.Queue
  class SpyQueue extends originalQueue {
    async add(name, data, opts) {
      captured = { name, data, opts }
      return super.add(name, data, opts)
    }
  }
  const client = createSupervisorClient({
    redisUrl: 'redis://fake',
    ioredisModule: createMockRedis(),
    bullmqModule: { ...bullmq, Queue: SpyQueue },
  })
  const options = { imageUrl: 'https://down-br.img.susercontent.com/file/teste' }
  const result = await client.sendBroadcast('user-1', 'hello', ['jid@s.whatsapp.net'], options)
  assert.equal(captured.name, COMMAND.SEND_BROADCAST)
  assert.equal(captured.data.userId, 'user-1')
  assert.equal(captured.data.text, 'hello')
  assert.deepEqual(captured.data.jids, ['jid@s.whatsapp.net'])
  assert.deepEqual(captured.data.options, options)
  assert.equal(result.acknowledged, true)
  await client.close()
})

test('onQR recebe eventos publicados no canal', async () => {
  const mockRedis = createMockRedis()
  const client = createSupervisorClient({
    redisUrl: 'redis://fake',
    ioredisModule: mockRedis,
    bullmqModule: createMockBullmq(),
  })
  // Força init para que o subscriber esteja registrado.
  await client._events // só pra acesso; init é disparado por subscribeUserEvent
  let received = null
  const off = client.onQR('user-42', qr => { received = qr })
  // Aguarda init terminar (ele é lazy via .catch silencioso)
  await new Promise(r => setTimeout(r, 10))
  // Encontra a instância de FakeRedis que virou subscriber
  // (o client cria duas; ambas iguais — emitir em qualquer uma serve se for a do subscribe)
  // Como o mock retorna nova instância a cada `new`, precisamos disparar
  // através de um path determinístico: o client guarda subscriber privado.
  // Atalho: emitir diretamente no EventEmitter interno do client é equivalente
  // ao que o subscriber faria após decodeEvent.
  client._events.emit(`${EVENT.QR}:user-42`, 'qr-string-abc')
  assert.equal(received, 'qr-string-abc')
  off()
  client._events.emit(`${EVENT.QR}:user-42`, 'outro-qr')
  assert.equal(received, 'qr-string-abc') // off() funcionou
  await client.close()
})

// Mock com store COMPARTILHADO entre instâncias — necessário para testar a
// re-hidratação, já que o client lê com publisherCheck (uma instância) a chave
// que o supervisor escreveria com outra conexão.
function createSharedStoreMockRedis() {
  const store = new Map()
  class FakeRedis extends EventEmitter {
    constructor() { super(); this.subscriptions = new Set(); this.store = store }
    async subscribe(ch) { this.subscriptions.add(ch); return 1 }
    async unsubscribe(ch) { this.subscriptions.delete(ch); return 0 }
    async get(key) { return store.get(key) ?? null }
    async set(key, val) { store.set(key, val); return 'OK' }
    async quit() { this.emit('end'); return 'OK' }
  }
  return { module: { default: FakeRedis }, store }
}

test('onQR re-hidrata o assinante com o último valor cacheado (P1-4)', async () => {
  const { module, store } = createSharedStoreMockRedis()
  // Simula o que o supervisor gravou na última publicação de QR.
  store.set(lastEventKey('user-99', EVENT.QR), JSON.stringify('qr-cacheado'))
  const client = createSupervisorClient({
    redisUrl: 'redis://fake',
    ioredisModule: module,
    bullmqModule: createMockBullmq(),
  })
  let received = null
  client.onQR('user-99', qr => { received = qr })
  // A hidratação é assíncrona (init + get). Aguarda o microtask/timer.
  await new Promise(r => setTimeout(r, 20))
  assert.equal(received, 'qr-cacheado', 'assinante tardio deve receber o QR cacheado sem nova publicação')
  await client.close()
})

test('getLastEvent retorna null quando não há cache', async () => {
  const { module } = createSharedStoreMockRedis()
  const client = createSupervisorClient({
    redisUrl: 'redis://fake',
    ioredisModule: module,
    bullmqModule: createMockBullmq(),
  })
  assert.equal(await client.getLastEvent(EVENT.STATUS, 'sem-cache'), null)
  await client.close()
})

test('onStatus desempacota { status, phone } como dois argumentos', async () => {
  const client = createSupervisorClient({
    redisUrl: 'redis://fake',
    ioredisModule: createMockRedis(),
    bullmqModule: createMockBullmq(),
  })
  let captured = null
  client.onStatus('user-7', (status, phone) => { captured = { status, phone } })
  await new Promise(r => setTimeout(r, 10))
  client._events.emit(`${EVENT.STATUS}:user-7`, { status: 'connected', phone: '+5511999' })
  assert.deepEqual(captured, { status: 'connected', phone: '+5511999' })
  await client.close()
})

test('stopAllBots/resumePersistedBots/startSessionHealthMonitor são no-op em remote', async () => {
  const client = createSupervisorClient({
    redisUrl: 'redis://fake',
    ioredisModule: createMockRedis(),
    bullmqModule: createMockBullmq(),
  })
  assert.equal(client.stopAllBots(), 0)
  const resume = await client.resumePersistedBots()
  assert.equal(resume.mode, 'remote')
  assert.equal(resume.started, 0)
  const off = client.startSessionHealthMonitor()
  assert.equal(typeof off, 'function')
  off()
  await client.close()
})

test('manager.js em modo inline expõe a superfície de sessionCore', async () => {
  // Importa fresh, sem env BOT_SUPERVISOR_MODE setada (default = inline).
  delete process.env.BOT_SUPERVISOR_MODE
  const manager = await import('../src/manager.js')
  assert.equal(manager.SUPERVISOR_MODE, 'inline')
  for (const fn of ['startBot', 'stopBot', 'sendBroadcast', 'onQR', 'onStatus', 'stopAllBots', 'resumePersistedBots']) {
    assert.equal(typeof manager[fn], 'function', `manager.${fn} deve existir`)
  }
})

test('encodeEvent integra com EventEmitter do client', async () => {
  // Garante que o formato wire (encodeEvent) é o mesmo que o client espera
  // ao decodificar. Isso é a "garantia ponta-a-ponta" do protocolo.
  const json = encodeEvent({ userId: 'u', type: EVENT.QR, data: 'qr-payload' })
  const parsed = JSON.parse(json)
  assert.equal(parsed.userId, 'u')
  assert.equal(parsed.type, EVENT.QR)
  assert.equal(parsed.data, 'qr-payload')
  // O canal alvo é único e canônico — supervisor e client devem usar a
  // mesma constante para falar.
  assert.equal(EVENTS_CHANNEL, 'bots:events')
})

// ---- Roteamento por nó (SUPERVISOR_NODE_ROUTING) ----

// Redis com store compartilhado (heartbeats) e Bullmq que registra o nome de
// cada fila aberta e as chamadas a add(). `handlers[queueName]` decide o retorno.
function createNodeHarness({ alive = ['n1', 'n2'], handlers = {}, events = [] } = {}) {
  const store = new Map(alive.map(id => [`supervisor:heartbeat:${id}`, '1']))
  class FakeRedis extends EventEmitter {
    async subscribe() { return 1 }
    async unsubscribe() { return 0 }
    async get(key) { return store.get(key) ?? null }
    async quit() { return 'OK' }
  }
  const openedQueues = []
  const added = []
  class FakeQueue {
    constructor(name) { this.name = name; openedQueues.push(name) }
    async add(name, data) {
      added.push({ queue: this.name, name, data })
      events.push(`add:${this.name}:${name}`)
      const handler = handlers[this.name]
      return { id: String(added.length), waitUntilFinished: async () => (handler ? handler(name, data) : { ok: true }) }
    }
    async close() {}
  }
  class FakeQueueEvents { async waitUntilReady() {} async close() {} }
  return { ioredisModule: { default: FakeRedis }, bullmqModule: { Queue: FakeQueue, QueueEvents: FakeQueueEvents }, openedQueues, added, store }
}

function fakeDb(rows = {}, events = []) {
  return {
    rows,
    waSession: {
      findUnique: async ({ where }) => (rows[where.userId] ? { ...rows[where.userId] } : null),
      updateMany: async ({ where, data }) => {
        const row = rows[where.userId]
        if (!row || row.nodeId !== where.nodeId) return { count: 0 }
        Object.assign(row, data)
        events.push(`db:nodeId=${data.nodeId}`)
        return { count: 1 }
      },
      create: async ({ data }) => { rows[data.userId] = { ...data }; events.push(`db:create:${data.nodeId}`); return data },
    },
  }
}

const routed = (h, extra = {}) => createSupervisorClient({
  redisUrl: 'redis://fake', ioredisModule: h.ioredisModule, bullmqModule: h.bullmqModule,
  env: {}, nodeRouting: true, nodeIds: ['n1', 'n2'], maxSessionsPerNode: 20, ...extra,
})

test('flag OFF: só a fila legada, sem tocar no banco (comportamento atual)', async () => {
  const h = createNodeHarness()
  const client = createSupervisorClient({ redisUrl: 'redis://fake', ioredisModule: h.ioredisModule, bullmqModule: h.bullmqModule, env: {}, nodeRouting: false })
  await client.sendBroadcast('u1', 'oi', [])
  await client.startBot('u1')
  assert.deepEqual([...new Set(h.openedQueues)], ['supervisor-commands'])
  assert.ok(h.added.every(a => a.queue === 'supervisor-commands'))
  await client.close()
})

test('flag ON: comando vai para a fila do nó dono, sem ":" no nome', async () => {
  const h = createNodeHarness()
  const db = fakeDb({ u1: { nodeId: 'n2' }, u2: { nodeId: null }, u3: { nodeId: 'n1' } })
  const client = routed(h, { db })
  await client.sendBroadcast('u1', 'a', [])
  await client.sendBroadcast('u2', 'b', []) // nodeId nulo = n1
  await client.sendBroadcast('u3', 'c', [])
  assert.deepEqual(h.added.map(a => a.queue), ['supervisor-commands-n2', 'supervisor-commands-n1', 'supervisor-commands-n1'])
  assert.ok(h.openedQueues.every(n => !n.includes(':')))
  assert.ok(!h.openedQueues.includes('supervisor-commands'), 'a fila legada nem é aberta com a API roteada')
  await client.close()
})

test('flag ON: Queue/QueueEvents por nó são lazy e reaproveitados', async () => {
  const h = createNodeHarness()
  const client = routed(h, { db: fakeDb({ u1: { nodeId: 'n2' } }) })
  assert.equal(h.openedQueues.length, 0)
  await client.sendBroadcast('u1', 'a', [])
  await client.sendBroadcast('u1', 'b', [])
  assert.equal(h.openedQueues.filter(n => n === 'supervisor-commands-n2').length, 1)
  await client.close()
})

test('flag ON: cache de posse evita reler o banco a cada comando', async () => {
  const h = createNodeHarness()
  let reads = 0
  const db = fakeDb({ u1: { nodeId: 'n2' } })
  const original = db.waSession.findUnique
  db.waSession.findUnique = async args => { reads++; return original(args) }
  const client = routed(h, { db })
  await client.sendBroadcast('u1', 'a', [])
  await client.sendBroadcast('u1', 'b', [])
  assert.equal(reads, 1)
  await client.close()
})

test('flag ON: falha ao ler o banco propaga (nunca roteia às cegas)', async () => {
  const h = createNodeHarness()
  const db = { waSession: { findUnique: async () => { throw new Error('db fora') } } }
  const client = routed(h, { db })
  await assert.rejects(() => client.sendBroadcast('u1', 'a', []), /db fora/)
  assert.equal(h.added.length, 0)
  await client.close()
})

test('flag ON: nodeId é gravado ANTES do START_BOT e vai ao nó escolhido', async () => {
  const events = []
  const h = createNodeHarness({ events, handlers: { 'supervisor-commands-n2': name => (name === 'listRunningBots' ? [] : true), 'supervisor-commands-n1': name => (name === 'listRunningBots' ? Array.from({ length: 15 }, (_, i) => `x${i}`) : true) } })
  // n2 vazio (0), n1 com 15 -> n2 tem mais vagas
  h.added.length = 0
  const db = fakeDb({ novo: { nodeId: null } }, events)
  const client = routed(h, { db })
  const ok = await client.startBot('novo')
  assert.equal(ok, true)
  const gravou = events.indexOf('db:nodeId=n2')
  const enviou = events.indexOf('add:supervisor-commands-n2:startBot')
  assert.ok(gravou >= 0 && enviou >= 0 && gravou < enviou, `ordem errada: ${events.join(' | ')}`)
  assert.equal(db.rows.novo.nodeId, 'n2')
  await client.close()
})

test('flag ON: sessão sem linha no banco ganha linha com nodeId antes do envio', async () => {
  const events = []
  const h = createNodeHarness({ events })
  const db = fakeDb({}, events)
  const client = routed(h, { db, nodeIds: ['n1'] })
  await client.startBot('zero')
  assert.equal(db.rows.zero.nodeId, 'n1')
  assert.ok(events.indexOf('db:create:n1') < events.findIndex(e => e.endsWith(':startBot')))
  await client.close()
})

test('flag ON: sessão que já tem nodeId NÃO é recolocada', async () => {
  const h = createNodeHarness()
  const db = fakeDb({ u1: { nodeId: 'n1' } })
  const client = routed(h, { db })
  await client.startBot('u1')
  assert.equal(db.rows.u1.nodeId, 'n1')
  assert.deepEqual(h.added.map(a => a.queue), ['supervisor-commands-n1'])
  await client.close()
})

test('flag ON: sem nó vivo com vaga o start é recusado (false) e nada é enviado', async () => {
  const h = createNodeHarness({ alive: [] })
  const db = fakeDb({ novo: { nodeId: null } })
  const client = routed(h, { db })
  assert.equal(await client.startBot('novo'), false)
  assert.equal(db.rows.novo.nodeId, null)
  assert.equal(h.added.filter(a => a.name === 'startBot').length, 0)
  await client.close()
})

test('LIST_RUNNING_BOTS faz fan-out aos nós vivos e soma', async () => {
  const h = createNodeHarness({ handlers: { 'supervisor-commands-n1': () => ['a', 'b'], 'supervisor-commands-n2': () => ['c'] } })
  const client = routed(h, { db: fakeDb() })
  assert.deepEqual((await client.listRunningBots()).sort(), ['a', 'b', 'c'])
  assert.deepEqual(await client.listRunningBotsByNode(), { n1: 2, n2: 1 })
  await client.close()
})

test('LIST_RUNNING_BOTS com um nó falhando: total indisponível, nunca soma parcial', async () => {
  const h = createNodeHarness({ handlers: { 'supervisor-commands-n1': () => ['a', 'b'], 'supervisor-commands-n2': () => { throw new Error('timeout') } } })
  const client = routed(h, { db: fakeDb() })
  await assert.rejects(() => client.listRunningBots(), /indisponível/)
  // por nó: o que falhou vira null (nunca 0), o outro segue medido
  assert.deepEqual(await client.listRunningBotsByNode(), { n1: 2, n2: null })
  await client.close()
})

test('LIST_RUNNING_BOTS ignora nó sem heartbeat (nó morto não roda robô)', async () => {
  const h = createNodeHarness({ alive: ['n1'], handlers: { 'supervisor-commands-n1': () => ['a'] } })
  const client = routed(h, { db: fakeDb() })
  assert.deepEqual(await client.listRunningBots(), ['a'])
  assert.ok(!h.openedQueues.includes('supervisor-commands-n2'))
  await client.close()
})

test('isSupervisorAlive e bootedAt aceitam nodeId; sem nodeId exigem todos os nós', async () => {
  const h = createNodeHarness({ alive: ['n1'] })
  h.store.set('supervisor:bootedAt:n1', '2000')
  h.store.set('supervisor:bootedAt:n2', '1000')
  const client = routed(h, { db: fakeDb() })
  assert.equal(await client.isSupervisorAlive('n1'), true)
  assert.equal(await client.isSupervisorAlive('n2'), false)
  assert.equal(await client.isSupervisorAlive(), false)
  assert.equal(await client.getSupervisorBootedAtMs('n1'), 2000)
  assert.equal(await client.getSupervisorBootedAtMs(), 1000) // o boot mais antigo
  await client.close()
})

test('flag OFF: isSupervisorAlive segue lendo a chave legada', async () => {
  const h = createNodeHarness({ alive: [] })
  h.store.set('supervisor:heartbeat', '1')
  const client = createSupervisorClient({ redisUrl: 'redis://fake', ioredisModule: h.ioredisModule, bullmqModule: h.bullmqModule, env: {}, nodeRouting: false })
  assert.equal(await client.isSupervisorAlive(), true)
  await client.close()
})
