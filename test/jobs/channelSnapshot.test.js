import test from 'node:test'
import assert from 'node:assert/strict'

import {
  pruneOldSnapshotIds,
  buildSnapshotData,
  captureSnapshot,
  captureAllForUser,
  SNAPSHOT_RETENTION,
} from '../../src/jobs/channelSnapshot.js'

// ---------- helpers puros ----------

test('pruneOldSnapshotIds preserva os N mais recentes', () => {
  const snaps = [
    { id: 'a', snapshotedAt: new Date('2026-05-10') },
    { id: 'b', snapshotedAt: new Date('2026-05-15') },
    { id: 'c', snapshotedAt: new Date('2026-05-01') },
    { id: 'd', snapshotedAt: new Date('2026-05-18') },
  ]
  const toDelete = pruneOldSnapshotIds(snaps, 2)
  // mantém d (18) + b (15); remove a (10) + c (01)
  assert.deepEqual(toDelete.sort(), ['a', 'c'])
})

test('pruneOldSnapshotIds com menos que retention retorna vazio', () => {
  const snaps = [{ id: 'x', snapshotedAt: new Date() }]
  assert.deepEqual(pruneOldSnapshotIds(snaps, 30), [])
})

test('buildSnapshotData extrai campos relevantes do metadata', () => {
  const meta = {
    jid: 'abc@newsletter',
    name: 'Canal X',
    description: 'desc',
    inviteLink: 'https://whatsapp.com/channel/0029Va',
    extra: 'irrelevante',
  }
  const data = buildSnapshotData(meta)
  assert.equal(data.name, 'Canal X')
  assert.equal(data.description, 'desc')
  assert.equal(data.inviteLink, 'https://whatsapp.com/channel/0029Va')
  const json = JSON.parse(data.snapshotJson)
  assert.equal(json.jid, 'abc@newsletter')
  assert.equal(json.extra, 'irrelevante')
})

test('buildSnapshotData tolera metadata mínimo', () => {
  const data = buildSnapshotData({ jid: 'x@newsletter' })
  assert.equal(data.name, null)
  assert.equal(data.description, null)
  assert.equal(data.inviteLink, null)
})

// ---------- I/O com fakes ----------

function makeFakeDb(state = {}) {
  const snapshots = state.snapshots ?? new Map() // groupId → array
  const groups = state.groups ?? []
  return {
    _snapshots: snapshots,
    group: {
      findMany: async ({ where, select }) => {
        let res = groups
        if (where?.userId) res = res.filter(g => g.userId === where.userId)
        if (where?.role) res = res.filter(g => g.role === where.role)
        if (where?.kind) res = res.filter(g => g.kind === where.kind)
        return select ? res.map(g => {
          const r = {}; for (const k of Object.keys(select)) r[k] = g[k]; return r
        }) : res
      },
      findFirst: async ({ where }) => groups.find(g => g.id === where.id) ?? null,
    },
    channelSnapshot: {
      create: async ({ data }) => {
        const list = snapshots.get(data.groupId) ?? []
        const row = { id: `s-${list.length + 1}-${data.groupId}`, snapshotedAt: new Date(), ...data }
        list.push(row)
        snapshots.set(data.groupId, list)
        return row
      },
      findMany: async ({ where, orderBy }) => {
        let list = snapshots.get(where.groupId) ?? []
        if (orderBy?.snapshotedAt === 'desc') {
          list = [...list].sort((a, b) => b.snapshotedAt - a.snapshotedAt)
        }
        return list
      },
      deleteMany: async ({ where }) => {
        const list = snapshots.get(where.groupId) ?? []
        const ids = new Set(where.id?.in ?? [])
        const next = list.filter(s => !ids.has(s.id))
        snapshots.set(where.groupId, next)
        return { count: list.length - next.length }
      },
    },
  }
}

test('captureSnapshot grava metadata e respeita retenção (default 30)', async () => {
  const db = makeFakeDb()
  const getMetadata = async () => ({ jid: 'g@newsletter', name: 'X', description: 'd', inviteLink: 'l' })
  const row = await captureSnapshot('g-1', { db, getMetadata })
  assert.equal(row.name, 'X')
  assert.equal(row.groupId, 'g-1')
  assert.equal(db._snapshots.get('g-1').length, 1)
})

test('captureSnapshot poda snapshots além do limite', async () => {
  const db = makeFakeDb()
  const now = Date.now()
  for (let i = 0; i < SNAPSHOT_RETENTION + 3; i++) {
    db._snapshots.set('g-1', [
      ...(db._snapshots.get('g-1') ?? []),
      { id: `pre-${i}`, groupId: 'g-1', snapshotedAt: new Date(now - (SNAPSHOT_RETENTION + 3 - i) * 1000), snapshotJson: '{}' },
    ])
  }
  const getMetadata = async () => ({ jid: 'g@newsletter', name: 'X' })
  await captureSnapshot('g-1', { db, getMetadata })
  const remaining = db._snapshots.get('g-1')
  assert.equal(remaining.length, SNAPSHOT_RETENTION)
})

test('captureSnapshot ignora canal quando metadata retorna null', async () => {
  const db = makeFakeDb()
  const result = await captureSnapshot('g-1', { db, getMetadata: async () => null })
  assert.equal(result, null)
  assert.equal(db._snapshots.has('g-1'), false)
})

test('captureAllForUser itera apenas canais role=post kind=channel', async () => {
  const db = makeFakeDb({
    groups: [
      { id: 'g-1', userId: 'u', role: 'post', kind: 'channel', waJid: 'a@newsletter' },
      { id: 'g-2', userId: 'u', role: 'post', kind: 'group', waJid: 'b@g.us' },
      { id: 'g-3', userId: 'u', role: 'monitor', kind: 'channel', waJid: 'c@newsletter' },
      { id: 'g-4', userId: 'other', role: 'post', kind: 'channel', waJid: 'd@newsletter' },
    ],
  })
  const getMetadata = async (_uid, { jid }) => ({ jid, name: `Canal ${jid}` })
  const summary = await captureAllForUser('u', { db, getMetadata })
  assert.equal(summary.captured, 1)
  assert.equal(summary.skipped, 0)
  assert.equal(db._snapshots.get('g-1').length, 1)
  assert.equal(db._snapshots.has('g-2'), false)
})

test('captureAllForUser conta skipped quando metadata falha', async () => {
  const db = makeFakeDb({
    groups: [
      { id: 'g-1', userId: 'u', role: 'post', kind: 'channel', waJid: 'a@newsletter' },
      { id: 'g-2', userId: 'u', role: 'post', kind: 'channel', waJid: 'b@newsletter' },
    ],
  })
  let calls = 0
  const getMetadata = async () => {
    calls++
    if (calls === 1) throw new Error('boom')
    return { jid: 'b@newsletter', name: 'B' }
  }
  const summary = await captureAllForUser('u', { db, getMetadata })
  assert.equal(summary.captured, 1)
  assert.equal(summary.skipped, 1)
})
