import test from 'node:test'
import assert from 'node:assert/strict'
import { FORWARD_MODE, NO_LINK_SCOPE, normalizeForwardingPolicy, shouldForwardMessage } from '../src/forwardingPolicy.js'

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
