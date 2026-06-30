import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldRelayOriginalMediaForImageMode } from '../src/monitoredRelayPolicy.js'

test('relay da mídia original só é permitido no modo imagem da mensagem', () => {
  assert.equal(shouldRelayOriginalMediaForImageMode(undefined), true, 'default legado usa imagem da mensagem')
  assert.equal(shouldRelayOriginalMediaForImageMode('original'), true)
  assert.equal(shouldRelayOriginalMediaForImageMode('fetch'), false, 'imagem oficial da loja deve forçar fetch/upload, não relay da origem')
  assert.equal(shouldRelayOriginalMediaForImageMode('none'), false)
  assert.equal(shouldRelayOriginalMediaForImageMode('preview'), false)
})
