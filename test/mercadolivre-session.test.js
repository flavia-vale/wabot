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

test('checkMercadoLivreSession: 200 => sessão viva (alive=true)', async (t) => {
  t.mock.method(axios, 'post', async () => ({ status: 200, data: { status: 200, urls: [] }, headers: {} }))
  const r = await checkMercadoLivreSession(CREDS)
  assert.deepEqual(r, { configured: true, alive: true, reason: 'ok' })
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
