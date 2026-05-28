import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildExistingJidRoleSet,
  getMobileGroupPickerItem,
  getRoleForMobileGroupTab,
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
