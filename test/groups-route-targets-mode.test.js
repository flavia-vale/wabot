import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import { groupsRoutes } from '../src/api/routes/groups.js'

// RCA 2026-08-26 (julianepumuceno16@gmail.com — "está mandando em grupo que nem
// está selecionado"): apagar um grupo de destino apaga por cascata os vínculos
// (GroupTarget) que apontavam para ele. A origem ficava com zero vínculos e,
// pela regra histórica "sem vínculo = todos", passava a espelhar para TODOS os
// destinos da conta. `Group.targetsMode` guarda a intenção da cliente para que
// isso não aconteça mais.

let userCounter = 0

async function buildApp() {
  const n = ++userCounter
  const userId = `user-targets-mode-${n}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({
    data: {
      id: userId,
      name: `Targets Mode Test ${n}`,
      email: `targets-mode-${n}-${Date.now()}@groups-route-test.local`,
      passwordHash: 'x',
      plan: 'pro',
    },
  })
  const reloadCalls = []
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  app.addHook('onClose', async () => {
    await db.groupTarget.deleteMany({ where: { userId } })
    await db.group.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
  })
  await app.register(groupsRoutes, {
    prefix: '/api/groups',
    channelMetadata: async () => null,
    followChannelImmediate: async () => ({ followed: 'new' }),
    listFollowedChannels: async () => [],
    isRunning: () => true,
    // Espelha o modo remote: reloadConfig devolve Promise. Sem await na rota,
    // o log gravava `configReloaded: {}` (Promise serializada) e não confirmava
    // nada — foi o que impediu de separar "job antigo saindo" de "worker não
    // recarregou" durante a investigação.
    reloadConfig: async (uid) => { reloadCalls.push(uid); return true },
  })
  return { app, userId, reloadCalls }
}

async function seed(app) {
  const monitor = JSON.parse((await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: `mon-${Math.random()}@g.us`, name: 'Origem', role: 'monitor', kind: 'group' } })).body)
  const postA = JSON.parse((await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: `a-${Math.random()}@g.us`, name: 'Destino A', role: 'post', kind: 'group' } })).body)
  const postB = JSON.parse((await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: `b-${Math.random()}@g.us`, name: 'Destino B', role: 'post', kind: 'group' } })).body)
  return { monitor, postA, postB }
}

test('escolher destinos marca a origem como explicit', async () => {
  const { app } = await buildApp()
  const { monitor, postA } = await seed(app)
  const res = await app.inject({ method: 'PUT', url: `/api/groups/${monitor.id}/targets`, payload: { postIds: [postA.id] } })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).mode, 'explicit')
  const row = await db.group.findUnique({ where: { id: monitor.id } })
  assert.equal(row.targetsMode, 'explicit')
  await app.close()
})

test('apagar o destino escolhido NÃO faz a origem voltar a enviar para todos', async () => {
  const { app } = await buildApp()
  const { monitor, postA, postB } = await seed(app)
  await app.inject({ method: 'PUT', url: `/api/groups/${monitor.id}/targets`, payload: { postIds: [postA.id] } })
  // A cliente apaga o destino que havia escolhido (cascade apaga o vínculo).
  await app.inject({ method: 'DELETE', url: `/api/groups/${postA.id}` })

  const res = await app.inject({ method: 'GET', url: `/api/groups/${monitor.id}/targets` })
  const body = JSON.parse(res.body)
  assert.equal(body.mode, 'explicit')
  assert.deepEqual(body.postIds, [], 'nenhum destino — nunca "todos"')
  assert.ok(!body.postIds.includes(postB.id))
  await app.close()
})

test('origem que nunca escolheu destino continua mostrando todos (comportamento histórico)', async () => {
  const { app } = await buildApp()
  const { monitor, postA, postB } = await seed(app)
  const body = JSON.parse((await app.inject({ method: 'GET', url: `/api/groups/${monitor.id}/targets` })).body)
  assert.equal(body.mode, 'all')
  assert.deepEqual([...body.postIds].sort(), [postA.id, postB.id].sort())
  await app.close()
})

// A cliente desmarcava todos, salvava, voltava e encontrava TUDO marcado de
// novo: salvar vazio gravava 'all', e 'all' faz o GET devolver todos os
// destinos da conta. Desmarcar tudo é "não mande para ninguém".
test('desmarcar tudo e salvar guarda a escolha vazia (não volta a marcar todos)', async () => {
  const { app } = await buildApp()
  const { monitor, postA, postB } = await seed(app)
  await app.inject({ method: 'PUT', url: `/api/groups/${monitor.id}/targets`, payload: { postIds: [postA.id] } })
  const res = await app.inject({ method: 'PUT', url: `/api/groups/${monitor.id}/targets`, payload: { postIds: [] } })
  assert.equal(JSON.parse(res.body).mode, 'explicit')
  const row = await db.group.findUnique({ where: { id: monitor.id } })
  assert.equal(row.targetsMode, 'explicit')

  // É o passo que reproduz o relato: reabrir a tela.
  const reopened = JSON.parse((await app.inject({ method: 'GET', url: `/api/groups/${monitor.id}/targets` })).body)
  assert.equal(reopened.mode, 'explicit')
  assert.deepEqual(reopened.postIds, [], 'continua sem nenhum destino marcado')
  assert.ok(!reopened.postIds.includes(postB.id))
  await app.close()
})

test('rotas de grupo esperam o reloadConfig (nada de Promise crua no log)', async () => {
  const { app, userId, reloadCalls } = await buildApp()
  const { monitor, postA } = await seed(app)
  await app.inject({ method: 'PUT', url: `/api/groups/${monitor.id}/targets`, payload: { postIds: [postA.id] } })
  await app.inject({ method: 'DELETE', url: `/api/groups/${postA.id}` })
  assert.ok(reloadCalls.length >= 2)
  assert.ok(reloadCalls.every(id => id === userId))
  await app.close()
})
