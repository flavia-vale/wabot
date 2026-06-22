import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../../../src/db.js'
import { groupsRoutes } from '../../../src/api/routes/groups.js'

let userCounter = 0

async function buildApp(deps = {}, { plan = 'pro', accessExpiresAt = null } = {}) {
  const n = ++userCounter
  const userId = `user-test-${n}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({
    data: {
      id: userId,
      name: `Test User ${n}`,
      email: `test-user-${n}-${Date.now()}@channel-test.local`,
      passwordHash: 'x',
      plan,
      accessExpiresAt,
    },
  })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  app.addHook('onClose', async () => {
    await db.groupTarget.deleteMany({ where: { userId } })
    await db.group.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
  })
  await app.register(groupsRoutes, {
    prefix: '/api/groups',
    channelMetadata: deps.channelMetadata ?? (async () => null),
    followChannelImmediate: deps.followChannelImmediate ?? (async () => ({ followed: 'new' })),
    listFollowedChannels: deps.listFollowedChannels ?? (async () => []),
    isRunning: deps.isRunning ?? (() => true),
  })
  return { app, userId }
}


// ---------- plan gates ----------

test('POST / cria grupo para Basic, mas bloqueia canal', async () => {
  const { app } = await buildApp({}, { plan: 'basic' })
  const groupRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: '123@g.us', name: 'Grupo Basic', role: 'monitor', kind: 'group' } })
  assert.equal(groupRes.statusCode, 200)

  const channelRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'abc@newsletter', name: 'Canal Basic', role: 'monitor', kind: 'channel' } })
  assert.equal(channelRes.statusCode, 403)
  assert.deepEqual(JSON.parse(channelRes.body), {
    error: 'Canais estão disponíveis no Trial ativo e no plano Pro.',
    code: 'FEATURE_REQUIRES_PRO',
    feature: 'channels',
    requiredPlan: 'pro',
  })
  await app.close()
})

test('POST / cria canal para trial ativo', async () => {
  const { app } = await buildApp({}, { plan: 'trial', accessExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })
  const res = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'trial@newsletter', name: 'Canal Trial', role: 'monitor', kind: 'channel' } })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).kind, 'channel')
  await app.close()
})

test('POST /resolve-channel-invite bloqueia Basic antes de consultar WhatsApp', async () => {
  let called = false
  const { app } = await buildApp({ channelMetadata: async () => { called = true; return { jid: 'abc@newsletter' } } }, { plan: 'basic' })
  const res = await app.inject({ method: 'POST', url: '/api/groups/resolve-channel-invite', payload: { url: 'https://whatsapp.com/channel/0029Va123' } })
  assert.equal(res.statusCode, 403)
  assert.equal(called, false)
  await app.close()
})

test('POST /resolve-channel-jid bloqueia Basic antes de consultar WhatsApp', async () => {
  let called = false
  const { app } = await buildApp({ channelMetadata: async () => { called = true; return { jid: 'abc@newsletter' } } }, { plan: 'basic' })
  const res = await app.inject({ method: 'POST', url: '/api/groups/resolve-channel-jid', payload: { jid: 'abc@newsletter' } })
  assert.equal(res.statusCode, 403)
  assert.equal(called, false)
  await app.close()
})

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

// ---------- PUT /:id/targets ----------

test('PUT /:id/targets bloqueia destino canal para Basic sem apagar registros', async (t) => {
  const { app, userId } = await buildApp({}, { plan: 'basic' })
  const monitor = await db.group.create({
    data: { userId, waJid: 'monitor-basic@g.us', name: 'Monitor Basic', role: 'monitor', kind: 'group', forwardMode: 'LINK_ONLY' },
  })
  const channelPost = await db.group.create({
    data: { userId, waJid: 'post-basic@newsletter', name: 'Destino Canal', role: 'post', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await app.close() })

  const res = await app.inject({ method: 'PUT', url: `/api/groups/${monitor.id}/targets`, payload: { postIds: [channelPost.id] } })
  assert.equal(res.statusCode, 403)
  assert.equal(await db.group.count({ where: { id: channelPost.id } }), 1)
})

// ---------- POST /:id/follow-now ----------

test('POST /:id/follow-now segue canal-monitor e retorna status', async (t) => {
  const { app, userId } = await buildApp({
    followChannelImmediate: async (_uid, jid) => {
      assert.equal(jid, 'a@newsletter')
      return { followed: 'new', duration: 86400 }
    },
  })
  const group = await db.group.create({
    data: { userId, waJid: 'a@newsletter', name: 'Canal A', role: 'monitor', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }); await db.user.deleteMany({ where: { id: userId } }); await app.close() })
  const res = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/follow-now` })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).followed, 'new')
})

