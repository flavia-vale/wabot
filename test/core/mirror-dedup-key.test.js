import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMirrorDedupKeys } from '../../src/core/mirrorDedupKey.js'

const DEST = '123@g.us'

test('gera chaves para url + converted + fallback, prefixadas pelo destino', () => {
  const { dedupSubjects, dedupKeys } = buildMirrorDedupKeys({
    destJid: DEST,
    primaryUrl: 'https://amzn.la/abc',
    primaryConverted: 'https://amzn.to/XYZ',
    fallbackSubject: 'msgid:texto',
  })
  assert.deepEqual(dedupSubjects, ['https://amzn.la/abc', 'https://amzn.to/XYZ', 'msgid:texto'])
  assert.deepEqual(dedupKeys, [
    `${DEST}:https://amzn.la/abc`,
    `${DEST}:https://amzn.to/XYZ`,
    `${DEST}:msgid:texto`,
  ])
})

test('dedupa subjects idênticos (url == converted não vira duas chaves)', () => {
  const { dedupKeys } = buildMirrorDedupKeys({
    destJid: DEST,
    primaryUrl: 'https://x/1',
    primaryConverted: 'https://x/1',
    fallbackSubject: 'fb',
  })
  assert.deepEqual(dedupKeys, [`${DEST}:https://x/1`, `${DEST}:fb`])
})

test('ignora vazios/nulos (mensagem sem link usa só o fallback)', () => {
  const { dedupKeys } = buildMirrorDedupKeys({
    destJid: DEST,
    primaryUrl: '',
    primaryConverted: null,
    fallbackSubject: 'nolink:texto',
  })
  assert.deepEqual(dedupKeys, [`${DEST}:nolink:texto`])
})

test('sempre retorna dedupKeys como array (nunca undefined) — regressão do ReferenceError', () => {
  const { dedupKeys } = buildMirrorDedupKeys({ destJid: DEST })
  assert.ok(Array.isArray(dedupKeys))
  assert.equal(dedupKeys.length, 0)
})

test('chamada sem argumentos não quebra', () => {
  const out = buildMirrorDedupKeys()
  assert.ok(Array.isArray(out.dedupKeys))
  assert.ok(Array.isArray(out.dedupSubjects))
})
