import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../../../src/db.js'
import { preservationRoutes } from '../../../src/api/routes/preservation.js'
import { __resetCacheForTests } from '../../../src/billing/plans.js'

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

// 1. GET /config retorna 402 para usuário basic
test('GET /config retorna 402 com FEATURE_REQUIRES_PRO para basic', async () => {
  const { app } = await buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/config' })
  assert.equal(res.statusCode, 402)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'FEATURE_REQUIRES_PRO')
  assert.equal(body.feature, 'advanced_preservation')
  await app.close()
})

// 2. GET /config retorna 200 com config + flags para usuário pro
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

// 3. PUT /config retorna 402 para basic
test('PUT /config retorna 402 para basic', async () => {
  const { app } = await buildApp({ plan: 'basic' })
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { channelMinIntervalSec: 10 },
  })
  assert.equal(res.statusCode, 402)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'FEATURE_REQUIRES_PRO')
  await app.close()
})

// 4. PUT /config atualiza campos para pro
test('PUT /config atualiza channelMinIntervalSec para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { channelMinIntervalSec: 30 },
  })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok('config' in body)
  assert.equal(body.config.channelMinIntervalSec, 30)
  await app.close()
})

// 5a. PUT /config retorna 400 para channelMinIntervalSec negativo
test('PUT /config retorna 400 para channelMinIntervalSec inválido (negativo)', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { channelMinIntervalSec: -1 },
  })
  assert.equal(res.statusCode, 400)
  const body = JSON.parse(res.body)
  assert.ok(body.errors && body.errors.length > 0, 'deve retornar array de erros')
  await app.close()
})

// 5b. PUT /config retorna 400 para imageMutationEnabled como string
test('PUT /config retorna 400 para imageMutationEnabled como string', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { imageMutationEnabled: 'true' },
  })
  assert.equal(res.statusCode, 400)
  const body = JSON.parse(res.body)
  assert.ok(body.errors && body.errors.length > 0)
  await app.close()
})

// 6. PUT /config aceita channelDailyCap: null
test('PUT /config aceita channelDailyCap null para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  // First set a value, then null it out
  await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { channelDailyCap: 100 },
  })
  __resetCacheForTests()
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { channelDailyCap: null },
  })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.config.channelDailyCap, null)
  await app.close()
})

// 7. PUT /config rejeita channelQuietHoursJson inválido
test('PUT /config retorna 400 para channelQuietHoursJson com JSON malformado', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { channelQuietHoursJson: '{ não é json' },
  })
  assert.equal(res.statusCode, 400)
  const body = JSON.parse(res.body)
  assert.ok(body.errors.some(e => /channelQuietHoursJson/.test(e)))
  await app.close()
})

// 8. PUT /config aceita channelQuietHoursJson válido
test('PUT /config aceita channelQuietHoursJson com JSON válido', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const payload = { channelQuietHoursJson: JSON.stringify({ startHour: 23, endHour: 6, tz: 'America/Sao_Paulo' }) }
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload,
  })
  assert.equal(res.statusCode, 200)
  await app.close()
})

// 9. PUT /config ignora copyVariationPoolJson (variações migraram para /api/config)
test('PUT /config ignora copyVariationPoolJson (campo migrou para Templates)', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { copyVariationPoolJson: JSON.stringify({ greetings: ['x'] }), channelMinIntervalSec: 30 },
  })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal('copyVariationPoolJson' in body.config, false, 'pool não deve mais ser exposto pela preservação')
  assert.equal(body.config.channelMinIntervalSec, 30)
  const stored = await db.botConfig.findUnique({ where: { userId } })
  assert.notEqual(stored.copyVariationPoolJson, JSON.stringify({ greetings: ['x'] }), 'preservação não pode escrever o pool')
  await app.close()
})

// 10. PUT /config rejeita maxDailyFollows fora do range
test('PUT /config retorna 400 para maxDailyFollows > 50', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { maxDailyFollows: 100 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

// 11. PUT /config aceita probeEnabled boolean
test('PUT /config aceita probeEnabled true', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { probeEnabled: true },
  })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.config.probeEnabled, true)
  await app.close()
})

// 12. PUT /config trial ativo libera (mesmo gating do pro)
test('PUT /config trial ativo permite atualização', async () => {
  const future = new Date(Date.now() + 60_000)
  const { app } = await buildApp({ plan: 'trial', accessExpiresAt: future })
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { channelBurstCap: 5 },
  })
  assert.equal(res.statusCode, 200)
  await app.close()
})

// 13. PUT /config trial expirado bloqueia com 402
test('PUT /config trial expirado retorna 402', async () => {
  const past = new Date(Date.now() - 60_000)
  const { app } = await buildApp({ plan: 'trial', accessExpiresAt: past })
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { channelBurstCap: 5 },
  })
  assert.equal(res.statusCode, 402)
  await app.close()
})

