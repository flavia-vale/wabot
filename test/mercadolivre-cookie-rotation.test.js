import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseCookieHeader,
  getSetCookieLines,
  parseSetCookieLine,
  mergeSetCookieIntoJar,
  serializeCookieJar,
  buildCredentialPatchFromSetCookie
} from '../src/converters/mercadolivreCookieRotation.js'

test('getSetCookieLines: lê headers[set-cookie] (lowercase)', () => {
  const lines = getSetCookieLines({ 'set-cookie': ['ssid=novo; Path=/'] })
  assert.deepEqual(lines, ['ssid=novo; Path=/'])
})

test('getSetCookieLines: lê headers[Set-Cookie] (capitalizado)', () => {
  const lines = getSetCookieLines({ 'Set-Cookie': ['ssid=novo; Path=/'] })
  assert.deepEqual(lines, ['ssid=novo; Path=/'])
})

test('getSetCookieLines: sem header => []', () => {
  assert.deepEqual(getSetCookieLines({}), [])
  assert.deepEqual(getSetCookieLines(), [])
})

test('getSetCookieLines: valor único não-array vira array de 1', () => {
  assert.deepEqual(getSetCookieLines({ 'set-cookie': 'ssid=abc' }), ['ssid=abc'])
})

test('parseSetCookieLine: linha simples de rotação', () => {
  const parsed = parseSetCookieLine('ssid=novo-valor; Path=/; HttpOnly')
  assert.deepEqual(parsed, { name: 'ssid', value: 'novo-valor', isDeletion: false })
})

test('parseSetCookieLine: deleção via valor vazio', () => {
  const parsed = parseSetCookieLine('ssid=; Path=/')
  assert.equal(parsed.isDeletion, true)
})

test('parseSetCookieLine: deleção via Max-Age=0', () => {
  const parsed = parseSetCookieLine('ssid=lixo; Max-Age=0; Path=/')
  assert.equal(parsed.isDeletion, true)
})

test('parseSetCookieLine: deleção via Expires no passado', () => {
  const parsed = parseSetCookieLine('ssid=lixo; Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  assert.equal(parsed.isDeletion, true)
})

test('parseSetCookieLine: linha vazia/malformada => null', () => {
  assert.equal(parseSetCookieLine(''), null)
  assert.equal(parseSetCookieLine('semvalor'), null)
})

test('mergeSetCookieIntoJar: mescla rotação real', () => {
  const jar = mergeSetCookieIntoJar('ssid=antigo; _csrf=abc', ['ssid=novo-valor; Path=/'])
  assert.equal(jar.get('ssid'), 'novo-valor')
  assert.equal(jar.get('_csrf'), 'abc')
})

test('mergeSetCookieIntoJar: ignora deleção (ssid=;)', () => {
  const jar = mergeSetCookieIntoJar('ssid=antigo; _csrf=abc', ['ssid=; Path=/'])
  assert.equal(jar.get('ssid'), 'antigo')
})

test('mergeSetCookieIntoJar: ignora deleção via Max-Age=0', () => {
  const jar = mergeSetCookieIntoJar('ssid=antigo', ['ssid=lixo; Max-Age=0'])
  assert.equal(jar.get('ssid'), 'antigo')
})

test('mergeSetCookieIntoJar: ignora deleção via Expires no passado', () => {
  const jar = mergeSetCookieIntoJar('ssid=antigo', ['ssid=lixo; Expires=Thu, 01 Jan 1970 00:00:00 GMT'])
  assert.equal(jar.get('ssid'), 'antigo')
})

test('serializeCookieJar: nunca emite par com valor vazio', () => {
  const jar = new Map([['ssid', 'valor'], ['_csrf', '']])
  const serialized = serializeCookieJar(jar)
  assert.equal(serialized, 'ssid=valor')
  assert.ok(!serialized.includes('_csrf='))
})

test('buildCredentialPatchFromSetCookie: retorna patch com ssid novo quando rotaciona', () => {
  const creds = { ssid: 'antigo', csrf: 'csrf-antigo' }
  const patch = buildCredentialPatchFromSetCookie(creds, 'ssid=antigo; _csrf=csrf-antigo', {
    'set-cookie': ['ssid=novo-ssid; Path=/']
  })
  assert.ok(patch)
  assert.equal(patch.ssid, 'novo-ssid')
  assert.ok(patch.cookie.includes('ssid=novo-ssid'))
})

test('buildCredentialPatchFromSetCookie: retorna null quando nenhum nome mudou (FR-006)', () => {
  const creds = { ssid: 'igual' }
  const patch = buildCredentialPatchFromSetCookie(creds, 'ssid=igual', {
    'set-cookie': ['ssid=igual; Path=/']
  })
  assert.equal(patch, null)
})

test('buildCredentialPatchFromSetCookie: retorna null quando não há Set-Cookie', () => {
  const creds = { ssid: 'igual' }
  const patch = buildCredentialPatchFromSetCookie(creds, 'ssid=igual', {})
  assert.equal(patch, null)
})

test('buildCredentialPatchFromSetCookie: preserva ssid conhecido quando Set-Cookie é só deleção (FR-004)', () => {
  const creds = { ssid: 'ssid-conhecido', csrf: 'csrf-conhecido' }
  const patch = buildCredentialPatchFromSetCookie(creds, 'ssid=ssid-conhecido; _csrf=csrf-antigo', {
    'set-cookie': ['_csrf=csrf-novo; Path=/', 'ssid=; Max-Age=0']
  })
  // _csrf mudou (rotação real), então o patch existe — mas ssid nunca fica vazio.
  assert.ok(patch)
  assert.equal(patch.ssid, 'ssid-conhecido')
  assert.notEqual(patch.ssid, '')
})

test('parseCookieHeader: parseia pares nome=valor separados por ;', () => {
  const jar = parseCookieHeader('ssid=abc; _csrf=def; id=123')
  assert.equal(jar.get('ssid'), 'abc')
  assert.equal(jar.get('_csrf'), 'def')
  assert.equal(jar.get('id'), '123')
})

test('parseCookieHeader: string vazia => jar vazio', () => {
  const jar = parseCookieHeader('')
  assert.equal(jar.size, 0)
})
