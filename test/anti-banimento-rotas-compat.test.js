import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import { preservationRoutes } from '../src/api/routes/preservation.js'
import { __resetCacheForTests } from '../src/billing/plans.js'
import { resolveDestinationPreservation } from '../src/core/preservationConfig.js'

// Contrato: specs/018-unificar-protecao-anti-ban/contracts/api-preservation.md
// Compatibilidade retroativa total: nenhuma rota nova/removida, nenhum campo
// renomeado. Campos fixos (burstCap/burstWindowSec/throttleEnabled) e
// channelStaggerJitterMs continuam aceitos/gravados pelo NOME atual — o efeito
// no envio (piso/espaçamento) só entra na LEITURA (resolveDestinationPreservation),
// nunca na escrita.

let userCounter = 0

async function buildApp({ plan = 'pro' } = {}) {
  __resetCacheForTests()
  const n = ++userCounter
  const userId = `antiban-compat-${n}-${Date.now()}`
  await db.user.create({
    data: {
      id: userId,
      name: `AntiBanCompat ${n}`,
      email: `antiban-compat-${n}-${Date.now()}@test.local`,
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

test('PUT /config continua aceitando channelStaggerJitterMs pelo mesmo nome (0..600000)', async () => {
  const { app } = await buildApp()
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { channelStaggerJitterMs: 30000 },
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().config.channelStaggerJitterMs, 30000)
  await app.close()
})

test('PUT /config: channelStaggerJitterMs fora da faixa (>600000) é rejeitado como hoje', async () => {
  const { app } = await buildApp()
  const res = await app.inject({
    method: 'PUT',
    url: '/api/preservation/config',
    payload: { channelStaggerJitterMs: 700000 },
  })
  assert.equal(res.statusCode, 400)
  await app.close()
})

test('POST /presets continua aceitando burstCap/burstWindowSec/throttleEnabled sem erro e sem descartar o resto do corpo', async () => {
  const { app } = await buildApp()
  const res = await app.inject({
    method: 'POST',
    url: '/api/preservation/presets',
    payload: {
      name: 'Teste 999',
      throttleEnabled: true,
      minIntervalSec: 45,
      burstCap: 999, // menos conservador que o fixo (6) — a rota grava como veio
      burstWindowSec: 120,
      dailyCap: 10,
      queueMaxAgeMin: 120,
    },
  })
  assert.equal(res.statusCode, 200)
  const preset = res.json().preset
  assert.equal(preset.name, 'Teste 999')
  assert.equal(preset.burstCap, 999, 'grava o valor recebido, mesmo menos conservador que o fixo')
  assert.equal(preset.burstWindowSec, 120)
  assert.equal(preset.minIntervalSec, 45, 'resto do corpo não é descartado')
  assert.equal(preset.dailyCap, 10)
  await app.close()
})

test('PUT /destinations/:id continua aceitando os três campos fixos; efetivo lido depois via resolveDestinationPreservation aplica o piso', async () => {
  const { app, userId } = await buildApp()
  const group = await db.group.create({
    data: { userId, waJid: `${Date.now()}@g.us`, name: 'Destino teste', kind: 'group', role: 'post' },
  })

  const putRes = await app.inject({
    method: 'PUT',
    url: `/api/preservation/destinations/${group.id}`,
    payload: { burstCap: 999, burstWindowSec: 120, throttleEnabled: true },
  })
  assert.equal(putRes.statusCode, 200)
  assert.equal(putRes.json().destination.burstCap, 999, 'grava cru, sem aplicar piso na ESCRITA')

  const stored = await db.group.findUnique({ where: { id: group.id } })
  const effective = resolveDestinationPreservation(stored, {})
  assert.equal(effective.burstCap, 6, 'na LEITURA o piso aplica: 999 é menos conservador que o fixo 6')

  await app.close()
})

// ---------------------------------------------------------------------------
// T024 — campos ADITIVOS na leitura (GET), campos antigos continuam byte a byte
// ---------------------------------------------------------------------------

test('GET /config soma effective.destinationIntervalSec sem remover nenhum campo existente', async () => {
  const { app } = await buildApp()
  await app.inject({ method: 'PUT', url: '/api/preservation/config', payload: { channelStaggerJitterMs: 45000 } })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/config' })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  // campos antigos continuam presentes
  assert.equal(body.config.channelStaggerJitterMs, 45000)
  assert.ok('maxDailyFollows' in body.config)
  assert.ok('followGuardEnabled' in body.config)
  assert.ok('imageMutationEnabled' in body.config)
  assert.ok('probeEnabled' in body.config)
  assert.ok('flags' in body)
  // campo aditivo novo
  assert.equal(body.config.effective.destinationIntervalSec, 45)
  await app.close()
})

test('GET /config: sem channelStaggerJitterMs gravado, destinationIntervalSec é 0 (sem espaçamento extra)', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'GET', url: '/api/preservation/config' })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().config.effective.destinationIntervalSec, 0)
  await app.close()
})

test('GET /presets soma ritmoMaisCuidadoso e recomecouDoPadrao por preset, mantendo os campos antigos', async () => {
  const { app } = await buildApp()
  await app.inject({
    method: 'POST',
    url: '/api/preservation/presets',
    payload: { name: 'Cuidadoso', throttleEnabled: true, minIntervalSec: 30, burstCap: 2, burstWindowSec: 600, dailyCap: null, queueMaxAgeMin: 300 },
  })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/presets' })
  assert.equal(res.statusCode, 200)
  const preset = res.json().presets.find((p) => p.name === 'Cuidadoso')
  assert.ok(preset, 'preset antigo continua na lista')
  assert.equal(preset.burstCap, 2, 'campo antigo intacto')
  assert.equal(preset.ritmoMaisCuidadoso, true)
  assert.equal(preset.recomecouDoPadrao, false)
  await app.close()
})

test('GET /destinations soma ritmoMaisCuidadoso, recomecouDoPadrao e effective por destino, mantendo os campos antigos', async () => {
  const { app, userId } = await buildApp()
  const group = await db.group.create({
    data: {
      userId, waJid: `${Date.now()}-b@g.us`, name: 'Destino aditivo', kind: 'group', role: 'post',
      throttleEnabled: false, minIntervalSec: 300, dailyCap: 3, burstCap: 2, burstWindowSec: 3600,
    },
  })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/destinations' })
  assert.equal(res.statusCode, 200)
  const dest = res.json().destinations.find((d) => d.id === group.id)
  assert.ok(dest, 'destino antigo continua na lista')
  assert.equal(dest.waJid, group.waJid, 'campo antigo intacto')
  assert.equal(dest.recomecouDoPadrao, true, 'estava com limites desligados')
  assert.equal(dest.ritmoMaisCuidadoso, false)
  assert.equal(dest.effective.throttleEnabled, true)
  assert.equal(dest.effective.burstCap, 6)
  assert.equal(dest.effective.minIntervalSec, 30)
  await app.close()
})
