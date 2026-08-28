import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import { groupsRoutes } from '../src/api/routes/groups.js'

// 2026-08-28: a estratégia de imagem passa a ser escolhida por DESTINO
// (role='post'). Todo grupo novo nasce com imageMode='original' — "a foto
// que veio na oferta", padrão do produto desde 2026-08-21 — independente do
// role (role='monitor' nunca leu este campo, mas mantemos um único valor por
// simplicidade de schema).

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

test('POST / cria grupo role=monitor sem imageMode explícito → persiste imageMode=original', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'monitor-original@g.us', name: 'Grupo Monitor', role: 'monitor', kind: 'group' } })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).imageMode, 'original')
  await app.close()
})

test('POST / cria grupo role=post sem imageMode explícito → também persiste imageMode=original', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-original@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).imageMode, 'original')
  await app.close()
})

test('PUT /:id recusa imageMode/watermarkText em grupo role=monitor (origem)', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'monitor-guard@g.us', name: 'Grupo Monitor', role: 'monitor', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  const putRes = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode: 'preview' } })
  assert.equal(putRes.statusCode, 400)

  const putRes2 = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { watermarkText: 'Minha marca' } })
  assert.equal(putRes2.statusCode, 400)
  await app.close()
})

test('PUT /:id aceita original/original_watermark/preview em grupo role=post (destino)', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-guard@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  for (const imageMode of ['preview', 'original']) {
    const putRes = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode } })
    assert.equal(putRes.statusCode, 200)
    assert.equal(JSON.parse(putRes.body).imageMode, imageMode)
  }

  const withWatermark = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode: 'original_watermark', watermarkText: 'Achadinhos da Maria' } })
  assert.equal(withWatermark.statusCode, 200)
  const body = JSON.parse(withWatermark.body)
  assert.equal(body.imageMode, 'original_watermark')
  assert.equal(body.watermarkText, 'Achadinhos da Maria')
  await app.close()
})

test('PUT /:id recusa preview_watermark (ainda não implementado)', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-preview-watermark@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  const putRes = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode: 'preview_watermark' } })
  assert.equal(putRes.statusCode, 400)
  await app.close()
})

test('PUT /:id recusa original_watermark sem texto de marca', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-no-text@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  const putRes = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode: 'original_watermark' } })
  assert.equal(putRes.statusCode, 400)
  await app.close()
})

test('PUT /:id recusa texto de marca acima de 50 caracteres (contagem por codepoint)', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-too-long@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  const putRes = await app.inject({
    method: 'PUT',
    url: `/api/groups/${id}`,
    payload: { imageMode: 'original_watermark', watermarkText: 'x'.repeat(51) },
  })
  assert.equal(putRes.statusCode, 400)

  const putOk = await app.inject({
    method: 'PUT',
    url: `/api/groups/${id}`,
    payload: { imageMode: 'original_watermark', watermarkText: 'x'.repeat(50) },
  })
  assert.equal(putOk.statusCode, 200)
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
