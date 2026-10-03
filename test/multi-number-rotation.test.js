import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Fastify from 'fastify'
import db from '../src/db.js'
import { assignOwners, pickSender, sendQueueNameFor, isRoutableJob, senderHourlyCap, rotationEnabledByEnv } from '../src/domain/session/senderRouting.js'
import { createRotationRouter } from '../src/core/rotationRouter.js'
import { createBullmqProducer, findUnserializableField } from '../src/sendQueueBackend.js'
import { multiNumberRoutes } from '../src/api/routes/multiNumber.js'

const both = { 1: true, 2: true }

test('dono: só membro conectado; mantém dono válido; equilibra por volume', () => {
  const memberships = { 1: new Set(['a', 'b', 'c']), 2: new Set(['b', 'c', 'd']) }
  const owners = assignOwners({
    destinations: [{ waJid: 'a', volume: 10 }, { waJid: 'b', volume: 50 }, { waJid: 'c', volume: 40 }, { waJid: 'd', volume: 5 }, { waJid: 'x', volume: 99 }],
    memberships, connected: both,
  })
  assert.equal(owners.get('a'), 1)
  assert.equal(owners.get('d'), 2)
  assert.equal(owners.get('x'), null, 'nenhum número está no grupo')
  assert.notEqual(owners.get('b'), owners.get('c'), 'os dois maiores ficam em números diferentes')
  const again = assignOwners({ destinations: [{ waJid: 'b', volume: 50 }], memberships, connected: both, current: new Map([['b', 2]]) })
  assert.equal(again.get('b'), 2, 'dono válido é mantido')
  const down = assignOwners({ destinations: [{ waJid: 'b', volume: 50 }], memberships, connected: { 1: true, 2: false }, current: new Map([['b', 2]]) })
  assert.equal(down.get('b'), 1, 'dono desconectado perde o grupo')
})

test('remetente: teto por hora transborda só para o outro membro', () => {
  const owners = new Map([['g', 1], ['h', 1]])
  const memberships = { 1: new Set(['g', 'h']), 2: new Set(['g']) }
  assert.equal(pickSender({ waJid: 'g', owners, memberships, connected: both, hourlyCounts: { 1: 5 }, hourlyCap: 10, fallbackSlot: 1 }), 1)
  assert.equal(pickSender({ waJid: 'g', owners, memberships, connected: both, hourlyCounts: { 1: 10 }, hourlyCap: 10, fallbackSlot: 1 }), 2)
  assert.equal(pickSender({ waJid: 'h', owners, memberships, connected: both, hourlyCounts: { 1: 10 }, hourlyCap: 10, fallbackSlot: 1 }), 1, 'outro não é membro: fica com o dono')
  assert.equal(pickSender({ waJid: 'z', owners, memberships, connected: both, fallbackSlot: 2 }), 2, 'sem dono → quem chamou')
  assert.equal(senderHourlyCap({}), Infinity)
  assert.equal(rotationEnabledByEnv({ MULTI_NUMBER_ROTATION_ENABLED: 'true' }), true)
})

test('fila por processo: a da conta não muda de nome', () => {
  assert.equal(sendQueueNameFor({ processKey: 'u1' }), 'wabot-send-u1')
  assert.equal(sendQueueNameFor({ processKey: 'u1~n2', isStandby: true }), 'wabot-send-u1~n2')
  assert.equal(sendQueueNameFor({ processKey: 'u1', override: 'fila' }), 'fila')
  assert.equal(sendQueueNameFor({ processKey: 'u1~n2', isStandby: true, override: 'fila' }), 'fila~n2')
})

test('só atravessa processo: grupo, serializável, sem onDone', () => {
  const opts = { findUnserializableField }
  assert.equal(isRoutableJob({ destJid: 'g@g.us', logId: 'l', payloadRecipe: { text: 'x' } }, opts), true)
  assert.equal(isRoutableJob({ destJid: '1@newsletter', logId: 'l' }, opts), false)
  assert.equal(isRoutableJob({ destJid: 'g@g.us', onDone: () => {} }, opts), false)
  assert.equal(isRoutableJob({ destJid: 'g@g.us', buildPayload: () => ({}) }, opts), false)
  assert.equal(isRoutableJob({ destJid: 'g@g.us', media: Buffer.from('x') }, opts), false)
})

test('produtor: mesmo jobId do backend e devolução (reclaim) só do que foi aceito', async () => {
  const added = []
  const stored = [{ data: { logId: 'a' }, removed: false, remove() { this.removed = true; return Promise.resolve() } }, { data: { logId: 'b' }, removed: false, remove() { this.removed = true; return Promise.resolve() } }]
  class Queue {
    constructor(name) { this.name = name }
    add(name, data, opts) { added.push({ name, data, opts }); return Promise.resolve() }
    getJobs() { return Promise.resolve(stored) }
    close() { return Promise.resolve() }
  }
  const p = await createBullmqProducer({ redisUrl: 'redis://x', queueName: 'wabot-send-u~n2', bullmqModule: { Queue } })
  assert.equal(await p.enqueue({ logId: 'L1', destJid: 'g@g.us' }), true)
  assert.equal(added[0].opts.jobId, 'L1')
  assert.equal(await p.enqueue({ logId: 'L2', buildPayload: () => ({}) }), false)
  const moved = await p.reclaim(async data => data.logId === 'a')
  assert.equal(moved, 1)
  assert.deepEqual(stored.map(j => j.removed), [true, false])
})

