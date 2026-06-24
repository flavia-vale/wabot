import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../../../src/db.js'
import { preservationRoutes } from '../../../src/api/routes/preservation.js'
import { __resetCacheForTests } from '../../../src/billing/plans.js'

// Plano B / Fase 3 (passo 2): a cadência/janela (min interval, burst, daily,
// quiet hours + toggles channelThrottleEnabled/quietHoursEnabled) saiu da config
// GLOBAL e virou config POR DESTINO (presets/destinations). Esta rota cuida só
// do que continua de conta: stagger entre canais, maxDailyFollows e as defesas
// opcionais (follow guard, mutação de imagem, probe). Os campos aposentados
// viram "campos desconhecidos" e são ignorados silenciosamente (não dão 400).

let userCounter = 0

async function buildApp({ plan = 'basic', accessExpiresAt = null } = {}) {
  __resetCacheForTests()
  const n = ++userCounter
  const userId = `pres-cfg-${n}-${Date.now()}`
  await db.user.create({
    data: {
      id: userId,
      name: `PresCfg ${n}`,
      email: `pres-cfg-${n}-${Date.now()}@test.local`,
      passwordHash: 'x',
      plan,
      accessExpiresAt,
    },
  })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(preservationRoutes, { prefix: '/api/preservation' })
  app.addHook('onClose', async () => {
    __resetCacheForTests()
    await db.botConfig.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
  })
  return { app, userId }
}

// ---------------------------------------------------------------------------
// Gating de plano
// ---------------------------------------------------------------------------

test('GET /config retorna 402 com FEATURE_REQUIRES_PRO para basic', async () => {
  const { app } = await buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/config' })
  assert.equal(res.statusCode, 402)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'FEATURE_REQUIRES_PRO')
  assert.equal(body.feature, 'advanced_preservation')
  await app.close()
})

test('GET /config retorna 200 com config e flags para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/config' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok('config' in body, 'deve ter campo config')
  assert.ok('flags' in body, 'deve ter campo flags')
  assert.ok('clickTrackerSaltConfigured' in body.flags)
  await app.close()
})

test('PUT /config retorna 402 para basic', async () => {
  const { app } = await buildApp({ plan: 'basic' })
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { channelStaggerJitterMs: 1000 },
  })
  assert.equal(res.statusCode, 402)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'FEATURE_REQUIRES_PRO')
  await app.close()
})

test('PUT /config trial ativo permite atualização (mesmo gating do pro)', async () => {
  const future = new Date(Date.now() + 60_000)
  const { app } = await buildApp({ plan: 'trial', accessExpiresAt: future })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { probeEnabled: true },
  })
  assert.equal(res.statusCode, 200)
  await app.close()
})

test('PUT /config trial expirado retorna 402', async () => {
  const past = new Date(Date.now() - 60_000)
  const { app } = await buildApp({ plan: 'trial', accessExpiresAt: past })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { probeEnabled: true },
  })
  assert.equal(res.statusCode, 402)
  await app.close()
})

// ---------------------------------------------------------------------------
// channelStaggerJitterMs (config de conta dedicada)
// ---------------------------------------------------------------------------

test('PUT /config atualiza channelStaggerJitterMs para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelStaggerJitterMs: 90000 },
  })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.config.channelStaggerJitterMs, 90000)
  await app.close()
})

test('PUT /config aceita channelStaggerJitterMs=0 (mínimo)', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelStaggerJitterMs: 0 },
  })
  assert.equal(res.statusCode, 200)
  await app.close()
})

test('PUT /config rejeita channelStaggerJitterMs negativo', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelStaggerJitterMs: -1 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

test('PUT /config rejeita channelStaggerJitterMs acima de 600000', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelStaggerJitterMs: 600001 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

// ---------------------------------------------------------------------------
// maxDailyFollows + toggles de conta
// ---------------------------------------------------------------------------

test('PUT /config rejeita maxDailyFollows > 50', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { maxDailyFollows: 100 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

test('PUT /config aceita maxDailyFollows=50 (máximo exato)', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { maxDailyFollows: 50 },
  })
  assert.equal(res.statusCode, 200)
  await app.close()
})

test('PUT /config rejeita maxDailyFollows=0', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { maxDailyFollows: 0 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

test('PUT /config aceita probeEnabled true', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { probeEnabled: true },
  })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.config.probeEnabled, true)
  await app.close()
})

