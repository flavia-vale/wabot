import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldUseRelayPath,
  stripChannelUnsafeFields,
  isChannelDestination,
  isChannelForbiddenError,
  buildRelayProto,
  injectChannelForwardIntoPayload,
  normalizeChannelForwardJid,
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

test('buildRelayProto', async (t) => {
  await t.test('null/undefined passa adiante', () => {
    assert.equal(buildRelayProto(null), null)
    assert.equal(buildRelayProto(undefined), undefined)
  })

  await t.test('troca o caption e não muta o proto original', () => {
    const proto = { url: 'https://x', mediaKey: Buffer.from('k'), caption: 'antigo' }
    const result = buildRelayProto(proto, { caption: 'novo' })
    assert.equal(result.caption, 'novo')
    assert.equal(result.url, 'https://x')
    assert.ok(Buffer.isBuffer(result.mediaKey))
    assert.equal(proto.caption, 'antigo', 'input não deve ser mutado')
    assert.notEqual(result, proto)
  })

  await t.test('caption ausente preserva o caption original', () => {
    const proto = { caption: 'mantém' }
    const result = buildRelayProto(proto, {})
    assert.equal(result.caption, 'mantém')
  })

  await t.test('remove o botão "Ver canal" de terceiros (forwardedNewsletterMessageInfo)', () => {
    const proto = {
      url: 'https://x',
      contextInfo: {
        forwardedNewsletterMessageInfo: { newsletterJid: 'origem@newsletter', serverMessageId: 99 },
      },
    }
    const result = buildRelayProto(proto, { caption: 'oferta' })
    assert.equal(result.contextInfo, undefined, 'contextInfo só tinha newsletter → some inteiro')
  })

  await t.test('preserva o marcador genérico isForwarded ao remover só o botão de canal', () => {
    const proto = {
      contextInfo: {
        forwardedNewsletterMessageInfo: { newsletterJid: 'origem@newsletter' },
        isForwarded: true,
      },
    }
    const result = buildRelayProto(proto, {})
    assert.deepEqual(result.contextInfo, { isForwarded: true })
  })

  await t.test('remove externalAdReply herdado (drop silencioso no WhatsApp)', () => {
    const proto = { contextInfo: { externalAdReply: { title: 'spam' } } }
    const result = buildRelayProto(proto, {})
    assert.equal(result.contextInfo, undefined)
  })

  await t.test('preserva outros campos de contextInfo ao limpar o newsletter', () => {
    const proto = {
      contextInfo: {
        forwardedNewsletterMessageInfo: { newsletterJid: 'origem@newsletter' },
        mentionedJid: ['abc@s.whatsapp.net'],
      },
    }
    const result = buildRelayProto(proto, {})
    assert.deepEqual(result.contextInfo, { mentionedJid: ['abc@s.whatsapp.net'] })
  })

  await t.test('injeta o canal do próprio usuário substituindo o de terceiros', () => {
    const proto = {
      contextInfo: {
        forwardedNewsletterMessageInfo: { newsletterJid: 'origem@newsletter', serverMessageId: 5 },
      },
    }
    const result = buildRelayProto(proto, {
      caption: 'oferta',
      forwardNewsletter: { newsletterJid: 'meu@newsletter', newsletterName: 'Meu Canal', serverMessageId: 42 },
    })
    assert.deepEqual(result.contextInfo.forwardedNewsletterMessageInfo, {
      newsletterJid: 'meu@newsletter',
      newsletterName: 'Meu Canal',
      serverMessageId: 42,
    })
    assert.equal(result.contextInfo.isForwarded, true)
  })

  await t.test('injeção sem serverMessageId omite o campo', () => {
    const result = buildRelayProto({}, {
      forwardNewsletter: { newsletterJid: 'meu@newsletter', newsletterName: 'Meu Canal' },
    })
    assert.equal(result.contextInfo.forwardedNewsletterMessageInfo.serverMessageId, undefined)
    assert.equal(result.contextInfo.forwardedNewsletterMessageInfo.newsletterJid, 'meu@newsletter')
  })

  await t.test('forwardNewsletter sem newsletterJid não injeta (apenas limpa)', () => {
    const proto = { contextInfo: { forwardedNewsletterMessageInfo: { newsletterJid: 'origem@newsletter' } } }
    const result = buildRelayProto(proto, { forwardNewsletter: { newsletterName: 'sem jid' } })
    assert.equal(result.contextInfo, undefined)
  })

  await t.test('não muta o contextInfo do input', () => {
    const proto = { contextInfo: { forwardedNewsletterMessageInfo: { newsletterJid: 'origem@newsletter' } } }
    buildRelayProto(proto, {})
    assert.deepEqual(proto.contextInfo, { forwardedNewsletterMessageInfo: { newsletterJid: 'origem@newsletter' } }, 'input intacto')
  })
})

