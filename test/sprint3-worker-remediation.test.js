import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import { CREDENTIAL_RULES_VERSION } from '../src/workerMetadata.js'
import { restartStaleWorkerIfNeeded } from '../src/workerRemediation.js'
import { credentialsRoutes } from '../src/api/routes/credentials.js'

let userCounter = 0

async function buildCredentialsApp({ reloadConfig = async () => true, getBotMetrics = async () => null, restartStaleWorker = async () => ({ attempted: false, reason: 'not_needed' }) } = {}) {
  const n = ++userCounter
  const userId = `sprint3-user-${n}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({
    data: {
      id: userId,
      name: `Sprint3 User ${n}`,
      email: `sprint3-${n}-${Date.now()}@tests.local`,
      passwordHash: 'x',
    },
  })

  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(credentialsRoutes, { reloadConfig, getBotMetrics, restartStaleWorker })
  app.addHook('onClose', async () => {
    await db.credential.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
  })
  return { app, userId }
}

test('restartStaleWorkerIfNeeded does not touch workers when health is ok', async () => {
  const calls = []
  const result = await restartStaleWorkerIfNeeded({
    userId: 'u1',
    platform: 'amazon',
    workerHealth: { status: 'ok', restartRecommended: false },
    stopBot: async () => { calls.push('stop') },
    startBot: async () => { calls.push('start') },
    isRunning: async () => false,
  })

  assert.deepEqual(result, { attempted: false, reason: 'worker_current' })
  assert.deepEqual(calls, [])
})

test('restartStaleWorkerIfNeeded restarts stale Amazon worker after it exits', async () => {
  const calls = []
  let runningChecks = 0
  const result = await restartStaleWorkerIfNeeded({
    userId: 'u1',
    platform: 'amazon',
    workerHealth: { status: 'stale', reason: 'worker_metadata_missing', restartRecommended: true },
    stopBot: async (userId) => { calls.push(['stop', userId]); return true },
    startBot: async (userId) => { calls.push(['start', userId]); return true },
    isRunning: async () => { runningChecks += 1; return runningChecks < 2 },
    sleep: async () => {},
    timeoutMs: 1000,
    pollMs: 10,
  })

  assert.deepEqual(result, {
    attempted: true,
    reason: 'stale_worker_restarted',
    stopped: true,
    started: true,
    timedOutWaitingStop: false,
  })
  assert.deepEqual(calls, [['stop', 'u1'], ['start', 'u1']])
})

test('PUT /credentials/:platform remediates stale Amazon worker and returns workerRestart', async () => {
  const restarts = []
  const { app } = await buildCredentialsApp({
    reloadConfig: async () => true,
    getBotMetrics: async () => ({ worker: { credentialRulesVersion: 'legacy-amazon-cookies-v0' } }),
    restartStaleWorker: async ({ userId, platform, workerHealth }) => {
      restarts.push({ userId, platform, workerHealth })
      return { attempted: true, reason: 'stale_worker_restarted', stopped: true, started: true, timedOutWaitingStop: false }
    },
  })

  const res = await app.inject({
    method: 'PUT',
    url: '/amazon',
    payload: { tag: 'loja-20', cookie: 'session-id=abc; at-acbbr=token; x-acbbr=x; ubid-acbbr=u' },
  })

  assert.equal(res.statusCode, 200)
  assert.equal(restarts.length, 1)
  assert.equal(restarts[0].platform, 'amazon')
  assert.equal(restarts[0].workerHealth.reason, 'credential_rules_version_mismatch')
  assert.deepEqual(res.json().workerRestart, {
    attempted: true,
    reason: 'stale_worker_restarted',
    stopped: true,
    started: true,
    timedOutWaitingStop: false,
  })
  assert.equal(res.json().workerHealth.expectedCredentialRulesVersion, CREDENTIAL_RULES_VERSION)
  await app.close()
})
