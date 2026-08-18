// Trava a peneira de FORMATO do código de acesso (investigação 18/08/2026).
//
// Antes, o save só conferia se o campo estava preenchido: uma conta salvou um
// LINK no lugar do código, o painel respondeu "Tudo certo!", e o robô acumulou
// 537 recusas seguidas do Mercado Livre sem nada no painel que denunciasse.
// Outras contas ficaram com 10, 16 e 52 caracteres — todas marcadas como
// prontas para usar.

import test from 'node:test'
import assert from 'node:assert/strict'
import { describeInvalidCredentialFields, validateCredentialData } from '../src/credentialHealth.js'
import { describeInvalidAffiliateValue } from '../dashboard/lib/painel/affiliatePlatforms.js'

const CODIGO_BOM = 'g'.repeat(84)

test('link colado no lugar do código é recusado (caso real)', () => {
  const problemas = describeInvalidCredentialFields('mercadolivre', { ssid: 'https://www.mercadolivre.com.br/afiliados/linkbuilder' })
  assert.equal(problemas.length, 1)
  assert.equal(problemas[0].field, 'ssid')
  assert.match(problemas[0].message, /é um link/i)
})

test('código com espaço no meio é recusado', () => {
  const problemas = describeInvalidCredentialFields('mercadolivre', { ssid: `${CODIGO_BOM.slice(0, 40)} ${CODIGO_BOM.slice(40)}` })
  assert.equal(problemas.length, 1)
  assert.match(problemas[0].message, /espaços/i)
})

test('pedaço solto (curto demais) é recusado', () => {
  for (const curto of ['abc', 'x'.repeat(10), 'y'.repeat(16), 'z'.repeat(29)]) {
    const problemas = describeInvalidCredentialFields('mercadolivre', { ssid: curto })
    assert.equal(problemas.length, 1, `deveria recusar "${curto.slice(0, 6)}…" (${curto.length} chars)`)
    assert.match(problemas[0].message, /curto/i)
  }
})

test('código de tamanho real (83-85) passa — a peneira não pode barrar quem está certo', () => {
  for (const tamanho of [83, 84, 85]) {
    assert.deepEqual(describeInvalidCredentialFields('mercadolivre', { ssid: 'g'.repeat(tamanho) }), [])
  }
})

test('a peneira vale para os campos de código da Amazon também', () => {
  const problemas = describeInvalidCredentialFields('amazon', { cookie: 'https://associados.amazon.com.br' })
  assert.equal(problemas.length, 1)
  assert.match(problemas[0].message, /é um link/i)
})

test('código COMPLETO (lista de vários pares) pode ter espaço — não pode ser recusado', () => {
  // O código completo da Amazon e o pacote do ML são listas `a=1; b=2`. Aplicar
  // a regra de espaço neles recusaria credencial legítima (pegou o fixture real
  // da suíte na primeira versão desta peneira).
  const cookieReal = 'session-id=abc; at-acbbr=token; x-acbbr=x; ubid-acbbr=u'
  assert.deepEqual(describeInvalidCredentialFields('amazon', { cookie: cookieReal }), [])
  assert.deepEqual(describeInvalidCredentialFields('mercadolivre', { cookie: 'ssid=abc; _csrf=x' }), [])
  assert.equal(describeInvalidAffiliateValue('amazon', 'cookie', cookieReal), '')
})

test('os códigos separados da Amazon não têm corte de tamanho (variam de tamanho)', () => {
  assert.deepEqual(describeInvalidCredentialFields('amazon', { 'ubid-acbbr': '123-4567890-1234567' }), [])
  const comEspaco = describeInvalidCredentialFields('amazon', { 'at-acbbr': 'token com espaco' })
  assert.equal(comEspaco.length, 1)
  assert.match(comEspaco[0].message, /espaços/i)
})

test('etiqueta de afiliada NÃO passa pela peneira (não é código de acesso)', () => {
  assert.deepEqual(describeInvalidCredentialFields('mercadolivre', { tag: 'abc', ssid: CODIGO_BOM }), [])
  assert.deepEqual(describeInvalidCredentialFields('magazineluiza', { tag: 'ab' }), [])
})

test('validateCredentialData marca status invalid sem mexer em configured/missing', () => {
  const v = validateCredentialData('mercadolivre', { tag: '475630078', ssid: 'https://x.com/abc' })
  assert.equal(v.status, 'invalid')
  assert.equal(v.invalid.length, 1)
  assert.deepEqual(v.missing, [], 'o campo está preenchido — não é "falta preencher"')
  assert.equal(v.configured, true, 'configured continua amarrado a missing (não quebra quem já lê esse campo)')
})

test('campo vazio continua sendo "falta preencher", não "formato errado"', () => {
  const v = validateCredentialData('mercadolivre', { tag: '475630078', ssid: '' })
  assert.equal(v.status, 'incomplete')
  assert.deepEqual(v.invalid, [])
})

test('a tela e o servidor recusam as MESMAS coisas (espelho não pode divergir)', () => {
  const casos = ['https://www.mercadolivre.com.br/abc', 'com espaco no meio aqui dentro do valor', 'curtinho']
  for (const valor of casos) {
    const servidor = describeInvalidCredentialFields('mercadolivre', { ssid: valor })
    const tela = describeInvalidAffiliateValue('mercadolivre', 'ssid', valor)
    assert.equal(servidor.length, 1, `servidor deveria recusar: ${valor}`)
    assert.equal(tela, servidor[0].message, `tela e servidor divergem para: ${valor}`)
  }
  assert.equal(describeInvalidAffiliateValue('mercadolivre', 'ssid', CODIGO_BOM), '')
  assert.equal(describeInvalidAffiliateValue('mercadolivre', 'tag', 'ab'), '', 'etiqueta não passa pela peneira')
})

test('mensagens de recusa não usam jargão técnico', () => {
  const mensagens = [
    ...describeInvalidCredentialFields('mercadolivre', { ssid: 'https://x.com' }),
    ...describeInvalidCredentialFields('mercadolivre', { ssid: 'curto' }),
  ].map((p) => p.message)
  for (const msg of mensagens) {
    assert.doesNotMatch(msg, /cookie de sess[ãa]o|ssid|token|payload|endpoint/i, `jargão em: ${msg}`)
  }
})
