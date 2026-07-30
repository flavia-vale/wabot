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

  // Shopee/Magalu não usam código de acesso da conta.
  assert.equal(platform('shopee').fields.some((f) => f.cookieField), false)
  assert.equal(platform('magazineluiza').fields.some((f) => f.cookieField), false)
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
