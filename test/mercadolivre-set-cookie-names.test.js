import test from 'node:test'
import assert from 'node:assert/strict'
import { describeSetCookieNames } from '../src/converters/mercadolivre.js'

// Investigação "código do ML vence em ~75–95 min": o bot.log das recusas passa a
// dizer QUAIS cookies o ML devolveu no 401 (só nomes), nunca o valor.
test('describeSetCookieNames: só nomes, marca deleção, nunca vaza valor', () => {
  const headers = {
    'set-cookie': [
      'ssid=; Max-Age=0; Path=/; Domain=.mercadolivre.com.br',
      '_d2id=abcdef-123456; Path=/; Max-Age=31536000',
      'orguseridp=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/',
      'lixo',
    ],
  }
  const out = describeSetCookieNames(headers)
  assert.deepEqual(out, ['ssid(del)', '_d2id', 'orguseridp(del)'])
  assert.ok(!JSON.stringify(out).includes('abcdef'), 'valor não pode aparecer')
})

test('describeSetCookieNames: sem Set-Cookie devolve lista vazia', () => {
  assert.deepEqual(describeSetCookieNames({}), [])
  assert.deepEqual(describeSetCookieNames({ 'set-cookie': 'ssid=novo; Path=/' }), ['ssid'])
})
