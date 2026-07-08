import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import { CREDENTIAL_RULES_VERSION } from '../src/workerMetadata.js'
import { classifyWorkerHealth } from '../src/workerHealth.js'
import { credentialsRoutes } from '../src/api/routes/credentials.js'

let userCounter = 0

async function buildCredentialsApp({ reloadConfig = async () => true, getBotMetrics = async () => null, restartStaleWorker = async () => ({ attempted: false, reason: 'test_noop' }) } = {}) {
  const n = ++userCounter
  const userId = `sprint2-user-${n}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({
    data: {
      id: userId,
      name: `Sprint2 User ${n}`,
      email: `sprint2-${n}-${Date.now()}@tests.local`,
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

test('classifyWorkerHealth marks workers without metadata as stale after Sprint 1 rollout', () => {
  assert.deepEqual(classifyWorkerHealth({ pending: 0 }), {
    status: 'stale',
    reason: 'worker_metadata_missing',
    expectedCredentialRulesVersion: CREDENTIAL_RULES_VERSION,
    actualCredentialRulesVersion: null,
    restartRecommended: true,
  })
})

test('classifyWorkerHealth marks credential rule mismatch as stale', () => {
  assert.deepEqual(classifyWorkerHealth({ worker: { credentialRulesVersion: 'legacy-amazon-cookies-v0' } }), {
    status: 'stale',
    reason: 'credential_rules_version_mismatch',
    expectedCredentialRulesVersion: CREDENTIAL_RULES_VERSION,
    actualCredentialRulesVersion: 'legacy-amazon-cookies-v0',
    restartRecommended: true,
  })
})

test('classifyWorkerHealth marks current worker metadata as ok', () => {
  assert.deepEqual(classifyWorkerHealth({ worker: { credentialRulesVersion: CREDENTIAL_RULES_VERSION } }), {
    status: 'ok',
    reason: null,
    expectedCredentialRulesVersion: CREDENTIAL_RULES_VERSION,
    actualCredentialRulesVersion: CREDENTIAL_RULES_VERSION,
    restartRecommended: false,
  })
})

test('PUT /credentials/:platform returns stale workerHealth when active worker is still old code', async () => {
  const { app } = await buildCredentialsApp({
    reloadConfig: async () => true,
    getBotMetrics: async () => ({ pending: 0 }),
  })

  const res = await app.inject({
    method: 'PUT',
    url: '/amazon',
    payload: { tag: 'loja-20', cookie: 'session-id=abc; at-acbbr=token; x-acbbr=x; ubid-acbbr=u' },
  })

  assert.equal(res.statusCode, 200)
  assert.equal(res.json().configReloaded, true)
  assert.deepEqual(res.json().workerHealth, {
    status: 'stale',
    reason: 'worker_metadata_missing',
    expectedCredentialRulesVersion: CREDENTIAL_RULES_VERSION,
    actualCredentialRulesVersion: null,
    restartRecommended: true,
  })
  await app.close()
})
