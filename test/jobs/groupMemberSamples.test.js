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
