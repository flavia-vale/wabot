import { test } from 'node:test'
import assert from 'node:assert/strict'
import db from '../src/db.js'
import { decideFailover, failoverSettings, isActiveBanned } from '../src/domain/session/failoverPolicy.js'
import { extraNumberAccess } from '../src/domain/session/extraNumberAccess.js'
import { switchActiveNumber } from '../src/core/numberSwitch.js'
import { createNumberFailoverSweep, NUMBER_SWITCHED_EVENT } from '../src/jobs/numberFailover.js'

const ON = { MULTI_NUMBER_ENABLED: 'true' }
const NOW = Date.parse('2026-10-03T12:00:00Z')
const fresh = new Date(NOW - 30_000)
const standbyOk = { status: 'connected', lastHeartbeatAt: fresh }

test('política: ativo conectado, sem reserva viva ou em intervalo mínimo nunca troca', () => {
  assert.equal(decideFailover({ active: { status: 'connected' }, standby: standbyOk, now: NOW }).reason, 'active_ok')
  assert.equal(decideFailover({ active: { status: 'disconnected' }, standby: { status: 'disconnected' }, now: NOW }).reason, 'no_standby')
  assert.equal(decideFailover({ active: { status: 'disconnected' }, standby: { status: 'connected', lastHeartbeatAt: new Date(NOW - 10 * 60_000) }, now: NOW }).reason, 'standby_stale')
  assert.equal(decideFailover({ active: { status: 'disconnected', lastDisconnectCode: '401' }, standby: standbyOk, user: { waSlotSwitchedAt: new Date(NOW - 60_000) }, now: NOW }).reason, 'cooldown')
})

test('política: bloqueio/deslogado troca na hora; queda comum só depois do tempo', () => {
  assert.deepEqual(decideFailover({ active: { status: 'disconnected', lastDisconnectCode: '401' }, standby: standbyOk, now: NOW }), { promote: true, reason: 'logged_out' })
  assert.equal(isActiveBanned({ status: 'disconnected', lifecycle: 'auth_reset_required' }), true)
  assert.equal(isActiveBanned({ status: 'connected', lastDisconnectCode: '401' }), false)
  const active = { status: 'disconnected', lastDisconnectCode: '428' }
  assert.equal(decideFailover({ active, standby: standbyOk, downSinceMs: NOW - 5 * 60_000, now: NOW }).reason, 'waiting')
  assert.deepEqual(decideFailover({ active, standby: standbyOk, downSinceMs: NOW - 11 * 60_000, now: NOW }), { promote: true, reason: 'down_too_long' })
})

test('ajustes por env com piso de segurança', () => {
  assert.equal(failoverSettings({}).failoverMs, 10 * 60_000)
  assert.equal(failoverSettings({ MULTI_NUMBER_FAILOVER_MINUTES: '0.5' }).failoverMs, 2 * 60_000)
  assert.equal(failoverSettings({ MULTI_NUMBER_MIN_SWITCH_MINUTES: '60' }).minSwitchIntervalMs, 60 * 60_000)
})

test('acesso ao número extra: flag, PRO, acesso em dia e número pago', () => {
  const future = new Date(NOW + 864e5)
  const at = new Date(NOW)
  assert.equal(extraNumberAccess({ plan: 'pro', accessExpiresAt: future, extraNumbers: 1 }, { now: at, env: {} }).reason, 'disabled')
  assert.equal(extraNumberAccess({ plan: 'basic', accessExpiresAt: future, extraNumbers: 1 }, { now: at, env: ON }).reason, 'requires_pro')
  assert.equal(extraNumberAccess({ plan: 'pro', accessExpiresAt: new Date(NOW - 1), extraNumbers: 1 }, { now: at, env: ON }).reason, 'access_expired')
  assert.equal(extraNumberAccess({ plan: 'pro', accessExpiresAt: future, extraNumbers: 0 }, { now: at, env: ON }).reason, 'not_purchased')
  assert.equal(extraNumberAccess({ plan: 'pro', accessExpiresAt: future, extraNumbers: 1 }, { now: at, env: ON }).allowed, true)
})

function fakeManager({ stuck = new Set() } = {}) {
  const running = new Set()
  const calls = []
  return {
    calls,
    running,
    isRunning: key => running.has(key),
    stopBot: key => { calls.push(['stop', key]); if (!stuck.has(key)) running.delete(key); return true },
    startBot: key => { calls.push(['start', key]); if (running.has(key)) return false; running.add(key); return true },
  }
}

