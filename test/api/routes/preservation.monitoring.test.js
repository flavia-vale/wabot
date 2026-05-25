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
  const userId = `pres-mon-${n}-${Date.now()}`
  await db.user.create({
    data: {
      id: userId,
      name: `PresMon ${n}`,
      email: `pres-mon-${n}-${Date.now()}@test.local`,
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
    await db.followLog.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
  })
  return { app, userId }
}

// 1. GET /monitoring/health retorna 402 para basic, 200 com items para pro
test('GET /monitoring/health retorna 402 para basic', async () => {
  const { app } = await buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/health' })
  assert.equal(res.statusCode, 402)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'FEATURE_REQUIRES_PRO')
  await app.close()
})

test('GET /monitoring/health retorna 200 com items para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/health' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok(Array.isArray(body.items), 'deve retornar campo items como array')
  await app.close()
})

// 2. GET /monitoring/risk-score retorna 200 com items e avgScore para pro
test('GET /monitoring/risk-score retorna 200 com items e avgScore para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/risk-score' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok(Array.isArray(body.items), 'deve ter campo items como array')
  assert.ok('avgScore' in body, 'deve ter campo avgScore')
  await app.close()
})

// 3. GET /monitoring/follows retorna 200 com items para pro
test('GET /monitoring/follows retorna 200 com items para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/follows' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok(Array.isArray(body.items), 'deve ter campo items como array')
  await app.close()
})

// 4. GET /monitoring/snapshots retorna 200 para pro
test('GET /monitoring/snapshots retorna 200 para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/snapshots' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok(Array.isArray(body.items), 'deve ter campo items como array')
  await app.close()
})

// 5. GET /monitoring/probe retorna 200 para pro
test('GET /monitoring/probe retorna 200 para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/probe' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok('enabled' in body, 'deve ter campo enabled')
  assert.ok('items' in body, 'deve ter campo items')
  await app.close()
})

// 6. GET /monitoring/clicks retorna 200 com total e days para pro
test('GET /monitoring/clicks retorna 200 com total e days para pro', async () => {
  const { app } = await buildApp({ plan: 'pro' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/clicks' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.ok('total' in body, 'deve ter campo total')
  assert.ok('days' in body, 'deve ter campo days')
  await app.close()
})

// 7. Gating: risk-score também retorna 402 para basic (confirma gating em toda área monitoring)
test('GET /monitoring/risk-score retorna 402 para basic', async () => {
  const { app } = await buildApp({ plan: 'basic' })
  const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/risk-score' })
  assert.equal(res.statusCode, 402)
  const body = JSON.parse(res.body)
  assert.equal(body.code, 'FEATURE_REQUIRES_PRO')
  await app.close()
})

// ============================================================================
// CENÁRIOS EXTREMOS — estado vazio, dados seedados, paginação, gating em todas rotas
// ============================================================================

async function seedGroup(userId, { name = 'Canal Teste', kind = 'channel', waJid }) {
  return db.group.create({
    data: {
      userId,
      name,
      waJid: waJid ?? `${userId}-${Math.random().toString(36).slice(2)}@g.us`,
      role: 'post',
      kind,
    },
  })
}

async function seedChannelHealth(groupId, data = {}) {
  return db.channelHealth.upsert({
    where: { groupId },
    create: { groupId, ...data },
    update: data,
  })
}

// Helper de cleanup mais robusto
async function teardown(app, userId) {
  __resetCacheForTests()
  await db.affiliateClick.deleteMany({ where: { link: { userId } } })
  await db.affiliateLink.deleteMany({ where: { userId } })
  await db.channelSnapshot.deleteMany({ where: { group: { userId } } })
  await db.channelHealth.deleteMany({ where: { group: { userId } } })
  await db.group.deleteMany({ where: { userId } })
  await db.followLog.deleteMany({ where: { userId } })
  await db.botConfig.deleteMany({ where: { userId } })
  await db.user.deleteMany({ where: { id: userId } })
  await app.close()
}

// 8. ESTADO VAZIO — todas as rotas devolvem arrays/contadores vazios sem quebrar
test('Monitoring: estado vazio (sem groups/follows/snapshots) retorna arrays vazios', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  try {
    const health = JSON.parse((await app.inject({ method: 'GET', url: '/api/preservation/monitoring/health' })).body)
    assert.deepEqual(health.items, [])

    const risk = JSON.parse((await app.inject({ method: 'GET', url: '/api/preservation/monitoring/risk-score' })).body)
    assert.deepEqual(risk.items, [])
    assert.equal(risk.avgScore, null, 'avg null com 0 canais (evita divisão por zero)')

    const follows = JSON.parse((await app.inject({ method: 'GET', url: '/api/preservation/monitoring/follows' })).body)
    assert.deepEqual(follows.items, [])

    const snaps = JSON.parse((await app.inject({ method: 'GET', url: '/api/preservation/monitoring/snapshots' })).body)
    assert.deepEqual(snaps.items, [])

    const probe = JSON.parse((await app.inject({ method: 'GET', url: '/api/preservation/monitoring/probe' })).body)
    assert.equal(probe.enabled, false)
    assert.equal(probe.probeAccountSessionId, null)
    assert.deepEqual(probe.items, [])

    const clicks = JSON.parse((await app.inject({ method: 'GET', url: '/api/preservation/monitoring/clicks' })).body)
    assert.equal(clicks.total, 0)
    assert.equal(typeof clicks.days, 'number')
  } finally { await teardown(app, userId) }
})

// 9. HEALTH com 3 canais em estados distintos
test('GET /monitoring/health retorna um item por canal post com status correto', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  try {
    const g1 = await seedGroup(userId, { name: 'Green', kind: 'channel' })
    const g2 = await seedGroup(userId, { name: 'Yellow', kind: 'channel' })
    const g3 = await seedGroup(userId, { name: 'Red', kind: 'channel' })
    await seedChannelHealth(g1.id, { status: 'green' })
    await seedChannelHealth(g2.id, { status: 'yellow', lastError: 'probe_watchdog:stale' })
    await seedChannelHealth(g3.id, { status: 'red', lastError: 'unauthorized' })

    const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/health' })
    const body = JSON.parse(res.body)
    assert.equal(body.items.length, 3)
    const byName = Object.fromEntries(body.items.map(i => [i.name, i]))
    assert.equal(byName.Green.health.status, 'green')
    assert.equal(byName.Yellow.health.status, 'yellow')
    assert.equal(byName.Red.health.status, 'red')
  } finally { await teardown(app, userId) }
})

