import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../../../src/db.js'
import { adminRoutes } from '../../../src/api/routes/admin.js'

let counter = 0

async function buildApp() {
  const n = ++counter
  const stamp = `${n}-${Date.now()}`
  const adminId = `admin-dlq-${stamp}`
  await db.user.create({ data: { id: adminId, name: `Admin ${n}`, email: `admindlq-${stamp}@t.local`, passwordHash: 'x' } })
  await db.adminUser.create({ data: { userId: adminId, role: 'owner', status: 'active' } })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: adminId } })
  await app.register(adminRoutes)
  app.addHook('onClose', async () => {
    await db.adminAuditLog.deleteMany({ where: { adminUser: { userId: adminId } } }).catch(() => {})
    await db.adminUser.deleteMany({ where: { userId: adminId } })
    await db.user.deleteMany({ where: { id: adminId } })
  })
  return { app, adminId }
}

test('GET /send-dlq rejeita userId malformado com 400 (não deriva fila Redis de input cru)', async (t) => {
  const { app } = await buildApp()
  t.after(() => app.close())

  const res = await app.inject({ method: 'GET', url: '/send-dlq/bad%3Aid' })
  assert.equal(res.statusCode, 400)
})

test('POST /send-dlq/:userId/purge rejeita usuário inexistente com 404', async (t) => {
  const { app } = await buildApp()
  t.after(() => app.close())

  const res = await app.inject({ method: 'POST', url: '/send-dlq/nao-existe-xyz/purge' })
  assert.equal(res.statusCode, 404)
})

test('GET /send-dlq/:userId de usuário existente passa da validação (não retorna 400/404)', async (t) => {
  const { app, adminId } = await buildApp()
  t.after(() => app.close())

  // Sem REDIS_URL, listDlq falha com 503 — o ponto é que a validação de
  // ownership/formato deixou passar (não barrou em 400/404).
  const res = await app.inject({ method: 'GET', url: `/send-dlq/${adminId}` })
  assert.ok(res.statusCode !== 400 && res.statusCode !== 404, `esperava passar da validação, veio ${res.statusCode}`)
})
