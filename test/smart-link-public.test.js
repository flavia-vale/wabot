import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { smartLinkPublicRoutes } from '../src/api/routes/smartLinkPublic.js'

const HUMAN = { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36' }

async function make({ link, samples = {} } = {}) {
  const clicks = []
  const db = {
    smartLink: { findUnique: async ({ where }) => (link && where.slug === link.slug ? link : null) },
    groupMemberSample: { findFirst: async ({ where }) => samples[where.groupId] ?? null },
    smartLinkDailyClick: { upsert: async (args) => (clicks.push(args), {}) },
  }
  const app = Fastify()
  await app.register(smartLinkPublicRoutes, { db })
  return { app, clicks }
}

const baseLink = (over = {}) => ({
  slug: 'promo-tech', id: 'l1', enabled: true, capPerGroup: 1000,
  groups: [
    { id: 'lg1', groupId: 'g1', inviteCode: 'AAAAAAAAAA1111', enabled: true },
    { id: 'lg2', groupId: 'g2', inviteCode: 'BBBBBBBBBB2222', enabled: true },
  ],
  ...over,
})

test('redireciona 302 para o grupo mais vazio, sem cache e noindex', async () => {
  const { app, clicks } = await make({ link: baseLink(), samples: { g1: { size: 800, sampledAt: new Date() }, g2: { size: 200, sampledAt: new Date() } } })
  const res = await app.inject({ url: '/g/promo-tech', headers: HUMAN })
  assert.equal(res.statusCode, 302)
  assert.equal(res.headers.location, 'https://chat.whatsapp.com/BBBBBBBBBB2222')
  assert.match(res.headers['cache-control'], /no-store/)
  assert.match(res.headers['x-robots-tag'], /noindex/)
  await new Promise(r => setImmediate(r))
  assert.equal(clicks.length, 1)
  assert.equal(clicks[0].where.smartLinkGroupId_day.smartLinkGroupId, 'lg2')
  await app.close()
})

test('rajada de cliques alterna entre grupos próximos (reserva)', async () => {
  const at = new Date()
  const { app } = await make({ link: baseLink(), samples: { g1: { size: 300, sampledAt: at }, g2: { size: 300, sampledAt: at } } })
  const seen = new Set()
  for (let i = 0; i < 6; i++) seen.add((await app.inject({ url: '/g/promo-tech', headers: HUMAN })).headers.location)
  assert.equal(seen.size, 2)
  await app.close()
})

test('robô de checagem é redirecionado mas não conta nem reserva', async () => {
  const { app, clicks } = await make({ link: baseLink(), samples: { g1: { size: 1, sampledAt: new Date() }, g2: { size: 2, sampledAt: new Date() } } })
  const res = await app.inject({ url: '/g/promo-tech', headers: { 'user-agent': 'facebookexternalhit/1.1' } })
  assert.equal(res.statusCode, 302)
  await new Promise(r => setImmediate(r))
  assert.equal(clicks.length, 0)
  await app.close()
})

test('todos cheios: 200 com página amigável (não 5xx), sem redirect', async () => {
  const { app } = await make({ link: baseLink(), samples: { g1: { size: 1000, sampledAt: new Date() }, g2: { size: 1000, sampledAt: new Date() } } })
  const res = await app.inject({ url: '/g/promo-tech', headers: HUMAN })
  assert.equal(res.statusCode, 200)
  assert.match(res.body, /lotados/)
  assert.equal(res.headers.location, undefined)
  await app.close()
})

test('link inexistente, desligado ou slug malformado = 404', async () => {
  const { app } = await make({ link: baseLink({ enabled: false }) })
  for (const url of ['/g/promo-tech', '/g/nao-existe', '/g/..%2Fx', '/g/API']) {
    assert.equal((await app.inject({ url, headers: HUMAN })).statusCode, 404, url)
  }
  await app.close()
})

test('convite adulterado no banco nunca vira redirect para fora do WhatsApp', async () => {
  const link = baseLink({ groups: [{ id: 'lg1', groupId: 'g1', inviteCode: 'https://evil.com/x', enabled: true }] })
  const { app } = await make({ link, samples: { g1: { size: 1, sampledAt: new Date() } } })
  const res = await app.inject({ url: '/g/promo-tech', headers: HUMAN })
  assert.notEqual(res.statusCode, 302)
  assert.equal(res.headers.location, undefined)
  await app.close()
})

test('limite por IP responde 429', async () => {
  const { createTrackGuard } = await import('../src/api/routes/affiliateTrackGuard.js')
  const app = Fastify()
  const db = { smartLink: { findUnique: async () => null }, groupMemberSample: { findFirst: async () => null }, smartLinkDailyClick: { upsert: async () => ({}) } }
  await app.register(smartLinkPublicRoutes, { db, guard: createTrackGuard({ rateMax: 2 }) })
  const codes = []
  for (let i = 0; i < 4; i++) codes.push((await app.inject({ url: '/g/promo-tech', headers: HUMAN })).statusCode)
  assert.deepEqual(codes, [404, 404, 429, 429])
  await app.close()
})
