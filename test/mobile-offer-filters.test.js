import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isChannelGroup,
  filterDestGroups,
  groupKey,
  selectAllVisible,
  clearVisible,
} from '../dashboard/lib/mobileOfferFilters.js'

const newsletter = { waJid: 'abc@newsletter', name: 'Canal A', kind: 'group' }
const channel = { waJid: 'xyz@g.us', name: 'Canal B', kind: 'channel' }
const group1 = { waJid: '111@g.us', name: 'Grupo Promoções', kind: 'group' }
const group2 = { waJid: '222@g.us', name: 'Grupo Eletrônicos', kind: 'group' }
const group3 = { id: '333', name: 'Grupo Moda', kind: 'group' }

test('isChannelGroup detecta @newsletter pelo jid', () => {
  assert.equal(isChannelGroup(newsletter), true)
})

test('isChannelGroup detecta kind=channel', () => {
  assert.equal(isChannelGroup(channel), true)
})

test('isChannelGroup retorna false para grupo comum', () => {
  assert.equal(isChannelGroup(group1), false)
})

test('filterDestGroups exclui canais por padrão', () => {
  const result = filterDestGroups([newsletter, channel, group1])
  assert.equal(result.length, 1)
  assert.equal(result[0].waJid, group1.waJid)
})

test('filterDestGroups inclui canais quando includeChannels=true', () => {
  const result = filterDestGroups([newsletter, channel, group1], { includeChannels: true })
  assert.equal(result.length, 3)
})

test('filterDestGroups filtra por busca case-insensitive no name', () => {
  const result = filterDestGroups([group1, group2], { search: 'ELETRÔ' })
  assert.equal(result.length, 1)
  assert.equal(result[0].waJid, group2.waJid)
})

test('filterDestGroups retorna todos quando busca vazia', () => {
  const result = filterDestGroups([group1, group2], { search: '' })
  assert.equal(result.length, 2)
})

test('filterDestGroups não muta o array original', () => {
  const original = [group1, group2]
  const result = filterDestGroups(original, { search: 'Eletrônicos' })
  assert.equal(original.length, 2)
  assert.notStrictEqual(result, original)
})

test('groupKey usa waJid quando disponível', () => {
  assert.equal(groupKey(group1), '111@g.us')
})

test('groupKey cai para id quando sem jid', () => {
  assert.equal(groupKey(group3), '333')
})

test('selectAllVisible adiciona chaves visíveis sem duplicar', () => {
  const current = ['111@g.us']
  const visible = [group1, group2]
  const result = selectAllVisible(current, visible)
  assert.deepEqual(result, ['111@g.us', '222@g.us'])
})

test('selectAllVisible não muta o array original', () => {
  const current = ['111@g.us']
  selectAllVisible(current, [group1, group2])
  assert.equal(current.length, 1)
})

test('clearVisible remove chaves dos visíveis', () => {
  const current = ['111@g.us', '222@g.us', '999@g.us']
  const visible = [group1, group2]
  const result = clearVisible(current, visible)
  assert.deepEqual(result, ['999@g.us'])
})

test('clearVisible não muta o array original', () => {
  const current = ['111@g.us', '222@g.us']
  clearVisible(current, [group1])
  assert.equal(current.length, 2)
})
