import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeCredentialBody } from '../src/credentialHealth.js'

test('ML: ssid novo descarta cookie/csrf/id rotacionados (não sombreia o ssid)', () => {
  const body = {
    tag: '475630078',
    ssid: 'ssid-novo-colado-pela-usuaria',
    cookie: 'ssid=ssid-antigo-expirado; _csrf=velho; _mldataSessionId=x',
    csrf: 'csrf-velho',
    id: 'id-velho',
  }
  const out = sanitizeCredentialBody('mercadolivre', body)
  assert.deepEqual(out, { tag: '475630078', ssid: 'ssid-novo-colado-pela-usuaria' })
  assert.equal('cookie' in out, false)
  assert.equal('csrf' in out, false)
  assert.equal('id' in out, false)
})

test('ML: sem ssid (ex.: só tag) mantém o corpo intacto', () => {
  const body = { tag: '475630078', cookie: 'ssid=algo' }
  const out = sanitizeCredentialBody('mercadolivre', body)
  assert.deepEqual(out, body)
})

test('ML: ssid em branco não dispara o sanitize (mantém corpo)', () => {
  const body = { tag: '475630078', ssid: '   ', cookie: 'ssid=algo' }
  const out = sanitizeCredentialBody('mercadolivre', body)
  assert.deepEqual(out, body)
})

test('Outras plataformas não são afetadas (Amazon mantém cookies)', () => {
  const body = { tag: 'amzn', 'ubid-acbbr': 'u', 'at-acbbr': 'a', 'x-acbbr': 'x' }
  const out = sanitizeCredentialBody('amazon', body)
  assert.deepEqual(out, body)
})
