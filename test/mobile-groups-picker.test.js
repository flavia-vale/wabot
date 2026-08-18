import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MOBILE_GROUP_DUPLICATE_FEEDBACK,
  MOBILE_GROUP_PLATFORMS,
  buildExistingJidRoleSet,
  getMobileGroupPickerItem,
  getRoleForMobileGroupTab,
  isMobilePlatformSelected,
  prepareMobileGroupAddPayload,
  sortWhatsAppGroupsForMobilePicker,
  toggleMobilePlatform,
  toggleMobileTargetPostId,
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

test('sem seleção manual de plataforma, todas contam como selecionadas', () => {
  for (const platform of MOBILE_GROUP_PLATFORMS) {
    assert.equal(isMobilePlatformSelected('', platform.id), true)
    assert.equal(isMobilePlatformSelected(null, platform.id), true)
  }
})

test('com csv explícito, só as plataformas listadas contam como selecionadas', () => {
  assert.equal(isMobilePlatformSelected('shopee,amazon', 'shopee'), true)
  assert.equal(isMobilePlatformSelected('shopee,amazon', 'mercadolivre'), false)
})

test('desmarcar a primeira plataforma parte do conjunto completo', () => {
  // grupo sem seleção (todas ativas) → desmarcar shopee mantém as outras 4
  const next = toggleMobilePlatform('', 'shopee')
  assert.deepEqual(next.split(',').sort(), ['amazon', 'magazineluiza', 'mercadolivre', 'shein'])
})

// specs/012-shein-store-support (D10/D11/T058)
test('MOBILE_GROUP_PLATFORMS inclui a SHEIN', () => {
  assert.ok(MOBILE_GROUP_PLATFORMS.some((p) => p.id === 'shein' && p.label === 'SHEIN'))
})

test('marcar e desmarcar plataforma sobre csv existente é idempotente em par', () => {
  const removed = toggleMobilePlatform('shopee,amazon', 'amazon')
  assert.equal(removed, 'shopee')
  const readded = toggleMobilePlatform(removed, 'amazon')
  assert.deepEqual(readded.split(','), ['shopee', 'amazon'])
})

test('toggle de alvo adiciona e remove o id de destino sem mutar o array', () => {
  const base = [1, 2]
  const added = toggleMobileTargetPostId(base, 3)
  assert.deepEqual(added, [1, 2, 3])
  assert.deepEqual(base, [1, 2])

  const removed = toggleMobileTargetPostId(added, 2)
  assert.deepEqual(removed, [1, 3])
})

test('toggle de alvo tolera lista ausente', () => {
  assert.deepEqual(toggleMobileTargetPostId(undefined, 7), [7])
})
