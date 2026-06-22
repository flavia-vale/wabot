import test from 'node:test'
import assert from 'node:assert/strict'
import { FORWARD_MODE, NO_LINK_SCOPE, normalizeForwardingPolicy, shouldForwardMessage, detectMessageKind, extractIncomingText } from '../src/forwardingPolicy.js'

test('normalizeForwardingPolicy mantém default conservador LINK_ONLY', () => {
  const policy = normalizeForwardingPolicy({})
  assert.equal(policy.forwardMode, FORWARD_MODE.LINK_ONLY)
  assert.equal(policy.noLinkScope, NO_LINK_SCOPE.TEXT_ONLY)
})

test('shouldForwardMessage encaminha qualquer mensagem com link', () => {
  const policy = normalizeForwardingPolicy({})
  assert.equal(shouldForwardMessage({ hasLinks: true, messageKind: 'other', policy }), true)
})

test('LINK_ONLY bloqueia mensagem sem link', () => {
  const policy = normalizeForwardingPolicy({ forwardMode: FORWARD_MODE.LINK_ONLY })
  assert.equal(shouldForwardMessage({ hasLinks: false, messageKind: 'text', policy }), false)
})

test('ALLOW_NO_LINK + TEXT_ONLY encaminha somente texto', () => {
  const policy = normalizeForwardingPolicy({ forwardMode: FORWARD_MODE.ALLOW_NO_LINK, noLinkScope: NO_LINK_SCOPE.TEXT_ONLY })
  assert.equal(shouldForwardMessage({ hasLinks: false, messageKind: 'text', policy }), true)
  assert.equal(shouldForwardMessage({ hasLinks: false, messageKind: 'image_with_caption', policy }), false)
})

test('ALLOW_NO_LINK + TEXT_IMAGE_WITH_CAPTION encaminha texto e imagem com legenda', () => {
  const policy = normalizeForwardingPolicy({ forwardMode: FORWARD_MODE.ALLOW_NO_LINK, noLinkScope: NO_LINK_SCOPE.TEXT_IMAGE_WITH_CAPTION })
  assert.equal(shouldForwardMessage({ hasLinks: false, messageKind: 'text', policy }), true)
  assert.equal(shouldForwardMessage({ hasLinks: false, messageKind: 'image_with_caption', policy }), true)
  assert.equal(shouldForwardMessage({ hasLinks: false, messageKind: 'video_with_caption', policy }), false)
  assert.equal(shouldForwardMessage({ hasLinks: false, messageKind: 'audio', policy }), false)
})

test('ALLOW_NO_LINK + ALL encaminha formatos sem texto', () => {
  const policy = normalizeForwardingPolicy({ forwardMode: FORWARD_MODE.ALLOW_NO_LINK, noLinkScope: NO_LINK_SCOPE.ALL })
  assert.equal(shouldForwardMessage({ hasLinks: false, messageKind: 'audio', policy }), true)
  assert.equal(shouldForwardMessage({ hasLinks: false, messageKind: 'document', policy }), true)
  assert.equal(shouldForwardMessage({ hasLinks: false, messageKind: 'sticker', policy }), true)
})

test('detectMessageKind identifica texto em wrappers aninhados de mensagem', () => {
  const kind = detectMessageKind({
    editedMessage: {
      message: {
        extendedTextMessage: { text: 'texto de admin' },
      },
    },
  }, '')
  assert.equal(kind, 'text')
})

test('detectMessageKind identifica texto em documentWithCaptionMessage', () => {
  const kind = detectMessageKind({
    documentWithCaptionMessage: {
      message: {
        documentMessage: { caption: 'legenda de documento' },
      },
    },
  }, '')
  assert.equal(kind, 'text')
})

test('extractIncomingText lê legenda de imagem', () => {
  assert.equal(extractIncomingText({ imageMessage: { caption: 'Oferta https://s.shopee.com.br/abc' } }), 'Oferta https://s.shopee.com.br/abc')
})

test('extractIncomingText lê conversation e extendedTextMessage', () => {
  assert.equal(extractIncomingText({ conversation: 'oi' }), 'oi')
  assert.equal(extractIncomingText({ extendedTextMessage: { text: 'link aqui' } }), 'link aqui')
})

test('extractIncomingText lê legenda de vídeo e documento', () => {
  assert.equal(extractIncomingText({ videoMessage: { caption: 'video cap' } }), 'video cap')
  assert.equal(extractIncomingText({ documentMessage: { caption: 'doc cap' } }), 'doc cap')
})

test('extractIncomingText null/sem texto retorna string vazia', () => {
  assert.equal(extractIncomingText(null), '')
  assert.equal(extractIncomingText(undefined), '')
  assert.equal(extractIncomingText({ imageMessage: {} }), '')
  assert.equal(extractIncomingText({}), '')
})

// Regressão do bug: imagem com legenda+link era ignorada como `nolink` porque o
// caption não era lido do conteúdo desembrulhado. extractIncomingText sobre o
// conteúdo unwrapped recupera a legenda, e a kind vira image_with_caption.
test('regressão: imagem-com-legenda desembrulhada vira image_with_caption (não nolink)', () => {
  // Simula o que extractMessageContent retorna após desembrulhar um
  // ephemeralMessage: o imageMessage interno com a legenda.
  const unwrapped = { imageMessage: { caption: 'BAIXOU https://s.shopee.com.br/7KugQyFsmQ' } }
  const text = extractIncomingText(unwrapped)
  assert.ok(text.includes('s.shopee.com.br'), 'legenda com link deve ser extraída')
  assert.equal(detectMessageKind(unwrapped, text), 'image_with_caption')
})

// Regressão (2026-06): mensagens de "plumbing" (protocolo, senderKey
// distribution, mensagens vazias) chegam sem texto, sem mídia reconhecida e sem
// link → kind 'other'. O bot-worker usa exatamente (kind === 'other' && sem
// link) para IGNORAR EM SILÊNCIO em vez de criar linha "ignorado/nolink" no
// painel. Sem isso, um reconnect (rajada de senderKeyDistribution) poluía o log
// com dezenas de "ignorado" mesmo o grupo não tendo recebido mensagem real.
test('detectMessageKind: mensagens de plumbing (sem conteúdo) são kind other', () => {
  assert.equal(detectMessageKind({ senderKeyDistributionMessage: { groupId: '120@g.us' } }, ''), 'other')
  assert.equal(detectMessageKind({ protocolMessage: { type: 0 } }, ''), 'other')
  assert.equal(detectMessageKind({}, ''), 'other')
  assert.equal(detectMessageKind(null, ''), 'other')
})

test('detectMessageKind: conteúdo real NÃO é other (não deve ser silenciado)', () => {
  assert.equal(detectMessageKind({ imageMessage: {} }, ''), 'image')
  assert.equal(detectMessageKind({ extendedTextMessage: { text: 'oi' } }, 'oi'), 'text')
})
