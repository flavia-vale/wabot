import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import { groupsRoutes } from '../src/api/routes/groups.js'

// A estratégia de imagem agora pertence ao destino; novos registros começam
// em original para preservar o comportamento corrente.

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

test('POST / cria grupo role=monitor com valor dormente original', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'monitor-preview@g.us', name: 'Grupo Monitor', role: 'monitor', kind: 'group' } })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).imageMode, 'original')
  await app.close()
})

test('POST / cria destino no modo original', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-preview@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).imageMode, 'original')
  await app.close()
})

test('PUT /:id aceita modo e texto de marca apenas no destino', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-watermark@g.us', name: 'Destino Marca', role: 'post', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)
  const putRes = await app.inject({
    method: 'PUT', url: `/api/groups/${id}`,
    payload: { imageMode: 'original_watermark', watermarkText: 'Achadinhos da Maria' },
  })
  assert.equal(putRes.statusCode, 200)
  assert.equal(JSON.parse(putRes.body).imageMode, 'original_watermark')
  assert.equal(JSON.parse(putRes.body).watermarkText, 'Achadinhos da Maria')
  await app.close()
})

test('PUT /:id rejeita marca sem texto e preview com marca ainda indisponível', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-invalid-watermark@g.us', name: 'Destino', role: 'post', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)
  const empty = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode: 'original_watermark' } })
  const future = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode: 'preview_watermark', watermarkText: 'Marca' } })
  assert.equal(empty.statusCode, 400)
  assert.equal(future.statusCode, 400)
  await app.close()
})

// specs/012-shein-store-support (T020/T025): 'shein' entrou na whitelist de
// allowedPlatforms — PUT /:id não pode mais recusá-la como "plataforma
// inválida".
test('PUT /:id aceita shein na whitelist de allowedPlatforms', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'monitor-shein@g.us', name: 'Grupo Monitor Shein', role: 'monitor', kind: 'group' } })
  assert.equal(createRes.statusCode, 200)
  const { id } = JSON.parse(createRes.body)

  const putRes = await app.inject({
    method: 'PUT',
    url: `/api/groups/${id}`,
    payload: { allowedPlatforms: 'shopee,amazon,mercadolivre,magazineluiza,shein' },
  })
  assert.equal(putRes.statusCode, 200)
  assert.equal(JSON.parse(putRes.body).allowedPlatforms, 'shopee,amazon,mercadolivre,magazineluiza,shein')
  await app.close()
})

test('PUT /:id ainda recusa plataforma realmente inválida', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'monitor-invalid@g.us', name: 'Grupo Monitor Inválido', role: 'monitor', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  const putRes = await app.inject({
    method: 'PUT',
    url: `/api/groups/${id}`,
    payload: { allowedPlatforms: 'shein,naoexiste' },
  })
  assert.equal(putRes.statusCode, 400)
  await app.close()
})
