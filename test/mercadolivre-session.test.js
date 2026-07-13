import { test } from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import { checkMercadoLivreSession } from '../src/converters/mercadolivre.js'

const CREDS = { tag: '475630078', ssid: 'ssid-de-teste-1234567890' }

test('checkMercadoLivreSession: 401 => sessão expirada (alive=false)', async (t) => {
  t.mock.method(axios, 'post', async () => ({ status: 401, data: { message: 'Unauthorized' }, headers: {} }))
  const r = await checkMercadoLivreSession(CREDS)
  assert.deepEqual(r, { configured: true, alive: false, reason: 'expired' })
})


test('checkMercadoLivreSession: 403 => indeterminado/forbidden (não marca SSID expirado)', async (t) => {
  t.mock.method(axios, 'post', async () => ({ status: 403, data: '<html>blocked</html>', headers: {} }))
  const r = await checkMercadoLivreSession(CREDS)
  assert.deepEqual(r, { configured: true, alive: null, reason: 'forbidden' })
})

test('checkMercadoLivreSession: 429 => indeterminado/rate_limited (não marca SSID expirado)', async (t) => {
  t.mock.method(axios, 'post', async () => ({ status: 429, data: { message: 'rate limited' }, headers: {} }))
  const r = await checkMercadoLivreSession(CREDS)
  assert.deepEqual(r, { configured: true, alive: null, reason: 'rate_limited' })
})

test('checkMercadoLivreSession: 200 => sessão viva (alive=true)', async (t) => {
  t.mock.method(axios, 'post', async () => ({ status: 200, data: { status: 200, urls: [] }, headers: {} }))
  const r = await checkMercadoLivreSession(CREDS)
  assert.deepEqual(r, { configured: true, alive: true, reason: 'ok' })
})


test('checkMercadoLivreSession: devolve credentialPatch quando ML rotaciona cookies', async (t) => {
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { status: 200, urls: [] },
    headers: {
      'set-cookie': [
        'ssid=ssid-rotacionado; Path=/; HttpOnly',
        '_csrf=csrf-rotacionado; Path=/',
      ],
    },
  }))
  const r = await checkMercadoLivreSession({ ...CREDS, csrf: 'csrf-antigo' })
  assert.equal(r.configured, true)
  assert.equal(r.alive, true)
  assert.equal(r.reason, 'ok')
  assert.equal(r.credentialPatch.ssid, 'ssid-rotacionado')
  assert.equal(r.credentialPatch.csrf, 'csrf-rotacionado')
  assert.match(r.credentialPatch.cookie, /ssid=ssid-rotacionado/)
  assert.match(r.credentialPatch.cookie, /_csrf=csrf-rotacionado/)
})


test('checkMercadoLivreSession: 400 (autenticado, sem produto) ainda conta como sessão viva', async (t) => {
  t.mock.method(axios, 'post', async () => ({ status: 400, data: { message: 'bad request' }, headers: {} }))
  const r = await checkMercadoLivreSession(CREDS)
  assert.deepEqual(r, { configured: true, alive: true, reason: 'ok' })
})

test('checkMercadoLivreSession: sem ssid/cookie => não configurado, não alarma', async () => {
  const r = await checkMercadoLivreSession({ tag: '475630078' })
  assert.deepEqual(r, { configured: false, alive: null, reason: 'no_cookie' })
})

test('checkMercadoLivreSession: erro de rede => indeterminado (não alarma)', async (t) => {
  t.mock.method(axios, 'post', async () => { throw new Error('network down') })
  const r = await checkMercadoLivreSession(CREDS)
  assert.deepEqual(r, { configured: true, alive: null, reason: 'network_error' })
})

// 005-ml-cookie-expiry (US1/T007): regressão do eixo cookie — já correto hoje,
// coberto por teste para garantir que futuras mudanças não regridam.

test('checkMercadoLivreSession: Set-Cookie de deleção (Max-Age=0) é ignorado e não sobrescreve o cookie válido', async (t) => {
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { status: 200, urls: [] },
    headers: {
      'set-cookie': [
        'ssid=; Path=/; Max-Age=0',
      ],
    },
  }))
  const r = await checkMercadoLivreSession({ ...CREDS })
  assert.equal(r.alive, true)
  assert.equal(r.credentialPatch, undefined)
})

test('checkMercadoLivreSession: Set-Cookie de deleção (Expires no passado) é ignorado e não sobrescreve o cookie válido', async (t) => {
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { status: 200, urls: [] },
    headers: {
      'set-cookie': [
        'ssid=ssid-de-teste-1234567890; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
      ],
    },
  }))
  const r = await checkMercadoLivreSession({ ...CREDS })
  assert.equal(r.alive, true)
  assert.equal(r.credentialPatch, undefined)
})

test('checkMercadoLivreSession: Set-Cookie com valor vazio é ignorado e não sobrescreve o cookie válido', async (t) => {
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { status: 200, urls: [] },
    headers: {
      'set-cookie': [
        'ssid=; Path=/',
      ],
    },
  }))
  const r = await checkMercadoLivreSession({ ...CREDS })
  assert.equal(r.alive, true)
  assert.equal(r.credentialPatch, undefined)
})

test('checkMercadoLivreSession: 401 => expired (alive:false) — não confundir com transitório', async (t) => {
  t.mock.method(axios, 'post', async () => ({ status: 401, data: {}, headers: {} }))
  const r = await checkMercadoLivreSession(CREDS)
  assert.equal(r.alive, false)
  assert.equal(r.reason, 'expired')
})

test('checkMercadoLivreSession: 403/429/erro de rede são todos alive:null (transitório, não conta como expiração)', async (t) => {
  t.mock.method(axios, 'post', async () => ({ status: 403, data: {}, headers: {} }))
  const forbidden = await checkMercadoLivreSession(CREDS)
  assert.equal(forbidden.alive, null)

  t.mock.method(axios, 'post', async () => ({ status: 429, data: {}, headers: {} }))
  const rateLimited = await checkMercadoLivreSession(CREDS)
  assert.equal(rateLimited.alive, null)

  t.mock.method(axios, 'post', async () => { throw new Error('ECONNRESET') })
  const networkError = await checkMercadoLivreSession(CREDS)
  assert.equal(networkError.alive, null)
})
