// A faixa de "código de acesso do Mercado Livre venceu" no painel.
//
// Ela nasceu como caixa VERMELHA de quatro linhas ("Credencial do Mercado Livre
// expirada / Seu SSID do Mercado Livre expirou…"), em todas as abas do painel.
// Dois problemas: o vocabulário era técnico e proibido nesta superfície, e
// vermelho dizia que algo tinha parado — quando nada parou. Sem o código de
// acesso o plano B continua publicando e a comissão continua sendo dela; o que
// muda é o link ficar mais comprido.
//
// Puro: lê o source, sem banco e sem rede.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const shell = readFileSync(new URL('../dashboard/app/painel/PainelShell.js', import.meta.url), 'utf8')

function bannerSource() {
  const inicio = shell.indexOf('function ExpiredMlSsidBanner')
  assert.ok(inicio > 0, 'a faixa de código vencido do ML sumiu do painel')
  const fim = shell.indexOf('function NoCredentialBanner')
  assert.ok(fim > inicio, 'não achei o fim do bloco')
  return shell.slice(inicio, fim)
}

test('a faixa fala em linguagem de gente, sem jargão', () => {
  const bloco = bannerSource()
  for (const jargao of [/\bSSID\b/i, /credencial/i, /expirad[ao]/i, /expirou/i, /link de afiliado/i, /cookie de sess[ãa]o/i]) {
    assert.doesNotMatch(bloco, jargao, `jargão de volta na faixa: ${jargao}`)
  }
  assert.match(bloco, /c[óo]digo de acesso/i, 'precisa chamar o dado de "código de acesso"')
  assert.match(bloco, /venceu/i, 'precisa dizer "venceu", não "expirou"')
})

test('a faixa NÃO diz que as ofertas pararam — porque não pararam', () => {
  // Mesma invariante da tela de credenciais e do e-mail de código vencido: no
  // ML e na Amazon o plano B segue enviando. Dizer o contrário assusta à toa e
  // treina a cliente a ignorar os avisos que importam de verdade.
  const bloco = bannerSource()
  assert.match(bloco, /continuam saindo/i)
  assert.match(bloco, /link mais comprido/i)
  assert.doesNotMatch(bloco, /pausad|parou|interrompid/i)
})

test('a faixa é aviso, nunca erro', () => {
  const bloco = bannerSource()
  assert.doesNotMatch(bloco, /is-error/, 'vermelho diz "parou" — e nada parou')
  assert.match(bloco, /is-warn/)
  assert.match(bloco, /role="status"/, 'role="alert" interrompe o leitor de tela por algo que não é urgente')
})

test('a faixa cabe em uma frase e leva para onde resolve', () => {
  const bloco = bannerSource()
  // Uma frase: nada de <strong> de título seguido de parágrafo, que era o que
  // fazia o aviso ocupar quatro linhas em toda aba do painel.
  assert.doesNotMatch(bloco, /<strong/, 'título separado traz o formato antigo de volta')
  assert.equal((bloco.match(/<p[ >]/g) || []).length, 0, 'a faixa não tem parágrafo — é uma linha só')
  assert.match(bloco, /href="\/painel\/ids-afiliada"/, 'a ação precisa levar para a tela das lojas')
})
