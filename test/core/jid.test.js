import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  JID_KIND,
  detectKind,
  isMirrorableJid,
  ensureJid,
  parseChannelInviteUrl,
} from '../../src/core/jid.js'

test('JID_KIND constants', () => {
  assert.equal(JID_KIND.GROUP, 'group')
  assert.equal(JID_KIND.CHANNEL, 'channel')
  assert.throws(() => { JID_KIND.GROUP = 'x' }, TypeError)
})

test('detectKind', async (t) => {
  await t.test('reconhece grupo', () => {
    assert.equal(detectKind('120363012345678901@g.us'), 'group')
  })
  await t.test('reconhece canal', () => {
    assert.equal(detectKind('120363012345678901@newsletter'), 'channel')
  })
  await t.test('retorna null para JIDs não-espelháveis', () => {
    assert.equal(detectKind('5511999998888@s.whatsapp.net'), null)
    assert.equal(detectKind('status@broadcast'), null)
    assert.equal(detectKind(''), null)
  })
  await t.test('retorna null para tipos inválidos', () => {
    assert.equal(detectKind(null), null)
    assert.equal(detectKind(undefined), null)
    assert.equal(detectKind(123), null)
    assert.equal(detectKind({}), null)
  })
})

test('isMirrorableJid', async (t) => {
  await t.test('aceita grupo e canal', () => {
    assert.equal(isMirrorableJid('abc@g.us'), true)
    assert.equal(isMirrorableJid('abc@newsletter'), true)
  })
  await t.test('rejeita outros JIDs', () => {
    assert.equal(isMirrorableJid('abc@s.whatsapp.net'), false)
    assert.equal(isMirrorableJid('status@broadcast'), false)
    assert.equal(isMirrorableJid(''), false)
    assert.equal(isMirrorableJid(null), false)
  })
})

test('ensureJid', async (t) => {
  await t.test('preserva JID já com sufixo (qualquer sufixo)', () => {
    assert.equal(ensureJid('abc@g.us'), 'abc@g.us')
    assert.equal(ensureJid('abc@newsletter'), 'abc@newsletter')
    assert.equal(ensureJid('abc@s.whatsapp.net'), 'abc@s.whatsapp.net')
  })
  await t.test('concatena sufixo de grupo por padrão', () => {
    assert.equal(ensureJid('120363012345'), '120363012345@g.us')
  })
  await t.test('concatena sufixo de canal quando defaultKind é channel', () => {
    assert.equal(ensureJid('120363012345', JID_KIND.CHANNEL), '120363012345@newsletter')
  })
  await t.test('concatena sufixo de grupo explicitamente', () => {
    assert.equal(ensureJid('abc', JID_KIND.GROUP), 'abc@g.us')
  })
  await t.test('trata input vazio/null/whitespace', () => {
    assert.equal(ensureJid(''), null)
    assert.equal(ensureJid(null), null)
    assert.equal(ensureJid(undefined), null)
    assert.equal(ensureJid('   '), null)
  })
  await t.test('faz trim antes de processar', () => {
    assert.equal(ensureJid('  abc  '), 'abc@g.us')
    assert.equal(ensureJid('  abc@g.us  '), 'abc@g.us')
  })
  await t.test('coerce numérico via String()', () => {
    assert.equal(ensureJid(123), '123@g.us')
  })
  await t.test('defaultKind inválido devolve null para IDs nus', () => {
    assert.equal(ensureJid('abc', 'banana'), null)
  })
})

test('parseChannelInviteUrl', async (t) => {
  await t.test('extrai código de URL canônica', () => {
    assert.equal(
      parseChannelInviteUrl('https://whatsapp.com/channel/0029VaAbCdEfGhI'),
      '0029VaAbCdEfGhI',
    )
  })
  await t.test('aceita www', () => {
    assert.equal(
      parseChannelInviteUrl('https://www.whatsapp.com/channel/0029VaAbCdEfGhI'),
      '0029VaAbCdEfGhI',
    )
  })
  await t.test('aceita http', () => {
    assert.equal(
      parseChannelInviteUrl('http://whatsapp.com/channel/0029VaAbCdEfGhI'),
      '0029VaAbCdEfGhI',
    )
  })
  await t.test('ignora query string e fragmento', () => {
    assert.equal(
      parseChannelInviteUrl('https://whatsapp.com/channel/0029VaXyzAbcd?ref=share'),
      '0029VaXyzAbcd',
    )
    assert.equal(
      parseChannelInviteUrl('https://whatsapp.com/channel/0029VaXyzAbcd#top'),
      '0029VaXyzAbcd',
    )
    assert.equal(
      parseChannelInviteUrl('https://whatsapp.com/channel/0029VaXyzAbcd/'),
      '0029VaXyzAbcd',
    )
  })
  await t.test('faz trim', () => {
    assert.equal(
      parseChannelInviteUrl('  https://whatsapp.com/channel/0029VaAbCdEfGhI  '),
      '0029VaAbCdEfGhI',
    )
  })
  await t.test('rejeita host diferente', () => {
    assert.equal(parseChannelInviteUrl('https://example.com/channel/0029VaAbCdEfGhI'), null)
    assert.equal(parseChannelInviteUrl('https://wa.me/channel/0029VaAbCdEfGhI'), null)
  })
  await t.test('rejeita path diferente', () => {
    assert.equal(parseChannelInviteUrl('https://whatsapp.com/group/0029VaAbCdEfGhI'), null)
    assert.equal(parseChannelInviteUrl('https://chat.whatsapp.com/0029VaAbCdEfGhI'), null)
  })
  await t.test('rejeita código curto demais', () => {
    assert.equal(parseChannelInviteUrl('https://whatsapp.com/channel/abc'), null)
  })
  await t.test('rejeita inputs não-string ou vazios', () => {
    assert.equal(parseChannelInviteUrl(null), null)
    assert.equal(parseChannelInviteUrl(undefined), null)
    assert.equal(parseChannelInviteUrl(''), null)
    assert.equal(parseChannelInviteUrl(123), null)
    assert.equal(parseChannelInviteUrl('not a url'), null)
  })
})
