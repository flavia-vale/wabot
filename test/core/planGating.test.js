import test from 'node:test'
import assert from 'node:assert/strict'

import { getAdvancedPreservationAccess, __resetCacheForTests } from '../../src/billing/plans.js'

function makeFakeDb(user) {
  let calls = 0
  return {
    _calls: () => calls,
    user: {
      findUnique: async () => {
        calls++
        return user
      },
    },
  }
}

test('getAdvancedPreservationAccess libera para plano pro', async () => {
  __resetCacheForTests()
  const db = makeFakeDb({ plan: 'pro', accessExpiresAt: null })
  const access = await getAdvancedPreservationAccess('u-1', { db })
  assert.equal(access.active, true)
  assert.equal(access.plan, 'pro')
})

test('getAdvancedPreservationAccess libera para trial dentro do prazo', async () => {
  __resetCacheForTests()
  const future = new Date(Date.now() + 60_000)
  const db = makeFakeDb({ plan: 'trial', accessExpiresAt: future })
  const access = await getAdvancedPreservationAccess('u-1', { db })
  assert.equal(access.active, true)
})

test('getAdvancedPreservationAccess bloqueia trial expirado', async () => {
  __resetCacheForTests()
  const past = new Date(Date.now() - 60_000)
  const db = makeFakeDb({ plan: 'trial', accessExpiresAt: past })
  const access = await getAdvancedPreservationAccess('u-1', { db })
  assert.equal(access.active, false)
})

test('getAdvancedPreservationAccess bloqueia plano basic', async () => {
  __resetCacheForTests()
  const db = makeFakeDb({ plan: 'basic', accessExpiresAt: null })
  const access = await getAdvancedPreservationAccess('u-1', { db })
  assert.equal(access.active, false)
})

test('getAdvancedPreservationAccess cacheia por TTL', async () => {
  __resetCacheForTests()
  const db = makeFakeDb({ plan: 'pro', accessExpiresAt: null })
  await getAdvancedPreservationAccess('u-1', { db })
  await getAdvancedPreservationAccess('u-1', { db })
  await getAdvancedPreservationAccess('u-1', { db })
  assert.equal(db._calls(), 1, 'só uma consulta dentro do TTL')
})

test('getAdvancedPreservationAccess revalida após TTL', async () => {
  __resetCacheForTests()
  const db = makeFakeDb({ plan: 'pro', accessExpiresAt: null })
  const now = Date.now()
  await getAdvancedPreservationAccess('u-1', { db, now })
  await getAdvancedPreservationAccess('u-1', { db, now: now + 61_000 })
  assert.equal(db._calls(), 2)
})

test('getAdvancedPreservationAccess retorna inactive quando usuário não existe', async () => {
  __resetCacheForTests()
  const db = makeFakeDb(null)
  const access = await getAdvancedPreservationAccess('u-missing', { db })
  assert.equal(access.active, false)
  assert.equal(access.plan, null)
})
