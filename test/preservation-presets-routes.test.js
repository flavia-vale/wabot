import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'

// preservation.js importa db.js, que constrói o PrismaClient no import (exige
// DATABASE_URL). Setamos um valor dummy + pulamos os PRAGMAs ANTES do import
// dinâmico; nenhuma query real roda (sobrescrevemos as superfícies do db pelo
// fake antes de cada request).
process.env.DATABASE_URL ||= 'file:./test-preservation-presets.db'
process.env.DB_SKIP_PRAGMAS = '1'
const { preservationRoutes } = await import('../src/api/routes/preservation.js')
const dbModule = await import('../src/db.js')

function installFakeDb(db) {
  for (const key of ['preservationPreset', 'group', 'botConfig', 'user']) {
    dbModule.default[key] = db[key]
  }
}

// fakeDb cobre só o que as rotas de preset/destino usam. user.findUnique →
// plano pro (libera o feature gate de preservação avançada).
function fakeDb() {
  const presets = []
  const groups = []
  let seq = 0
  const matches = (row, where = {}) => Object.entries(where).every(([k, v]) => {
    if (v === null || v === undefined) return true
    if (typeof v === 'object') {
      if ('not' in v) return row[k] !== v.not
      if ('in' in v) return v.in.includes(row[k])
      return true
    }
    return row[k] === v
  })
  const project = (row, select) => select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : row
  return {
    presets, groups,
    user: { findUnique: async () => ({ plan: 'pro', accessExpiresAt: null }) },
    botConfig: { findUnique: async () => ({}) },
    preservationPreset: {
      findMany: async ({ where, select }) => presets.filter((r) => matches(r, where)).map((r) => project(r, select)),
      findFirst: async ({ where, select }) => { const r = presets.find((c) => matches(c, where)); return r ? project(r, select) : null },
      create: async ({ data, select }) => { const r = { id: `p${++seq}`, isDefault: false, operatingHoursEnabled: false, operatingHoursJson: '{"startHour":8,"endHour":22,"tz":"America/Sao_Paulo"}', throttleEnabled: true, minIntervalSec: 30, burstCap: 6, burstWindowSec: 600, dailyCap: null, createdAt: new Date(), updatedAt: new Date(), ...data }; presets.push(r); return project(r, select) },
      update: async ({ where, data, select }) => { const r = presets.find((c) => c.id === where.id); Object.assign(r, data); return project(r, select) },
      updateMany: async ({ where, data }) => { const found = presets.filter((r) => matches(r, where)); found.forEach((r) => Object.assign(r, data)); return { count: found.length } },
      delete: async ({ where }) => { const i = presets.findIndex((r) => r.id === where.id); presets.splice(i, 1); return {} },
    },
    group: {
      findMany: async ({ where, select }) => groups.filter((r) => matches(r, where)).map((r) => project(r, select)),
      findFirst: async ({ where, select }) => { const r = groups.find((c) => matches(c, where)); return r ? project(r, select) : null },
      update: async ({ where, data, select }) => { const r = groups.find((c) => c.id === where.id); Object.assign(r, data); return project(r, select) },
      updateMany: async ({ where, data }) => { const found = groups.filter((r) => matches(r, where)); found.forEach((r) => Object.assign(r, data)); return { count: found.length } },
    },
  }
}

async function appFor(userId) {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(preservationRoutes)
  return app
}

