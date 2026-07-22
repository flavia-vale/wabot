import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeJid, buildAllowedJidSet, shouldIgnoreChatJid } from '../src/core/ignoredJidPolicy.js'

const MONITOR = '120363408902013129@g.us'
const POST = '120363406417873088@g.us'
const CULPRIT = '120363411003172494@g.us' // grupo que derrubava a Vanessa (não-monitorado)

function allow() {
  return buildAllowedJidSet([MONITOR, POST])
}

test('normalizeJid remove o sufixo de device', () => {
  assert.equal(normalizeJid('120363411003172494:12@g.us'), '120363411003172494@g.us')
  assert.equal(normalizeJid('  5511999@s.whatsapp.net '), '5511999@s.whatsapp.net')
  assert.equal(normalizeJid(null), '')
})

test('flag OFF: nunca ignora nada (comportamento histórico)', () => {
  assert.equal(shouldIgnoreChatJid(CULPRIT, { allowedJids: allow(), enabled: false, ready: true }), false)
})

test('ready=false: nunca ignora (default seguro antes da config carregar)', () => {
  assert.equal(shouldIgnoreChatJid(CULPRIT, { allowedJids: allow(), enabled: true, ready: false }), false)
})

test('grupo @g.us não-monitorado é ignorado quando ligado e pronto', () => {
  assert.equal(shouldIgnoreChatJid(CULPRIT, { allowedJids: allow(), enabled: true, ready: true }), true)
})

test('grupo monitorado NUNCA é ignorado (mesmo ligado)', () => {
  assert.equal(shouldIgnoreChatJid(MONITOR, { allowedJids: allow(), enabled: true, ready: true }), false)
  assert.equal(shouldIgnoreChatJid(POST, { allowedJids: allow(), enabled: true, ready: true }), false)
})

test('grupo monitorado com sufixo de device casa com o allowlist normalizado', () => {
  assert.equal(shouldIgnoreChatJid('120363408902013129:9@g.us', { allowedJids: allow(), enabled: true, ready: true }), false)
})

test('newsletter, DM, status e próprio número NUNCA são ignorados (blast radius mínimo)', () => {
  const opts = { allowedJids: allow(), enabled: true, ready: true }
  assert.equal(shouldIgnoreChatJid('120363333333333333@newsletter', opts), false)
  assert.equal(shouldIgnoreChatJid('5511988887777@s.whatsapp.net', opts), false)
  assert.equal(shouldIgnoreChatJid('status@broadcast', opts), false)
  assert.equal(shouldIgnoreChatJid('69321040605402@lid', opts), false)
})

test('jid inválido/vazio nunca é ignorado', () => {
  const opts = { allowedJids: allow(), enabled: true, ready: true }
  assert.equal(shouldIgnoreChatJid('', opts), false)
  assert.equal(shouldIgnoreChatJid(undefined, opts), false)
})

test('buildAllowedJidSet normaliza e descarta vazios', () => {
  const set = buildAllowedJidSet([MONITOR, '', null, '120363408902013129:3@g.us'])
  assert.equal(set.has(MONITOR), true)
  assert.equal(set.size, 1) // o com device colapsa no mesmo jid normalizado
})
