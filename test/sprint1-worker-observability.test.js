import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import { buildWorkerMetadata, CREDENTIAL_RULES_VERSION } from '../src/workerMetadata.js'
import { credentialsRoutes } from '../src/api/routes/credentials.js'
import { createReloadConfigHandler } from '../src/supervisor/commandHandlers.js'

let userCounter = 0

async function buildCredentialsApp({ reloadConfig = async () => true } = {}) {
  const n = ++userCounter
  const userId = `sprint1-user-${n}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({
    data: {
      id: userId,
      name: `Sprint User ${n}`,
      email: `sprint1-${n}-${Date.now()}@tests.local`,
      passwordHash: 'x',
    },
  })

  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(credentialsRoutes, { reloadConfig })
  app.addHook('onClose', async () => {
    await db.credential.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
  })
  return { app, userId }
}

test('buildWorkerMetadata exposes safe worker identity and credential rules version', () => {
  const metadata = buildWorkerMetadata({
    userId: 'user-123',
    startedAt: 1783461811511,
    gitSha: 'abc1234',
    pid: 321,
    ppid: 123,
    cwd: '/repo',
    nodeVersion: 'v22.22.2',
  })

  assert.equal(metadata.userId, 'user-123')
  assert.equal(metadata.pid, 321)
  assert.equal(metadata.ppid, 123)
  assert.equal(metadata.startedAt, '2026-07-07T22:03:31.511Z')
  assert.equal(metadata.gitSha, 'abc1234')
  assert.equal(metadata.cwd, '/repo')
  assert.equal(metadata.nodeVersion, 'v22.22.2')
  assert.equal(metadata.credentialRulesVersion, CREDENTIAL_RULES_VERSION)
})

test('PUT /credentials/:platform awaits remote reloadConfig and returns real result', async () => {
  let reloadStarted = false
  let reloadFinished = false
  const { app } = await buildCredentialsApp({
    reloadConfig: async () => {
      reloadStarted = true
      await new Promise(resolve => setTimeout(resolve, 25))
      reloadFinished = true
      return true
    },
  })

  const res = await app.inject({
    method: 'PUT',
    url: '/amazon',
    payload: { tag: 'loja-20', cookie: 'session-id=abc; at-acbbr=token; x-acbbr=x; ubid-acbbr=u' },
  })

  assert.equal(res.statusCode, 200)
  assert.equal(reloadStarted, true)
  assert.equal(reloadFinished, true)
  assert.equal(res.json().configReloaded, true)
  assert.equal(res.json().configReloadError, null)
  await app.close()
})

test('PUT /credentials/:platform reports reloadConfig failure without losing saved credential', async () => {
  const { app, userId } = await buildCredentialsApp({
    reloadConfig: async () => { throw new Error('redis offline') },
  })

  const res = await app.inject({
    method: 'PUT',
    url: '/amazon',
    payload: { tag: 'loja-20', cookie: 'session-id=abc; at-acbbr=token; x-acbbr=x; ubid-acbbr=u' },
  })

  assert.equal(res.statusCode, 200)
  assert.equal(res.json().configReloaded, false)
  assert.equal(res.json().configReloadError, 'redis offline')
  const saved = await db.credential.findUnique({ where: { userId_platform: { userId, platform: 'amazon' } } })
  assert.ok(saved)
  await app.close()
})

test('createReloadConfigHandler logs shard misses and successful worker reloads', async () => {
  const logs = []
  const logger = { info: (data, msg) => logs.push({ level: 'info', data, msg }), warn: (data, msg) => logs.push({ level: 'warn', data, msg }) }
  const calls = []
  const handler = createReloadConfigHandler({
    belongsToThisShard: (userId) => userId !== 'other-shard',
    sessionCore: { reloadConfig: (userId) => { calls.push(userId); return userId === 'known-user' } },
    logger,
  })

  assert.equal(await handler({ userId: 'known-user' }), true)
  assert.equal(await handler({ userId: 'missing-worker' }), false)
  assert.equal(await handler({ userId: 'other-shard' }), false)

  assert.deepEqual(calls, ['known-user', 'missing-worker'])
  assert.ok(logs.some(l => l.msg === 'Supervisor reloadConfig aplicado' && l.data.userId === 'known-user' && l.data.workerFound === true))
  assert.ok(logs.some(l => l.msg === 'Supervisor reloadConfig sem worker ativo' && l.data.userId === 'missing-worker' && l.data.workerFound === false))
  assert.ok(logs.some(l => l.msg === 'Supervisor reloadConfig ignorado: usuário pertence a outro shard' && l.data.userId === 'other-shard'))
})
