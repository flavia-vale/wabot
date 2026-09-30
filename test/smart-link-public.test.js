import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { smartLinkPublicRoutes } from '../src/api/routes/smartLinkPublic.js'

const HUMAN = { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36' }

async function make({ link, links, samples = {}, opts = {} } = {}) {
  const clicks = []
  const counters = { linkLookups: 0 }
  const all = links ?? (link ? [link] : [])
  const db = {
    smartLink: { findUnique: async ({ where }) => { counters.linkLookups++; await new Promise(r => setImmediate(r)); return all.find(l => l.slug === where.slug) ?? null } },
    groupMemberSample: { findFirst: async ({ where }) => samples[where.groupId] ?? null },
    smartLinkDailyClick: { upsert: async (args) => (clicks.push(args), {}) },
  }
  const app = Fastify()
  await app.register(smartLinkPublicRoutes, { db, ...opts })
  return { app, clicks, counters }
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
  await app.close() // fecha = grava os cliques que estavam em memória
  assert.equal(clicks.length, 1)
  assert.equal(clicks[0].where.smartLinkGroupId_day.smartLinkGroupId, 'lg2')
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
  await app.close()
  assert.equal(clicks.length, 0)
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

test('limite de ERROS por IP (varredura de endereços) responde 429; acertos não gastam esse limite', async () => {
  const { createTrackGuard } = await import('../src/api/routes/affiliateTrackGuard.js')
  const { app } = await make({
    link: baseLink(), samples: { g1: { size: 1, sampledAt: new Date() }, g2: { size: 2, sampledAt: new Date() } },
    opts: { missGuard: createTrackGuard({ rateMax: 2 }) },
  })
  for (let i = 0; i < 10; i++) assert.equal((await app.inject({ url: '/g/promo-tech', headers: HUMAN })).statusCode, 302)
  const codes = []
  for (let i = 0; i < 4; i++) codes.push((await app.inject({ url: '/g/nao-existe', headers: HUMAN })).statusCode)
  assert.deepEqual(codes, [404, 404, 429, 429])
  await app.close()
})

test('limite geral por IP também existe (robô descontrolado)', async () => {
  const { createTrackGuard } = await import('../src/api/routes/affiliateTrackGuard.js')
  const { app } = await make({ link: baseLink(), samples: { g1: { size: 1, sampledAt: new Date() } }, opts: { guard: createTrackGuard({ rateMax: 3 }) } })
  const codes = []
  for (let i = 0; i < 5; i++) codes.push((await app.inject({ url: '/g/promo-tech', headers: HUMAN })).statusCode)
  assert.deepEqual(codes, [302, 302, 302, 429, 429])
  await app.close()
})

test('acessos simultâneos na virada do cache fazem UMA consulta ao banco', async () => {
  const { app, counters } = await make({ link: baseLink(), samples: { g1: { size: 1, sampledAt: new Date() }, g2: { size: 2, sampledAt: new Date() } } })
  const results = await Promise.all(Array.from({ length: 30 }, () => app.inject({ url: '/g/promo-tech', headers: HUMAN })))
  assert.ok(results.every(r => r.statusCode === 302))
  assert.equal(counters.linkLookups, 1)
  await app.close()
})

test('cliques são gravados em lote: 50 cliques = 1 escrita por grupo/dia', async () => {
  const at = new Date()
  const { app, clicks } = await make({ link: baseLink({ groups: [baseLink().groups[0]] }), samples: { g1: { size: 1, sampledAt: at } } })
  for (let i = 0; i < 50; i++) await app.inject({ url: '/g/promo-tech', headers: HUMAN })
  await app.close()
  assert.equal(clicks.length, 1)
  assert.equal(clicks[0].create.clicks, 50)
  assert.deepEqual(clicks[0].update, { clicks: { increment: 50 } })
})

test('o mesmo grupo em dois links compartilha a reserva (senão um link lotaria o grupo do outro)', async () => {
  const at = new Date()
  const gA = { id: 'lgA', groupId: 'shared', inviteCode: 'AAAAAAAAAA1111', enabled: true }
  const gB = { id: 'lgB', groupId: 'shared', inviteCode: 'AAAAAAAAAA1111', enabled: true }
  const other = { id: 'lgO', groupId: 'other', inviteCode: 'CCCCCCCCCC3333', enabled: true }
  const { app } = await make({
    links: [baseLink({ slug: 'link-a', groups: [gA] }), baseLink({ slug: 'link-b', capPerGroup: 60, groups: [gB, other] })],
    samples: { shared: { size: 40, sampledAt: at }, other: { size: 55, sampledAt: at } },
  })
  // 25 cliques no link A reservam 25 no grupo compartilhado (40+25=65 >= teto 60 do link B)
  for (let i = 0; i < 25; i++) await app.inject({ url: '/g/link-a', headers: HUMAN })
  const res = await app.inject({ url: '/g/link-b', headers: HUMAN })
  assert.equal(res.headers.location, 'https://chat.whatsapp.com/CCCCCCCCCC3333')
  await app.close()
})

test('amostra com mais de 24h deixa de valer: grupo medido com vaga é preferido', async () => {
  const fresh = new Date()
  const old = new Date(Date.now() - 30 * 3600_000)
  const { app } = await make({ link: baseLink(), samples: { g1: { size: 10, sampledAt: old }, g2: { size: 900, sampledAt: fresh } } })
  const res = await app.inject({ url: '/g/promo-tech', headers: HUMAN })
  assert.equal(res.headers.location, 'https://chat.whatsapp.com/BBBBBBBBBB2222')
  await app.close()
})

test('link apagado (soft delete) responde 404 mesmo com grupos', async () => {
  const { app } = await make({ link: baseLink({ deletedAt: new Date() }), samples: { g1: { size: 1, sampledAt: new Date() } } })
  assert.equal((await app.inject({ url: '/g/promo-tech', headers: HUMAN })).statusCode, 404)
  await app.close()
})
