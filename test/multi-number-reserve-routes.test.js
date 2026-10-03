import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import { multiNumberRoutes } from '../src/api/routes/multiNumber.js'
import { canStartReserve, reserveHeadroom } from '../src/domain/session/reserveCapacity.js'

const ON = { MULTI_NUMBER_ENABLED: 'true', MAX_SESSIONS_PER_PROCESS: '20' }

test('vaga: principal tem prioridade; sem dado de vaga, recusa', () => {
  assert.equal(canStartReserve({ runningCount: 10, maxSessions: 20, headroom: 5 }).ok, true)
  assert.equal(canStartReserve({ runningCount: 15, maxSessions: 20, headroom: 5 }).reason, 'capacity_reserved_for_primary')
  assert.equal(canStartReserve({ runningCount: null, maxSessions: 20 }).reason, 'capacity_unknown')
  assert.equal(reserveHeadroom({}), 5)
  assert.equal(reserveHeadroom({ MULTI_NUMBER_RESERVE_HEADROOM: '0' }), 0)
})

function fakeManager({ running = [], groups = [] } = {}) {
  const set = new Set(running)
  const calls = []
  return {
    calls,
    set,
    isRunning: key => set.has(key),
    startBot: key => { calls.push(['start', key]); set.add(key); return true },
    stopBot: key => { calls.push(['stop', key]); set.delete(key); return true },
    listRunningBots: () => [...set],
    getLastQR: () => 'QR-DATA',
    requestPairingCode: async (key, phone) => { calls.push(['pair', key, phone]); return 'ABCD-1234' },
    listGroups: async () => groups,
  }
}

