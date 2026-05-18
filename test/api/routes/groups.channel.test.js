import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../../../src/db.js'
import { groupsRoutes } from '../../../src/api/routes/groups.js'

let userCounter = 0

async function buildApp(deps = {}, { withUser = false } = {}) {
  const n = ++userCounter
  const userId = `user-test-${n}`
  if (withUser) {
    await db.user.create({
      data: {
        id: userId,
        name: `Test User ${n}`,
        email: `test-user-${n}@channel-test.local`,
        passwordHash: 'x',
      },
    })
  }
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(groupsRoutes, {
    prefix: '/api/groups',
    channelMetadata: deps.channelMetadata ?? (async () => null),
    followChannelImmediate: deps.followChannelImmediate ?? (async () => ({ followed: 'new' })),
    listFollowedChannels: deps.listFollowedChannels ?? (async () => []),
    isRunning: deps.isRunning ?? (() => true),
  })
  return { app, userId }
}

// ---------- POST /resolve-channel-invite ----------

test('POST /resolve-channel-invite com URL válida retorna metadata', async () => {
  const { app } = await buildApp({
    channelMetadata: async (_uid, { inviteCode }) => {
      assert.equal(inviteCode, '0029Va123')
      return { jid: 'abc@newsletter', name: 'Canal X', owner: 'me@s.whatsapp.net', isViewerOwner: true, picture: null }
    },
  })
  const res = await app.inject({ method: 'POST', url: '/api/groups/resolve-channel-invite', payload: { url: 'https://whatsapp.com/channel/0029Va123' } })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).jid, 'abc@newsletter')
  await app.close()
})

test('POST /resolve-channel-invite com URL inválida retorna 400', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'POST', url: '/api/groups/resolve-channel-invite', payload: { url: 'https://example.com/foo' } })
  assert.equal(res.statusCode, 400)
  await app.close()
})

test('POST /resolve-channel-invite com worker offline retorna 503', async () => {
  const { app } = await buildApp({ isRunning: () => false })
  const res = await app.inject({ method: 'POST', url: '/api/groups/resolve-channel-invite', payload: { url: 'https://whatsapp.com/channel/0029Va123' } })
  assert.equal(res.statusCode, 503)
  await app.close()
})

test('POST /resolve-channel-invite quando canal não existe retorna 404', async () => {
  const { app } = await buildApp({ channelMetadata: async () => null })
  const res = await app.inject({ method: 'POST', url: '/api/groups/resolve-channel-invite', payload: { url: 'https://whatsapp.com/channel/0029Va999' } })
  assert.equal(res.statusCode, 404)
  await app.close()
})

// ---------- POST /resolve-channel-jid ----------

test('POST /resolve-channel-jid retorna metadata por jid', async () => {
  const { app } = await buildApp({
    channelMetadata: async (_uid, { jid }) => ({ jid, name: 'X', owner: 'o', isViewerOwner: false, picture: null }),
  })
  const res = await app.inject({ method: 'POST', url: '/api/groups/resolve-channel-jid', payload: { jid: 'abc@newsletter' } })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).jid, 'abc@newsletter')
  await app.close()
})

test('POST /resolve-channel-jid rejeita jid não-@newsletter', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'POST', url: '/api/groups/resolve-channel-jid', payload: { jid: 'abc@g.us' } })
  assert.equal(res.statusCode, 400)
  await app.close()
})

// ---------- POST /:id/follow-now ----------

test('POST /:id/follow-now segue canal-monitor e retorna status', async (t) => {
  const { app, userId } = await buildApp({
    followChannelImmediate: async (_uid, jid) => {
      assert.equal(jid, 'a@newsletter')
      return { followed: 'new', duration: 86400 }
    },
  }, { withUser: true })
  const group = await db.group.create({
    data: { userId, waJid: 'a@newsletter', name: 'Canal A', role: 'monitor', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }); await db.user.deleteMany({ where: { id: userId } }); await app.close() })
  const res = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/follow-now` })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).followed, 'new')
})

test('POST /:id/follow-now para grupo (não canal) retorna 400', async (t) => {
  const { app, userId } = await buildApp({}, { withUser: true })
  const group = await db.group.create({
    data: { userId, waJid: 'a@g.us', name: 'Grupo A', role: 'monitor', kind: 'group', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }); await db.user.deleteMany({ where: { id: userId } }); await app.close() })
  const res = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/follow-now` })
  assert.equal(res.statusCode, 400)
})

test('POST /:id/follow-now com group inexistente retorna 404', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'POST', url: '/api/groups/nonexistent-id/follow-now' })
  assert.equal(res.statusCode, 404)
  await app.close()
})