test('injectChannelForwardIntoPayload', async (t) => {
  const channel = { newsletterJid: '120363000000000000@newsletter', newsletterName: 'Meu Canal' }

  await t.test('null/sem canal → no-op (payload intacto)', () => {
    const payload = { primary: { text: 'oi' }, fallbacks: [] }
    assert.equal(injectChannelForwardIntoPayload(payload, null), payload)
    assert.equal(injectChannelForwardIntoPayload(payload, {}), payload)
    assert.equal(injectChannelForwardIntoPayload(payload, { newsletterName: 'sem jid' }), payload)
    assert.equal(injectChannelForwardIntoPayload(null, channel), null)
  })

  await t.test('injeta o botão em corpo cru de texto', () => {
    const result = injectChannelForwardIntoPayload({ text: 'oferta' }, channel)
    assert.equal(result.text, 'oferta')
    assert.deepEqual(result.contextInfo.forwardedNewsletterMessageInfo, {
      newsletterJid: '120363000000000000@newsletter',
      newsletterName: 'Meu Canal',
    })
    assert.equal(result.contextInfo.isForwarded, true)
  })

  await t.test('injeta no primary e em cada fallback (formato buildMonitoredMessagePayload)', () => {
    const payload = {
      _route: 'image',
      primary: { image: Buffer.from('x'), caption: 'c' },
      fallbacks: [{ text: 'fb' }],
    }
    const result = injectChannelForwardIntoPayload(payload, channel)
    assert.equal(result.primary.contextInfo.forwardedNewsletterMessageInfo.newsletterJid, channel.newsletterJid)
    assert.equal(result.fallbacks[0].contextInfo.forwardedNewsletterMessageInfo.newsletterJid, channel.newsletterJid)
    // primary mantém a mídia original
    assert.equal(result.primary.image, payload.primary.image)
  })

  await t.test('preserva contextInfo já existente e não muta o input', () => {
    const payload = { text: 'oi', contextInfo: { mentionedJid: ['a@x'] } }
    const result = injectChannelForwardIntoPayload(payload, channel)
    assert.deepEqual(result.contextInfo.mentionedJid, ['a@x'])
    assert.equal(payload.contextInfo.forwardedNewsletterMessageInfo, undefined, 'input intacto')
  })

  await t.test('serverMessageId é incluído quando presente', () => {
    const result = injectChannelForwardIntoPayload({ text: 'oi' }, { ...channel, serverMessageId: 42 })
    assert.equal(result.contextInfo.forwardedNewsletterMessageInfo.serverMessageId, 42)
  })
})

test('normalizeChannelForwardJid', async (t) => {
  await t.test('vazio/whitespace → string vazia (limpa o campo)', () => {
    assert.equal(normalizeChannelForwardJid(''), '')
    assert.equal(normalizeChannelForwardJid('   '), '')
    assert.equal(normalizeChannelForwardJid(null), '')
    assert.equal(normalizeChannelForwardJid(undefined), '')
  })
  await t.test('JID de newsletter válido passa', () => {
    assert.equal(normalizeChannelForwardJid('120363425953507343@newsletter'), '120363425953507343@newsletter')
    assert.equal(normalizeChannelForwardJid('  120363425953507343@newsletter  '), '120363425953507343@newsletter')
  })
  await t.test('formato inválido → null (rota deve 400)', () => {
    assert.equal(normalizeChannelForwardJid('abc@newsletter'), null)
    assert.equal(normalizeChannelForwardJid('120363425953507343@g.us'), null)
    assert.equal(normalizeChannelForwardJid('120363425953507343'), null)
    assert.equal(normalizeChannelForwardJid('https://wa.me/canal'), null)
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
