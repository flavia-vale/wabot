import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeDesyncGroups } from '../src/adminLogSummary.js'

const CULPRIT = '120363411003172494@g.us'
const OTHER = '120363400000000000@g.us'

function ev(event, metadata, createdAt) {
  return { event, metadata: JSON.stringify(metadata), createdAt }
}

test('agrega por jid: conta autoheals, pega nome e último visto', () => {
  const rows = summarizeDesyncGroups([
    ev('ops_wa_group_desync_autoheal', { jid: CULPRIT, name: 'Grupo Quebrado', count: 5 }, '2026-07-19T10:00:00Z'),
    ev('ops_wa_group_desync_autoheal', { jid: CULPRIT, name: 'Grupo Quebrado', count: 6 }, '2026-07-19T12:00:00Z'),
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].jid, CULPRIT)
  assert.equal(rows[0].name, 'Grupo Quebrado')
  assert.equal(rows[0].autoheals, 2)
  assert.equal(rows[0].unresolved, false)
  assert.equal(rows[0].lastSeenAt, '2026-07-19T12:00:00.000Z')
})

test('unresolved marca o grupo e ordena na frente', () => {
  const rows = summarizeDesyncGroups([
    ev('ops_wa_group_desync_autoheal', { jid: OTHER, count: 9 }, '2026-07-19T09:00:00Z'),
    ev('ops_wa_group_desync_autoheal', { jid: OTHER, count: 9 }, '2026-07-19T09:30:00Z'),
    ev('ops_wa_group_desync_autoheal', { jid: CULPRIT, count: 5 }, '2026-07-19T10:00:00Z'),
    ev('ops_wa_group_desync_unresolved', { jid: CULPRIT, count: 3 }, '2026-07-19T13:00:00Z'),
  ])
  // CULPRIT tem unresolved → vem primeiro apesar de menos autoheals
  assert.equal(rows[0].jid, CULPRIT)
  assert.equal(rows[0].unresolved, true)
  assert.equal(rows[1].jid, OTHER)
  assert.equal(rows[1].unresolved, false)
})

test('evento sem jid é ignorado; metadata malformada não quebra', () => {
  const rows = summarizeDesyncGroups([
    { event: 'ops_wa_group_desync_autoheal', metadata: '{bad json', createdAt: '2026-07-19T10:00:00Z' },
    ev('ops_wa_group_desync_autoheal', { count: 5 }, '2026-07-19T10:00:00Z'),
    ev('ops_wa_group_desync_autoheal', { jid: CULPRIT, count: 5 }, '2026-07-19T10:00:00Z'),
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].jid, CULPRIT)
})

test('respeita o limit', () => {
  const many = []
  for (let i = 0; i < 20; i++) many.push(ev('ops_wa_group_desync_autoheal', { jid: `1203634${i}@g.us`, count: 1 }, '2026-07-19T10:00:00Z'))
  assert.equal(summarizeDesyncGroups(many, { limit: 5 }).length, 5)
})