async function build({ plan = 'pro', extraNumbers = 1, env = ON, manager = fakeManager(), activePhone = '5511999990000' } = {}) {
  const userId = `user-reserve-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({
    data: { id: userId, name: 'R', email: `${userId}@t.local`, passwordHash: 'x', plan, extraNumbers, accessExpiresAt: new Date(Date.now() + 864e5) },
  })
  if (activePhone) await db.waSession.create({ data: { userId, status: 'connected', lifecycle: 'ready', phone: activePhone } })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async req => { req.user = { sub: userId } })
  await app.register(multiNumberRoutes, { prefix: '/api/multi-number', manager, env })
  return { app, userId, manager }
}

const cleanup = id => db.user.deleteMany({ where: { id } })

test('flag desligada: rotas da reserva somem (404)', async () => {
  const { app, userId } = await build({ env: {} })
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/api/multi-number/reserve' })).statusCode, 404)
    assert.equal((await app.inject({ method: 'POST', url: '/api/multi-number/reserve/start' })).statusCode, 404)
  } finally { await cleanup(userId) }
})

test('Basic e conta sem número pago não ligam a reserva (403 com motivo)', async () => {
  const basic = await build({ plan: 'basic' })
  const unpaid = await build({ extraNumbers: 0 })
  try {
    const r1 = await basic.app.inject({ method: 'POST', url: '/api/multi-number/reserve/start' })
    assert.equal(r1.statusCode, 403)
    assert.equal(r1.json().reason, 'requires_pro')
    const r2 = await unpaid.app.inject({ method: 'POST', url: '/api/multi-number/reserve/start' })
    assert.equal(r2.json().reason, 'not_purchased')
    assert.equal(basic.manager.calls.length + unpaid.manager.calls.length, 0)
  } finally { await cleanup(basic.userId); await cleanup(unpaid.userId) }
})

test('liga a reserva com a chave ~n2, mostra QR, recusa o mesmo número e desliga', async () => {
  const { app, userId, manager } = await build()
  try {
    const start = await app.inject({ method: 'POST', url: '/api/multi-number/reserve/start' })
    assert.equal(start.statusCode, 200)
    assert.deepEqual(manager.calls[0], ['start', `${userId}~n2`])
    const row = await db.waExtraSession.findFirst({ where: { userId } })
    assert.equal(row.slot, 2)
    const state = (await app.inject({ method: 'GET', url: '/api/multi-number/reserve' })).json()
    assert.equal(state.running, true)
    assert.equal(state.access.allowed, true)
    assert.equal((await app.inject({ method: 'GET', url: '/api/multi-number/reserve/qr' })).json().qr, 'QR-DATA')
    const same = await app.inject({ method: 'POST', url: '/api/multi-number/reserve/pairing-code', payload: { phone: '+55 11 99999-0000' } })
    assert.equal(same.json().code, 'SAME_NUMBER')
    const pair = await app.inject({ method: 'POST', url: '/api/multi-number/reserve/pairing-code', payload: { phone: '11988887777' } })
    assert.equal(pair.json().code, 'ABCD-1234')
    assert.deepEqual(manager.calls.at(-1), ['pair', `${userId}~n2`, '5511988887777'])
    const stop = await app.inject({ method: 'POST', url: '/api/multi-number/reserve/stop' })
    assert.equal(stop.statusCode, 200)
    assert.equal((await db.waExtraSession.findFirst({ where: { userId } })).lifecycle, 'stopped_by_user')
  } finally { await cleanup(userId) }
})

test('sem número principal conectado ou sem vaga, a reserva não liga', async () => {
  const noPrimary = await build({ activePhone: null })
  const full = await build({ manager: fakeManager({ running: Array.from({ length: 15 }, (_, i) => `x${i}`) }) })
  try {
    assert.equal((await noPrimary.app.inject({ method: 'POST', url: '/api/multi-number/reserve/start' })).json().code, 'PRIMARY_NOT_CONNECTED')
    const r = await full.app.inject({ method: 'POST', url: '/api/multi-number/reserve/start' })
    assert.equal(r.statusCode, 503)
    assert.equal(r.json().code, 'RESERVE_NO_CAPACITY')
  } finally { await cleanup(noPrimary.userId); await cleanup(full.userId) }
})

test('grupos que faltam na reserva e troca manual só com a reserva conectada', async () => {
  const manager = fakeManager({ groups: [{ waJid: 'g1@g.us' }] })
  const { app, userId } = await build({ manager })
  try {
    await db.group.createMany({ data: [
      { userId, waJid: 'g1@g.us', name: 'Grupo 1', role: 'post' },
      { userId, waJid: 'g2@g.us', name: 'Grupo 2', role: 'post' },
    ] })
    const notReady = await app.inject({ method: 'POST', url: '/api/multi-number/reserve/switch' })
    assert.equal(notReady.json().code, 'STANDBY_NOT_CONNECTED')
    await db.waExtraSession.create({ data: { userId, slot: 2, status: 'connected', phone: '5511988887777', lastHeartbeatAt: new Date() } })
    const missing = (await app.inject({ method: 'GET', url: '/api/multi-number/reserve/missing-groups' })).json()
    assert.equal(missing.total, 2)
    assert.deepEqual(missing.missing.map(g => g.waJid), ['g2@g.us'])
    const sw = await app.inject({ method: 'POST', url: '/api/multi-number/reserve/switch' })
    assert.equal(sw.statusCode, 200)
    assert.equal(sw.json().activeWaSlot, 2)
    assert.equal((await db.user.findUnique({ where: { id: userId } })).activeWaSlot, 2)
    // Logo depois da troca a outra linha volta a "conectando" — sem troca nova.
    assert.equal((await app.inject({ method: 'POST', url: '/api/multi-number/reserve/switch' })).json().code, 'STANDBY_NOT_CONNECTED')
    await db.waExtraSession.updateMany({ where: { userId }, data: { status: 'connected' } })
    const again = await app.inject({ method: 'POST', url: '/api/multi-number/reserve/switch' })
    assert.equal(again.statusCode, 429, 'intervalo mínimo entre trocas manuais')
  } finally {
    await db.analyticsEvent.deleteMany({ where: { userId } })
    await cleanup(userId)
  }
})
