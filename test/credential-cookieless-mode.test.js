import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyCookielessMode,
  filterRequiredFieldsForCookieless,
  isCookielessMode,
  stripCookieFields,
  supportsCookielessMode,
} from '../src/credentialPrivacy.js'
import { getCredentialSaveMessage, sanitizeCredentialBody, validateCredentialData } from '../src/credentialHealth.js'

test('modo sem cookie só existe onde há cookie para não dar', () => {
  assert.equal(supportsCookielessMode('mercadolivre'), true)
  assert.equal(supportsCookielessMode('amazon'), true)
  assert.equal(supportsCookielessMode('shopee'), false)
  assert.equal(supportsCookielessMode('magazineluiza'), false)
})

test('flag aceita boolean e string "true"; qualquer outro valor é modo desligado', () => {
  assert.equal(isCookielessMode('mercadolivre', { cookielessMode: true }), true)
  assert.equal(isCookielessMode('mercadolivre', { cookielessMode: 'true' }), true)
  assert.equal(isCookielessMode('mercadolivre', { cookielessMode: 'false' }), false)
  assert.equal(isCookielessMode('mercadolivre', { cookielessMode: 1 }), false)
  assert.equal(isCookielessMode('mercadolivre', {}), false)
  // Shopee não tem cookie: ligar a flag lá não muda nada.
  assert.equal(isCookielessMode('shopee', { cookielessMode: true }), false)
})

test('ML: ligar o modo APAGA ssid/cookie/csrf/id do que é persistido', () => {
  const body = {
    tag: '475630078',
    ssid: 'ghy-abc_-1',
    cookie: 'ssid=ghy-abc_-1; _csrf=x',
    csrf: 'csrf-velho',
    id: 'id-velho',
    vitrineUrl: 'https://www.mercadolivre.com.br/social/eu',
    cookielessMode: true,
  }
  const out = sanitizeCredentialBody('mercadolivre', body)
  assert.deepEqual(out, {
    tag: '475630078',
    vitrineUrl: 'https://www.mercadolivre.com.br/social/eu',
    cookielessMode: true,
  })
  for (const field of ['ssid', 'cookie', 'csrf', 'id']) {
    assert.equal(field in out, false, `campo de sessão ${field} não pode ser persistido no modo sem cookie`)
  }
})

test('Amazon: ligar o modo APAGA cookie completo e os 3 cookies nomeados', () => {
  const body = {
    tag: 'fafaciane-20',
    cookie: 'session-token=abc; at-acbbr=def',
    'ubid-acbbr': 'u',
    'at-acbbr': 'a',
    'x-acbbr': 'x',
    cookielessMode: 'true',
  }
  const out = sanitizeCredentialBody('amazon', body)
  assert.deepEqual(out, { tag: 'fafaciane-20', cookielessMode: true })
})

test('modo desligado não altera o comportamento histórico do sanitize', () => {
  const body = { tag: '475630078', ssid: 'ssid-novo', cookie: 'ssid=antigo', csrf: 'v', id: 'i' }
  const out = sanitizeCredentialBody('mercadolivre', body)
  // Regra histórica (ssid novo descarta artefatos de rotação) segue valendo.
  assert.deepEqual(out, { tag: '475630078', ssid: 'ssid-novo' })
})

test('ML no modo sem cookie: só a tag basta para a credencial ficar completa', () => {
  const validation = validateCredentialData('mercadolivre', { tag: '475630078', cookielessMode: true })
  assert.equal(validation.configured, true)
  assert.equal(validation.status, 'configured')
  assert.equal(validation.cookielessMode, true)
  assert.deepEqual(validation.missing, [])
})

test('Amazon no modo sem cookie: só a tag basta (os 3 cookies deixam de ser exigidos)', () => {
  const validation = validateCredentialData('amazon', { tag: 'fafaciane-20', cookielessMode: true })
  assert.equal(validation.configured, true)
  assert.equal(validation.cookielessMode, true)
  assert.deepEqual(validation.missing, [])
})

test('modo sem cookie NÃO dispensa a tag — sem ela não há comissão para creditar', () => {
  const validation = validateCredentialData('mercadolivre', { cookielessMode: true })
  assert.equal(validation.configured, false)
  assert.equal(validation.status, 'incomplete')
  assert.deepEqual(validation.missing, ['tag'])
})

test('sem o modo ligado, o SSID continua obrigatório (não regride a exigência histórica)', () => {
  const validation = validateCredentialData('mercadolivre', { tag: '475630078' })
  assert.equal(validation.configured, false)
  assert.equal(validation.cookielessMode, false)
  assert.ok(validation.missing.includes('ssid/cookie'))
})

test('mensagem de save tranquiliza em linguagem simples (nada de jargão)', () => {
  const validation = validateCredentialData('amazon', { tag: 'fafaciane-20', cookielessMode: true })
  const message = getCredentialSaveMessage(validation)
  assert.match(message, /etiqueta/i, 'fala "etiqueta", não "tag"')
  assert.match(message, /comiss/i, 'promete a comissão explicitamente')
  assert.match(message, /continuam saindo/i, 'diz que nada se perde')
  assert.doesNotMatch(message, /cookie|ssid|partner_id|fallback/i)
})

test('mensagem de pendência usa nome de gente, não nome de campo', () => {
  const validation = validateCredentialData('mercadolivre', {})
  const message = getCredentialSaveMessage(validation)
  assert.match(message, /etiqueta de afiliado/i)
  assert.match(message, /c[oó]digo de acesso/i)
  assert.doesNotMatch(message, /ssid\/cookie/i, 'nome técnico do campo não pode vazar para a tela')
})

test('helpers puros: strip e required não mutam a entrada', () => {
  const data = { tag: 't', ssid: 's' }
  const stripped = stripCookieFields('mercadolivre', data)
  assert.deepEqual(data, { tag: 't', ssid: 's' })
  assert.deepEqual(stripped, { tag: 't' })

  assert.deepEqual(filterRequiredFieldsForCookieless('amazon', ['tag', 'ubid-acbbr', 'at-acbbr', 'x-acbbr']), ['tag'])
  assert.deepEqual(filterRequiredFieldsForCookieless('shopee', ['appId', 'secretKey']), ['appId', 'secretKey'])

  const body = { tag: 't' }
  assert.equal(applyCookielessMode('mercadolivre', body), body, 'sem a flag, o corpo passa intacto (mesma referência)')
})