test('GET /:id/health retorna defaults verdes quando não há registro', async (t) => {
  const { app, userId } = await buildApp({}, { withUser: true })
  const group = await db.group.create({
    data: { userId, waJid: 'h@newsletter', name: 'Canal H', role: 'post', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => {
    await db.channelHealth.deleteMany({ where: { groupId: group.id } })
    await db.group.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
    await app.close()
  })
  const res = await app.inject({ method: 'GET', url: `/api/groups/${group.id}/health` })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.status, 'green')
  assert.equal(body.consecutiveFailures, 0)
})

test('GET /:id/health reflete registro existente em red com pausedUntil', async (t) => {
  const { app, userId } = await buildApp({}, { withUser: true })
  const group = await db.group.create({
    data: { userId, waJid: 'h2@newsletter', name: 'Canal H2', role: 'post', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  const future = new Date(Date.now() + 60 * 60 * 1000)
  await db.channelHealth.create({
    data: { groupId: group.id, status: 'red', consecutiveFailures: 3, pausedUntil: future, lastError: '403' },
  })
  t.after(async () => {
    await db.channelHealth.deleteMany({ where: { groupId: group.id } })
    await db.group.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
    await app.close()
  })
  const res = await app.inject({ method: 'GET', url: `/api/groups/${group.id}/health` })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.status, 'red')
  assert.equal(body.consecutiveFailures, 3)
  assert.equal(body.lastError, '403')
})

test('POST /lint detecta título de impersonação e claim em copy', async (t) => {
  const { app } = await buildApp()
  t.after(async () => { await app.close() })
  const res = await app.inject({
    method: 'POST', url: '/api/groups/lint',
    payload: { title: 'Amazon Brasil', template: 'oferta 80% off agora' },
  })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  const codes = body.warnings.map(w => w.code)
  assert.ok(codes.includes('brand_impersonation'))
  assert.ok(codes.includes('misleading_claim'))
})

test('POST /lint sem inputs problemáticos retorna sem warnings', async (t) => {
  const { app } = await buildApp()
  t.after(async () => { await app.close() })
  const res = await app.inject({
    method: 'POST', url: '/api/groups/lint',
    payload: { title: 'Ofertas Tech BR', template: 'Confira em https://ex.com' },
  })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body).warnings, [])
})

test('GET /:id/snapshots retorna lista ordenada do mais recente', async (t) => {
  const { app, userId } = await buildApp({}, { withUser: true })
  const group = await db.group.create({
    data: { userId, waJid: 's@newsletter', name: 'Canal S', role: 'post', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  await db.channelSnapshot.create({ data: { groupId: group.id, name: 'old', snapshotJson: '{}', snapshotedAt: new Date('2026-01-01') } })
  await db.channelSnapshot.create({ data: { groupId: group.id, name: 'new', snapshotJson: '{}', snapshotedAt: new Date('2026-05-01') } })
  t.after(async () => {
    await db.channelSnapshot.deleteMany({ where: { groupId: group.id } })
    await db.group.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
    await app.close()
  })
  const res = await app.inject({ method: 'GET', url: `/api/groups/${group.id}/snapshots` })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.length, 2)
  assert.equal(body[0].name, 'new')
})

test('POST /:id/snapshot-now grava snapshot via metadata', async (t) => {
  const { app, userId } = await buildApp({
    channelMetadata: async (_uid, { jid }) => ({ jid, name: 'Capturado', description: 'd' }),
  }, { withUser: true })
  const group = await db.group.create({
    data: { userId, waJid: 'sn@newsletter', name: 'X', role: 'post', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => {
    await db.channelSnapshot.deleteMany({ where: { groupId: group.id } })
    await db.group.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
    await app.close()
  })
  const res = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/snapshot-now` })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.name, 'Capturado')
  const stored = await db.channelSnapshot.findMany({ where: { groupId: group.id } })
  assert.equal(stored.length, 1)
})

test('POST /:id/recreate troca waJid após validar ownership', async (t) => {
  const { app, userId } = await buildApp({
    channelMetadata: async (_uid, { jid }) => ({ jid, name: 'Canal Novo', owner: 'me', isViewerOwner: true }),
  }, { withUser: true })
  const group = await db.group.create({
    data: { userId, waJid: 'old@newsletter', name: 'Canal Velho', role: 'post', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => {
    await db.channelHealth.deleteMany({ where: { groupId: group.id } }).catch(() => {})
    await db.channelThrottle.deleteMany({ where: { groupId: group.id } }).catch(() => {})
    await db.group.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
    await app.close()
  })
  const res = await app.inject({
    method: 'POST', url: `/api/groups/${group.id}/recreate`,
    payload: { newJid: 'new@newsletter' },
  })
  assert.equal(res.statusCode, 200)
  const updated = await db.group.findFirst({ where: { id: group.id } })
  assert.equal(updated.waJid, 'new@newsletter')
  assert.equal(updated.name, 'Canal Novo')
})

test('POST /:id/recreate rejeita 403 quando não é admin do novo canal', async (t) => {
  const { app, userId } = await buildApp({
    channelMetadata: async (_uid, { jid }) => ({ jid, name: 'X', owner: 'someone-else', isViewerOwner: false }),
  }, { withUser: true })
  const group = await db.group.create({
    data: { userId, waJid: 'old2@newsletter', name: 'V', role: 'post', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }); await db.user.deleteMany({ where: { id: userId } }); await app.close() })
  const res = await app.inject({
    method: 'POST', url: `/api/groups/${group.id}/recreate`,
    payload: { newJid: 'new2@newsletter' },
  })
  assert.equal(res.statusCode, 403)
})

test('POST /:id/recreate rejeita 400 quando newJid não termina em @newsletter', async (t) => {
  const { app, userId } = await buildApp({}, { withUser: true })
  const group = await db.group.create({
    data: { userId, waJid: 'old3@newsletter', name: 'V', role: 'post', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }); await db.user.deleteMany({ where: { id: userId } }); await app.close() })
  const res = await app.inject({
    method: 'POST', url: `/api/groups/${group.id}/recreate`,
    payload: { newJid: 'something@g.us' },
  })
  assert.equal(res.statusCode, 400)
})

test('GET /:id/health para grupo (não canal) retorna 400', async (t) => {
  const { app, userId } = await buildApp({}, { withUser: true })
  const group = await db.group.create({
    data: { userId, waJid: 'g@g.us', name: 'Grupo G', role: 'post', kind: 'group', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }); await db.user.deleteMany({ where: { id: userId } }); await app.close() })
  const res = await app.inject({ method: 'GET', url: `/api/groups/${group.id}/health` })
  assert.equal(res.statusCode, 400)
})

test('POST /:id/follow-now retorna 429 quando guard nega (warmup cap atingido)', async (t) => {
  let invoked = 0
  const { app, userId } = await buildApp({
    followChannelImmediate: async () => { invoked++; return { followed: 'new' } },
  }, { withUser: true })
  const group = await db.group.create({
    data: { userId, waJid: 'a@newsletter', name: 'Canal A', role: 'monitor', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  // Conta nova (createdAt = now) → warmup cap = 1. Pré-gravar 1 follow OK
  // consome o cap; próxima tentativa deve bater no daily_cap.
  await db.followLog.create({ data: { userId, channelJid: 'x@newsletter', status: 'ok' } })

  t.after(async () => {
    await db.followLog.deleteMany({ where: { userId } })
    await db.group.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
    await app.close()
  })

  const res = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/follow-now` })
  assert.equal(res.statusCode, 429)
  assert.equal(invoked, 0, 'guard deve impedir chamada ao follow real')
  const body = JSON.parse(res.body)
  assert.equal(body.reason, 'daily_cap')
  assert.equal(body.dailyCap, 1)
  assert.ok(res.headers['retry-after'])
})

// ---------- POST /:id/refresh-admin ----------

test('POST /:id/refresh-admin retorna isViewerOwner atualizado', async (t) => {
  const { app, userId } = await buildApp({
    channelMetadata: async (_uid, { jid }) => ({ jid, name: 'Canal B', owner: 'me@s.whatsapp.net', isViewerOwner: true, picture: null }),
  }, { withUser: true })
  const group = await db.group.create({
    data: { userId, waJid: 'b@newsletter', name: 'Canal B', role: 'post', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }); await db.user.deleteMany({ where: { id: userId } }); await app.close() })
  const res = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/refresh-admin` })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).isViewerOwner, true)
})

test('POST /:id/refresh-admin para grupo (não canal) retorna 400', async (t) => {
  const { app, userId } = await buildApp({}, { withUser: true })
  const group = await db.group.create({
    data: { userId, waJid: 'b@g.us', name: 'Grupo B', role: 'post', kind: 'group', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }); await db.user.deleteMany({ where: { id: userId } }); await app.close() })
  const res = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/refresh-admin` })
  assert.equal(res.statusCode, 400)
})

// ---------- GET /wa/channels ----------

test('GET /wa/channels retorna lista de canais seguidos', async () => {
  const { app } = await buildApp({
    listFollowedChannels: async () => [
      { jid: 'a@newsletter', name: 'Canal A', owner: 'me@s.whatsapp.net', isViewerOwner: true, picture: null },
      { jid: 'b@newsletter', name: 'Canal B', owner: 'other@s.whatsapp.net', isViewerOwner: false, picture: null },
    ],
  })
  const res = await app.inject({ method: 'GET', url: '/api/groups/wa/channels' })
  assert.equal(res.statusCode, 200)
  const list = JSON.parse(res.body)
  assert.equal(list.length, 2)
  assert.equal(list[0].jid, 'a@newsletter')
  await app.close()
})

test('GET /wa/channels com worker offline retorna 503', async () => {
  const { app } = await buildApp({ isRunning: () => false })
  const res = await app.inject({ method: 'GET', url: '/api/groups/wa/channels' })
  assert.equal(res.statusCode, 503)
  await app.close()
})
