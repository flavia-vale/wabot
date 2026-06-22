import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { offerQueueRoutes } from '../src/api/routes/offerQueue.js'

function fakeDb() {
  const queues = []
  const items = []
  let id = 0
  const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => {
    if (typeof value === 'object' && value !== null) return true
    return row[key] === value
  })
  return {
    queues, items,
    user: { findUnique: async () => ({ plan: 'pro', accessExpiresAt: null }) },
    group: { findMany: async ({ where }) => [{ waJid: `${where.userId}-post@g.us` }] },
    offerQueue: {
      count: async ({ where }) => queues.filter((row) => matches(row, where)).length,
      findMany: async ({ where }) => queues.filter((row) => matches(row, where)),
      findFirst: async ({ where, select }) => { const row = queues.find((candidate) => matches(candidate, where)); return row && select ? Object.fromEntries(Object.keys(select).map((key) => [key, row[key]])) : row },
      create: async ({ data }) => { const row = { id: `q${++id}`, createdAt: new Date(), updatedAt: new Date(), ...data }; queues.push(row); return row },
      updateMany: async ({ where, data }) => { const found = queues.filter((row) => matches(row, where)); found.forEach((row) => Object.assign(row, data)); return { count: found.length } },
      deleteMany: async ({ where }) => { const index = queues.findIndex((row) => matches(row, where)); if (index < 0) return { count: 0 }; queues.splice(index, 1); return { count: 1 } },
    },
    offerQueueItem: {
      count: async ({ where }) => items.filter((row) => matches(row, where)).length,
      findMany: async ({ where }) => items.filter((row) => matches(row, where)),
      findFirst: async ({ where }) => [...items].reverse().find((row) => matches(row, where)),
      create: async ({ data }) => { const row = { id: `i${++id}`, status: 'pending', createdAt: new Date(), ...data }; items.push(row); return row },
      updateMany: async ({ where, data }) => { const found = items.filter((row) => matches(row, where)); found.forEach((row) => Object.assign(row, data)); return { count: found.length } },
    },
  }
}

async function appFor(userId, db, options = {}) {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(offerQueueRoutes, { prefix: '/api/offer-queues', db, now: () => new Date('2026-06-10T15:00:00Z'), drainQueueOnce: options.drainQueueOnce })
  return app
}

test('CRUD de filas valida toggles e isola ownership', async (t) => {
  const db = fakeDb()
  const appA = await appFor('user-a', db)
  const appB = await appFor('user-b', db)
  t.after(async () => { await appA.close(); await appB.close() })

  const invalid = await appA.inject({ method: 'POST', url: '/api/offer-queues', payload: { name: 'Rápida', intervalEnabled: true, intervalMinutes: 0 } })
  assert.equal(invalid.statusCode, 400)

  const created = await appA.inject({ method: 'POST', url: '/api/offer-queues', payload: { name: ' Rápida ', intervalEnabled: true, intervalMinutes: 2, targetJids: ['123@g.us', '123@g.us'] } })
  assert.equal(created.statusCode, 200)
  const queue = created.json()
  assert.equal(queue.name, 'Rápida')
  assert.deepEqual(queue.targetJids, ['123@g.us'])

  const noJids = await appA.inject({ method: 'POST', url: '/api/offer-queues', payload: { name: 'Sem grupos' } })
  assert.deepEqual(noJids.json().targetJids, [])

  const updated = await appA.inject({ method: 'PUT', url: `/api/offer-queues/${queue.id}`, payload: { targetJids: ['456@g.us'] } })
  assert.deepEqual(updated.json().targetJids, ['456@g.us'])

  const listB = await appB.inject({ method: 'GET', url: '/api/offer-queues' })
  assert.deepEqual(listB.json(), [])
  const updateB = await appB.inject({ method: 'PUT', url: `/api/offer-queues/${queue.id}`, payload: { name: 'Invadida' } })
  assert.equal(updateB.statusCode, 404)
})

test('inserção normaliza destinos, usa fallback post e cancelamento exige ownership', async (t) => {
  const db = fakeDb()
  const app = await appFor('user-a', db)
  const other = await appFor('user-b', db)
  t.after(async () => { await app.close(); await other.close() })
  const queue = (await app.inject({ method: 'POST', url: '/api/offer-queues', payload: { name: 'Principal' } })).json()

  const added = await app.inject({ method: 'POST', url: `/api/offer-queues/${queue.id}/items`, payload: { text: ' Oferta ', imageUrl: 'https://img.test/a.jpg' } })
  assert.equal(added.statusCode, 200)
  const item = added.json()
  assert.equal(item.text, 'Oferta')
  assert.deepEqual(JSON.parse(item.targetJids), ['user-a-post@g.us'])
  assert.equal(item.position, 1)

  const denied = await other.inject({ method: 'DELETE', url: `/api/offer-queues/${queue.id}/items/${item.id}` })
  assert.equal(denied.statusCode, 404)
  const cancelled = await app.inject({ method: 'DELETE', url: `/api/offer-queues/${queue.id}/items/${item.id}` })
  assert.equal(cancelled.statusCode, 200)
})