// ============================================================================
// CENÁRIOS EXTREMOS — boundaries de cada campo configurável
// ============================================================================

// 14. channelMinIntervalSec: 0 (abaixo do min) é inválido
test('PUT /config rejeita channelMinIntervalSec=0 (abaixo do min 1)', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelMinIntervalSec: 0 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

// 15. channelMinIntervalSec: 1 (mínimo exato) é válido
test('PUT /config aceita channelMinIntervalSec=1 (mínimo exato)', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelMinIntervalSec: 1 },
  })
  assert.equal(res.statusCode, 200)
  await app.close()
})

// 16. channelMinIntervalSec: 86400 (máximo exato) é válido
test('PUT /config aceita channelMinIntervalSec=86400 (máximo exato)', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelMinIntervalSec: 86400 },
  })
  assert.equal(res.statusCode, 200)
  await app.close()
})

// 17. channelMinIntervalSec: 86401 (acima do max) é inválido
test('PUT /config rejeita channelMinIntervalSec=86401 (acima do max)', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelMinIntervalSec: 86401 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

// 18. channelBurstWindowSec: 59 (abaixo do min 60) é inválido
test('PUT /config rejeita channelBurstWindowSec=59 (abaixo do min 60)', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelBurstWindowSec: 59 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

// 19. channelBurstWindowSec: 60 (mínimo exato) é válido
test('PUT /config aceita channelBurstWindowSec=60 (mínimo exato)', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelBurstWindowSec: 60 },
  })
  assert.equal(res.statusCode, 200)
  await app.close()
})

// 20. channelStaggerJitterMs: 0 é válido (mínimo)
test('PUT /config aceita channelStaggerJitterMs=0', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelStaggerJitterMs: 0 },
  })
  assert.equal(res.statusCode, 200)
  await app.close()
})

// 21. channelStaggerJitterMs: -1 é inválido
test('PUT /config rejeita channelStaggerJitterMs negativo', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelStaggerJitterMs: -1 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

// 22. channelStaggerJitterMs: 600001 (acima do max 600000) é inválido
test('PUT /config rejeita channelStaggerJitterMs acima de 600000', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelStaggerJitterMs: 600001 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

// 23. channelDailyCap: 0 é inválido (min 1, mas nullable)
test('PUT /config rejeita channelDailyCap=0', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelDailyCap: 0 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

// 24. channelDailyCap: 10001 (acima do max) é inválido
test('PUT /config rejeita channelDailyCap acima de 10000', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelDailyCap: 10001 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

// 25. channelBurstCap: 1001 (acima do max 1000) é inválido
test('PUT /config rejeita channelBurstCap acima de 1000', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelBurstCap: 1001 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

// 26. maxDailyFollows: 0 é inválido (min 1)
test('PUT /config rejeita maxDailyFollows=0', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { maxDailyFollows: 0 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

// 27. maxDailyFollows: 50 (máximo exato) é válido
test('PUT /config aceita maxDailyFollows=50 (máximo exato)', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { maxDailyFollows: 50 },
  })
  assert.equal(res.statusCode, 200)
  await app.close()
})

// 28. Tipos não-inteiros: float é rejeitado
test('PUT /config rejeita float em campo inteiro (channelMinIntervalSec=1.5)', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelMinIntervalSec: 1.5 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

// 29. String numérica é rejeitada (sem coerção)
test('PUT /config rejeita string numérica "5" em campo inteiro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelMinIntervalSec: '5' },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

// 30. NaN é rejeitado
test('PUT /config rejeita NaN em campo inteiro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelMinIntervalSec: Number.NaN },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

// 31. null em campo NÃO-nullable é rejeitado
test('PUT /config rejeita null em campo não-nullable (channelMinIntervalSec)', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelMinIntervalSec: null },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

// 32. Múltiplos campos inválidos: retorna array com TODOS os erros
test('PUT /config acumula múltiplos erros em uma resposta', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: {
      channelMinIntervalSec: -1,
      channelBurstCap: 0,
      maxDailyFollows: 999,
      imageMutationEnabled: 'sim',
      channelQuietHoursJson: 'não-é-json',
    },
  })
  assert.equal(res.statusCode, 400)
  const body = JSON.parse(res.body)
  assert.ok(body.errors.length >= 5, `esperava >=5 erros, recebi ${body.errors.length}`)
  await app.close()
})

// 33. Empty body é no-op válido (200)
test('PUT /config com body vazio retorna 200 sem alterar nada', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: {},
  })
  assert.equal(res.statusCode, 200)
  await app.close()
})

// 34. Campos desconhecidos são ignorados silenciosamente
test('PUT /config ignora campos desconhecidos sem erro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { foo: 'bar', __proto__: 'evil', channelMinIntervalSec: 10 },
  })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.config.channelMinIntervalSec, 10)
  assert.ok(!('foo' in body.config))
  await app.close()
})

