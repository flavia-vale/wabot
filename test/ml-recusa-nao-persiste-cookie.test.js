// Recusa do Mercado Livre NUNCA vira rotação de cookie guardada.
//
// Medido em produção (18/08/2026): a resposta 401 do createLink é o redirect
// para a tela de LOGIN e vem com Set-Cookie (2 cookies). Como o jar (`cookie`)
// tem precedência sobre o `ssid` em buildCookieHeader, guardar esses cookies
// mistura sessão anônima na credencial da cliente e pode matar de vez um código
// que ainda estava vivo. Só rotação vinda de resposta ACEITA pode ser guardada.

import test from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import { checkMercadoLivreSession } from '../src/converters/mercadolivre.js'

const CREDS = { tag: '475630078', ssid: 'ssid-de-teste-1234567890', csrf: 'csrf-de-teste' }

const COOKIES_DA_TELA_DE_LOGIN = [
  'ssid=ssid-anonimo-da-tela-de-login; Path=/',
  '_csrf=csrf-anonimo; Path=/',
]

test('401 (código vencido) não devolve credentialPatch, mesmo com Set-Cookie na resposta', async (t) => {
  t.mock.method(axios, 'post', async () => ({
    status: 401,
    data: { message: 'Unauthorized', data: { url: 'https://www.mercadolivre.com/jms/mlb/lgz/login' } },
    headers: { 'set-cookie': COOKIES_DA_TELA_DE_LOGIN },
  }))
  const r = await checkMercadoLivreSession(CREDS)
  assert.deepEqual(r, { configured: true, alive: false, reason: 'expired' })
  assert.equal(r.credentialPatch, undefined)
})

test('403 e 429 também não devolvem credentialPatch', async (t) => {
  for (const status of [403, 429]) {
    t.mock.method(axios, 'post', async () => ({
      status,
      data: { message: 'blocked' },
      headers: { 'set-cookie': COOKIES_DA_TELA_DE_LOGIN },
    }))
    const r = await checkMercadoLivreSession(CREDS)
    assert.equal(r.credentialPatch, undefined, `status ${status} não pode devolver patch`)
    assert.equal(r.alive, null)
  }
})

test('resposta ACEITA continua devolvendo a rotação (não regredir o caminho bom)', async (t) => {
  t.mock.method(axios, 'post', async () => ({
    status: 200,
    data: { status: 200, urls: [] },
    headers: { 'set-cookie': ['ssid=ssid-rotacionado-pelo-ml; Path=/'] },
  }))
  const r = await checkMercadoLivreSession(CREDS)
  assert.equal(r.alive, true)
  assert.equal(r.credentialPatch.ssid, 'ssid-rotacionado-pelo-ml')
})
