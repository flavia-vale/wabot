import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MOBILE_GROUP_DUPLICATE_FEEDBACK,
  buildExistingJidRoleSet,
  getMobileGroupPickerItem,
  getRoleForMobileGroupTab,
  prepareMobileGroupAddPayload,
  sortWhatsAppGroupsForMobilePicker,
} from '../dashboard/lib/mobileGroupPicker.js'

test('aba ativa define se o grupo será adicionado como monitor ou post', () => {
  assert.equal(getRoleForMobileGroupTab('origem'), 'monitor')
  assert.equal(getRoleForMobileGroupTab('destino'), 'post')
})

test('lista do WhatsApp é ordenada por nome visível', () => {
  const sorted = sortWhatsAppGroupsForMobilePicker([
    { waJid: '3@g.us', name: 'Zeta' },
    { waJid: '1@g.us', subject: 'Alfa' },
    { waJid: '2@g.us', name: 'Beta' },
  ])

  assert.deepEqual(sorted.map((group) => group.waJid), ['1@g.us', '2@g.us', '3@g.us'])
})

test('item do picker bloqueia apenas duplicado da role atual', () => {
  const existing = buildExistingJidRoleSet([
    { waJid: 'grupo@g.us', role: 'monitor' },
  ])

  const monitorItem = getMobileGroupPickerItem({ waJid: 'grupo@g.us', name: 'Grupo' }, 'monitor', existing)
  assert.equal(monitorItem.disabled, true)
  assert.equal(monitorItem.pill, 'já está na lista')

  const postItem = getMobileGroupPickerItem({ waJid: 'grupo@g.us', name: 'Grupo' }, 'post', existing)
  assert.equal(postItem.disabled, false)
  assert.equal(postItem.pill, 'Publicar')
})

test('item do picker bloqueia grupo já cadastrado nas duas roles', () => {
  const existing = buildExistingJidRoleSet([
    { waJid: 'grupo@g.us', role: 'monitor' },
    { waJid: 'grupo@g.us', role: 'post' },
  ])

  const monitorItem = getMobileGroupPickerItem({ waJid: 'grupo@g.us', name: 'Grupo' }, 'monitor', existing)
  assert.equal(monitorItem.disabled, true)
  assert.equal(monitorItem.pill, 'já está na lista')

  const postItem = getMobileGroupPickerItem({ waJid: 'grupo@g.us', name: 'Grupo' }, 'post', existing)
  assert.equal(postItem.disabled, true)
  assert.equal(postItem.pill, 'já está na lista')
})

test('payload do add-flow usa role ativa e normaliza dados manuais', () => {
  const result = prepareMobileGroupAddPayload(
    { waJid: ' grupo@g.us ', name: ' Grupo Manual ', kind: 'channel' },
    'post',
    new Set()
  )

  assert.equal(result.ok, true)
  assert.deepEqual(result.payload, {
    waJid: 'grupo@g.us',
    name: 'Grupo Manual',
    role: 'post',
    kind: 'channel',
  })
})

test('add-flow manual detecta duplicidade antes de montar chamada para API', () => {
  const existing = buildExistingJidRoleSet([
    { waJid: 'grupo@g.us', role: 'monitor' },
  ])

  const result = prepareMobileGroupAddPayload({ waJid: ' grupo@g.us ', name: 'Grupo' }, 'monitor', existing)

  assert.equal(result.ok, false)
  assert.equal(result.reason, 'duplicate')
  assert.equal(result.feedback, MOBILE_GROUP_DUPLICATE_FEEDBACK)
  assert.equal('payload' in result, false)
})
