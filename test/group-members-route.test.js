import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { groupMembersRoutes } from '../src/api/routes/groupMembers.js'

async function make(plan, groups = []) {
  const app = Fastify()
  app.decorate('authenticate', async (req) => { req.user = { sub: 'owner' } })
  let queried = false
  const db = { group: { findMany: async () => (queried = true, groups) } }
  await app.register(groupMembersRoutes, { db, loadPlanSubject: async () => plan, now: () => new Date('2026-09-30T12:00:00Z') })
  return { app, wasQueried: () => queried }
}

test('Basic recebe 403 antes de consultar amostras', async () => {
  const { app, wasQueried } = await make({ plan: 'basic' })
  const res = await app.inject({ url: '/' })
  assert.equal(res.statusCode, 403)
  assert.equal(res.json().code, 'FEATURE_REQUIRES_PRO')
  assert.equal(res.json().feature, 'group_members')
  assert.equal(wasQueried(), false)
  await app.close()
})

test('PRO recebe grupos com total e variação', async () => {
  const t = h => new Date(new Date('2026-09-30T12:00:00Z').getTime() - h * 3600_000)
  const { app } = await make({ plan: 'pro', accessExpiresAt: new Date(Date.now() + 86400000) }, [
    { id: 'g1', name: 'A', memberSamples: [{ size: 110, sampledAt: t(0) }, { size: 100, sampledAt: t(24) }] },
  ])
  const res = await app.inject({ url: '/' })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.totalSize, 110)
  assert.deepEqual(body.groups[0].delta24h, { diff: 10, pct: 10 })
  assert.doesNotMatch(res.body, /userId|@g\.us/)
  await app.close()
})

test('PRO recebe séries por período (24h/7d/30d) para o gráfico', async () => {
  const base = new Date('2026-09-30T12:00:00Z').getTime()
  const samples = [...Array(48).keys()].map(h => ({ size: 1000 - h, sampledAt: new Date(base - h * 3600_000) }))
  const { app } = await make({ plan: 'pro', accessExpiresAt: new Date(Date.now() + 86400000) }, [{ id: 'g1', name: 'A', memberSamples: samples }])
  const g = (await app.inject({ url: '/' })).json().groups[0]
  assert.equal(g.series.d1.length, 25)
  assert.equal(g.series.d7.length, 48)
  assert.ok(g.series.d30.length >= 2)
  assert.deepEqual(g.delta24h, { diff: 24, pct: 2.5 })
  await app.close()
})
