import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldRelayOriginalMediaForImageMode } from '../src/monitoredRelayPolicy.js'

test('relay da mídia original só é permitido no modo imagem da mensagem', () => {
  assert.equal(shouldRelayOriginalMediaForImageMode(undefined), true, 'default legado usa imagem da mensagem')
  assert.equal(shouldRelayOriginalMediaForImageMode('original'), true)
  assert.equal(shouldRelayOriginalMediaForImageMode('fetch'), false, 'imagem oficial da loja deve forçar fetch/upload, não relay da origem')
  assert.equal(shouldRelayOriginalMediaForImageMode('none'), false)
})

test('relay de imagem é bloqueado quando canvas contain é necessário', () => {
  assert.equal(
    shouldRelayOriginalMediaForImageMode('original', { mediaType: 'imageMessage', imageFit: 'contain' }),
    false,
    'imagem precisa passar por normalizeImageForWhatsApp para ganhar padding/canvas',
  )
})

test('relay continua permitido para vídeo mesmo com política contain de imagens', () => {
  assert.equal(
    shouldRelayOriginalMediaForImageMode('original', { mediaType: 'videoMessage', imageFit: 'contain' }),
    true,
    'contain é uma política de imagem; vídeo não deve ser reprocessado',
  )
})
