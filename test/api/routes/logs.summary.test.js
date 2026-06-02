import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../../../src/db.js'
import { logsRoutes } from '../../../src/api/routes/logs.js'

let counter = 0

async function buildApp() {
  const n = ++counter
  const userId = `user-logsum-${n}`
  await db.user.create({
    data: { id: userId, name: `U ${n}`, email: `logsum-${n}@t.local`, passwordHash: 'x' },
  })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(logsRoutes)
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

test('GET /summary agrega contagens por categoria de errorMsg', async (t) => {
  const { app, userId } = await buildApp()
  t.after(async () => {
    await db.messageLog.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
    await app.close()
  })

  await Promise.all([
    // Sucesso com 2 repostas agregadas (dedupHits=2) — contam como 2 dedups.
    seedLog(userId, { status: 'success', dedupHits: 2 }),
    seedLog(userId, { status: 'success' }),
    // Linha fallback de dedup com 1 reposta agregada — conta como 1 + 1 = 2.
    seedLog(userId, { status: 'skipped', errorMsg: 'skip:dedup_recent_link', destGroup: 'skipped', dedupHits: 1 }),
    seedLog(userId, { status: 'skipped', errorMsg: 'skip:blocked_keyword', destGroup: 'skipped' }),
    seedLog(userId, { status: 'skipped', errorMsg: 'skip:title_mismatch', destGroup: 'skipped' }),
    seedLog(userId, { status: 'error', errorMsg: 'timeout:send:120999@newsletter' }),
    seedLog(userId, { status: 'error', errorMsg: 'timeout:incoming' }),
    seedLog(userId, { status: 'error', errorMsg: 'error:queue_full' }),
    seedLog(userId, { status: 'error', errorMsg: 'error:baileys:500' }),
    seedLog(userId, { status: 'queued', errorMsg: null }),
  ])

  const res = await app.inject({ method: 'GET', url: '/summary?period=7d' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)

  assert.equal(body.period, '7d')
  assert.equal(body.counts.success, 2)
  // 2 (dedupHits do sucesso) + 1+1 (linha fallback com dedupHits=1) = 4.
  assert.equal(body.counts.skippedDedup, 4)
  assert.equal(body.counts.skippedConfig, 2)
  assert.equal(body.counts.timeoutTotal, 2)
  assert.equal(body.counts.errorOther, 2)
  assert.equal(body.counts.inFlight, 1)

  // deliveryRate = success / (success + timeout + errorOther) = 2 / (2+2+2) = 0.333...
  assert.ok(body.deliveryRate > 0.33 && body.deliveryRate < 0.34)

  // top sources: mesma source para todos. sent=2 (sucessos), blocked=4
  // (2 dedupHits do sucesso + 1+1 da linha fallback).
  assert.equal(body.topSources.length, 1)
  assert.equal(body.topSources[0].sent, 2)
  assert.equal(body.topSources[0].blocked, 4)
})

test('GET /summary respeita período (today só pega hoje)', async (t) => {
  const { app, userId } = await buildApp()
  t.after(async () => {
    await db.messageLog.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
    await app.close()
  })

  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60_000)
  await seedLog(userId, { status: 'success', sentAt: new Date() })
  await seedLog(userId, { status: 'success', sentAt: tenDaysAgo })

  const today = JSON.parse((await app.inject({ method: 'GET', url: '/summary?period=today' })).body)
  const month = JSON.parse((await app.inject({ method: 'GET', url: '/summary?period=30d' })).body)

  assert.equal(today.counts.success, 1)
  assert.equal(month.counts.success, 2)
})

test('GET /summary aceita período inválido caindo no default 7d', async (t) => {
  const { app, userId } = await buildApp()
  t.after(async () => {
    await db.messageLog.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
    await app.close()
  })

  const res = await app.inject({ method: 'GET', url: '/summary?period=invalid' })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).period, '7d')
})

test('GET /summary com banco vazio devolve zeros e deliveryRate null', async (t) => {
  const { app, userId } = await buildApp()
  t.after(async () => {
    await db.user.deleteMany({ where: { id: userId } })
    await app.close()
  })

  const body = JSON.parse((await app.inject({ method: 'GET', url: '/summary' })).body)
  assert.equal(body.counts.success, 0)
  assert.equal(body.counts.skippedDedup, 0)
  assert.equal(body.deliveryRate, null)
  assert.equal(body.topSources.length, 0)
  assert.equal(body.lastSendAt, null)
})

test('GET / aceita filtro de múltiplos status separados por vírgula', async (t) => {
  const { app, userId } = await buildApp()
  t.after(async () => {
    await db.messageLog.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
    await app.close()
  })

  await Promise.all([
    seedLog(userId, { status: 'queued', messageText: 'fila' }),
    seedLog(userId, { status: 'sending', messageText: 'enviando' }),
    seedLog(userId, { status: 'success', messageText: 'sucesso' }),
  ])

  const res = await app.inject({ method: 'GET', url: '/?status=queued,sending&limit=10' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  const statuses = body.logs.map((log) => log.status).sort()

  assert.equal(body.total, 2)
  assert.deepEqual(statuses, ['queued', 'sending'])
})
