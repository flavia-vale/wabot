import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeCredentialBody, validateCredentialData, getCredentialSaveMessage } from '../src/credentialHealth.js'

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

test('Amazon: sem cookie completo mantém os 3 cookies nomeados intactos', () => {
  const body = { tag: 'amzn', 'ubid-acbbr': 'u', 'at-acbbr': 'a', 'x-acbbr': 'x' }
  const out = sanitizeCredentialBody('amazon', body)
  assert.deepEqual(out, body)
})

test('Amazon: cookie completo descarta os 3 cookies nomeados legados (não sombreia a sessão nova)', () => {
  const body = {
    tag: 'amzn-20',
    cookie: 'session-id=1; at-acbbr=novo; session-token=abc',
    'ubid-acbbr': 'antigo-u',
    'at-acbbr': 'antigo-at',
    'x-acbbr': 'antigo-x',
  }
  const out = sanitizeCredentialBody('amazon', body)
  assert.deepEqual(out, { tag: 'amzn-20', cookie: 'session-id=1; at-acbbr=novo; session-token=abc' })
  assert.equal('ubid-acbbr' in out, false)
  assert.equal('at-acbbr' in out, false)
  assert.equal('x-acbbr' in out, false)
})

test('Amazon: cookie em branco não dispara o sanitize (mantém os nomeados)', () => {
  const body = { tag: 'amzn', cookie: '   ', 'ubid-acbbr': 'u', 'at-acbbr': 'a', 'x-acbbr': 'x' }
  const out = sanitizeCredentialBody('amazon', body)
  assert.deepEqual(out, body)
})

// ---------------------------------------------------------------------------
// SHEIN (specs/012-shein-store-support). Normalização é offline (só parsing
// de URL) — o número puro é aceito como está; um link de afiliada com
// koc_id/url_from visível na URL extrai o número; qualquer outra coisa
// (oneLink ainda não expandido, link de compartilhamento, texto aleatório)
// fica como veio e é recusada por validateCredentialData, que ensina onde
// pegar o link certo (SC-008).
// ---------------------------------------------------------------------------

test('SHEIN: número puro aceito como está', () => {
  const out = sanitizeCredentialBody('shein', { tag: '123456' })
  assert.deepEqual(out, { tag: '123456' })
})

test('SHEIN: link de afiliada com koc_id extrai o número', () => {
  const url = 'https://m.shein.com/br/ark/default?scene=1&koc_id=123456&url_from=affiliate_koc_123456&goods_id=485735309'
  const out = sanitizeCredentialBody('shein', { tag: url })
  assert.equal(out.tag, '123456')
})

test('SHEIN: link com url_from=affiliate_koc_<n> (sem koc_id) extrai o número', () => {
  const url = 'https://m.shein.com/br/ark/default?url_from=affiliate_koc_998877'
  const out = sanitizeCredentialBody('shein', { tag: url })
  assert.equal(out.tag, '998877')
})

test('SHEIN: oneLink ainda não expandido mantém como veio (recusado na validação)', () => {
  const url = 'https://onelink.shein.com/14/4v4p6bpzshsx'
  const out = sanitizeCredentialBody('shein', { tag: url })
  assert.equal(out.tag, url)
})

test('SHEIN: link de compartilhamento (GM7/shc/link) mantém como veio', () => {
  const url = 'https://api-shein.shein.com/h5/sharejump/appjump?shc=abc&link=xyz&url_from=GM7999'
  const out = sanitizeCredentialBody('shein', { tag: url })
  assert.equal(out.tag, url)
})

test('SHEIN: validação aceita número puro (configured)', () => {
  const v = validateCredentialData('shein', { tag: '123456' })
  assert.equal(v.configured, true)
  assert.deepEqual(v.missing, [])
})

test('SHEIN: validação recusa link de compartilhamento com mensagem que ensina', () => {
  const url = 'https://api-shein.shein.com/h5/sharejump/appjump?shc=abc&link=xyz&url_from=GM7999'
  const v = validateCredentialData('shein', { tag: url })
  assert.equal(v.configured, false)
  assert.match(getCredentialSaveMessage(v), /botão de compartilhar/i)
  assert.match(getCredentialSaveMessage(v), /painel de afiliada/i)
})

test('SHEIN: validação recusa texto aleatório com mensagem que ensina o formato certo', () => {
  const v = validateCredentialData('shein', { tag: 'qualquer coisa aleatória' })
  assert.equal(v.configured, false)
  assert.match(getCredentialSaveMessage(v), /link de afiliada da SHEIN|número de afiliada/i)
})

test('SHEIN: campo vazio é "faltou preencher", não recusa de formato', () => {
  const v = validateCredentialData('shein', { tag: '' })
  assert.equal(v.configured, false)
  assert.deepEqual(v.missing, ['tag'])
  assert.match(getCredentialSaveMessage(v), /faltou preencher/i)
})
