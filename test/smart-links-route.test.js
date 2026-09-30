import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { smartLinksRoutes } from '../src/api/routes/smartLinks.js'

function makeDb() {
  const state = { links: [], lgs: [], nextId: 1 }
  const db = {
    smartLink: {
      count: async ({ where }) => state.links.filter(l => l.userId === where.userId).length,
      findUnique: async ({ where }) => state.links.find(l => l.slug === where.slug) ?? null,
      findFirst: async ({ where }) => state.links.find(l => l.id === where.id && l.userId === where.userId) ?? null,
      create: async ({ data }) => { const l = { id: `l${state.nextId++}`, ...data }; state.links.push(l); return l },
      update: async ({ where, data }) => Object.assign(state.links.find(l => l.id === where.id), data),
      delete: async ({ where }) => { state.links = state.links.filter(l => l.id !== where.id) },
      findMany: async () => [],
    },
    group: {
      findFirst: async ({ where }) => (where.id === 'g-ok' && where.userId === 'owner' ? { id: 'g-ok', waJid: '1@g.us' } : null),
    },
    smartLinkGroup: {
      count: async () => state.lgs.length,
      findFirst: async ({ where }) => state.lgs.find(x => (where.groupId ? x.groupId === where.groupId : x.id === where.id)) ?? null,
      create: async ({ data }) => { const x = { id: `lg${state.nextId++}`, ...data }; state.lgs.push(x); return x },
    },
  }
  return { db, state }
}

async function make({ plan = { plan: 'pro' }, groupInviteCode = async () => ({ code: 'ABCDEFGHIJ1234' }) } = {}) {
  const { db, state } = makeDb()
  const app = Fastify()
  app.decorate('authenticate', async (req) => { req.user = { sub: 'owner' } })
  await app.register(smartLinksRoutes, { db, loadPlanSubject: async () => plan, groupInviteCode })
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