// 35. Payload completo: todos os campos válidos em um PUT
test('PUT /config aceita payload completo com todos os campos válidos', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: {
      channelMinIntervalSec: 15,
      channelBurstCap: 3,
      channelBurstWindowSec: 300,
      channelDailyCap: 50,
      channelStaggerJitterMs: 1500,
      channelQuietHoursJson: JSON.stringify({ startHour: 22, endHour: 7, tz: 'America/Sao_Paulo' }),
      maxDailyFollows: 10,
      imageMutationEnabled: true,
      probeEnabled: false,
    },
  })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.config.channelMinIntervalSec, 15)
  assert.equal(body.config.maxDailyFollows, 10)
  assert.equal(body.config.imageMutationEnabled, true)
  assert.equal(body.config.probeEnabled, false)
  await app.close()
})

// 37. channelQuietHoursJson aceita objeto vazio (validação é JSON, não schema)
test('PUT /config aceita channelQuietHoursJson com objeto vazio', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelQuietHoursJson: '{}' },
  })
  assert.equal(res.statusCode, 200)
  await app.close()
})

// 38. GET /config retorna defaults quando user nunca configurou
test('GET /config retorna estrutura com nulls quando não há BotConfig', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/config' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  for (const k of ['channelMinIntervalSec', 'channelBurstCap', 'channelStaggerJitterMs', 'maxDailyFollows', 'imageMutationEnabled', 'probeEnabled', 'channelQuietHoursJson', 'probeAccountSessionId']) {
    assert.ok(k in body.config, `config deve ter campo ${k}`)
  }
  assert.ok('clickTrackerSaltConfigured' in body.flags)
  assert.ok('shortlinkBaseUrl' in body.flags)
  await app.close()
})

// 39. Boolean: número 1 é rejeitado em campo boolean
test('PUT /config rejeita número 1 em campo boolean (imageMutationEnabled)', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { imageMutationEnabled: 1 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

// 40. Gating: trial expirando exatamente agora bloqueia (>now estrito)
test('PUT /config trial com accessExpiresAt no passado imediato bloqueia', async () => {
  const past = new Date(Date.now() - 1)
  const { app } = await buildApp({ plan: 'trial', accessExpiresAt: past })
  const res = await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelBurstCap: 5 },
  })
  assert.equal(res.statusCode, 402)
  await app.close()
})

// 41. PUT persiste e GET subsequente retorna valor atualizado
test('PUT /config persiste e GET retorna valor atualizado', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  await app.inject({
    method: 'PUT', url: '/api/preservation/config',
    payload: { channelMinIntervalSec: 42, probeEnabled: true },
  })
  __resetCacheForTests()
  const getRes = await app.inject({ method: 'GET', url: '/api/preservation/config' })
  const body = JSON.parse(getRes.body)
  assert.equal(body.config.channelMinIntervalSec, 42)
  assert.equal(body.config.probeEnabled, true)
  await app.close()
})

test('PUT /config persiste toggles independentes de preservação', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  const payload = {
    channelThrottleEnabled: true,
    quietHoursEnabled: false,
    followGuardEnabled: true,
    imageMutationEnabled: true,
  }
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload,
  })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.deepEqual(
    Object.fromEntries(Object.keys(payload).map(key => [key, body.config[key]])),
    payload,
  )
  assert.equal('preservationEnabled' in body.config, false, 'API não deve expor o toggle mestre removido')
  assert.equal('imageMutationActive' in body.config, false, 'nome interno não deve vazar para a UI')

  const stored = await db.botConfig.findUnique({ where: { userId } })
  assert.equal(stored.imageMutationActive, true)
  assert.equal(stored.imageMutationEnabled, true, 'preferência legada permanece intacta')
  await app.close()
})

test('toggle mestre legado é ignorado e não reativa nenhuma defesa', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { preservationEnabled: true },
  })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal('preservationEnabled' in body.config, false)
  for (const key of ['channelThrottleEnabled', 'quietHoursEnabled', 'followGuardEnabled', 'imageMutationEnabled']) {
    assert.equal(body.config[key], false, `${key} deve permanecer desligado`)
  }
  const stored = await db.botConfig.findUnique({ where: { userId } })
  assert.equal(stored.preservationEnabled, false)
  await app.close()
})

test('API rejeita tipo inválido em cada toggle independente', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  for (const key of ['channelThrottleEnabled', 'quietHoursEnabled', 'followGuardEnabled', 'imageMutationEnabled']) {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/preservation/config',
      payload: { [key]: 'true' },
    })
    assert.equal(res.statusCode, 400, key)
    assert.match(JSON.parse(res.body).error, new RegExp(`${key} deve ser boolean`))
  }
  await app.close()
})
