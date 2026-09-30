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
