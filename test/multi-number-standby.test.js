import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import db from '../src/db.js'
import { resolveWorkerIdentity, standbyProcessKey, otherSlot } from '../src/domain/session/workerIdentity.js'
import { loadWorkerIdentity } from '../src/core/workerIdentity.js'
import { listResumableStandbySessions } from '../src/core/standbySessions.js'

const ON = { MULTI_NUMBER_ENABLED: 'true' }

test('flag desligada: o processo da conta usa o login de sempre e a prontidão não existe', () => {
  assert.deepEqual(resolveWorkerIdentity({ processKey: 'u1', activeWaSlot: 2, enabled: false }), {
    userId: 'u1', processKey: 'u1', role: 'active', authSlot: 1, authKey: 'u1',
  })
  assert.equal(resolveWorkerIdentity({ processKey: 'u1~n2', activeWaSlot: 1, enabled: false }), null)
})

test('flag ligada: ativo e prontidão nunca usam o mesmo login', () => {
  for (const activeWaSlot of [1, 2]) {
    const active = resolveWorkerIdentity({ processKey: 'u1', activeWaSlot, enabled: true })
    const standby = resolveWorkerIdentity({ processKey: standbyProcessKey('u1'), activeWaSlot, enabled: true })
    assert.equal(active.role, 'active')
    assert.equal(standby.role, 'standby')
    assert.equal(active.authSlot, activeWaSlot)
    assert.equal(standby.authSlot, otherSlot(activeWaSlot))
    assert.notEqual(active.authKey, standby.authKey)
    assert.equal(standby.userId, 'u1')
  }
})

test('activeWaSlot inválido cai no número 1; chave malformada não vira processo', () => {
  assert.equal(resolveWorkerIdentity({ processKey: 'u1', activeWaSlot: 7, enabled: true }).authSlot, 1)
  assert.equal(resolveWorkerIdentity({ processKey: 'u1~n9', activeWaSlot: 1, enabled: true }), null)
})

test('loadWorkerIdentity: flag desligada nem consulta o banco', async () => {
  const fakeDb = { user: { findUnique: () => { throw new Error('não devia consultar') } } }
  const identity = await loadWorkerIdentity('u1', { db: fakeDb, env: {} })
  assert.equal(identity.authKey, 'u1')
  await assert.rejects(loadWorkerIdentity('u1~n2', { db: fakeDb, env: {} }))
})

test('loadWorkerIdentity: flag ligada lê activeWaSlot; banco fora LANÇA (não chuta o login)', async () => {
  const okDb = { user: { findUnique: async () => ({ activeWaSlot: 2 }) } }
  assert.equal((await loadWorkerIdentity('u1', { db: okDb, env: ON })).authKey, 'u1~n2')
  assert.equal((await loadWorkerIdentity('u1~n2', { db: okDb, env: ON })).authKey, 'u1')
  const downDb = { user: { findUnique: async () => { throw new Error('db fora') } } }
  await assert.rejects(loadWorkerIdentity('u1', { db: downDb, env: ON }))
  const goneDb = { user: { findUnique: async () => null } }
  await assert.rejects(loadWorkerIdentity('u1~n2', { db: goneDb, env: ON }))
})

test('retomada da prontidão: só com flag, só conta com número extra pago, chave ~n2', async () => {
  const id = `user-standby-${Date.now()}`
  const unpaid = `${id}-unpaid`
  await db.user.create({ data: { id, name: 'S', email: `${id}@t.local`, passwordHash: 'x', extraNumbers: 1 } })
  await db.user.create({ data: { id: unpaid, name: 'S', email: `${unpaid}@t.local`, passwordHash: 'x' } })
  try {
    await db.waExtraSession.create({ data: { userId: id, slot: 2, status: 'connected' } })
    await db.waExtraSession.create({ data: { userId: unpaid, slot: 2, status: 'connected' } })
    assert.deepEqual(await listResumableStandbySessions(db, { env: {} }), [])
    const rows = (await listResumableStandbySessions(db, { env: ON })).filter(r => r.accountId.startsWith(id))
    assert.deepEqual(rows.map(r => r.userId), [`${id}~n2`])
    assert.equal(rows[0].accountId, id)
  } finally {
    await db.user.deleteMany({ where: { id: { in: [id, unpaid] } } })
  }
})

test('estrutural: a prontidão não espelha, só aceita comandos de socket e só envia com o rodízio', () => {
  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(src, /const scheduledMessagesTimer = IS_STANDBY \? null :/)
  assert.match(src, /const stuckSendLogsTimer = IS_STANDBY \? null :/)
  // Fase 2: a prontidão só cria fila de envio com o rodízio ligado.
  assert.match(src, /const CAN_SEND = !IS_STANDBY \|\| ROTATION_ON/)
  assert.match(src, /if \(CAN_SEND && !sendBackend\) sendBackend = await createSendBackend\(\)/)
  assert.match(src, /markUpsertReceived\(\)\n\s+\/\/[^\n]*\n\s+if \(IS_STANDBY\) return/)
  // Fase 2.1: consultar/seguir canal (a reserva precisa seguir os canais de origem).
  assert.match(src, /STANDBY_IPC_TYPES = new Set\(\['stop', 'requestPairingCode', 'listGroups', 'metrics', 'channel:metadata', 'channel:follow'\]\)/)
  assert.match(src, /if \(IS_STANDBY\) \{\n\s+await handleStandbyOpen\(\{ phone \}\)\n\s+\} else \{/)
  assert.match(src, /const AUTH_DIR = getAuthInfoDir\(AUTH_KEY\)/)
  assert.doesNotMatch(src, /getAuthInfoDir\(userId\)/)
})
