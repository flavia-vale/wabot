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

test('Amazon: sem cookie completo e sem os 3 nomeados fica incompleto', () => {
  const v = validateCredentialData('amazon', { tag: 'x-20' })
  assert.equal(v.configured, false)
  assert.ok(v.missing.includes('ubid-acbbr'))
  assert.ok(v.missing.includes('at-acbbr'))
  assert.ok(v.missing.includes('x-acbbr'))
})

test('Amazon: cookie completo curto (<20) não conta como portador de auth', () => {
  const v = validateCredentialData('amazon', { tag: 'x-20', cookie: 'a=b' })
  assert.equal(v.configured, false)
  assert.ok(v.missing.includes('at-acbbr'))
})
