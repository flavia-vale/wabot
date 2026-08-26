import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../../../src/db.js'
import { adminRoutes } from '../../../src/api/routes/admin.js'

let counter = 0

async function buildApp() {
  const stamp = `${++counter}-${Date.now()}`
  const adminId = `admin-automation-${stamp}`
  const customerId = `customer-automation-${stamp}`
  await db.user.createMany({ data: [
    { id: adminId, name: 'Admin Automações', email: `admin-${stamp}@t.local`, passwordHash: 'x' },
    { id: customerId, name: 'Cliente Teste', email: `cliente-${stamp}@t.local`, passwordHash: 'x' },
  ] })
  await db.adminUser.create({ data: { userId: adminId, role: 'owner', status: 'active' } })
  await db.offerAutomation.createMany({ data: [
    { userId: customerId, destGroupJid: '1@g.us', destGroupName: 'Grupo 1', keyword: 'casa', intervalMinutes: 60, enabled: true },
    { userId: customerId, destGroupJid: '2@g.us', destGroupName: 'Grupo 2', keyword: 'moda', intervalMinutes: 60, enabled: true },
    { userId: customerId, destGroupJid: '3@g.us', destGroupName: 'Grupo 3', keyword: 'beleza', intervalMinutes: 60, enabled: false },
  ] })

  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: adminId } })
  await app.register(adminRoutes)
  app.addHook('onClose', async () => {
    await db.adminAuditLog.deleteMany({ where: { adminUser: { userId: adminId } } }).catch(() => {})
    await db.offerAutomation.deleteMany({ where: { userId: customerId } })
    await db.adminUser.deleteMany({ where: { userId: adminId } })
    await db.user.deleteMany({ where: { id: { in: [adminId, customerId] } } })
  })
  return { app, customerId }
}

test('painel lista contagem ativa, total e limite padrão por cliente', async (t) => {
  const { app, customerId } = await buildApp()
  t.after(() => app.close())

  // Também cobre a busca: no SQLite, incluir `mode: insensitive` causa erro
  // de validação do Prisma em vez de retornar o cliente.
  const response = await app.inject({ method: 'GET', url: '/automation-quota?search=CLIENTE' })

  assert.equal(response.statusCode, 200)
  const customer = response.json().users.find((user) => user.id === customerId)
  assert.deepEqual(customer && {
    activeAutomations: customer.activeAutomations,
    totalAutomations: customer.totalAutomations,
    maxAutomations: customer.maxAutomations,
  }, { activeAutomations: 2, totalAutomations: 3, maxAutomations: 30 })
})

test('admin edita o limite e a alteração persiste no cliente', async (t) => {
  const { app, customerId } = await buildApp()
  t.after(() => app.close())

  const response = await app.inject({
    method: 'PATCH',
    url: `/automation-quota/${customerId}`,
    payload: { maxAutomations: 45 },
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().maxAutomations, 45)
  assert.equal((await db.user.findUnique({ where: { id: customerId } })).maxAutomations, 45)
})

test('admin rejeita limites vazios, fracionários ou fora da faixa', async (t) => {
  const { app, customerId } = await buildApp()
  t.after(() => app.close())

  for (const maxAutomations of [null, '', 2.5, 0, 201]) {
    const response = await app.inject({
      method: 'PATCH',
      url: `/automation-quota/${customerId}`,
      payload: { maxAutomations },
    })
    assert.equal(response.statusCode, 400, `valor inválido aceito: ${String(maxAutomations)}`)
  }
  assert.equal((await db.user.findUnique({ where: { id: customerId } })).maxAutomations, 30)
})