test('presets: CRUD + único default + ownership + apply', async (t) => {
  const db = fakeDb()
  installFakeDb(db)
  const app = await appFor('presetuser-a')
  t.after(async () => { await app.close() })

  // validação: name obrigatório
  const bad = await app.inject({ method: 'POST', url: '/presets', payload: { minIntervalSec: 10 } })
  assert.equal(bad.statusCode, 400)

  // cria preset default
  const created = await app.inject({ method: 'POST', url: '/presets', payload: { name: ' Conservador ', isDefault: true, minIntervalSec: 60, operatingHoursEnabled: true, operatingHoursJson: '{"startHour":9,"endHour":21}' } })
  assert.equal(created.statusCode, 200)
  const preset = created.json().preset
  assert.equal(preset.name, 'Conservador')
  assert.equal(preset.isDefault, true)
  assert.equal(preset.minIntervalSec, 60)
  // tz default preenchido
  assert.equal(JSON.parse(preset.operatingHoursJson).tz, 'America/Sao_Paulo')

  // cria segundo default → desmarca o primeiro
  const second = await app.inject({ method: 'POST', url: '/presets', payload: { name: 'Agressivo', isDefault: true } })
  assert.equal(second.json().preset.isDefault, true)
  const list = await app.inject({ method: 'GET', url: '/presets' })
  const defaults = list.json().presets.filter((p) => p.isDefault)
  assert.equal(defaults.length, 1)
  assert.equal(defaults[0].name, 'Agressivo')

  // validação no PUT: minIntervalSec fora do range
  const badPut = await app.inject({ method: 'PUT', url: `/presets/${preset.id}`, payload: { minIntervalSec: 0 } })
  assert.equal(badPut.statusCode, 400)

  // delete do default é bloqueado
  const delDefault = await app.inject({ method: 'DELETE', url: `/presets/${second.json().preset.id}` })
  assert.equal(delDefault.statusCode, 409)

  // delete de não-default ok
  const delOk = await app.inject({ method: 'DELETE', url: `/presets/${preset.id}` })
  assert.equal(delOk.statusCode, 200)
})

test('presets: ownership isola entre usuários', async (t) => {
  const db = fakeDb()
  installFakeDb(db)
  const appA = await appFor('presetuser-a')
  const appB = await appFor('presetuser-b')
  t.after(async () => { await appA.close(); await appB.close() })

  const created = await appA.inject({ method: 'POST', url: '/presets', payload: { name: 'A' } })
  const id = created.json().preset.id
  // user B não enxerga nem edita
  const putB = await appB.inject({ method: 'PUT', url: `/presets/${id}`, payload: { name: 'hack' } })
  assert.equal(putB.statusCode, 404)
  const listB = await appB.inject({ method: 'GET', url: '/presets' })
  assert.equal(listB.json().presets.length, 0)
})

test('destinations: lista post-groups e aplica override/preset com validação', async (t) => {
  const db = fakeDb()
  db.groups.push({ id: 'g1', userId: 'presetuser-a', role: 'post', name: 'Grupo 1', waJid: 'g1@g.us', kind: 'group', preservationPresetId: null })
  db.groups.push({ id: 'g2', userId: 'presetuser-a', role: 'monitor', name: 'Mon', waJid: 'm@g.us', kind: 'group' })
  installFakeDb(db)
  const app = await appFor('presetuser-a')
  t.after(async () => { await app.close() })

  // só lista post
  const dests = await app.inject({ method: 'GET', url: '/destinations' })
  assert.equal(dests.json().destinations.length, 1)
  assert.equal(dests.json().destinations[0].id, 'g1')

  // override: minIntervalSec + dailyCap null (herda)
  const put = await app.inject({ method: 'PUT', url: '/destinations/g1', payload: { minIntervalSec: 120, dailyCap: null } })
  assert.equal(put.statusCode, 200)
  assert.equal(put.json().destination.minIntervalSec, 120)
  assert.equal(put.json().destination.dailyCap, null)

  // preset inexistente → 400
  const badPreset = await app.inject({ method: 'PUT', url: '/destinations/g1', payload: { preservationPresetId: 'nope' } })
  assert.equal(badPreset.statusCode, 400)

  // monitor não é destino editável
  const mon = await app.inject({ method: 'PUT', url: '/destinations/g2', payload: { minIntervalSec: 10 } })
  assert.equal(mon.statusCode, 404)

  // apply de preset a vários grupos
  const preset = await app.inject({ method: 'POST', url: '/presets', payload: { name: 'X' } })
  const apply = await app.inject({ method: 'POST', url: `/presets/${preset.json().preset.id}/apply`, payload: { groupIds: ['g1'] } })
  assert.equal(apply.statusCode, 200)
  assert.equal(apply.json().applied, 1)
  assert.equal(db.groups.find((g) => g.id === 'g1').preservationPresetId, preset.json().preset.id)
})