test('PUT /config retorna 400 para imageMutationEnabled como string', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { imageMutationEnabled: 'true' },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

test('PUT /config rejeita número 1 em campo boolean (imageMutationEnabled)', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { imageMutationEnabled: 1 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

test('PUT /config persiste toggles independentes de preservação de conta', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  const payload = {
    followGuardEnabled: true,
    imageMutationEnabled: true,
    probeEnabled: false,
  }
  const res = await app.inject({ method: 'PUT', url: '/api/preservation/config', payload })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.deepEqual(
    Object.fromEntries(Object.keys(payload).map(key => [key, body.config[key]])),
    payload,
  )
  assert.equal('imageMutationActive' in body.config, false, 'nome interno não deve vazar para a UI')

  const stored = await db.botConfig.findUnique({ where: { userId } })
  assert.equal(stored.imageMutationActive, true)
  await app.close()
})

test('API rejeita tipo inválido em cada toggle de conta', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  for (const key of ['followGuardEnabled', 'imageMutationEnabled', 'probeEnabled']) {
    const res = await app.inject({
      method: 'PUT', url: '/api/preservation/config',
      payload: { [key]: 'true' },
    })
    assert.equal(res.statusCode, 400, key)
  }
  await app.close()
})

// ---------------------------------------------------------------------------
// Campos aposentados (cadência/quiet global): ignorados, não dão 400
// ---------------------------------------------------------------------------

test('PUT /config IGNORA campos de cadência/quiet aposentados (viraram por destino)', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: {
      channelMinIntervalSec: -1,        // valor que antes dava 400
      channelBurstCap: 0,               // idem
      channelQuietHoursJson: 'não-json', // idem
      channelThrottleEnabled: true,
      quietHoursEnabled: false,
      channelStaggerJitterMs: 1500,     // este é válido e deve persistir
    },
  })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.config.channelStaggerJitterMs, 1500)
  for (const gone of ['channelMinIntervalSec', 'channelBurstCap', 'channelQuietHoursJson', 'channelThrottleEnabled', 'quietHoursEnabled']) {
    assert.equal(gone in body.config, false, `${gone} não deve mais ser exposto pela preservação`)
  }
  await app.close()
})

test('PUT /config ignora copyVariationPoolJson (campo migrou para Templates)', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { copyVariationPoolJson: JSON.stringify({ greetings: ['x'] }), channelStaggerJitterMs: 3000 },
  })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal('copyVariationPoolJson' in body.config, false, 'pool não deve ser exposto pela preservação')
  assert.equal(body.config.channelStaggerJitterMs, 3000)
  const stored = await db.botConfig.findUnique({ where: { userId } })
  assert.notEqual(stored.copyVariationPoolJson, JSON.stringify({ greetings: ['x'] }), 'preservação não pode escrever o pool')
  await app.close()
})

test('toggle mestre legado é ignorado e não reativa nenhuma defesa', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { preservationEnabled: true },
  })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal('preservationEnabled' in body.config, false)
  for (const key of ['followGuardEnabled', 'imageMutationEnabled', 'probeEnabled']) {
    assert.equal(body.config[key], false, `${key} deve permanecer desligado`)
  }
  const stored = await db.botConfig.findUnique({ where: { userId } })
  assert.equal(stored.preservationEnabled, false)
  await app.close()
})

// ---------------------------------------------------------------------------
// Robustez geral do validador
// ---------------------------------------------------------------------------

test('PUT /config rejeita float em campo inteiro (channelStaggerJitterMs=1.5)', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelStaggerJitterMs: 1.5 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

test('PUT /config rejeita string numérica "5" em campo inteiro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelStaggerJitterMs: '5' },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

test('PUT /config rejeita NaN em campo inteiro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelStaggerJitterMs: Number.NaN },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

test('PUT /config acumula múltiplos erros em uma resposta', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: {
      channelStaggerJitterMs: -1,
      maxDailyFollows: 999,
      imageMutationEnabled: 'sim',
      probeEnabled: 1,
    },
  })
  assert.equal(res.statusCode, 400)
  const body = JSON.parse(res.body)
  assert.ok(body.errors.length >= 4, `esperava >=4 erros, recebi ${body.errors.length}`)
  await app.close()
})

test('PUT /config com body vazio retorna 200 sem alterar nada', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'PUT', url: '/api/preservation/config', payload: {} })
  assert.equal(res.statusCode, 200)
  await app.close()
})

test('PUT /config ignora campos desconhecidos sem erro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { foo: 'bar', __proto__: 'evil', channelStaggerJitterMs: 10 },
  })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.config.channelStaggerJitterMs, 10)
  assert.ok(!('foo' in body.config))
  await app.close()
})

test('PUT /config aceita payload completo com todos os campos válidos', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: {
      channelStaggerJitterMs: 1500,
      maxDailyFollows: 10,
      followGuardEnabled: true,
      imageMutationEnabled: true,
      probeEnabled: false,
    },
  })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.config.channelStaggerJitterMs, 1500)
  assert.equal(body.config.maxDailyFollows, 10)
  assert.equal(body.config.followGuardEnabled, true)
  assert.equal(body.config.imageMutationEnabled, true)
  assert.equal(body.config.probeEnabled, false)
  await app.close()
})

test('GET /config retorna estrutura com nulls quando não há BotConfig', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/config' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  for (const k of ['channelStaggerJitterMs', 'maxDailyFollows', 'followGuardEnabled', 'imageMutationEnabled', 'probeEnabled', 'probeAccountSessionId']) {
    assert.ok(k in body.config, `config deve ter campo ${k}`)
  }
  // Campos aposentados não devem mais aparecer.
  for (const gone of ['channelMinIntervalSec', 'channelBurstCap', 'channelQuietHoursJson', 'channelThrottleEnabled', 'quietHoursEnabled']) {
    assert.equal(gone in body.config, false, `${gone} não deve mais ser exposto`)
  }
  assert.ok('clickTrackerSaltConfigured' in body.flags)
  assert.ok('shortlinkBaseUrl' in body.flags)
  await app.close()
})

test('PUT persiste e GET subsequente retorna valor atualizado', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelStaggerJitterMs: 42000, probeEnabled: true },
  })
  __resetCacheForTests()
  const getRes = await app.inject({ method: 'GET', url: '/api/preservation/config' })
  const body = JSON.parse(getRes.body)
  assert.equal(body.config.channelStaggerJitterMs, 42000)
  assert.equal(body.config.probeEnabled, true)
  await app.close()
})
