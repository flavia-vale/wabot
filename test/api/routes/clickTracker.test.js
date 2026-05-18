import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../../../src/db.js'
import { clickTrackerRoutes } from '../../../src/api/routes/clickTracker.js'

let counter = 0

async function buildApp() {
  const n = ++counter
  const userId = `user-click-${n}`
  await db.user.create({
    data: { id: userId, name: `U ${n}`, email: `click-${n}@t.local`, passwordHash: 'x' },
  })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(clickTrackerRoutes)
  return { app, userId }
}

test('POST /api/links/shortlink cria link e GET /r/:hash 302 redireciona', async (t) => {
  const { app, userId } = await buildApp()
  t.after(async () => {
    await db.affiliateClick.deleteMany({})
    await db.affiliateLink.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
    await app.close()
  })

  const create = await app.inject({
    method: 'POST', url: '/api/links/shortlink',
    payload: { originalUrl: 'https://example.com/produto?id=42' },
  })
  assert.equal(create.statusCode, 200)
  const { hash } = JSON.parse(create.body)
  assert.ok(hash)

  const redirect = await app.inject({ method: 'GET', url: `/r/${hash}` })
  assert.equal(redirect.statusCode, 302)
  assert.equal(redirect.headers.location, 'https://example.com/produto?id=42')

  // click foi gravado
  const link = await db.affiliateLink.findUnique({ where: { hash } })
  const clicks = await db.affiliateClick.findMany({ where: { linkId: link.id } })
  assert.equal(clicks.length, 1)
})

test('GET /r/:hash com hash inexistente retorna 404', async (t) => {
  const { app } = await buildApp()
  t.after(async () => { await app.close() })
  const res = await app.inject({ method: 'GET', url: '/r/notexist' })
  assert.equal(res.statusCode, 404)
})

test('POST /api/links/shortlink valida ownership do groupId', async (t) => {
  const { app, userId } = await buildApp()
  // grupo de OUTRO user
  const otherUser = await db.user.create({
    data: { id: `other-${userId}`, name: 'Other', email: `other-${userId}@t.local`, passwordHash: 'x' },
  })
  const otherGroup = await db.group.create({
    data: { userId: otherUser.id, waJid: 'foreign@newsletter', name: 'F', role: 'post', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => {
    await db.group.deleteMany({ where: { userId: otherUser.id } })
    await db.user.deleteMany({ where: { id: { in: [userId, otherUser.id] } } })
    await app.close()
  })
  const res = await app.inject({
    method: 'POST', url: '/api/links/shortlink',
    payload: { originalUrl: 'https://ex.com', groupId: otherGroup.id },
  })
  assert.equal(res.statusCode, 404)
})

test('GET /api/groups/:id/clicks agrega clicks do canal', async (t) => {
  const { app, userId } = await buildApp()
  const group = await db.group.create({
    data: { userId, waJid: 'ck@newsletter', name: 'CK', role: 'post', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  // criar 2 links no group e 1 noutro, registrar clicks
  const link1 = await db.affiliateLink.create({
    data: { userId, hash: 'aaa11111', originalUrl: 'https://a.com', groupId: group.id },
  })
  const link2 = await db.affiliateLink.create({
    data: { userId, hash: 'bbb22222', originalUrl: 'https://b.com', groupId: group.id },
  })
  await db.affiliateClick.createMany({
    data: [
      { linkId: link1.id, ipHash: 'h1' },
      { linkId: link1.id, ipHash: 'h2' },
      { linkId: link2.id, ipHash: 'h3' },
    ],
  })

  t.after(async () => {
    await db.affiliateClick.deleteMany({ where: { linkId: { in: [link1.id, link2.id] } } })
    await db.affiliateLink.deleteMany({ where: { userId } })
    await db.group.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
    await app.close()
  })

  const res = await app.inject({ method: 'GET', url: `/api/groups/${group.id}/clicks?days=7` })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.total, 3)
  assert.equal(body.days, 7)
})
