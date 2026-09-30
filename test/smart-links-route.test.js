import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { smartLinksRoutes } from '../src/api/routes/smartLinks.js'

function makeDb() {
  const state = { links: [], lgs: [], nextId: 1 }
  const db = {
    smartLink: {
      count: async ({ where }) => state.links.filter(l => l.userId === where.userId && (where.deletedAt === null ? !l.deletedAt : true)).length,
      findUnique: async ({ where }) => state.links.find(l => l.slug === where.slug) ?? null,
      findFirst: async ({ where }) => state.links.find(l => l.id === where.id && l.userId === where.userId && (where.deletedAt === null ? !l.deletedAt : true)) ?? null,
      create: async ({ data }) => { const l = { id: `l${state.nextId++}`, ...data }; state.links.push(l); return l },
      update: async ({ where, data }) => Object.assign(state.links.find(l => l.id === where.id), data),
      findMany: async () => [],
    },
    group: {
      findFirst: async ({ where }) => (where.id === 'g-ok' && where.userId === 'owner' ? { id: 'g-ok', waJid: '1@g.us' } : null),
    },
    smartLinkGroup: {
      count: async () => state.lgs.length,
      findFirst: async ({ where }) => state.lgs.find(x => (where.groupId ? x.groupId === where.groupId : x.id === where.id)) ?? null,
      create: async ({ data }) => { if (state.dupOnCreate) throw Object.assign(new Error('dup'), { code: 'P2002' }); const x = { id: `lg${state.nextId++}`, ...data }; state.lgs.push(x); return x },
      deleteMany: async ({ where }) => { state.lgs = state.lgs.filter(x => x.smartLinkId !== where.smartLinkId) },
    },
  }
  return { db, state }
}

async function make({ plan = { plan: 'pro' }, groupInviteCode = async () => ({ code: 'ABCDEFGHIJ1234' }), user = 'owner', captureSamples = async () => {} } = {}) {
  const { db, state } = makeDb()
  const app = Fastify()
  app.decorate('authenticate', async (req) => { req.user = { sub: user } })
  await app.register(smartLinksRoutes, { db, loadPlanSubject: async () => plan, groupInviteCode, captureSamples })
  return { app, state }
}
const post = (app, url, payload) => app.inject({ method: 'POST', url, payload })

test('Basic recebe 403 FEATURE_REQUIRES_PRO', async () => {
  const { app } = await make({ plan: { plan: 'basic' } })
  const res = await app.inject({ url: '/' })
  assert.equal(res.statusCode, 403)
  assert.equal(res.json().feature, 'smart_links')
  await app.close()
})

test('cria link com slug escolhido pela cliente e recusa repetido/inválido', async () => {
  const { app } = await make()
  const ok = await post(app, '/', { name: 'Ofertas Tech', slug: 'Promo Tech' })
  assert.equal(ok.statusCode, 201)
  assert.equal(ok.json().path, '/g/promo-tech')
  assert.equal((await post(app, '/', { name: 'Outro', slug: 'promo-tech' })).statusCode, 409)
  assert.equal((await post(app, '/', { name: 'X', slug: 'api' })).statusCode, 400)
  assert.equal((await post(app, '/', { name: '', slug: 'valido-1' })).statusCode, 400)
  await app.close()
})

test('adiciona grupo buscando o convite; recusa grupo de outra pessoa', async () => {
  const { app, state } = await make()
  const link = (await post(app, '/', { name: 'A', slug: 'link-a' })).json()
  const add = await post(app, `/${link.id}/groups`, { groupId: 'g-ok' })
  assert.equal(add.statusCode, 201)
  assert.equal(state.lgs[0].inviteCode, 'ABCDEFGHIJ1234')
  assert.equal((await post(app, `/${link.id}/groups`, { groupId: 'g-ok' })).statusCode, 409)
  assert.equal((await post(app, `/${link.id}/groups`, { groupId: 'g-de-outro' })).statusCode, 404)
  await app.close()
})

