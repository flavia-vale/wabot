import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReferrals } from '../src/domain/affiliate/service.js'

test('buildReferrals agrega commissionAmountCents por referredUserId', () => {
  const users = [
    { id: 'u1', name: 'João', plan: 'pro', status: 'active', accessExpiresAt: new Date(Date.now() + 86400000) },
    { id: 'u2', name: 'Maria', plan: 'basic', status: 'inactive', accessExpiresAt: null },
  ]
  const commissions = [
    { referredUserId: 'u1', commissionAmountCents: 2000 },
    { referredUserId: 'u1', commissionAmountCents: 1500 },
    { referredUserId: 'u2', commissionAmountCents: 3000 },
  ]
  const result = buildReferrals(users, commissions)
  assert.equal(result[0].totalCommissionsCents, 3500)
  assert.equal(result[1].totalCommissionsCents, 3000)
  assert.equal(result[0].name, 'João')
  assert.equal('email' in result[0], false, 'não deve expor email por padrão')
})

test('buildReferrals com includeEmail=true expõe email', () => {
  const users = [{ id: 'u1', name: 'João', email: 'j@ex.com', plan: 'pro', status: 'active', accessExpiresAt: null }]
  const result = buildReferrals(users, [], true)
  assert.equal(result[0].email, 'j@ex.com')
})

test('buildReferrals retorna totalCommissionsCents=0 para usuário sem comissões', () => {
  const users = [{ id: 'u1', name: 'João', plan: 'trial', status: 'active', accessExpiresAt: null }]
  const result = buildReferrals(users, [])
  assert.equal(result[0].totalCommissionsCents, 0)
})
