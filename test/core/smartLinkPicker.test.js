import test from 'node:test'
import assert from 'node:assert/strict'
import { pickGroup, normalizeSlug, isValidInviteCode, inviteUrl, normalizeCap, createReserveTracker } from '../../src/core/smartLinkPicker.js'

const g = (id, size, extra = {}) => ({ id, enabled: true, inviteCode: 'ABCDEFGHIJ1234', size, reserved: 0, lastPickedAt: 0, ...extra })

test('escolhe o grupo com menos membros', () => {
  const r = pickGroup([g('a', 900), g('b', 300), g('c', 600)])
  assert.equal(r.group.id, 'b')
})

test('diferença de até 5 membros é empate e alterna pelo menos recente', () => {
  const r = pickGroup([g('a', 300, { lastPickedAt: 50 }), g('b', 304, { lastPickedAt: 10 }), g('c', 400)])
  assert.equal(r.group.id, 'b')
})

test('reserva de cliques desloca a escolha (rajada não cai toda no mesmo grupo)', () => {
  const r = pickGroup([g('a', 300, { reserved: 40 }), g('b', 320)])
  assert.equal(r.group.id, 'b')
})

test('grupo no teto sai do rodízio; todos cheios = all_full', () => {
  assert.equal(pickGroup([g('a', 1000), g('b', 400)]).group.id, 'b')
  const full = pickGroup([g('a', 1000), g('b', 990, { reserved: 10 })])
  assert.deepEqual([full.group, full.reason], [null, 'all_full'])
  assert.equal(pickGroup([g('a', 60)], { cap: 50 }).reason, 'all_full')
})

test('desligado ou sem convite válido não entra; nenhum utilizável = empty', () => {
  const r = pickGroup([g('a', 1, { enabled: false }), g('b', 1, { inviteCode: null }), g('c', 1, { inviteCode: 'curto' })])
  assert.equal(r.reason, 'empty')
})

test('grupo sem amostra só é usado se não há grupo medido com vaga', () => {
  assert.equal(pickGroup([g('novo', null), g('a', 500)]).group.id, 'a')
  assert.equal(pickGroup([g('novo', null), g('a', 1000)]).group.id, 'novo')
})

test('slug: normaliza, recusa reservado, curto e hífen duplo', () => {
  assert.equal(normalizeSlug(' Promo Tech '), 'promo-tech')
  assert.equal(normalizeSlug('Café Ofertas'), 'cafe-ofertas')
  for (const bad of ['api', 'g', 'ab', '-x-', 'a--b', 'a/b', '../x', '', null]) assert.equal(normalizeSlug(bad), null, String(bad))
})

test('convite: só código alfanumérico vira URL do chat.whatsapp.com', () => {
  assert.equal(inviteUrl('ABCDEFGHIJ1234'), 'https://chat.whatsapp.com/ABCDEFGHIJ1234')
  for (const bad of ['https://evil.com', 'abc/../x', 'a b c d e f g h i j', null]) {
    assert.equal(isValidInviteCode(bad), false)
    assert.equal(inviteUrl(bad), null)
  }
})

test('teto por grupo: 50 a 1024', () => {
  assert.equal(normalizeCap(1000), 1000)
  for (const bad of [49, 1025, 'x', 10.5]) assert.equal(normalizeCap(bad), null)
})

test('reserva zera quando entra amostra nova', () => {
  const t = createReserveTracker()
  t.add('a', 100); t.add('a', 100)
  assert.equal(t.get('a', 100), 2)
  assert.equal(t.get('a', 200), 0)
  t.add('a', 200)
  assert.equal(t.get('a', 200), 1)
})
