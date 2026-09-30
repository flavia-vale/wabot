import test from 'node:test'
import assert from 'node:assert/strict'
import { explainErrorMsg } from '../dashboard/lib/painel/logsCopy.js'
import { friendlyMobileLogError as explainMobile } from '../dashboard/lib/mobileLogs.js'

// RCA 2026-09-30: produto real recusado pelo ML (erro 111) saía como link
// comprido e o painel não explicava nada — a cliente achava que "a API caiu".
test('painel explica o produto recusado pelo ML sem culpar o código de acesso', () => {
  const web = explainErrorMsg('warning:ml_url_not_supported', 'mercadolivre')
  assert.match(web, /não aceitou esse produto/i)
  assert.match(web, /link mais comprido/i)
  assert.match(web, /Não é problema do seu código de acesso/i)
  assert.match(web, /Gerador de Links/i)
  assert.doesNotMatch(web, /ssid|cookie|partner_id|token/i)
  const mobile = explainMobile('warning:ml_url_not_supported')
  assert.match(mobile, /não aceitou esse produto/i)
  assert.doesNotMatch(mobile, /ssid|cookie|partner_id/i)
})