test('roteador com banco: rodízio desligado/sem outro número → sempre local', async () => {
  const id = `user-rot-${Date.now()}`
  await db.user.create({ data: { id, name: 'R', email: `${id}@t.local`, passwordHash: 'x', plan: 'pro', extraNumbers: 1 } })
  try {
    await db.group.createMany({ data: [{ userId: id, waJid: 'g1@g.us', name: 'G1', role: 'post' }, { userId: id, waJid: 'g2@g.us', name: 'G2', role: 'post' }] })
    await db.waGroupMembership.createMany({ data: [
      { userId: id, slot: 1, waJid: 'g1@g.us' }, { userId: id, slot: 1, waJid: 'g2@g.us' },
      { userId: id, slot: 2, waJid: 'g2@g.us' },
    ] })
    const router = () => createRotationRouter({ db, userId: id, localSlot: 1, logger: { warn() {} } })
    assert.equal(await router().chooseSlot('g2@g.us'), 1, 'rotationEnabled=false')
    await db.user.update({ where: { id }, data: { rotationEnabled: true } })
    assert.equal(await router().chooseSlot('g2@g.us'), 1, 'outro número sem prontidão conectada')
    await db.waExtraSession.create({ data: { userId: id, slot: 2, status: 'connected', lastHeartbeatAt: new Date() } })
    const r = router()
    const picks = [await r.chooseSlot('g1@g.us'), await r.chooseSlot('g2@g.us')]
    assert.equal(picks[0], 1, 'g1 só tem o número 1')
    assert.equal(picks[1], 2, 'g2 vai para o número 2 (equilíbrio)')
    const rows = await db.destinationSender.findMany({ where: { userId: id }, orderBy: { destJid: 'asc' } })
    assert.deepEqual(rows.map(x => [x.destJid, x.slot]), [['g1@g.us', 1], ['g2@g.us', 2]])
    assert.equal(r.remoteIsUp(), true)
  } finally {
    await db.user.deleteMany({ where: { id } })
  }
})

test('API do rodízio: 404 sem a flag, liga/desliga e mostra dono e membros', async () => {
  const id = `user-rotapi-${Date.now()}`
  await db.user.create({ data: { id, name: 'A', email: `${id}@t.local`, passwordHash: 'x', plan: 'pro', extraNumbers: 1, accessExpiresAt: new Date(Date.now() + 864e5) } })
  const build = async env => {
    const app = Fastify({ logger: false })
    app.decorate('authenticate', async req => { req.user = { sub: id } })
    await app.register(multiNumberRoutes, { prefix: '/api/multi-number', manager: { isRunning: () => true }, env })
    return app
  }
  try {
    const off = await build({ MULTI_NUMBER_ENABLED: 'true' })
    assert.equal((await off.inject({ method: 'GET', url: '/api/multi-number/rotation' })).statusCode, 404)
    const app = await build({ MULTI_NUMBER_ENABLED: 'true', MULTI_NUMBER_ROTATION_ENABLED: 'true' })
    await db.group.create({ data: { userId: id, waJid: 'g1@g.us', name: 'G1', role: 'post' } })
    await db.destinationSender.create({ data: { userId: id, destJid: 'g1@g.us', slot: 2 } })
    await db.waGroupMembership.create({ data: { userId: id, slot: 2, waJid: 'g1@g.us' } })
    assert.equal((await app.inject({ method: 'POST', url: '/api/multi-number/rotation', payload: { enabled: true } })).json().enabled, true)
    const view = (await app.inject({ method: 'GET', url: '/api/multi-number/rotation' })).json()
    assert.equal(view.enabled, true)
    assert.deepEqual(view.groups, [{ waJid: 'g1@g.us', name: 'G1', senderSlot: 2, members: { 1: false, 2: true } }])
  } finally {
    await db.analyticsEvent.deleteMany({ where: { userId: id } })
    await db.user.deleteMany({ where: { id } })
  }
})

test('estrutural: só o ativo roteia; prontidão só envia com o rodízio; fila por processo', () => {
  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(src, /const ROTATION_ON = MULTI_NUMBER_ON && rotationEnabledByEnv\(\)/)
  assert.match(src, /const CAN_SEND = !IS_STANDBY \|\| ROTATION_ON/)
  assert.match(src, /const rotationRouter = ROTATION_ON && !IS_STANDBY/)
  assert.match(src, /if \(await routeToOtherNumber\(job, normalizedJob\)\) return true\n\s+return sendBackend\.enqueue\(normalizedJob\)/)
  assert.match(src, /const BULLMQ_QUEUE_NAME = sendQueueNameFor\(\{ processKey: SESSION_IDENTITY\.processKey/)
  // Escuta (messages.upsert) segue bloqueada na prontidão mesmo com rodízio.
  assert.match(src, /markUpsertReceived\(\)\n\s+\/\/[^\n]*\n\s+if \(IS_STANDBY\) return/)
  // Reprocessar falhas da conta continua só no ativo.
  assert.match(src, /if \(!IS_STANDBY && !interruptedSendLogsMarked\)/)
})
