import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Fastify from 'fastify'
import db from '../src/db.js'
import { buildMembershipRows, missingDestinations } from '../src/domain/session/groupMembership.js'
import { multiNumberRoutes } from '../src/api/routes/multiNumber.js'

test('pertença: só grupos, detecta admin pelo número ou pelo @lid', () => {
  const rows = buildMembershipRows({
    selfIds: ['5511999990000:12@s.whatsapp.net', '777@lid'],
    groups: {
      'g1@g.us': { subject: 'Ofertas 1', participants: [{ id: '5511999990000@s.whatsapp.net', admin: 'admin' }] },
      'g2@g.us': { subject: 'Ofertas 2', participants: [{ id: '777@lid', admin: null }] },
      'g3@g.us': { subject: 'Ofertas 3', participants: [{ id: '888@lid', admin: 'superadmin' }] },
      '123@newsletter': { subject: 'Canal' },
    },
  })
  assert.deepEqual(rows.map(r => [r.waJid, r.isAdmin]), [['g1@g.us', true], ['g2@g.us', false], ['g3@g.us', false]])
  assert.deepEqual(missingDestinations({ destinations: [{ waJid: 'g1@g.us' }, { waJid: 'g9@g.us' }], memberJids: ['g1@g.us'] }), [{ waJid: 'g9@g.us' }])
})

test('estrutural: o robô grava a pertença só com a flag e reaproveita o refresh', () => {
  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(src, /if \(!MULTI_NUMBER_ON \|\| !activeSock\) return \{ ok: false, reason: 'off' \}/)
  assert.match(src, /if \(groups\) void syncGroupMembership\(`refresh:\$\{reason\}`, groups\)/)
  assert.match(src, /const slot = SESSION_IDENTITY\.authSlot/)
})

test('grupos que faltam usam a pertença gravada do número de prontidão', async () => {
  const userId = `user-membership-${Date.now()}`
  await db.user.create({ data: { id: userId, name: 'M', email: `${userId}@t.local`, passwordHash: 'x', plan: 'pro', extraNumbers: 1, accessExpiresAt: new Date(Date.now() + 864e5) } })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async req => { req.user = { sub: userId } })
  let liveCalls = 0
  const manager = { isRunning: () => true, listGroups: async () => { liveCalls++; return [] } }
  await app.register(multiNumberRoutes, { prefix: '/api/multi-number', manager, env: { MULTI_NUMBER_ENABLED: 'true' } })
  try {
    await db.waSession.create({ data: { userId, status: 'connected', phone: '5511999990000' } })
    await db.waExtraSession.create({ data: { userId, slot: 2, status: 'connected', phone: '5511888880000', lastHeartbeatAt: new Date() } })
    await db.group.createMany({ data: [
      { userId, waJid: 'g1@g.us', name: 'G1', role: 'post' },
      { userId, waJid: 'g2@g.us', name: 'G2', role: 'post' },
    ] })
    await db.waGroupMembership.create({ data: { userId, slot: 2, waJid: 'g1@g.us' } })
    const res = (await app.inject({ method: 'GET', url: '/api/multi-number/reserve/missing-groups' })).json()
    assert.equal(res.source, 'stored')
    assert.deepEqual(res.missing.map(g => g.waJid), ['g2@g.us'])
    assert.equal(liveCalls, 0)
  } finally {
    await db.user.deleteMany({ where: { id: userId } })
  }
})