test('POST /:id/follow-now para grupo (não canal) retorna 400', async (t) => {
  const { app, userId } = await buildApp({})
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

test('POST /:id/probe-ping atualiza lastProbeSeenAt', async (t) => {
  const { app, userId } = await buildApp({}, { withUser: true })
  const group = await db.group.create({
    data: { userId, waJid: 'p@newsletter', name: 'P', role: 'post', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => {
    await db.channelHealth.deleteMany({ where: { groupId: group.id } }).catch(() => {})
    await db.group.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
    await app.close()
  })
  const res = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/probe-ping` })
  assert.equal(res.statusCode, 200)
  const health = await db.channelHealth.findUnique({ where: { groupId: group.id } })
  assert.ok(health?.lastProbeSeenAt)
})

test('POST /:id/probe-ping para grupo (não canal) retorna 400', async (t) => {
  const { app, userId } = await buildApp({}, { withUser: true })
  const group = await db.group.create({
    data: { userId, waJid: 'p@g.us', name: 'G', role: 'post', kind: 'group', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }); await db.user.deleteMany({ where: { id: userId } }); await app.close() })
  const res = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/probe-ping` })
  assert.equal(res.statusCode, 400)
})

test('POST /:id/risk-score/recompute calcula e persiste score', async (t) => {
  const { app, userId } = await buildApp({}, { withUser: true })
  const group = await db.group.create({
    data: { userId, waJid: 'r@newsletter', name: 'R', role: 'post', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  // 10 posts no canal nos últimos minutos, 50 followers, 1 fonte → score alto
  for (let i = 0; i < 10; i++) {
    await db.messageLog.create({
      data: {
        userId,
        platform: 'amazon',
        sourceGroup: 'src@g.us',
        destGroup: 'r@newsletter',
        originalUrl: 'https://ex.com',
        convertedUrl: 'https://ex.com',
        messageText: 'x',
        status: 'success',
      },
    })
  }
  await db.channelSnapshot.create({
    data: { groupId: group.id, name: 'R', snapshotJson: JSON.stringify({ subscribersCount: 50 }) },
  })
  t.after(async () => {
    await db.channelHealth.deleteMany({ where: { groupId: group.id } }).catch(() => {})
    await db.channelSnapshot.deleteMany({ where: { groupId: group.id } }).catch(() => {})
    await db.messageLog.deleteMany({ where: { userId } }).catch(() => {})
    await db.group.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
    await app.close()
  })
  const res = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/risk-score/recompute?days=1` })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok(body.score >= 80, `score=${body.score}`)
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
  await db.botConfig.create({ data: { userId, followGuardEnabled: true } })

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


test('POST /:id/follow-now mantém proteção padrão mesmo com follow-guard desligado', async (t) => {
  let invoked = 0
  const { app, userId } = await buildApp({
    followChannelImmediate: async () => { invoked++; return { followed: 'new' } },
  }, { withUser: true })
  const group = await db.group.create({
    data: { userId, waJid: 'guard-off@newsletter', name: 'Canal sem guard', role: 'monitor', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  // Conta nova (createdAt = now) → warmup cap = 1, mesmo com o toggle off:
  // o guard anti-ban nunca desliga, só o limite personalizado deixa de valer.
  await db.followLog.create({ data: { userId, channelJid: 'x@newsletter', status: 'ok' } })
  await db.botConfig.create({ data: { userId, followGuardEnabled: false, maxDailyFollows: 50 } })

  t.after(async () => {
    await db.followLog.deleteMany({ where: { userId } })
    await db.group.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
    await app.close()
  })

  const res = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/follow-now` })
  assert.equal(res.statusCode, 429)
  assert.equal(invoked, 0, 'guard padrão deve impedir o follow mesmo com o toggle desligado')
})


// ---------- POST /:id/refresh-admin ----------

test('POST /:id/refresh-admin retorna isViewerOwner atualizado', async (t) => {
  const { app, userId } = await buildApp({
    channelMetadata: async (_uid, { jid }) => ({ jid, name: 'Canal B', owner: 'me@s.whatsapp.net', isViewerOwner: true, picture: null }),
  })
  const group = await db.group.create({
    data: { userId, waJid: 'b@newsletter', name: 'Canal B', role: 'post', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }); await db.user.deleteMany({ where: { id: userId } }); await app.close() })
  const res = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/refresh-admin` })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).isViewerOwner, true)
})

test('POST /:id/refresh-admin para grupo (não canal) retorna 400', async (t) => {
  const { app, userId } = await buildApp({})
  const group = await db.group.create({
    data: { userId, waJid: 'b@g.us', name: 'Grupo B', role: 'post', kind: 'group', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }); await db.user.deleteMany({ where: { id: userId } }); await app.close() })
  const res = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/refresh-admin` })
  assert.equal(res.statusCode, 400)
})

