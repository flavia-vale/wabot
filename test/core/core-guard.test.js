import test from 'node:test'
import assert from 'node:assert/strict'

import { safeCoreEvent, withCoreErrorBoundary } from '../../src/core/errors.js'
import { extractLinks } from '../../src/core/linkCore.js'
import { getLastQR, isRunning } from '../../src/core/sessionCore.js'

test('safeCoreEvent captura erro e retorna null', () => {
  const result = safeCoreEvent('unit', () => { throw new Error('boom') }, { error: () => {} })
  assert.equal(result, null)
})

test('withCoreErrorBoundary propaga erro', async () => {
  const wrapped = withCoreErrorBoundary('unit', async () => { throw new Error('falha') }, { error: () => {} })
  await assert.rejects(() => wrapped(), /falha/)
})

test('extractLinks detecta links no texto', () => {
  const links = extractLinks('veja https://amzn.to/oferta')
  assert.ok(Array.isArray(links))
  assert.ok(links.length >= 1)
})

test('session core mantém estado inicial vazio', () => {
  assert.equal(isRunning('user-x'), false)
  assert.equal(getLastQR('user-x'), null)
})