test('sem WhatsApp conectado: 409 com mensagem clara; sem admin: 422', async () => {
  const off = await make({ groupInviteCode: async () => { throw new Error('Bot não está rodando') } })
  const l1 = (await post(off.app, '/', { name: 'A', slug: 'link-a' })).json()
  const r1 = await post(off.app, `/${l1.id}/groups`, { groupId: 'g-ok' })
  assert.equal(r1.statusCode, 409)
  assert.match(r1.json().error, /Conecte o WhatsApp/)
  await off.app.close()

  const noAdmin = await make({ groupInviteCode: async () => { throw new Error('not-authorized') } })
  const l2 = (await post(noAdmin.app, '/', { name: 'A', slug: 'link-b' })).json()
  const r2 = await post(noAdmin.app, `/${l2.id}/groups`, { groupId: 'g-ok' })
  assert.equal(r2.statusCode, 422)
  assert.doesNotMatch(r2.body, /not-authorized/)
  await noAdmin.app.close()
})

test('limite por grupo fora de 50..1024 é recusado', async () => {
  const { app } = await make()
  const link = (await post(app, '/', { name: 'A', slug: 'link-a' })).json()
  const patch = (cap) => app.inject({ method: 'PATCH', url: `/${link.id}`, payload: { capPerGroup: cap } })
  assert.equal((await patch(900)).statusCode, 200)
  assert.equal((await patch(2000)).statusCode, 400)
  await app.close()
})

test('apagar NÃO libera o endereço para outra pessoa; a mesma dona reativa', async () => {
  const { app, state } = await make()
  const link = (await post(app, '/', { name: 'A', slug: 'link-a' })).json()
  await post(app, `/${link.id}/groups`, { groupId: 'g-ok' })
  assert.equal((await app.inject({ method: 'DELETE', url: `/${link.id}` })).statusCode, 200)
  assert.equal(state.links[0].deletedAt instanceof Date, true)
  assert.equal(state.lgs.length, 0)
  // outra pessoa tenta pegar o endereço já divulgado
  const other = await make({ user: 'intrusa' })
  other.state.links.push(state.links[0])
  assert.equal((await post(other.app, '/', { name: 'X', slug: 'link-a' })).statusCode, 409)
  // a mesma dona reativa (sem os grupos antigos)
  const back = await post(app, '/', { name: 'A de novo', slug: 'link-a' })
  assert.equal(back.statusCode, 201)
  assert.equal(state.links[0].deletedAt, null)
  assert.equal(state.links[0].name, 'A de novo')
  await app.close(); await other.app.close()
})

test('enabled precisa ser booleano de verdade ("false" em texto não vira true)', async () => {
  const { app } = await make()
  const link = (await post(app, '/', { name: 'A', slug: 'link-a' })).json()
  const patch = (enabled) => app.inject({ method: 'PATCH', url: `/${link.id}`, payload: { enabled } })
  assert.equal((await patch('false')).statusCode, 400)
  assert.equal((await patch(false)).statusCode, 200)
  await app.close()
})

test('duas adições simultâneas do mesmo grupo: 409, não 500', async () => {
  const { app, state } = await make()
  const link = (await post(app, '/', { name: 'A', slug: 'link-a' })).json()
  state.dupOnCreate = true
  assert.equal((await post(app, `/${link.id}/groups`, { groupId: 'g-ok' })).statusCode, 409)
  await app.close()
})

test('ao adicionar o grupo mede o tamanho na hora (senão ficaria 1h sem tráfego)', async () => {
  const calls = []
  const { app } = await make({ captureSamples: async (userId) => { calls.push(userId) } })
  const link = (await post(app, '/', { name: 'A', slug: 'link-a' })).json()
  await post(app, `/${link.id}/groups`, { groupId: 'g-ok' })
  assert.deepEqual(calls, ['owner'])
  await app.close()
})

test('falha na medição imediata não derruba o cadastro do grupo', async () => {
  const { app } = await make({ captureSamples: async () => { throw new Error('WhatsApp fora') } })
  const link = (await post(app, '/', { name: 'A', slug: 'link-a' })).json()
  assert.equal((await post(app, `/${link.id}/groups`, { groupId: 'g-ok' })).statusCode, 201)
  await app.close()
})