// 10. HEALTH ignora canais kind != 'channel' (mas mantém role=post)
test('GET /monitoring/health inclui groups role=post independente do kind', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  try {
    await seedGroup(userId, { name: 'Canal', kind: 'channel' })
    await seedGroup(userId, { name: 'Grupo', kind: 'group' })
    const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/health' })
    const body = JSON.parse(res.body)
    assert.equal(body.items.length, 2)
  } finally { await teardown(app, userId) }
})

// 11. RISK SCORE: avg com mix de scores e nulls
test('GET /monitoring/risk-score: avg ignora canais sem score', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  try {
    const g1 = await seedGroup(userId, { name: 'A', kind: 'channel' })
    const g2 = await seedGroup(userId, { name: 'B', kind: 'channel' })
    const g3 = await seedGroup(userId, { name: 'C', kind: 'channel' })
    await seedChannelHealth(g1.id, { reportRiskScore: 20 })
    await seedChannelHealth(g2.id, { reportRiskScore: 80 })
    await seedChannelHealth(g3.id, {}) // sem score

    const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/risk-score' })
    const body = JSON.parse(res.body)
    assert.equal(body.items.length, 3)
    assert.equal(body.avgScore, 50, 'média de [20,80] ignorando null')
  } finally { await teardown(app, userId) }
})

// 12. RISK SCORE: avg null quando TODOS sem score
test('GET /monitoring/risk-score: avgScore=null quando nenhum canal tem score', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  try {
    const g = await seedGroup(userId, { name: 'X', kind: 'channel' })
    await seedChannelHealth(g.id, {})
    const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/risk-score' })
    const body = JSON.parse(res.body)
    assert.equal(body.avgScore, null)
    assert.equal(body.items[0].score, null)
  } finally { await teardown(app, userId) }
})

// 13. RISK SCORE: ignora canais kind=group (só kind=channel)
test('GET /monitoring/risk-score só inclui canais kind=channel', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  try {
    await seedGroup(userId, { name: 'Channel', kind: 'channel' })
    await seedGroup(userId, { name: 'Group', kind: 'group' })
    const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/risk-score' })
    const body = JSON.parse(res.body)
    assert.equal(body.items.length, 1)
    assert.equal(body.items[0].name, 'Channel')
  } finally { await teardown(app, userId) }
})

// 14. RECOMPUTE-ALL com zero canais retorna {recomputed:0, total:0}
test('POST /monitoring/risk-score/recompute-all sem canais retorna zeros', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  try {
    const res = await app.inject({ method: 'POST', url: '/api/preservation/monitoring/risk-score/recompute-all' })
    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.body)
    assert.equal(body.recomputed, 0)
    assert.equal(body.total, 0)
  } finally { await teardown(app, userId) }
})

