import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'

import db from '../../../src/db.js'
import { adminRoutes } from '../../../src/api/routes/admin.js'

// Para passar pelo `requireAdmin`, criamos o usuário com um dos emails de
// bootstrap admin (DEFAULT_BOOTSTRAP_ADMIN_EMAILS em admin.js). Esse path
// dá role 'owner' direto sem precisar de AdminUser separado.
const BOOTSTRAP_EMAIL = 'flavia.vale@usp.br'

let counter = 0

async function buildApp({ sendDlqMock } = {}) {
  const n = ++counter
  const userId = `admin-dlq-test-${n}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  // Reusar o mesmo email do bootstrap em tests paralelos não funciona —
  // o User table tem email como unique. Como bootstrap aceita variantes
  // de capitalização e plus-addressing, geramos um único por teste.
  // Mas o resolveAdminAccess compara contra a Set de emails canônicos,
  // que NÃO inclui variantes. Solução: usamos o canônico e isolamos
  // entre testes deletando logo após.
  const baseEmail = BOOTSTRAP_EMAIL
  // Limpa qualquer User anterior com esse email
  await db.user.deleteMany({ where: { email: baseEmail } }).catch(() => {})

  await db.user.create({
    data: {
      id: userId,
      name: `Admin Test ${n}`,
      email: baseEmail,
      passwordHash: 'x',
      plan: 'pro',
    },
  })

  const app = Fastify({ logger: false })
  app.decorate('authenticate', async req => { req.user = { sub: userId } })
  // MFA: ADMIN_MFA_TOKEN vazio = pula MFA (default em test)
  delete process.env.ADMIN_MFA_TOKEN
  await app.register(adminRoutes, {
    prefix: '/api/admin',
    sendDlqModule: sendDlqMock,
  })
  app.addHook('onClose', async () => {
    await db.adminAuditLog.deleteMany({ where: { actorUserId: userId } }).catch(() => {})
    await db.user.deleteMany({ where: { id: userId } }).catch(() => {})
  })
  return { app, userId, email: baseEmail }
}

// Mock minimal dos 4 helpers do sendDlq.js
function makeSendDlqMock(overrides = {}) {
  return {
    listDlq: overrides.listDlq ?? (async ({ userId, limit }) => ({
      queue: `wabot-send-${userId}-dlq`,
      total: 0,
      jobs: [],
      _calledWith: { userId, limit },
    })),
    retryDlqJob: overrides.retryDlqJob ?? (async ({ userId, dlqJobId }) => ({
      ok: true,
      requeuedTo: `wabot-send-${userId}`,
      logId: 99,
      _calledWith: { userId, dlqJobId },
    })),
    discardDlqJob: overrides.discardDlqJob ?? (async ({ userId, dlqJobId }) => ({
      ok: true,
      _calledWith: { userId, dlqJobId },
    })),
    purgeDlq: overrides.purgeDlq ?? (async ({ userId }) => ({
      ok: true,
      removed: 0,
      _calledWith: { userId },
    })),
  }
}

// ---------- GET /send-dlq/:userId ----------

test('GET /api/admin/send-dlq/:userId chama listDlq com userId e limit', async (t) => {
  const calls = []
  const { app, userId } = await buildApp({
    sendDlqMock: makeSendDlqMock({
      listDlq: async args => { calls.push(args); return { queue: 'q', total: 5, jobs: [] } },
    }),
  })
  t.after(() => app.close())

  const res = await app.inject({ method: 'GET', url: `/api/admin/send-dlq/${userId}?limit=50` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.total, 5)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].userId, userId)
  assert.equal(calls[0].limit, 50)
})

test('GET /send-dlq usa default limit=100 quando query ausente', async (t) => {
  const calls = []
  const { app, userId } = await buildApp({
    sendDlqMock: makeSendDlqMock({
      listDlq: async args => { calls.push(args); return { queue: 'q', total: 0, jobs: [] } },
    }),
  })
  t.after(() => app.close())

  await app.inject({ method: 'GET', url: `/api/admin/send-dlq/${userId}` })
  assert.equal(calls[0].limit, 100)
})

test('GET /send-dlq clamp limit em 500 (proteção contra payload gigante)', async (t) => {
  const calls = []
  const { app, userId } = await buildApp({
    sendDlqMock: makeSendDlqMock({
      listDlq: async args => { calls.push(args); return { queue: 'q', total: 0, jobs: [] } },
    }),
  })
  t.after(() => app.close())

  await app.inject({ method: 'GET', url: `/api/admin/send-dlq/${userId}?limit=99999` })
  assert.equal(calls[0].limit, 500)
})

test('GET /send-dlq retorna 503 quando helper lança (ex: sem REDIS_URL)', async (t) => {
  const { app, userId } = await buildApp({
    sendDlqMock: makeSendDlqMock({
      listDlq: async () => { throw new Error('REDIS_URL ausente — DLQ só funciona com backend BullMQ') },
    }),
  })
  t.after(() => app.close())

  const res = await app.inject({ method: 'GET', url: `/api/admin/send-dlq/${userId}` })
  assert.equal(res.statusCode, 503)
  assert.match(res.json().error, /REDIS_URL ausente/)
})

// ---------- POST /send-dlq/:userId/retry/:jobId ----------

test('POST /retry encaminha userId+jobId e devolve resultado', async (t) => {
  const calls = []
  const { app, userId } = await buildApp({
    sendDlqMock: makeSendDlqMock({
      retryDlqJob: async args => { calls.push(args); return { ok: true, requeuedTo: 'q', logId: 7 } },
    }),
  })
  t.after(() => app.close())

  const res = await app.inject({ method: 'POST', url: `/api/admin/send-dlq/${userId}/retry/abc-123` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.logId, 7)
  assert.equal(calls[0].dlqJobId, 'abc-123')
  assert.equal(calls[0].userId, userId)
})

// ---------- DELETE /send-dlq/:userId/job/:jobId ----------

test('DELETE /job remove o job', async (t) => {
  const calls = []
  const { app, userId } = await buildApp({
    sendDlqMock: makeSendDlqMock({
      discardDlqJob: async args => { calls.push(args); return { ok: true } },
    }),
  })
  t.after(() => app.close())

  const res = await app.inject({ method: 'DELETE', url: `/api/admin/send-dlq/${userId}/job/xyz` })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), { ok: true })
  assert.equal(calls[0].dlqJobId, 'xyz')
})

// ---------- POST /send-dlq/:userId/purge ----------

test('POST /purge drena toda a DLQ e devolve contagem', async (t) => {
  const calls = []
  const { app, userId } = await buildApp({
    sendDlqMock: makeSendDlqMock({
      purgeDlq: async args => { calls.push(args); return { ok: true, removed: 42 } },
    }),
  })
  t.after(() => app.close())

  const res = await app.inject({ method: 'POST', url: `/api/admin/send-dlq/${userId}/purge` })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.removed, 42)
  assert.equal(calls[0].userId, userId)
})

// ---------- audit log ----------

test('todas as ações gravam AdminAuditLog', async (t) => {
  const { app, userId } = await buildApp({ sendDlqMock: makeSendDlqMock() })
  t.after(() => app.close())

  await app.inject({ method: 'GET', url: `/api/admin/send-dlq/${userId}` })
  await app.inject({ method: 'POST', url: `/api/admin/send-dlq/${userId}/retry/jid` })
  await app.inject({ method: 'DELETE', url: `/api/admin/send-dlq/${userId}/job/jid` })
  await app.inject({ method: 'POST', url: `/api/admin/send-dlq/${userId}/purge` })

  const logs = await db.adminAuditLog.findMany({
    where: { actorUserId: userId, resource: 'sendDlq' },
    orderBy: { createdAt: 'asc' },
  })
  const actions = logs.map(l => l.action)
  assert.deepEqual(actions, [
    'admin.sendDlq.list',
    'admin.sendDlq.retry',
    'admin.sendDlq.discard',
    'admin.sendDlq.purge',
  ])
})

// ---------- permission gate ----------

test('usuário sem bootstrap admin recebe 403', async (t) => {
  // Cria usuário com email NÃO listado nos bootstraps
  const n = ++counter
  const userId = `non-admin-${n}-${Date.now()}`
  await db.user.create({
    data: { id: userId, name: 'X', email: `non-admin-${n}@x.local`, passwordHash: 'x', plan: 'pro' },
  })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async req => { req.user = { sub: userId } })
  await app.register(adminRoutes, { prefix: '/api/admin', sendDlqModule: makeSendDlqMock() })
  t.after(async () => {
    await db.adminAuditLog.deleteMany({ where: { actorUserId: userId } }).catch(() => {})
    await db.user.deleteMany({ where: { id: userId } }).catch(() => {})
    await app.close()
  })

  const res = await app.inject({ method: 'GET', url: `/api/admin/send-dlq/${userId}` })
  assert.equal(res.statusCode, 403)
})