const H = 3600_000
const fixedNow = new Date('2026-09-30T12:00:00Z')
function statsDb({ links }) {
  return { smartLink: { findMany: async () => links }, group: {}, smartLinkGroup: {} }
}
const sampleAt = (hoursAgo, size) => ({ size, sampledAt: new Date(fixedNow.getTime() - hoursAgo * H) })
const mkGroup = (id, name, samples, clicks = []) => ({
  id: `lg-${id}`, groupId: id, inviteCode: 'ABCDEFGHIJ1234', enabled: true, createdAt: new Date(),
  group: { id, name, memberSamples: samples }, dailyClicks: clicks,
})

async function makeStats(links, plan = { plan: 'pro' }) {
  const app = Fastify()
  app.decorate('authenticate', async (req) => { req.user = { sub: 'owner' } })
  await app.register(smartLinksRoutes, { db: statsDb({ links }), loadPlanSubject: async () => plan, groupInviteCode: async () => ({}), captureSamples: async () => {}, now: () => fixedNow })
  return app
}

test('lista: ocupação, cliques de hoje/7 dias e membros atuais por grupo', async () => {
  const link = {
    id: 'l1', name: 'Tech', slug: 'tech', enabled: true, capPerGroup: 1000, createdAt: new Date(),
    groups: [
      mkGroup('g1', 'Grupo 1', [sampleAt(0, 950), sampleAt(24, 900)], [{ day: '2026-09-30', clicks: 7 }, { day: '2026-09-28', clicks: 3 }]),
      mkGroup('g2', 'Grupo 2', [sampleAt(1, 400)]),
    ],
  }
  const app = await makeStats([link])
  const body = (await app.inject({ url: '/' })).json()
  const l = body.links[0]
  assert.equal(l.clicksToday, 7)
  assert.equal(l.clicks7d, 10)
  assert.equal(l.totalSize, 1350)
  assert.equal(l.groups[0].size, 950)
  assert.equal(l.groups[0].occupancyPct, 95)
  assert.equal(l.occupancy.level, 'warn')
  assert.doesNotMatch(JSON.stringify(body), /ABCDEFGHIJ1234|inviteCode/)
  await app.close()
})

test('resumo do painel: pior link, crítico quando todos >= 90%, link pausado fora', async () => {
  const mk = (id, enabled, sizes) => ({
    id, name: id, slug: id, enabled, capPerGroup: 1000, createdAt: new Date(),
    groups: sizes.map((s, i) => mkGroup(`${id}-${i}`, `G${i}`, [sampleAt(0, s)])),
  })
  const app = await makeStats([mk('calmo', true, [100, 200]), mk('cheio', true, [950, 920, 990]), mk('pausado', false, [999])])
  const r = (await app.inject({ url: '/summary' })).json()
  assert.equal(r.linkCount, 2)
  assert.equal(r.worst.id, 'cheio')
  assert.equal(r.worst.level, 'critical')
  assert.equal(r.worst.avgPct, 95)
  assert.equal(r.worst.remainingSlots, 140)
  await app.close()
})

test('resumo sem links: worst nulo (o card mostra o convite para criar)', async () => {
  const app = await makeStats([])
  assert.deepEqual((await app.inject({ url: '/summary' })).json(), { linkCount: 0, worst: null })
  await app.close()
})

test('resumo: Basic recebe 403 e nenhum dado real', async () => {
  const app = await makeStats([], { plan: 'basic' })
  const res = await app.inject({ url: '/summary' })
  assert.equal(res.statusCode, 403)
  assert.equal(res.json().feature, 'smart_links')
  await app.close()
})

test('amostra com mais de 24h não vira "crítico" (nunca alarma no escuro)', async () => {
  const link = { id: 'l', name: 'l', slug: 'l', enabled: true, capPerGroup: 1000, createdAt: new Date(), groups: [mkGroup('g', 'G', [sampleAt(30, 990)])] }
  const app = await makeStats([link])
  const r = (await app.inject({ url: '/summary' })).json()
  assert.equal(r.worst.level, 'nodata')
  await app.close()
})
