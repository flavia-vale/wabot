import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../../../src/db.js'
import { logsRoutes } from '../../../src/api/routes/logs.js'

let counter = 0

async function buildApp() {
  const n = ++counter
  const userId = `user-logslist-${n}-${Date.now()}`
  await db.user.create({ data: { id: userId, name: `U ${n}`, email: `logslist-${n}-${Date.now()}@t.local`, passwordHash: 'x' } })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(logsRoutes)
  app.addHook('onClose', async () => {
    await db.messageLog.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
  })
  return { app, userId }
}

async function seedLog(userId, overrides = {}) {
  return db.messageLog.create({
    data: {
      userId,
      platform: 'shopee',
      sourceGroup: '120363@g.us',
      destGroup: '120999@newsletter',
      originalUrl: 'https://shopee.example/x',
      convertedUrl: 'https://aff.example/x',
      messageText: 'oferta',
      status: 'success',
      sentAt: new Date(),
      ...overrides,
    },
  })
}

test('GET / retorna statusCounts agregados de todo o histórico', async (t) => {
  const { app, userId } = await buildApp()
  t.after(() => app.close())

  await Promise.all([
    seedLog(userId, { status: 'success' }),
    seedLog(userId, { status: 'success' }),
    seedLog(userId, { status: 'error', errorMsg: 'timeout:send' }),
    seedLog(userId, { status: 'queued' }),
    seedLog(userId, { status: 'sending' }),
    seedLog(userId, { status: 'skipped', errorMsg: 'skip:dedup_recent_link' }),
  ])

  const res = await app.inject({ method: 'GET', url: '/?status=all&page=1&limit=2' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  // Paginação limita a 2 itens, mas as contagens refletem o total real.
  assert.equal(body.logs.length, 2)
  assert.equal(body.statusCountsTotal, 6)
  assert.equal(body.statusCounts.success, 2)
  assert.equal(body.statusCounts.error, 1)
  assert.equal(body.statusCounts.queued, 1)
  assert.equal(body.statusCounts.sending, 1)
  assert.equal(body.statusCounts.skipped, 1)
})

test('GET / aceita lista de status separada por vírgula (queued,sending)', async (t) => {
  const { app, userId } = await buildApp()
  t.after(() => app.close())

  await Promise.all([
    seedLog(userId, { status: 'success' }),
    seedLog(userId, { status: 'queued' }),
    seedLog(userId, { status: 'sending' }),
    seedLog(userId, { status: 'error', errorMsg: 'error:other:x' }),
  ])

  const res = await app.inject({ method: 'GET', url: '/?status=queued,sending&page=1&limit=20' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.total, 2)
  assert.equal(body.logs.length, 2)
  for (const log of body.logs) {
    assert.ok(log.status === 'queued' || log.status === 'sending')
  }
  // statusCounts ignora o filtro de status ativo (só respeita a busca).
  assert.equal(body.statusCountsTotal, 4)
})

test('GET / filtra por status único mantendo contagem global nos chips', async (t) => {
  const { app, userId } = await buildApp()
  t.after(() => app.close())

  await Promise.all([
    seedLog(userId, { status: 'success' }),
    seedLog(userId, { status: 'error', errorMsg: 'error:other:y' }),
    seedLog(userId, { status: 'error', errorMsg: 'timeout:send' }),
  ])

  const res = await app.inject({ method: 'GET', url: '/?status=error&page=1&limit=20' })
  const body = JSON.parse(res.body)
  assert.equal(body.total, 2)
  assert.equal(body.logs.every((l) => l.status === 'error'), true)
  assert.equal(body.statusCounts.error, 2)
  assert.equal(body.statusCounts.success, 1)
})
