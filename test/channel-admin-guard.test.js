import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import { groupsRoutes } from '../src/api/routes/groups.js'

let counter = 0

async function buildApp({ metadata, running = true }) {
  const suffix = `${Date.now()}-${++counter}`
  const userId = `channel-admin-${suffix}`
  await db.user.create({ data: { id: userId, name: 'Teste canal admin', email: `channel-admin-${suffix}@test.local`, passwordHash: 'x', plan: 'pro' } })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  app.addHook('onClose', async () => {
    await db.group.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
  })
  await app.register(groupsRoutes, {
    prefix: '/api/groups',
    channelMetadata: async (_userId, { jid }) => ({ jid, name: 'Canal teste', isViewerAdmin: metadata }),
    isRunning: () => running,
    reloadConfig: async () => true,
    followChannelImmediate: async () => ({ followed: 'new' }),
    listFollowedChannels: async () => [],
  })
  return { app, userId }
}

test('impede cadastrar canal de destino quando o número conectado não é admin', async () => {
  const { app, userId } = await buildApp({ metadata: false })
  const response = await app.inject({
    method: 'POST',
    url: '/api/groups',
    payload: { waJid: '120363000000000001@newsletter', name: 'Canal sem permissão', role: 'post', kind: 'channel' },
  })
  assert.equal(response.statusCode, 409)
  assert.equal(response.json().code, 'CHANNEL_ADMIN_REQUIRED')
  assert.equal(await db.group.count({ where: { userId } }), 0)
  await app.close()
})

test('permite cadastrar canal de destino quando o WhatsApp confirma a administração', async () => {
  const { app } = await buildApp({ metadata: true })
  const response = await app.inject({
    method: 'POST',
    url: '/api/groups',
    payload: { waJid: '120363000000000002@newsletter', name: 'Canal autorizado', role: 'post', kind: 'channel' },
  })
  assert.equal(response.statusCode, 200)
  assert.equal(response.json().waJid, '120363000000000002@newsletter')
  await app.close()
})

test('revalidação informa canal antigo que perdeu a administração', async () => {
  const { app, userId } = await buildApp({ metadata: false })
  const channel = await db.group.create({ data: { userId, waJid: '120363000000000003@newsletter', name: 'Canal antigo', role: 'post', kind: 'channel' } })
  const response = await app.inject({ method: 'GET', url: '/api/groups/post-channel-admin-status' })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    connected: true,
    channels: [{
      id: channel.id,
      waJid: channel.waJid,
      name: channel.name,
      status: 'not-owner',
      isViewerAdmin: false,
      message: 'O número conectado não é administrador deste canal. Torne-o administrador no WhatsApp antes de usar o canal como destino.',
    }],
  })
  await app.close()
})

test('não aceita cadastro sem conseguir validar a sessão conectada', async () => {
  const { app } = await buildApp({ metadata: true, running: false })
  const response = await app.inject({
    method: 'POST',
    url: '/api/groups',
    payload: { waJid: '120363000000000004@newsletter', name: 'Canal offline', role: 'post', kind: 'channel' },
  })
  assert.equal(response.statusCode, 503)
  assert.equal(response.json().channelAdminStatus, 'offline')
  await app.close()
})
