import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AFFILIATE_PLATFORMS, getPlatformStatus } from '../dashboard/lib/painel/affiliatePlatforms.js'
import { sanitizeCredentialBody, validateCredentialData } from '../src/credentialHealth.js'

const pageSource = readFileSync(new URL('../dashboard/app/painel/ids-afiliada/page.js', import.meta.url), 'utf8')
const apiSource = readFileSync(new URL('../dashboard/lib/api.js', import.meta.url), 'utf8')

function platform(id) {
  return AFFILIATE_PLATFORMS.find((p) => p.id === id)
}

test('as lojas que pedem código de acesso marcam esses campos como cookieField', () => {
  const mlCookieFields = platform('mercadolivre').fields.filter((f) => f.cookieField).map((f) => f.key)
  assert.deepEqual(mlCookieFields, ['ssid'])

  const amazonCookieFields = platform('amazon').fields.filter((f) => f.cookieField).map((f) => f.key)
  assert.deepEqual(amazonCookieFields, ['cookie', 'ubid-acbbr', 'at-acbbr', 'x-acbbr'])

  // Shopee/Magalu não usam código de acesso da conta. SHEIN passou a
  // aceitar um código de acesso OPCIONAL a partir do Phase 16
  // (specs/012-shein-store-support) — só para encurtar o link; o cadastro
  // funciona igual sem ele.
  assert.equal(platform('shopee').fields.some((f) => f.cookieField), false)
  assert.equal(platform('magazineluiza').fields.some((f) => f.cookieField), false)
  const sheinCookieFields = platform('shein').fields.filter((f) => f.cookieField).map((f) => f.key)
  assert.deepEqual(sheinCookieFields, ['cookie'])
})

test('a entrada shein não reintroduz o modo sem cookie do ML — o código de acesso dela é opcional por natureza, não uma flag de opt-out', () => {
  const shein = platform('shein')
  assert.equal(shein.supportsCookielessMode, undefined)
  assert.equal(shein.cookielessNote, undefined)

  // T080 (Phase 16): `tag` continua o único campo OBRIGATÓRIO — é o
  // identificador permanente de afiliada (specs/012-shein-store-support
  // D-009). O `cookie` é um campo novo, explicitamente opcional
  // (`required: false`), que só existe para encurtar o link — sem ele o
  // cadastro segue completo e a oferta sai igual (link mais comprido).
  assert.deepEqual(shein.fields.map((f) => f.key), ['tag', 'cookie'])
  assert.equal(shein.fields[0].key, 'tag')
  assert.equal(shein.fields[0].required, undefined) // obrigatório por omissão, igual sempre foi

  const cookieField = shein.fields.find((f) => f.key === 'cookie')
  assert.equal(cookieField.required, false)
  assert.equal(cookieField.sensitive, true)
  assert.equal(cookieField.cookieField, true)
})

test('o código de acesso do ML continua obrigatório — não existe opção de ficar sem', () => {
  // Regressão do "modo sem cookie" (removido a pedido da cliente): o painel não
  // pode voltar a considerar a loja pronta sem o código de acesso.
  assert.equal(getPlatformStatus(platform('mercadolivre'), { tag: '475630078' }), 'incomplete')
  assert.equal(getPlatformStatus(platform('mercadolivre'), { tag: '475630078', ssid: 'ghy-abc' }), 'configured')
})

test('o painel não oferece nenhuma opção de operar sem o código de acesso', () => {
  assert.doesNotMatch(pageSource, /cookielessMode/i)
  assert.doesNotMatch(pageSource, /não quero guardar meu código/i)
  for (const p of AFFILIATE_PLATFORMS) {
    assert.equal(p.supportsCookielessMode, undefined, `${p.id} não pode ter modo sem cookie`)
    assert.equal(p.cookielessNote, undefined, `${p.id} não pode ter texto de modo sem cookie`)
  }
})

test('a página explica o que é feito com o código e deixa apagar os dados', () => {
  assert.match(pageSource, /Esse código expõe meus dados pessoais\?/)
  assert.match(pageSource, /Apagar meus dados da/)
  assert.match(pageSource, /criptografad/i)
})

test('o client da API expõe o apagamento de credencial', () => {
  assert.match(apiSource, /deleteCredential: \(platform\) =>/)
  assert.match(apiSource, /method: 'DELETE'/)
})

test('resíduo do modo removido: a flag antiga nunca é regravada ao salvar', () => {
  // Contas que ligaram a opção enquanto ela existiu ficaram com
  // `cookielessMode: true` guardado. Salvar de novo tem que limpar o resíduo,
  // senão ele sobrevive para sempre. Limpeza das linhas antigas:
  // scripts/cleanup-cookieless-flag.mjs.
  const out = sanitizeCredentialBody('mercadolivre', {
    tag: '475630078',
    ssid: 'ghy-codigo-novo-colado',
    cookielessMode: true,
  })
  assert.equal('cookielessMode' in out, false)
  assert.equal(out.tag, '475630078')
  assert.equal(out.ssid, 'ghy-codigo-novo-colado')
})

test('resíduo do modo removido: a flag não deixa a credencial passar sem código', () => {
  // Mesmo com a flag guardada, o ML volta a exigir o código de acesso.
  const validacao = validateCredentialData('mercadolivre', { tag: '475630078', cookielessMode: true })
  assert.equal(validacao.configured, false)
  assert.ok(validacao.missing.includes('ssid/cookie'))
})
