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