test('item sem jids herda os grupos configurados na fila', async (t) => {
  const db = fakeDb()
  // JIDs explícitos/herdados precisam estar cadastrados como grupos do tenant
  db.group.findMany = async () => [{ waJid: '111@g.us' }, { waJid: '222@g.us' }, { waJid: '333@g.us' }]
  const app = await appFor('user-a', db)
  t.after(async () => { await app.close() })
  const queue = (await app.inject({ method: 'POST', url: '/api/offer-queues', payload: { name: 'Com grupos', targetJids: ['111@g.us', '222@g.us'] } })).json()

  const inherited = await app.inject({ method: 'POST', url: `/api/offer-queues/${queue.id}/items`, payload: { text: 'Oferta da fila' } })
  assert.equal(inherited.statusCode, 200)
  assert.deepEqual(JSON.parse(inherited.json().targetJids), ['111@g.us', '222@g.us'])

  const explicit = await app.inject({ method: 'POST', url: `/api/offer-queues/${queue.id}/items`, payload: { text: 'Oferta avulsa', jids: ['333@g.us'] } })
  assert.deepEqual(JSON.parse(explicit.json().targetJids), ['333@g.us'])
})

test('reativar fila limpa o intervalo anterior e tenta enviar a primeira oferta imediatamente', async (t) => {
  const db = fakeDb()
  const drains = []
  const app = await appFor('user-a', db, {
    drainQueueOnce: async (queue) => {
      drains.push(queue)
      return { sent: 'i1' }
    },
  })
  t.after(async () => { await app.close() })

  const queue = (await app.inject({ method: 'POST', url: '/api/offer-queues', payload: { name: 'Retomada', enabled: false, intervalEnabled: true, intervalMinutes: 60 } })).json()
  db.queues[0].lastSentAt = new Date('2026-06-10T14:55:00Z')

  const paused = await app.inject({ method: 'PUT', url: `/api/offer-queues/${queue.id}`, payload: { enabled: false } })
  assert.equal(paused.statusCode, 200)
  assert.equal(drains.length, 0)

  const resumed = await app.inject({ method: 'PUT', url: `/api/offer-queues/${queue.id}`, payload: { enabled: true } })
  assert.equal(resumed.statusCode, 200)
  assert.equal(resumed.json().enabled, true)
  assert.equal(resumed.json().lastSentAt, null)
  assert.deepEqual(resumed.json().activation, { sent: 'i1' })
  assert.equal(drains.length, 1)
  assert.equal(drains[0].lastSentAt, null)
})

test('GET / expõe blockReason quando há itens pendentes parados', async (t) => {
  const db = fakeDb()
  const app = await appFor('user-b', db, { evaluateQueueGate: async () => 'bot_offline' })
  t.after(async () => { await app.close() })

  const queue = (await app.inject({ method: 'POST', url: '/api/offer-queues', payload: { name: 'Com pendentes', targetJids: ['g@g.us'] } })).json()
  db.items.push({ id: 'i1', queueId: queue.id, userId: 'user-b', status: 'pending', position: 1 })

  const list = (await app.inject({ method: 'GET', url: '/api/offer-queues' })).json()
  assert.equal(list[0].pendingCount, 1)
  assert.equal(list[0].blockReason, 'bot_offline')

  // Sem itens pendentes, não há motivo de bloqueio a reportar.
  db.items[0].status = 'sent'
  const listSent = (await app.inject({ method: 'GET', url: '/api/offer-queues' })).json()
  assert.equal(listSent[0].pendingCount, 0)
  assert.equal(listSent[0].blockReason, null)
})

test('GET / reporta plan_inactive em fila pendente quando o plano não permite', async (t) => {
  const db = fakeDb()
  // evaluateQueueGate nem deve ser consultado: o gate de plano vem primeiro.
  const app = await appFor('user-b', db, { evaluateQueueGate: async () => { throw new Error('não deveria chamar') } })
  t.after(async () => { await app.close() })

  // Cria a fila ainda com plano Pro (a criação é gated em Pro).
  const queue = (await app.inject({ method: 'POST', url: '/api/offer-queues', payload: { name: 'Plano caiu', targetJids: ['g@g.us'] } })).json()
  db.items.push({ id: 'i1', queueId: queue.id, userId: 'user-b', status: 'pending', position: 1 })
  // Depois o plano cai para basic — a fila fica guardada e a UI precisa dizer por quê.
  db.user.findUnique = async () => ({ plan: 'basic', accessExpiresAt: null })

  const list = (await app.inject({ method: 'GET', url: '/api/offer-queues' })).json()
  assert.equal(list[0].blockReason, 'plan_inactive')
})

test('horário de funcionamento: valida formato e persiste/zera os campos', async (t) => {
  const db = fakeDb()
  const app = await appFor('user-h', db)
  t.after(async () => { await app.close() })

  // Toggle ligado sem horários válidos => 400
  const invalid = await app.inject({ method: 'POST', url: '/api/offer-queues', payload: { name: 'Comercial', targetJids: ['g@g.us'], operatingHoursEnabled: true, operatingHoursStart: '7h', operatingHoursEnd: '22:00' } })
  assert.equal(invalid.statusCode, 400)

  // Toggle ligado com HH:mm válido => persiste
  const created = await app.inject({ method: 'POST', url: '/api/offer-queues', payload: { name: 'Comercial', targetJids: ['g@g.us'], operatingHoursEnabled: true, operatingHoursStart: '07:00', operatingHoursEnd: '22:00' } })
  assert.equal(created.statusCode, 200)
  const queue = created.json()
  assert.equal(queue.operatingHoursEnabled, true)
  assert.equal(queue.operatingHoursStart, '07:00')
  assert.equal(queue.operatingHoursEnd, '22:00')

  // Desligar o toggle zera os horários
  const updated = await app.inject({ method: 'PUT', url: `/api/offer-queues/${queue.id}`, payload: { operatingHoursEnabled: false } })
  assert.equal(updated.statusCode, 200)
  assert.equal(updated.json().operatingHoursEnabled, false)
  assert.equal(updated.json().operatingHoursStart, null)
  assert.equal(updated.json().operatingHoursEnd, null)
})
