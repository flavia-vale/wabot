import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'

import { mutate, IMAGE_MIN_DIMENSION_PX, hashIndex } from '../../src/core/imageMutation.js'

async function makeJpeg(w, h) {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 100, b: 50 } } })
    .jpeg({ quality: 90 })
    .toBuffer()
}

test('mutate desabilitado retorna buffer original', async () => {
  const buf = await makeJpeg(1000, 800)
  const out = await mutate(buf, 'image/jpeg', { groupId: 'g-1', enabled: false })
  assert.equal(out.buffer, buf)
  assert.equal(out.mimetype, 'image/jpeg')
})

test('mutate em JPEG hi-res reduz dimensão (crop 0–2px) e mantém mimetype', async () => {
  const buf = await makeJpeg(1000, 800)
  const out = await mutate(buf, 'image/jpeg', { groupId: 'g-1', enabled: true, date: '2026-05-18' })
  assert.equal(out.mimetype, 'image/jpeg')
  const meta = await sharp(out.buffer).metadata()
  assert.ok(meta.width <= 1000 && meta.width >= 998, `width=${meta.width}`)
  assert.ok(meta.height <= 800 && meta.height >= 798, `height=${meta.height}`)
})

test('mutate é determinístico por (groupId, date)', async () => {
  const buf = await makeJpeg(1000, 800)
  const a = await mutate(buf, 'image/jpeg', { groupId: 'g-1', enabled: true, date: '2026-05-18' })
  const b = await mutate(buf, 'image/jpeg', { groupId: 'g-1', enabled: true, date: '2026-05-18' })
  // bytes idênticos
  assert.ok(a.buffer.equals(b.buffer))
})

test('mutate varia entre groupIds para evitar fingerprint', async () => {
  const buf = await makeJpeg(1000, 800)
  const a = await mutate(buf, 'image/jpeg', { groupId: 'g-1', enabled: true, date: '2026-05-18' })
  const b = await mutate(buf, 'image/jpeg', { groupId: 'g-2', enabled: true, date: '2026-05-18' })
  assert.ok(!a.buffer.equals(b.buffer))
})

test('mutate pula imagem que ficaria abaixo do mínimo (800px)', async () => {
  const buf = await makeJpeg(IMAGE_MIN_DIMENSION_PX, IMAGE_MIN_DIMENSION_PX)
  const out = await mutate(buf, 'image/jpeg', { groupId: 'g-1', enabled: true, date: '2026-05-18' })
  // crop levaria abaixo de 800 → mantém original
  assert.equal(out.buffer, buf)
})

test('mutate ignora mimetypes não suportados (passthrough)', async () => {
  const buf = Buffer.from([0, 1, 2, 3])
  const out = await mutate(buf, 'application/octet-stream', { groupId: 'g-1', enabled: true })
  assert.equal(out.buffer, buf)
  assert.equal(out.mimetype, 'application/octet-stream')
})

test('mutate tolera falha do sharp retornando original', async () => {
  const buf = Buffer.from('not a real image', 'utf8')
  const out = await mutate(buf, 'image/jpeg', { groupId: 'g-1', enabled: true })
  assert.equal(out.buffer, buf)
})

test('hashIndex distribui entre 0 e mod-1', () => {
  for (let i = 0; i < 20; i++) {
    const h = hashIndex(`g-${i}`, '2026-05-18', 8)
    assert.ok(h >= 0 && h < 8)
  }
})
