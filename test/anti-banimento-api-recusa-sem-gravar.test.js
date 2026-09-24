import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import { preservationRoutes } from '../src/api/routes/preservation.js'
import { __resetCacheForTests } from '../src/billing/plans.js'

// User Story 3 (FR-018): conta sem acesso não consegue gravar NADA pela API,
// em nenhuma das rotas de escrita — nem uma linha muda no banco.

let userCounter = 0

async function buildApp({ plan = 'basic' } = {}) {
  __resetCacheForTests()
  const n = ++userCounter
  const userId = `antiban-recusa-${n}-${Date.now()}`
  await db.user.create({
    data: {
      id: userId,
      name: `AntiBanRecusa ${n}`,
      email: `antiban-recusa-${n}-${Date.now()}@test.local`,
      passwordHash: 'x',
      plan,
    },
  })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(preservationRoutes, { prefix: '/api/preservation' })
  app.addHook('onClose', async () => {
    __resetCacheForTests()
    await db.group.deleteMany({ where: { userId } })
    await db.preservationPreset.deleteMany({ where: { userId } })
    await db.botConfig.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
  })
  return { app, userId }
}

test('PUT /config sem acesso: recusa com a mensagem do gate e NÃO grava nada', async () => {
  const { app, userId } = await buildApp()
  const antes = await db.botConfig.findUnique({ where: { userId } })
  assert.equal(antes, null)

  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { channelStaggerJitterMs: 20000 },
  })
  assert.equal(res.statusCode, 402)
  assert.match(JSON.parse(res.body).error, /Anti-banimento.*PRO/)

  const depois = await db.botConfig.findUnique({ where: { userId } })
  assert.equal(depois, null, 'nada pode ter sido gravado')
  await app.close()
})

test('POST /presets sem acesso: recusa e NÃO cria linha', async () => {
  const { app, userId } = await buildApp()
  const res = await app.inject({
    method: 'POST',
    url: '/api/preservation/presets',
    payload: { name: 'Tentativa', minIntervalSec: 60, burstCap: 999, burstWindowSec: 60, dailyCap: null, queueMaxAgeMin: 0, operatingHoursEnabled: false, operatingHoursJson: '{"startHour":8,"endHour":22,"tz":"America/Sao_Paulo"}', throttleEnabled: true },
  })
  assert.equal(res.statusCode, 402)
  const contagem = await db.preservationPreset.count({ where: { userId } })
  assert.equal(contagem, 0)
  await app.close()
})

test('PUT /presets/:id sem acesso: recusa mesmo se o id existisse (nunca chega a validar)', async () => {
  const { app } = await buildApp()
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/presets/algum-id-qualquer',
    payload: { burstCap: 1 },
  })
  assert.equal(res.statusCode, 402)
  await app.close()
})

test('PUT /destinations/:id sem acesso: recusa e não altera nenhum Group', async () => {
  const { app, userId } = await buildApp()
  const group = await db.group.create({
    data: { userId, name: 'Grupo teste', waJid: '123@g.us', role: 'post', kind: 'group' },
  })
  const res = await app.inject({
    method: 'PUT',
    url: `/api/preservation/destinations/${group.id}`,
    payload: { burstCap: 1, throttleEnabled: false },
  })
  assert.equal(res.statusCode, 402)
  const depois = await db.group.findUnique({ where: { id: group.id } })
  assert.equal(depois.burstCap, null)
  assert.equal(depois.throttleEnabled, null)
  await db.group.delete({ where: { id: group.id } })
  await app.close()
})

test('PRO tem acesso e consegue gravar normalmente (contraste)', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { channelStaggerJitterMs: 20000 },
  })
  assert.equal(res.statusCode, 200)
  const depois = await db.botConfig.findUnique({ where: { userId } })
  assert.equal(depois.channelStaggerJitterMs, 20000)
  await app.close()
})
