import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateCredentialData } from '../src/credentialHealth.js'

test('Amazon: os 3 cookies nomeados + tag continuam configurando (compat legada)', () => {
  const v = validateCredentialData('amazon', { tag: 'x-20', 'ubid-acbbr': 'u', 'at-acbbr': 'a', 'x-acbbr': 'x' })
  assert.equal(v.configured, true)
  assert.deepEqual(v.missing, [])
})

test('Amazon: cookie completo + tag configura sem exigir os 3 cookies nomeados', () => {
  const v = validateCredentialData('amazon', {
    tag: 'x-20',
    cookie: 'session-id=1; session-token=abcdef; at-acbbr=Atza|longvalue-here',
  })
  assert.equal(v.configured, true)
  assert.deepEqual(v.missing, [])
})

test('Amazon: cookie completo em JSON (export de extensão) também configura', () => {
  const cookie = JSON.stringify([
    { name: 'session-id', value: '147-000' },
    { name: 'at-acbbr', value: 'Atza|xyz' },
    { name: 'session-token', value: 'tok' },
  ])
  const v = validateCredentialData('amazon', { tag: 'x-20', cookie })
  assert.equal(v.configured, true)
  assert.deepEqual(v.missing, [])
})

test('Amazon: só a etiqueta já configura (sai com link longo ?tag=)', () => {
  const v = validateCredentialData('amazon', { tag: 'x-20' })
  assert.equal(v.configured, true)
  assert.deepEqual(v.missing, [])
})

test('Amazon: sem etiqueta continua incompleto, mesmo com código de acesso', () => {
  const v = validateCredentialData('amazon', { cookie: 'session-id=1; session-token=abcdef; at-acbbr=Atza|x' })
  assert.equal(v.configured, false)
  assert.deepEqual(v.missing, ['tag'])
})

test('Amazon só com etiqueta: save diz que salvou e que o link sai comprido, não que a loja falhou', async () => {
  const { describeSaveSessionCheck } = await import('../src/credentialSaveCheck.js')
  const validation = validateCredentialData('amazon', { tag: 'x-20' })
  const r = describeSaveSessionCheck({
    platform: 'amazon',
    validation,
    probe: { configured: false, alive: null, reason: 'no_cookie' },
    fallbackMessage: 'fallback',
  })
  assert.equal(r.tone, 'success')
  assert.match(r.message, /link mais comprido/)
  assert.doesNotMatch(r.message, /não respondeu|venceu/)
})