// 15. RECOMPUTE-ALL gating
test('POST /monitoring/risk-score/recompute-all retorna 402 para basic', async () => {
  const { app, userId } = await buildApp({ plan: 'basic' })
  try {
    const res = await app.inject({ method: 'POST', url: '/api/preservation/monitoring/risk-score/recompute-all' })
    assert.equal(res.statusCode, 402)
  } finally { await teardown(app, userId) }
})

// 16. FOLLOWS ordenação desc + limit default 20
test('GET /monitoring/follows ordena por followedAt desc e respeita limit default 20', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  try {
    // Cria 25 follows com timestamps espaçados
    const base = Date.now()
    for (let i = 0; i < 25; i++) {
      await db.followLog.create({
        data: {
          userId,
          channelJid: `c-${i}@newsletter`,
          status: i % 2 === 0 ? 'ok' : 'error',
          followedAt: new Date(base - i * 1000),
        },
      })
    }
    const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/follows' })
    const body = JSON.parse(res.body)
    assert.equal(body.items.length, 20, 'default limit=20')
    // O mais novo (i=0) deve estar primeiro
    assert.equal(body.items[0].channelJid, 'c-0@newsletter')
    assert.equal(body.items[19].channelJid, 'c-19@newsletter')
  } finally { await teardown(app, userId) }
})

// 17. FOLLOWS limit query param respeitado
test('GET /monitoring/follows?limit=5 respeita o limit', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  try {
    for (let i = 0; i < 10; i++) {
      await db.followLog.create({
        data: { userId, channelJid: `c-${i}`, status: 'ok' },
      })
    }
    const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/follows?limit=5' })
    const body = JSON.parse(res.body)
    assert.equal(body.items.length, 5)
  } finally { await teardown(app, userId) }
})

// 18. FOLLOWS limit é capado em 200
test('GET /monitoring/follows?limit=9999 é capado em 200', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  try {
    // só testa que não explode e que o limite ainda funciona
    const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/follows?limit=9999' })
    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.body)
    assert.ok(body.items.length <= 200)
  } finally { await teardown(app, userId) }
})

// 19. FOLLOWS limit inválido (string) cai pro default
test('GET /monitoring/follows?limit=abc usa default sem 500', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  try {
    const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/follows?limit=abc' })
    assert.equal(res.statusCode, 200)
  } finally { await teardown(app, userId) }
})

// 20. FOLLOWS isola por userId (não vaza follows de outro usuário)
test('GET /monitoring/follows não retorna follows de outro usuário', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  // cria outro usuário com follow
  const otherId = `pres-other-${Date.now()}-${Math.random()}`
  await db.user.create({
    data: { id: otherId, name: 'Other', email: `${otherId}@t.local`, passwordHash: 'x', plan: 'pro' },
  })
  await db.followLog.create({ data: { userId: otherId, channelJid: 'leak@nl', status: 'ok' } })
  try {
    const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/follows' })
    const body = JSON.parse(res.body)
    assert.ok(!body.items.some(i => i.channelJid === 'leak@nl'), 'não vaza follow de outro user')
  } finally {
    await db.followLog.deleteMany({ where: { userId: otherId } })
    await db.user.deleteMany({ where: { id: otherId } })
    await teardown(app, userId)
  }
})

// 21. SNAPSHOTS: count total e lastSnapshotAt por canal
test('GET /monitoring/snapshots retorna total e último por canal', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  try {
    const g = await seedGroup(userId, { name: 'CanalSnap', kind: 'channel' })
    const t1 = new Date(Date.now() - 86400_000)
    const t2 = new Date()
    await db.channelSnapshot.create({ data: { groupId: g.id, snapshotJson: '{}', snapshotedAt: t1 } })
    await db.channelSnapshot.create({ data: { groupId: g.id, snapshotJson: '{}', snapshotedAt: t2 } })

    const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/snapshots' })
    const body = JSON.parse(res.body)
    assert.equal(body.items.length, 1)
    assert.equal(body.items[0].total, 2)
    assert.equal(new Date(body.items[0].lastSnapshotAt).getTime(), t2.getTime())
  } finally { await teardown(app, userId) }
})

// 22. SNAPSHOTS: canal sem snapshots aparece com total=0 e lastSnapshotAt=null
test('GET /monitoring/snapshots: canal sem snapshots tem total=0 e lastSnapshotAt=null', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  try {
    await seedGroup(userId, { name: 'Vazio', kind: 'channel' })
    const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/snapshots' })
    const body = JSON.parse(res.body)
    assert.equal(body.items[0].total, 0)
    assert.equal(body.items[0].lastSnapshotAt, null)
  } finally { await teardown(app, userId) }
})

