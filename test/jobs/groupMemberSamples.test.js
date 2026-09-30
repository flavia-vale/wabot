import test from 'node:test'
import assert from 'node:assert/strict'
import { captureMemberSamplesForUser, normalizeSize } from '../../src/jobs/groupMemberSamples.js'

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

test('tamanho 0/negativo/decimal é desconhecido (resposta truncada do WhatsApp), não "grupo vazio"', () => {
  for (const bad of [0, -1, 1.5, '12', null, undefined, NaN]) assert.equal(normalizeSize(bad), null, String(bad))
  assert.equal(normalizeSize(1), 1)
})

test('grupo que veio com size 0 é pulado, nada é gravado', async () => {
  const db = fakeDb([{ id: 'g1', waJid: 'a@g.us' }])
  const r = await captureMemberSamplesForUser('u1', { db, listGroups: async () => [{ waJid: 'a@g.us', size: 0 }] })
  assert.deepEqual(r, { captured: 0, skipped: 1 })
  assert.equal(db.created.length, 0)
})

import { runHotSampleSweep } from '../../src/jobs/groupMemberSamples.js'

const future = new Date(Date.now() + 86400000)
function hotDb(links) {
  const created = []
  return {
    created,
    smartLink: { findMany: async () => links },
    group: { findMany: async ({ where }) => [{ id: `g-${where.userId}`, waJid: 'a@g.us' }] },
    groupMemberSample: { create: async ({ data }) => created.push(data), findMany: async () => [], deleteMany: async () => ({}) },
  }
}
const link = (userId, size, extra = {}) => ({
  userId, capPerGroup: 1000,
  user: { plan: 'pro', accessExpiresAt: future, status: 'active' },
  groups: [{ enabled: true, inviteCode: 'ABCDEFGHIJ1234', group: { memberSamples: [{ size, sampledAt: new Date() }] } }],
  ...extra,
})

test('medição adaptativa: só mede quem tem grupo acima de 80% e sessão viva', async () => {
  const db = hotDb([link('quente', 850), link('frio', 300), link('quente-offline', 900)])
  const asked = []
  const stats = await runHotSampleSweep({
    db, pauseMs: 0,
    isRunning: async id => id !== 'quente-offline',
    listGroups: async id => (asked.push(id), [{ waJid: 'a@g.us', size: 860 }]),
  })
  assert.deepEqual(asked, ['quente'])
  assert.deepEqual(stats, { users: 1, captured: 1, skipped: 0, errors: 0 })
})

test('medição adaptativa: exatamente 80% conta; 79% não; Basic e inativo nunca', async () => {
  const asked = []
  const run = async links => { asked.length = 0; await runHotSampleSweep({ db: hotDb(links), pauseMs: 0, isRunning: async () => true, listGroups: async id => (asked.push(id), []) }) }
  await run([link('u80', 800)]); assert.deepEqual(asked, ['u80'])
  await run([link('u79', 799)]); assert.deepEqual(asked, [])
  await run([link('basic', 900, { user: { plan: 'basic', accessExpiresAt: future, status: 'active' } })]); assert.deepEqual(asked, [])
  await run([link('inativo', 900, { user: { plan: 'pro', accessExpiresAt: future, status: 'blocked' } })]); assert.deepEqual(asked, [])
})

test('medição adaptativa: amostra velha (>24h), grupo pausado ou sem convite não deixam o link "quente"', async () => {
  const old = { userId: 'velho', capPerGroup: 1000, user: { plan: 'pro', accessExpiresAt: future, status: 'active' }, groups: [{ enabled: true, inviteCode: 'ABCDEFGHIJ1234', group: { memberSamples: [{ size: 950, sampledAt: new Date(Date.now() - 30 * 3600_000) }] } }] }
  const paused = link('pausado', 950); paused.groups[0].enabled = false
  const noInvite = link('semconvite', 950); noInvite.groups[0].inviteCode = null
  const asked = []
  await runHotSampleSweep({ db: hotDb([old, paused, noInvite]), pauseMs: 0, isRunning: async () => true, listGroups: async id => (asked.push(id), []) })
  assert.deepEqual(asked, [])
})

test('medição adaptativa: um usuário com 2 links quentes é medido UMA vez; falha de um não derruba os outros', async () => {
  const db = hotDb([link('a', 900), link('a', 950), link('b', 900)])
  const asked = []
  const stats = await runHotSampleSweep({
    db, pauseMs: 0, isRunning: async () => true,
    listGroups: async id => { asked.push(id); if (id === 'a') throw new Error('WhatsApp fora'); return [{ waJid: 'a@g.us', size: 900 }] },
  })
  assert.deepEqual(asked, ['a', 'b'])
  assert.equal(stats.errors, 1)
  assert.equal(stats.captured, 1)
})
