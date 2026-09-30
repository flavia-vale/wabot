import test from 'node:test'
import assert from 'node:assert/strict'
import { captureMemberSamplesForUser } from '../../src/jobs/groupMemberSamples.js'

function fakeDb(groups) {
  const created = []
  return {
    created,
    group: { findMany: async () => groups },
    groupMemberSample: {
      create: async ({ data }) => created.push(data),
      findMany: async () => [],
      deleteMany: async () => ({}),
    },
  }
}

test('grava tamanho por grupo e pula quem veio sem size (worker antigo)', async () => {
  const db = fakeDb([{ id: 'g1', waJid: 'a@g.us' }, { id: 'g2', waJid: 'b@g.us' }])
  const listGroups = async () => [{ waJid: 'a@g.us', name: 'A', size: 42 }, { waJid: 'b@g.us', name: 'B' }]
  const r = await captureMemberSamplesForUser('u1', { db, listGroups })
  assert.deepEqual(r, { captured: 1, skipped: 1 })
  assert.equal(db.created[0].groupId, 'g1')
  assert.equal(db.created[0].size, 42)
})

test('sem grupos-destino não consulta o WhatsApp', async () => {
  let called = false
  const r = await captureMemberSamplesForUser('u1', { db: fakeDb([]), listGroups: async () => (called = true, []) })
  assert.deepEqual(r, { captured: 0, skipped: 0 })
  assert.equal(called, false)
})

import { runGroupMemberSampleSweep } from '../../src/jobs/groupMemberSamples.js'

test('sweep: só PRO com sessão viva; isRunning assíncrono (modo remote) funciona', async () => {
  const future = new Date(Date.now() + 86400000)
  const users = [
    { id: 'pro-on', plan: 'pro', accessExpiresAt: future },
    { id: 'pro-off', plan: 'pro', accessExpiresAt: future },
    { id: 'basic-on', plan: 'basic', accessExpiresAt: future },
  ]
  const created = []
  const db = {
    user: { findMany: async () => users },
    group: { findMany: async ({ where }) => [{ id: `g-${where.userId}`, waJid: 'a@g.us' }] },
    groupMemberSample: { create: async ({ data }) => created.push(data), findMany: async () => [], deleteMany: async () => ({}) },
  }
  const asked = []
  const stats = await runGroupMemberSampleSweep({
    db, pauseMs: 0,
    isRunning: async id => id !== 'pro-off',
    listGroups: async id => (asked.push(id), [{ waJid: 'a@g.us', size: 7 }]),
  })
  assert.deepEqual(stats, { users: 1, captured: 1, skipped: 0, errors: 0 })
  assert.deepEqual(asked, ['pro-on'])
  assert.equal(created[0].groupId, 'g-pro-on')
})
