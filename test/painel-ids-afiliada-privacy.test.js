import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AFFILIATE_PLATFORMS, getPlatformStatus } from '../dashboard/lib/painel/affiliatePlatforms.js'

const pageSource = readFileSync(new URL('../dashboard/app/painel/ids-afiliada/page.js', import.meta.url), 'utf8')
const apiSource = readFileSync(new URL('../dashboard/lib/api.js', import.meta.url), 'utf8')

function platform(id) {
  return AFFILIATE_PLATFORMS.find((p) => p.id === id)
}

test('as duas lojas que pedem cookie de sessão oferecem o modo sem cookie', () => {
  assert.equal(platform('mercadolivre').supportsCookielessMode, true)
  assert.equal(platform('amazon').supportsCookielessMode, true)
  // Shopee/Magalu não usam cookie de sessão — oferecer a opção lá só confundiria.
  assert.equal(platform('shopee').supportsCookielessMode, undefined)
  assert.equal(platform('magazineluiza').supportsCookielessMode, undefined)
})

test('todo campo de cookie está marcado como cookieField (senão o modo não o esconde)', () => {
  const mlCookieFields = platform('mercadolivre').fields.filter((f) => f.cookieField).map((f) => f.key)
  assert.deepEqual(mlCookieFields, ['ssid'])

  const amazonCookieFields = platform('amazon').fields.filter((f) => f.cookieField).map((f) => f.key)
  assert.deepEqual(amazonCookieFields, ['cookie', 'ubid-acbbr', 'at-acbbr', 'x-acbbr'])
})

test('status do painel: modo sem cookie fica "configurado" só com a tag', () => {
  assert.equal(getPlatformStatus(platform('mercadolivre'), { tag: '475630078', cookielessMode: true }), 'configured')
  assert.equal(getPlatformStatus(platform('amazon'), { tag: 'fafaciane-20', cookielessMode: true }), 'configured')
})

test('status do painel: sem o modo, o cookie obrigatório continua sendo cobrado', () => {
  // ML sem SSID: campo obrigatório em branco -> incompleto (comportamento histórico).
  assert.equal(getPlatformStatus(platform('mercadolivre'), { tag: '475630078' }), 'incomplete')
})

test('status do painel: modo sem cookie não dispensa a tag', () => {
  assert.equal(getPlatformStatus(platform('mercadolivre'), { cookielessMode: true }), 'pending')
})

test('a página oferece o modo sem cookie, o botão de apagar e a explicação de privacidade', () => {
  assert.match(pageSource, /Modo sem cookie/)
  assert.match(pageSource, /toggleCookieless/)
  assert.match(pageSource, /Apagar credenciais de/)
  assert.match(pageSource, /O que o BOTinho faz com esse cookie\?/)
  assert.match(pageSource, /criptografad/i)
})

test('a página não sonda sessão nem alarma "expirada" no modo sem cookie', () => {
  assert.match(pageSource, /cookielessMode === true\) \{ setMlSession\(null\); return \}/)
  assert.match(pageSource, /cookielessMode === true\) \{ setAmazonSession\(null\); return \}/)
  assert.match(pageSource, /\{!cookieless && <SessionWarning/)
})

test('o client da API expõe o apagamento de credencial', () => {
  assert.match(apiSource, /deleteCredential: \(platform\) =>/)
  assert.match(apiSource, /method: 'DELETE'/)
})
