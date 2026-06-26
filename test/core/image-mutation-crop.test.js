import test from 'node:test'
import assert from 'node:assert/strict'

// Testes PUROS de computeMutationCrop — sem sharp, rodam em qualquer ambiente.
// A aplicação real (extract + encode) vive em normalizeImageForWhatsApp e é
// validada em staging (sharp). Aqui garantimos a GEOMETRIA/qualidade do crop.
import { computeMutationCrop, IMAGE_MIN_DIMENSION_PX, hashIndex } from '../../src/core/imageMutationCrop.js'

test('computeMutationCrop: recorta 1-2px de uma borda e devolve qualidade 85-92', () => {
  // Dimensões bem acima do mínimo (800) para o crop sempre caber em qualquer borda.
  const crop = computeMutationCrop({ width: 1500, height: 1200 }, { groupId: 'g-1', date: '2026-05-18' })
  assert.ok(crop, 'deve retornar crop para imagem hi-res')
  // No máximo 2px removidos por eixo.
  assert.ok(crop.width <= 1500 && crop.width >= 1498, `width=${crop.width}`)
  assert.ok(crop.height <= 1200 && crop.height >= 1198, `height=${crop.height}`)
  assert.ok(crop.left >= 0 && crop.top >= 0)
  assert.ok(crop.quality >= 85 && crop.quality <= 92, `quality=${crop.quality}`)
})

test('computeMutationCrop: determinístico por (groupId, date)', () => {
  const a = computeMutationCrop({ width: 1500, height: 1200 }, { groupId: 'g-1', date: '2026-05-18' })
  const b = computeMutationCrop({ width: 1500, height: 1200 }, { groupId: 'g-1', date: '2026-05-18' })
  assert.deepEqual(a, b)
})

test('computeMutationCrop: varia entre groupIds (anti-fingerprint)', () => {
  const crops = new Set()
  for (const g of ['g-1', 'g-2', 'g-3', 'g-4', 'g-5', 'g-6']) {
    const c = computeMutationCrop({ width: 1500, height: 1200 }, { groupId: g, date: '2026-05-18' })
    crops.add(`${c.left}:${c.top}:${c.width}:${c.height}:${c.quality}`)
  }
  assert.ok(crops.size >= 2, 'crops devem variar entre groupIds')
})

test('computeMutationCrop: retorna null quando o crop violaria o mínimo de 800px', () => {
  const crop = computeMutationCrop(
    { width: IMAGE_MIN_DIMENSION_PX, height: IMAGE_MIN_DIMENSION_PX },
    { groupId: 'g-1', date: '2026-05-18' },
  )
  assert.equal(crop, null, 'não mutar é melhor que degradar abaixo do mínimo')
})

test('computeMutationCrop: meta inválida retorna null (defensivo)', () => {
  assert.equal(computeMutationCrop(null, {}), null)
  assert.equal(computeMutationCrop({ width: 0, height: 800 }, {}), null)
  assert.equal(computeMutationCrop({ width: 800 }, {}), null)
})

test('computeMutationCrop: nunca remove mais que 2px por eixo (limite do crop)', () => {
  for (const g of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    const c = computeMutationCrop({ width: 1500, height: 1200 }, { groupId: g, date: '2026-06-26' })
    assert.ok(1500 - c.width <= 2, `largura removida=${1500 - c.width}`)
    assert.ok(1200 - c.height <= 2, `altura removida=${1200 - c.height}`)
  }
})

test('hashIndex distribui entre 0 e mod-1', () => {
  for (let i = 0; i < 20; i++) {
    const h = hashIndex(`g-${i}`, '2026-05-18', 8)
    assert.ok(h >= 0 && h < 8)
  }
})
