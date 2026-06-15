import test from 'node:test'
import assert from 'node:assert/strict'
import { createAdminService } from '../src/domain/admin/service.js'

const referredUser = {
  id: 'user-referred',
  name: 'Cliente indicada',
  email: 'indicada@example.com',
  contactPhone: '5511999999999',
  status: 'active',
  plan: 'trial',
  accessExpiresAt: null,
  affiliateProfileId: 'affiliate-profile-1',
  affiliateRef: {
    code: 'PARCEIRA10',
    status: 'approved',
    user: { id: 'affiliate-user', name: 'Parceira Oficial', email: 'parceira@example.com' },
  },
  lastLoginAt: null,
  lastActivityAt: null,
  lastSupportContactAt: null,
  supportStatus: 'new',
  createdAt: new Date('2026-06-12T10:00:00.000Z'),
  waSession: null,
  groups: [],
  credentials: [],
  _count: { payments: 0, credentials: 0, messageLogs: 0 },
}

test('admin listUsers mantém a atribuição e os dados do afiliado indicador', async () => {
  let userSelect
  const db = {
    user: {
      count: async () => 1,
      findMany: async args => {
        userSelect = args.select
        return [referredUser]
      },
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
    summarizeCredentialHealth: () => ({}),
    buildRiskFlags: () => [],
    sanitizeUser: user => user,
    parseDateRange: () => ({ from: new Date(), to: new Date() }),
  })

  const result = await service.listUsers({ query: {}, adminRole: 'owner' })

  assert.deepEqual(userSelect.affiliateRef, {
    select: {
      code: true,
      status: true,
      user: { select: { id: true, name: true, email: true } },
    },
  })
  assert.equal(result.users[0].affiliateProfileId, 'affiliate-profile-1')
  assert.equal(result.users[0].affiliateRef.code, 'PARCEIRA10')
  assert.equal(result.users[0].affiliateRef.user.name, 'Parceira Oficial')
})
