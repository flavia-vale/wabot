import test from 'node:test'
import assert from 'node:assert/strict'
import { createAdminService } from '../src/domain/admin/service.js'

const baseUser = {
  id: 'u1',
  name: 'Cliente Ativa',
  email: 'cliente@example.com',
  contactPhone: '11999999999',
  status: 'active',
  plan: 'pro',
  accessExpiresAt: new Date('2026-12-31T00:00:00.000Z'),
  lastLoginAt: null,
  lastActivityAt: new Date('2026-06-20T10:00:00.000Z'),
  lastSupportContactAt: null,
  supportStatus: 'new',
  createdAt: new Date('2026-06-01T10:00:00.000Z'),
  waSession: {
    status: 'disconnected',
    phone: '5511999999999',
    updatedAt: new Date('2026-06-28T10:00:00.000Z'),
    lastHeartbeatAt: null,
    lastDisconnectCode: '428',
    lifecycle: 'idle',
  },
  groups: [{ role: 'monitor' }, { role: 'post' }],
  credentials: [{ platform: 'mercadolivre', data: '{}' }],
  _count: { payments: 1, credentials: 1, messageLogs: 3 },
}

function makeService({ users = [baseUser], successCount = 2, sanitizeUser = user => user } = {}) {
  const db = {
    user: {
      findMany: async () => users,
    },
    messageLog: {
      groupBy: async args => {
        assert.equal(args.where.status, 'success')
        return successCount > 0 ? [{ userId: 'u1', _max: { sentAt: new Date('2026-06-27T10:00:00.000Z') } }] : []
      },
    },
  }

  return createAdminService({
    db,
    listRunningBots: async () => [],
    getOperationalOverview: async () => ({}),
    getPagination: () => ({ page: 1, limit: 25, skip: 0 }),
    addDays: (date, days) => new Date(date.getTime() + days * 86400000),
    getLogCountMap: async ({ status }) => status === 'success' ? new Map([['u1', successCount]]) : new Map(),
    getLogActivityMap: async () => new Map([['u1', new Date('2026-06-27T10:00:00.000Z')]]),
    getGroupCounts: groups => groups.reduce((acc, group) => ({ ...acc, total: acc.total + 1, [group.role]: (acc[group.role] || 0) + 1 }), { total: 0, monitor: 0, post: 0 }),
    getAccessStatus: () => 'active',
    resolveEffectiveLastActivity: (_user, lastMessageAt) => lastMessageAt,
    summarizeCredentialHealth: () => [{ platform: 'mercadolivre', label: 'Mercado Livre', status: 'configured' }],
    buildRiskFlags: () => ['wa_disconnected'],
    sanitizeUser,
    parseDateRange: () => ({ from: new Date(), to: new Date() }),
  })
}

test('admin lista clientes com WhatsApp desconectado que já tiveram sucesso e monta CTA', async () => {
  const service = makeService()
  const result = await service.listWaDisconnectedUsers({ query: { minSuccess: '1' }, adminRole: 'owner' })

  assert.equal(result.total, 1)
  assert.equal(result.summary.paidAtRisk, 1)
  assert.equal(result.summary.estimatedMrrAtRisk, 69)
  assert.equal(result.users[0].email, 'cliente@example.com')
  assert.equal(result.users[0].successCount, 2)
  assert.equal(result.users[0].priorityLabel, 'Pagante em risco')
  assert.match(result.users[0].whatsappContactUrl, /^https:\/\/wa\.me\/5511999999999\?text=/)
})

test('admin não lista WA desconectado sem sucesso anterior quando minSuccess=1', async () => {
  const service = makeService({ successCount: 0 })
  const result = await service.listWaDisconnectedUsers({ query: { minSuccess: '1' }, adminRole: 'owner' })

  assert.equal(result.total, 0)
  assert.equal(result.users.length, 0)
})

test('admin não expõe CTA de WhatsApp quando telefone é mascarado', async () => {
  const service = makeService({ sanitizeUser: user => ({ ...user, contactPhone: '119*****99', waSession: { ...user.waSession, phone: '551*****99' } }) })
  const result = await service.listWaDisconnectedUsers({ query: { minSuccess: '1' }, adminRole: 'read_only' })

  assert.equal(result.total, 1)
  assert.equal(result.users[0].whatsappContactUrl, null)
})

test('admin listUsers aceita filtro explícito de WhatsApp off', async () => {
  let userWhere
  const db = {
    user: {
      count: async args => {
        userWhere = args.where
        return 0
      },
      findMany: async () => [],
    },
  }
  const service = createAdminService({
    db,
    listRunningBots: async () => [],
    getOperationalOverview: async () => ({}),
    getPagination: () => ({ page: 1, limit: 25, skip: 0 }),
    addDays: (date, days) => new Date(date.getTime() + days * 86400000),
    getLogCountMap: async () => new Map(),
    getLogActivityMap: async () => new Map(),
    getGroupCounts: () => ({ total: 0, monitor: 0, post: 0 }),
    getAccessStatus: () => 'active',
    resolveEffectiveLastActivity: () => null,
    summarizeCredentialHealth: () => [],
    buildRiskFlags: () => [],
    sanitizeUser: user => user,
    parseDateRange: () => ({ from: new Date(), to: new Date() }),
  })

  await service.listUsers({ query: { risk: 'wa_disconnected' }, adminRole: 'owner' })

  assert.deepEqual(userWhere.OR, [
    { waSession: { is: null } },
    { waSession: { is: { status: { not: 'connected' } } } },
  ])
})
