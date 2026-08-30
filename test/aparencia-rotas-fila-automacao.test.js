import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { offerQueueRoutes } from '../src/api/routes/offerQueue.js'
import { offerAutomationRoutes } from '../src/api/routes/offerAutomation.js'

// ------------------------------------------------------- fila (por fila)

function fakeQueueDb() {
  const queues = []
  let id = 0
  const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => {
    if (typeof value === 'object' && value !== null) return true
    return row[key] === value
  })
  return {
    queues,
    user: { findUnique: async () => ({ plan: 'pro', accessExpiresAt: null }) },
    group: { findMany: async ({ where }) => [{ waJid: `${where.userId}-post@g.us` }] },
    offerQueue: {
      count: async () => queues.length,
      findMany: async ({ where }) => queues.filter((row) => matches(row, where)),
      findFirst: async ({ where, select }) => { const row = queues.find((c) => matches(c, where)); return row && select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : row },
      create: async ({ data }) => { const row = { id: `q${++id}`, createdAt: new Date(), updatedAt: new Date(), ...data }; queues.push(row); return row },
      updateMany: async ({ where, data }) => { const found = queues.filter((row) => matches(row, where)); found.forEach((row) => Object.assign(row, data)); return { count: found.length } },
      deleteMany: async () => ({ count: 0 }),
    },
    offerQueueItem: { count: async () => 0, findMany: async () => [], findFirst: async () => null, create: async () => ({}), updateMany: async () => ({ count: 0 }) },
  }
}

async function appFila(db, userId = 'user-a') {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(offerQueueRoutes, { prefix: '/api/offer-queues', db, now: () => new Date('2026-06-10T15:00:00Z') })
  return app
}

async function criaFila(app, payload = {}) {
  const res = await app.inject({ method: 'POST', url: '/api/offer-queues', payload: { name: 'Fila', ...payload } })
  return { res, body: JSON.parse(res.body) }
}

test('fila nova nasce com a foto da oferta', async () => {
  const app = await appFila(fakeQueueDb())
  const { res, body } = await criaFila(app)
  assert.equal(res.statusCode, 200)
  assert.equal(body.imageMode, 'original')
  await app.close()
})

test('cada fila guarda o próprio formato', async () => {
  const db = fakeQueueDb()
  const app = await appFila(db)
  const { body: cartao } = await criaFila(app, { name: 'Card', imageMode: 'preview' })
  const { body: marca } = await criaFila(app, { name: 'Marca', imageMode: 'original_watermark', watermarkText: 'Ofertas da Ana', watermarkColor: 'black' })
  assert.equal(cartao.imageMode, 'preview')
  assert.equal(marca.imageMode, 'original_watermark')
  assert.equal(marca.watermarkText, 'Ofertas da Ana')
  assert.equal(marca.watermarkColor, 'black')
  await app.close()
})

test('fila recusa formato desconhecido, cor inválida e texto longo demais', async () => {
  const app = await appFila(fakeQueueDb())
  const casos = [
    { imageMode: 'fetch' },
    { imageMode: 'original_watermark', watermarkText: 'ok', watermarkColor: 'roxo' },
    { imageMode: 'original_watermark', watermarkText: 'x'.repeat(26) },
  ]
  for (const payload of casos) {
    const { res } = await criaFila(app, payload)
    assert.equal(res.statusCode, 400, `deveria recusar ${JSON.stringify(payload)}`)
  }
  await app.close()
})

// Formato com marca e texto vazio sairia igual à oferta de sempre — a pessoa
// acharia que a escolha não fez nada. Mesma regra do destino de espelhamento.
test('fila exige o texto da marca antes de escolher um formato com marca', async () => {
  const app = await appFila(fakeQueueDb())
  for (const imageMode of ['original_watermark', 'preview_watermark']) {
    const { res } = await criaFila(app, { imageMode })
    assert.equal(res.statusCode, 400)
  }
  await app.close()
})

test('fila antiga, sem formato salvo, chega à tela como a foto da oferta', async () => {
  const db = fakeQueueDb()
  db.queues.push({ id: 'q-legado', userId: 'user-a', name: 'Antiga', enabled: true, targetJids: '[]' })
  const app = await appFila(db)
  const res = await app.inject({ method: 'GET', url: '/api/offer-queues' })
  assert.equal(JSON.parse(res.body)[0].imageMode, 'original')
  await app.close()
})

// ------------------------------------- ofertas automáticas (uma da conta)

function fakeAutomationDb(cfg = null) {
  let stored = cfg
  return {
    stored: () => stored,
    user: { findUnique: async () => ({ plan: 'pro', accessExpiresAt: null }) },
    botConfig: {
      findUnique: async () => stored,
      upsert: async ({ create, update }) => { stored = stored ? { ...stored, ...update } : { ...create }; return stored },
    },
    offerAutomation: { findMany: async () => [] },
  }
}

async function appAutomacao(db, userId = 'user-a') {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(offerAutomationRoutes, { prefix: '/api/offer-automations', db })
  return app
}

test('conta sem escolha lê a foto da oferta como formato das automáticas', async () => {
  const app = await appAutomacao(fakeAutomationDb())
  const res = await app.inject({ method: 'GET', url: '/api/offer-automations/appearance' })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { imageMode: 'original', watermarkText: '', watermarkColor: 'white' })
  await app.close()
})

test('a escolha das automáticas é salva uma vez e vale para a conta', async () => {
  const db = fakeAutomationDb()
  const app = await appAutomacao(db)
  const res = await app.inject({ method: 'PUT', url: '/api/offer-automations/appearance', payload: { imageMode: 'preview_watermark', watermarkText: 'Achadinhos Maria', watermarkColor: 'black' } })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { imageMode: 'preview_watermark', watermarkText: 'Achadinhos Maria', watermarkColor: 'black' })
  assert.equal(db.stored().automationImageMode, 'preview_watermark')
  await app.close()
})

test('as automáticas recusam formato desconhecido, cor inválida e texto longo demais', async () => {
  const app = await appAutomacao(fakeAutomationDb())
  const casos = [
    { imageMode: 'none' },
    { imageMode: 'original_watermark', watermarkText: 'ok', watermarkColor: 'roxo' },
    { watermarkText: 'x'.repeat(26) },
  ]
  for (const payload of casos) {
    const res = await app.inject({ method: 'PUT', url: '/api/offer-automations/appearance', payload })
    assert.equal(res.statusCode, 400, `deveria recusar ${JSON.stringify(payload)}`)
  }
  await app.close()
})

test('as automáticas exigem o texto da marca antes do formato com marca', async () => {
  const app = await appAutomacao(fakeAutomationDb())
  const res = await app.inject({ method: 'PUT', url: '/api/offer-automations/appearance', payload: { imageMode: 'original_watermark' } })
  assert.equal(res.statusCode, 400)
  await app.close()
})

// /appearance é rota estática e não pode ser engolida pelo PUT /:id das
// automações — se fosse, salvar a aparência viraria "automação não encontrada".
test('a rota de aparência não é confundida com uma automação chamada "appearance"', async () => {
  const db = fakeAutomationDb()
  const app = await appAutomacao(db)
  const res = await app.inject({ method: 'PUT', url: '/api/offer-automations/appearance', payload: { imageMode: 'preview' } })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).imageMode, 'preview')
  await app.close()
})
