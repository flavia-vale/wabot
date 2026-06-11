import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { broadcastRoutes } from '../../../src/api/routes/broadcast.js'

function createScheduledDb(seed = []) {
  const messages = seed.map((item) => ({
    targetJids: JSON.stringify(['destino@g.us']),
    scheduledAt: new Date('2026-06-12T12:00:00.000Z'),
    ...item,
  }))

  return {
    messages,
    scheduledMessage: {
      async findMany({ where, orderBy }) {
        const statuses = where.status.in
        return messages
          .filter((item) => item.userId === where.userId && statuses.includes(item.status))
          .sort((a, b) => orderBy.scheduledAt === 'asc' ? a.scheduledAt - b.scheduledAt : b.scheduledAt - a.scheduledAt)
      },
      async updateMany({ where, data }) {
        let count = 0
        for (const message of messages) {
          if (message.id === where.id && message.userId === where.userId && message.status === where.status) {
            Object.assign(message, data)
            count += 1
          }
        }
        return { count }
      },
      async findFirst({ where }) {
        const message = messages.find((item) => item.id === where.id && item.userId === where.userId)
        return message ? { status: message.status } : null
      },
      async create() {
        throw new Error('create não esperado neste teste')
      },
    },
  }
}

async function buildApp(seed = []) {
  const userId = 'scheduled-user'
  const db = createScheduledDb(seed)
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(broadcastRoutes, { prefix: '/api/broadcast', db })
  return { app, db, userId }
}

test('GET /scheduled retorna somente pending e queued em ordem cronológica', async (t) => {
  const { app, userId } = await buildApp([
    { id: 'queued', userId: 'scheduled-user', status: 'queued', scheduledAt: new Date('2026-06-12T12:20:00.000Z') },
    { id: 'pending', userId: 'scheduled-user', status: 'pending', scheduledAt: new Date('2026-06-12T12:10:00.000Z') },
    { id: 'sent', userId: 'scheduled-user', status: 'sent' },
    { id: 'failed', userId: 'scheduled-user', status: 'failed' },
    { id: 'cancelled', userId: 'scheduled-user', status: 'cancelled' },
    { id: 'other-user', userId: 'other-user', status: 'pending' },
  ])
  t.after(() => app.close())
  assert.equal(userId, 'scheduled-user')

  const response = await app.inject({ method: 'GET', url: '/api/broadcast/scheduled' })
  assert.equal(response.statusCode, 200)
  const body = response.json()

  assert.deepEqual(body.map((item) => item.id), ['pending', 'queued'])
  assert.deepEqual(body.map((item) => item.status), ['pending', 'queued'])
  assert.deepEqual(body[0].targetJids, ['destino@g.us'])
})

test('DELETE /scheduled/:id cancela atomicamente somente mensagem pending', async (t) => {
  const { app, db } = await buildApp([{ id: 'pending', userId: 'scheduled-user', status: 'pending' }])
  t.after(() => app.close())

  const response = await app.inject({ method: 'DELETE', url: '/api/broadcast/scheduled/pending' })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), { ok: true })
  assert.equal(db.messages[0].status, 'cancelled')
})

test('DELETE /scheduled/:id devolve 409 quando mensagem já entrou na fila', async (t) => {
  const { app, db } = await buildApp([{ id: 'queued', userId: 'scheduled-user', status: 'queued' }])
  t.after(() => app.close())

  const response = await app.inject({ method: 'DELETE', url: '/api/broadcast/scheduled/queued' })
  assert.equal(response.statusCode, 409)
  assert.equal(response.json().status, 'queued')
  assert.equal(db.messages[0].status, 'queued')
})

test('DELETE /scheduled/:id devolve 404 sem revelar mensagem de outro usuário', async (t) => {
  const { app } = await buildApp([{ id: 'private', userId: 'other-user', status: 'pending' }])
  t.after(() => app.close())

  const response = await app.inject({ method: 'DELETE', url: '/api/broadcast/scheduled/private' })
  assert.equal(response.statusCode, 404)
  assert.equal(response.json().error, 'Mensagem agendada não encontrada')
})
