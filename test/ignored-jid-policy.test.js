import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeJid, buildAllowedJidSet, shouldIgnoreChatJid, shouldIgnoreDesyncedChannel } from '../src/core/ignoredJidPolicy.js'

const MONITOR = '120363408902013129@g.us'
const POST = '120363406417873088@g.us'
const CULPRIT = '120363411003172494@g.us' // grupo que derrubava a Vanessa (não-monitorado)
const CHANNEL = '120363185235679999@newsletter' // canal que derrubava tecnicotelecom10@gmail.com
const MONITORED_CHANNEL = '120363167675090065@newsletter'

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

// shouldIgnoreDesyncedChannel — Camada 3-B (RCA 2026-09-23): canal com
// sessão dessincronizada, ignorado só DEPOIS de provar estar quebrado.

test('flag OFF: canal em quarentena não é ignorado (comportamento histórico)', () => {
  const now = 1_000_000
  assert.equal(
    shouldIgnoreDesyncedChannel(CHANNEL, { enabled: false, quarantinedAt: now - 10, now, ttlMs: 60_000 }),
    false
  )
})

test('sem quarentena registrada (quarantinedAt ausente): nunca ignora', () => {
  const now = 1_000_000
  assert.equal(shouldIgnoreDesyncedChannel(CHANNEL, { enabled: true, quarantinedAt: undefined, now, ttlMs: 60_000 }), false)
})

test('canal em quarentena, dentro da janela: ignorado', () => {
  const now = 1_000_000
  assert.equal(
    shouldIgnoreDesyncedChannel(CHANNEL, { enabled: true, quarantinedAt: now - 10_000, now, ttlMs: 60_000 }),
    true
  )
})

test('canal em quarentena, janela expirada: volta a ser processado', () => {
  const now = 1_000_000
  assert.equal(
    shouldIgnoreDesyncedChannel(CHANNEL, { enabled: true, quarantinedAt: now - 120_000, now, ttlMs: 60_000 }),
    false
  )
})

test('canal MONITORADO nunca é ignorado, mesmo em quarentena (allowlist ganha)', () => {
  const now = 1_000_000
  assert.equal(
    shouldIgnoreDesyncedChannel(MONITORED_CHANNEL, {
      enabled: true,
      quarantinedAt: now - 10_000,
      now,
      ttlMs: 60_000,
      allowedJids: buildAllowedJidSet([MONITORED_CHANNEL]),
    }),
    false
  )
})

test('só entram nesta regra jids de canal (@newsletter) — grupo em quarentena não conta', () => {
  const now = 1_000_000
  assert.equal(
    shouldIgnoreDesyncedChannel(CULPRIT, { enabled: true, quarantinedAt: now - 10_000, now, ttlMs: 60_000 }),
    false
  )
})

test('canal com sufixo de device casa com a quarentena normalizada', () => {
  const now = 1_000_000
  assert.equal(
    shouldIgnoreDesyncedChannel('120363185235679999:5@newsletter', { enabled: true, quarantinedAt: now - 10_000, now, ttlMs: 60_000 }),
    true
  )
})

test('ttlMs<=0 desliga a expiração (quarentena vale enquanto estiver registrada)', () => {
  const now = 1_000_000
  assert.equal(
    shouldIgnoreDesyncedChannel(CHANNEL, { enabled: true, quarantinedAt: now - 999_999_999, now, ttlMs: 0 }),
    true
  )
})
