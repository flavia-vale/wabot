import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldUseRelayPath,
  stripChannelUnsafeFields,
  isChannelDestination,
  isChannelForbiddenError,
} from '../../src/core/channelSend.js'

test('isChannelDestination', async (t) => {
  await t.test('verdadeiro para @newsletter', () => {
    assert.equal(isChannelDestination('abc@newsletter'), true)
  })
  await t.test('falso para @g.us', () => {
    assert.equal(isChannelDestination('abc@g.us'), false)
  })
  await t.test('falso para JIDs desconhecidos ou inválidos', () => {
    assert.equal(isChannelDestination('abc@s.whatsapp.net'), false)
    assert.equal(isChannelDestination('status@broadcast'), false)
    assert.equal(isChannelDestination(''), false)
    assert.equal(isChannelDestination(null), false)
    assert.equal(isChannelDestination(undefined), false)
  })
})

test('shouldUseRelayPath', async (t) => {
  await t.test('verdadeiro para grupo com mídia original', () => {
    assert.equal(shouldUseRelayPath({ destJid: 'abc@g.us', hasOriginal: true }), true)
  })
  await t.test('falso para grupo sem mídia original', () => {
    assert.equal(shouldUseRelayPath({ destJid: 'abc@g.us', hasOriginal: false }), false)
  })
  await t.test('FALSO para canal mesmo com mídia original — relayMessage não vale pra @newsletter', () => {
    assert.equal(shouldUseRelayPath({ destJid: 'abc@newsletter', hasOriginal: true }), false)
  })
  await t.test('falso para canal sem mídia original', () => {
    assert.equal(shouldUseRelayPath({ destJid: 'abc@newsletter', hasOriginal: false }), false)
  })
  await t.test('falso para JID desconhecido (defensive default)', () => {
    assert.equal(shouldUseRelayPath({ destJid: 'abc@s.whatsapp.net', hasOriginal: true }), false)
    assert.equal(shouldUseRelayPath({ destJid: '', hasOriginal: true }), false)
    assert.equal(shouldUseRelayPath({ destJid: null, hasOriginal: true }), false)
  })
})

test('stripChannelUnsafeFields', async (t) => {
  await t.test('null/undefined passa adiante', () => {
    assert.equal(stripChannelUnsafeFields(null), null)
    assert.equal(stripChannelUnsafeFields(undefined), undefined)
  })
  await t.test('remove quoted de payload de texto', () => {
    const result = stripChannelUnsafeFields({
      text: 'oi',
      quoted: { key: 'whatever' },
    })
    assert.deepEqual(result, { text: 'oi' })
  })
  await t.test('remove contextInfo (que pode carregar quoted)', () => {
    const result = stripChannelUnsafeFields({
      text: 'oi',
      contextInfo: { quotedMessage: {} },
    })
    assert.deepEqual(result, { text: 'oi' })
  })
  await t.test('preserva text-only payload sem campos a remover', () => {
    const input = { text: 'oi', mentions: ['abc@s.whatsapp.net'] }
    const result = stripChannelUnsafeFields(input)
    assert.deepEqual(result, input)
    assert.notEqual(result, input, 'deve retornar novo objeto (immutabilidade)')
  })
  await t.test('preserva image+caption removendo apenas quoted/contextInfo', () => {
    const result = stripChannelUnsafeFields({
      image: Buffer.from('fake'),
      caption: 'legenda',
      quoted: { fake: true },
      contextInfo: { fake: true },
    })
    assert.equal(result.caption, 'legenda')
    assert.ok(Buffer.isBuffer(result.image))
    assert.equal(result.quoted, undefined)
    assert.equal(result.contextInfo, undefined)
  })
  await t.test('não muta o input', () => {
    const input = { text: 'oi', quoted: { x: 1 } }
    stripChannelUnsafeFields(input)
    assert.deepEqual(input.quoted, { x: 1 }, 'input original não deve ser mutado')
  })
})

test('isChannelForbiddenError', async (t) => {
  await t.test('verdadeiro para erro com statusCode 403', () => {
    const err = new Error('forbidden')
    err.output = { statusCode: 403 }
    assert.equal(isChannelForbiddenError(err), true)
  })
  await t.test('verdadeiro para erro com data.statusCode 403 (formato Baileys)', () => {
    const err = new Error('forbidden')
    err.data = 403
    assert.equal(isChannelForbiddenError(err), true)
  })
  await t.test('verdadeiro para mensagem com "forbidden"', () => {
    assert.equal(isChannelForbiddenError(new Error('Forbidden: not allowed to post')), true)
  })
  await t.test('verdadeiro para mensagem com "not authorized"', () => {
    assert.equal(isChannelForbiddenError(new Error('not authorized to post in newsletter')), true)
  })
  await t.test('verdadeiro para mensagem com "unauthorized"', () => {
    assert.equal(isChannelForbiddenError(new Error('Unauthorized access')), true)
  })
  await t.test('verdadeiro para mensagem com "not admin"', () => {
    assert.equal(isChannelForbiddenError(new Error('Sender is not admin of newsletter')), true)
  })
  await t.test('falso para erro transitório de rede', () => {
    assert.equal(isChannelForbiddenError(new Error('ETIMEDOUT')), false)
    assert.equal(isChannelForbiddenError(new Error('Connection closed')), false)
  })
  await t.test('falso para statusCode 5xx (transitório)', () => {
    const err = new Error('server error')
    err.output = { statusCode: 500 }
    assert.equal(isChannelForbiddenError(err), false)
  })
  await t.test('falso para err null/undefined', () => {
    assert.equal(isChannelForbiddenError(null), false)
    assert.equal(isChannelForbiddenError(undefined), false)
  })
  await t.test('falso para err sem message nem statusCode', () => {
    assert.equal(isChannelForbiddenError({}), false)
  })
})
