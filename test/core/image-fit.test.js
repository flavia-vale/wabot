import test from 'node:test'
import assert from 'node:assert/strict'

import {
  WHATSAPP_SAFE_IMAGE_BACKGROUND,
  WHATSAPP_SAFE_IMAGE_SIZE,
  WHATSAPP_SAFE_THUMBNAIL_SIZE,
  buildContainedImageResizeOptions,
  shouldContainImageForWhatsApp,
} from '../../src/core/imageFit.js'

test('shouldContainImageForWhatsApp habilita somente a política contain explícita', () => {
  assert.equal(shouldContainImageForWhatsApp(), false)
  assert.equal(shouldContainImageForWhatsApp(null), false)
  assert.equal(shouldContainImageForWhatsApp('original'), false)
  assert.equal(shouldContainImageForWhatsApp('contain'), true)
})

test('buildContainedImageResizeOptions usa canvas quadrado seguro para WhatsApp', () => {
  assert.deepEqual(buildContainedImageResizeOptions(), {
    width: WHATSAPP_SAFE_IMAGE_SIZE,
    height: WHATSAPP_SAFE_IMAGE_SIZE,
    fit: 'contain',
    withoutEnlargement: true,
    background: WHATSAPP_SAFE_IMAGE_BACKGROUND,
  })
})

test('buildContainedImageResizeOptions permite canvas menor para thumbnail', () => {
  assert.deepEqual(buildContainedImageResizeOptions(WHATSAPP_SAFE_THUMBNAIL_SIZE), {
    width: WHATSAPP_SAFE_THUMBNAIL_SIZE,
    height: WHATSAPP_SAFE_THUMBNAIL_SIZE,
    fit: 'contain',
    withoutEnlargement: true,
    background: WHATSAPP_SAFE_IMAGE_BACKGROUND,
  })
})
