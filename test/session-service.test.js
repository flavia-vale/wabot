import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionService, normalizePairingPhone } from '../src/domain/session/service.js'

test('normalizePairingPhone normalizes BR numbers', () => {
  assert.deepEqual(normalizePairingPhone('(11) 98888-7777'), { ok: true, phone: '5511988887777' })
  assert.equal(normalizePairingPhone('').ok, false)
})

test('findSessionStartUser fallback works on prisma shape mismatch', async () => {
  let fallbackUsed = false
  const db = {
    user: {
      findUnique: async ({ select }) => {
        if (select.status) throw new Error('Unknown field `status`')
        fallbackUsed = true
        return { plan: 'trial', accessExpiresAt: null }
      },
    },
  }
  const service = createSessionService({ db })
  const user = await service.findSessionStartUser('u1')
  assert.equal(fallbackUsed, true)
  assert.equal(user.plan, 'trial')
})

test('validateSessionStartUser enforces blocked/expired rules', () => {
  const service = createSessionService({ db: { user: { findUnique: async () => null } } })
  const blocked = service.validateSessionStartUser({ status: 'banned' })
  assert.equal(blocked.ok, false)
  assert.equal(blocked.statusCode, 403)

  const expired = service.validateSessionStartUser({ plan: 'trial', accessExpiresAt: new Date('2020-01-01T00:00:00Z') })
  assert.equal(expired.ok, false)

  const ok = service.validateSessionStartUser({ plan: 'pro', accessExpiresAt: new Date(Date.now() + 100000) })
  assert.equal(ok.ok, true)
})