test('POST /:id/follow-now bloqueia canal para Basic', async (t) => {
  const { app, userId } = await buildApp({}, { plan: 'basic' })
  const group = await db.group.create({
    data: { userId, waJid: 'blocked@newsletter', name: 'Canal bloqueado', role: 'monitor', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await app.close() })
  const res = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/follow-now` })
  assert.equal(res.statusCode, 403)
})

test('POST /:id/refresh-admin bloqueia canal para Basic', async (t) => {
  const { app, userId } = await buildApp({}, { plan: 'basic' })
  const group = await db.group.create({
    data: { userId, waJid: 'blocked-refresh@newsletter', name: 'Canal bloqueado', role: 'post', kind: 'channel', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await app.close() })
  const res = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/refresh-admin` })
  assert.equal(res.statusCode, 403)
})

// ---------- GET /wa/channels ----------

test('GET /wa/channels bloqueia Basic', async () => {
  const { app } = await buildApp({}, { plan: 'basic' })
  const res = await app.inject({ method: 'GET', url: '/api/groups/wa/channels' })
  assert.equal(res.statusCode, 403)
  await app.close()
})

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


test('PUT /:id bloqueia forwardMode=ALLOW_NO_LINK para Basic (Preservação Avançada)', async (t) => {
  const { app, userId } = await buildApp({}, { plan: 'basic' })
  const group = await db.group.create({
    data: { userId, waJid: 'pres-basic@g.us', name: 'Grupo Basic Pres', role: 'monitor', kind: 'group', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }); await db.user.deleteMany({ where: { id: userId } }); await app.close() })

  const res = await app.inject({
    method: 'PUT',
    url: `/api/groups/${group.id}`,
    payload: { forwardMode: 'ALLOW_NO_LINK', noLinkScope: 'ALL' },
  })

  assert.equal(res.statusCode, 403)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'FEATURE_REQUIRES_PRO')
  assert.equal(body.feature, 'advanced_preservation')
})

test('PUT /:id permite forwardMode=ALLOW_NO_LINK para Pro', async (t) => {
  const { app, userId } = await buildApp({}, { plan: 'pro' })
  const group = await db.group.create({
    data: { userId, waJid: 'pres-pro@g.us', name: 'Grupo Pro Pres', role: 'monitor', kind: 'group', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }); await db.user.deleteMany({ where: { id: userId } }); await app.close() })

  const res = await app.inject({
    method: 'PUT',
    url: `/api/groups/${group.id}`,
    payload: { forwardMode: 'ALLOW_NO_LINK', noLinkScope: 'ALL' },
  })

  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.forwardMode, 'ALLOW_NO_LINK')
  assert.equal(body.noLinkScope, 'ALL')
})

test('PUT /:id salva janela silenciosa do grupo de destino', async (t) => {
  const { app, userId } = await buildApp({}, { plan: 'pro' })
  const group = await db.group.create({
    data: { userId, waJid: 'quiet-dest@g.us', name: 'Destino Quiet', role: 'post', kind: 'group', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }); await db.user.deleteMany({ where: { id: userId } }); await app.close() })

  const res = await app.inject({
    method: 'PUT',
    url: `/api/groups/${group.id}`,
    payload: { quietHoursEnabled: true, quietHoursJson: JSON.stringify({ startHour: 22, endHour: 8, tz: 'America/Sao_Paulo' }) },
  })

  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.quietHoursEnabled, true)
  assert.deepEqual(JSON.parse(body.quietHoursJson), { startHour: 22, endHour: 8, tz: 'America/Sao_Paulo' })
})

test('PUT /:id rejeita janela silenciosa em grupo monitor', async (t) => {
  const { app, userId } = await buildApp({}, { plan: 'pro' })
  const group = await db.group.create({
    data: { userId, waJid: 'quiet-mon@g.us', name: 'Monitor Quiet', role: 'monitor', kind: 'group', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }); await db.user.deleteMany({ where: { id: userId } }); await app.close() })

  const res = await app.inject({
    method: 'PUT',
    url: `/api/groups/${group.id}`,
    payload: { quietHoursEnabled: true },
  })

  assert.equal(res.statusCode, 400)
})

test('PUT /:id rejeita quietHoursJson com hora inválida', async (t) => {
  const { app, userId } = await buildApp({}, { plan: 'pro' })
  const group = await db.group.create({
    data: { userId, waJid: 'quiet-bad@g.us', name: 'Destino Bad', role: 'post', kind: 'group', forwardMode: 'LINK_ONLY' },
  })
  t.after(async () => { await db.group.deleteMany({ where: { userId } }); await db.user.deleteMany({ where: { id: userId } }); await app.close() })

  const res = await app.inject({
    method: 'PUT',
    url: `/api/groups/${group.id}`,
    payload: { quietHoursJson: JSON.stringify({ startHour: 99, endHour: 8 }) },
  })

  assert.equal(res.statusCode, 400)
})