// 23. PROBE reflete probeEnabled e probeAccountSessionId do BotConfig
test('GET /monitoring/probe reflete probeEnabled=true e sessionId', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  try {
    await db.botConfig.upsert({
      where: { userId },
      create: { userId, probeEnabled: true, probeAccountSessionId: 'probe-sess-1' },
      update: { probeEnabled: true, probeAccountSessionId: 'probe-sess-1' },
    })
    const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/probe' })
    const body = JSON.parse(res.body)
    assert.equal(body.enabled, true)
    assert.equal(body.probeAccountSessionId, 'probe-sess-1')
  } finally { await teardown(app, userId) }
})

// 24. PROBE items inclui lastProbeSeenAt de cada canal
test('GET /monitoring/probe lista lastProbeSeenAt por canal', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  try {
    const g = await seedGroup(userId, { name: 'C1', kind: 'channel' })
    const seen = new Date(Date.now() - 60_000)
    await seedChannelHealth(g.id, { lastProbeSeenAt: seen })
    const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/probe' })
    const body = JSON.parse(res.body)
    assert.equal(new Date(body.items[0].lastProbeSeenAt).getTime(), seen.getTime())
  } finally { await teardown(app, userId) }
})

// 25. CLICKS conta apenas clicks dos últimos 7 dias (default) do usuário
test('GET /monitoring/clicks conta clicks dos últimos 7 dias do usuário', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  try {
    const link = await db.affiliateLink.create({
      data: { userId, hash: `h-${Date.now()}`, originalUrl: 'https://ex.com/x' },
    })
    // 2 clicks recentes, 1 antigo (10 dias)
    await db.affiliateClick.create({ data: { linkId: link.id } })
    await db.affiliateClick.create({ data: { linkId: link.id } })
    await db.affiliateClick.create({
      data: { linkId: link.id, clickedAt: new Date(Date.now() - 10 * 86400_000) },
    })
    const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/clicks' })
    const body = JSON.parse(res.body)
    assert.equal(body.total, 2, 'click antigo (>7d) é excluído')
    assert.equal(body.days, 7)
  } finally { await teardown(app, userId) }
})

// 26. CLICKS isola por userId
test('GET /monitoring/clicks não conta clicks de outro usuário', async () => {
  const { app, userId } = await buildApp({ plan: 'pro' })
  const otherId = `pres-clicks-other-${Date.now()}-${Math.random()}`
  await db.user.create({ data: { id: otherId, name: 'O', email: `${otherId}@t`, passwordHash: 'x', plan: 'pro' } })
  const otherLink = await db.affiliateLink.create({
    data: { userId: otherId, hash: `o-${Date.now()}`, originalUrl: 'https://x.com' },
  })
  await db.affiliateClick.create({ data: { linkId: otherLink.id } })
  try {
    const res = await app.inject({ method: 'GET', url: '/api/preservation/monitoring/clicks' })
    const body = JSON.parse(res.body)
    assert.equal(body.total, 0)
  } finally {
    await db.affiliateClick.deleteMany({ where: { link: { userId: otherId } } })
    await db.affiliateLink.deleteMany({ where: { userId: otherId } })
    await db.user.deleteMany({ where: { id: otherId } })
    await teardown(app, userId)
  }
})

// 27. GATING — todas as rotas de monitoring retornam 402 para basic
test('Monitoring: TODAS as rotas retornam 402 para basic', async () => {
  const { app, userId } = await buildApp({ plan: 'basic' })
  try {
    const routes = [
      ['GET', '/api/preservation/monitoring/health'],
      ['GET', '/api/preservation/monitoring/risk-score'],
      ['POST', '/api/preservation/monitoring/risk-score/recompute-all'],
      ['GET', '/api/preservation/monitoring/follows'],
      ['GET', '/api/preservation/monitoring/snapshots'],
      ['GET', '/api/preservation/monitoring/probe'],
      ['GET', '/api/preservation/monitoring/clicks'],
    ]
    for (const [method, url] of routes) {
      const res = await app.inject({ method, url })
      assert.equal(res.statusCode, 402, `${method} ${url} deveria ser 402`)
    }
  } finally { await teardown(app, userId) }
})

// 28. GATING — trial ativo libera TODAS as rotas de monitoring
test('Monitoring: trial ativo libera todas as rotas (200)', async () => {
  const future = new Date(Date.now() + 60_000)
  const { app, userId } = await buildApp({ plan: 'trial', accessExpiresAt: future })
  try {
    const routes = [
      '/api/preservation/monitoring/health',
      '/api/preservation/monitoring/risk-score',
      '/api/preservation/monitoring/follows',
      '/api/preservation/monitoring/snapshots',
      '/api/preservation/monitoring/probe',
      '/api/preservation/monitoring/clicks',
    ]
    for (const url of routes) {
      const res = await app.inject({ method: 'GET', url })
      assert.equal(res.statusCode, 200, `${url} deveria ser 200 com trial ativo`)
    }
  } finally { await teardown(app, userId) }
})
