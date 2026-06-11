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

async function appFor(userId, db) {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(offerQueueRoutes, { prefix: '/api/offer-queues', db, now: () => new Date('2026-06-10T15:00:00Z') })
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
  const app = await appFor('user-a', db)
  t.after(async () => { await app.close() })
  const queue = (await app.inject({ method: 'POST', url: '/api/offer-queues', payload: { name: 'Com grupos', targetJids: ['111@g.us', '222@g.us'] } })).json()

  const inherited = await app.inject({ method: 'POST', url: `/api/offer-queues/${queue.id}/items`, payload: { text: 'Oferta da fila' } })
  assert.equal(inherited.statusCode, 200)
  assert.deepEqual(JSON.parse(inherited.json().targetJids), ['111@g.us', '222@g.us'])

  const explicit = await app.inject({ method: 'POST', url: `/api/offer-queues/${queue.id}/items`, payload: { text: 'Oferta avulsa', jids: ['333@g.us'] } })
  assert.deepEqual(JSON.parse(explicit.json().targetJids), ['333@g.us'])
})
