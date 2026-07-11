import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import { groupsRoutes } from '../src/api/routes/groups.js'

// specs/001-image-mode-preview-default (US4, AC-1/AC-2): todo grupo novo
// nasce com imageMode='preview', em qualquer caminho de criação e
// independente do role. Antes o default era 'original' para monitor e
// 'none' para os demais.

let userCounter = 0

async function buildApp() {
  const n = ++userCounter
  const userId = `user-image-mode-${n}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({
    data: {
      id: userId,
      name: `Image Mode Test User ${n}`,
      email: `image-mode-test-${n}-${Date.now()}@groups-route-test.local`,
      passwordHash: 'x',
      plan: 'pro',
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
    channelMetadata: async () => null,
    followChannelImmediate: async () => ({ followed: 'new' }),
    listFollowedChannels: async () => [],
    isRunning: () => true,
  })
  return { app, userId }
}

test('POST / cria grupo role=monitor sem imageMode explícito → persiste imageMode=preview', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'monitor-preview@g.us', name: 'Grupo Monitor', role: 'monitor', kind: 'group' } })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).imageMode, 'preview')
  await app.close()
})

test('POST / cria grupo role=post sem imageMode explícito → também persiste imageMode=preview', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-preview@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).imageMode, 'preview')
  await app.close()
})