async function seedAccount({ activeWaSlot = 1, switchedAt = null } = {}) {
  const id = `user-failover-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({
    data: {
      id, name: 'F', email: `${id}@t.local`, passwordHash: 'x', plan: 'pro',
      accessExpiresAt: new Date(Date.now() + 864e5), extraNumbers: 1, activeWaSlot, waSlotSwitchedAt: switchedAt,
    },
  })
  await db.waSession.create({ data: { userId: id, status: 'disconnected', lifecycle: 'reconnecting', phone: '5511111', lastDisconnectCode: '401' } })
  await db.waExtraSession.create({ data: { userId: id, slot: 2, status: 'connected', lifecycle: 'ready', phone: '5522222', lastHeartbeatAt: new Date() } })
  return id
}

async function cleanup(id) {
  await db.analyticsEvent.deleteMany({ where: { userId: id } })
  await db.user.deleteMany({ where: { id } })
}

test('troca: para os dois, ESPERA saírem, inverte o ativo, troca os telefones e religa', async () => {
  const id = await seedAccount()
  const manager = fakeManager()
  manager.running.add(id); manager.running.add(`${id}~n2`)
  try {
    const result = await switchActiveNumber({ db, manager, userId: id, expectedActiveSlot: 1, reason: 'logged_out', sleep: async () => {} })
    assert.deepEqual(result, { switched: true, from: 1, to: 2, reason: 'logged_out' })
    const order = manager.calls.map(([kind]) => kind)
    assert.deepEqual(order, ['stop', 'stop', 'start', 'start'])
    const user = await db.user.findUnique({ where: { id }, select: { activeWaSlot: true, waSlotSwitchedAt: true } })
    assert.equal(user.activeWaSlot, 2)
    assert.ok(user.waSlotSwitchedAt)
    assert.equal((await db.waSession.findUnique({ where: { userId: id } })).phone, '5522222')
    assert.equal((await db.waExtraSession.findFirst({ where: { userId: id } })).phone, '5511111')
  } finally { await cleanup(id) }
})

test('troca: processo que não sai a tempo cancela tudo e não inverte o ativo', async () => {
  const id = await seedAccount()
  const manager = fakeManager({ stuck: new Set([`${id}~n2`]) })
  manager.running.add(id); manager.running.add(`${id}~n2`)
  try {
    const result = await switchActiveNumber({ db, manager, userId: id, expectedActiveSlot: 1, reason: 'x', timeoutMs: 5, pollMs: 1, sleep: async () => {} })
    assert.deepEqual(result, { switched: false, reason: 'stop_timeout' })
    assert.equal((await db.user.findUnique({ where: { id } })).activeWaSlot, 1)
    assert.equal((await db.waSession.findUnique({ where: { userId: id } })).lifecycle, 'reconnecting')
    assert.equal(manager.calls.filter(([k]) => k === 'start').length, 0)
  } finally { await cleanup(id) }
})

test('troca: duas passadas ao mesmo tempo — só uma ganha (nunca dois ativos)', async () => {
  const id = await seedAccount()
  try {
    const [a, b] = await Promise.all([
      switchActiveNumber({ db, manager: fakeManager(), userId: id, expectedActiveSlot: 1, reason: 'a', minIntervalMs: 60_000, sleep: async () => {} }),
      switchActiveNumber({ db, manager: fakeManager(), userId: id, expectedActiveSlot: 1, reason: 'b', minIntervalMs: 60_000, sleep: async () => {} }),
    ])
    assert.equal([a, b].filter(r => r.switched).length, 1)
    assert.equal((await db.user.findUnique({ where: { id } })).activeWaSlot, 2)
  } finally { await cleanup(id) }
})

test('passada automática: troca quem foi bloqueado, registra e avisa; flag desligada não faz nada', async () => {
  const id = await seedAccount()
  const notified = []
  try {
    const off = createNumberFailoverSweep({ db, manager: fakeManager(), env: {}, notify: async x => notified.push(x) })
    assert.deepEqual(await off(), { checked: 0, switched: 0 })
    const sweep = createNumberFailoverSweep({ db, manager: fakeManager(), env: ON, notify: async x => notified.push(x), logger: { warn() {}, error() {} } })
    const summary = await sweep()
    assert.ok(summary.switched >= 1)
    assert.equal((await db.user.findUnique({ where: { id } })).activeWaSlot, 2)
    assert.equal(await db.analyticsEvent.count({ where: { userId: id, event: NUMBER_SWITCHED_EVENT } }), 1)
    assert.ok(notified.some(n => n.user.id === id))
  } finally { await cleanup(id) }
})
