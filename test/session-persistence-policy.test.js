import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAuthResetSessionPatch, buildCloseSessionPatch } from '../src/core/sessionPersistencePolicy.js'

test('close transitório fica resumível para blindar sessões ativas', () => {
  const now = new Date('2026-06-30T12:00:00.000Z')
  const patch = buildCloseSessionPatch({ code: 428, terminal: false, ownerInstance: 'api-1', now })

  assert.equal(patch.status, 'connecting')
  assert.equal(patch.lifecycle, 'reconnecting')
  assert.equal(patch.lastDisconnectCode, '428')
  assert.equal(patch.ownerInstance, 'api-1')
  assert.equal(patch.lastHeartbeatAt, now)
})

test('close terminal pode marcar disconnected', () => {
  const patch = buildCloseSessionPatch({ code: 401, terminal: true })

  assert.equal(patch.status, 'disconnected')
  assert.equal(patch.lifecycle, 'disconnected')
  assert.equal(patch.lastDisconnectCode, '401')
})

test('reset explícito de auth marca necessidade de reparar sem parecer queda transitória', () => {
  const patch = buildAuthResetSessionPatch({ code: 500, ownerInstance: 'worker-1' })

  assert.equal(patch.status, 'disconnected')
  assert.equal(patch.lifecycle, 'auth_reset_required')
  assert.equal(patch.lastDisconnectCode, '500')
  assert.equal(patch.ownerInstance, 'worker-1')
})
