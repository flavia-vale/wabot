// O painel precisa avisar, ANTES, o que derruba o código de acesso.
//
// Confirmado em teste controlado (18/08/2026): clicar em "Sair" na conta da
// loja encerra a sessão e o código morre na hora — um código válido virou
// "vencido" em menos de 4 minutos após o clique. Era o motivo nº 1 de
// "cadastrei de novo e continua vencido": a cliente copiava o código e saía da
// conta em seguida, sem nada na tela dizendo que isso quebrava tudo.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AFFILIATE_PLATFORMS } from '../dashboard/lib/painel/affiliatePlatforms.js'

const pageSource = readFileSync(new URL('../dashboard/app/painel/ids-afiliada/page.js', import.meta.url), 'utf8')

function loja(id) {
  return AFFILIATE_PLATFORMS.find((p) => p.id === id)
}

test('as lojas com código de acesso avisam para não sair da conta', () => {
  for (const id of ['mercadolivre', 'amazon']) {
    const nota = loja(id).sessionCareNote
    assert.ok(nota, `${id} precisa do aviso de cuidado com a sessão`)
    assert.match(nota, /sair/i, `${id}: o aviso precisa falar de sair da conta`)
    assert.match(nota, /an[ôo]nima/i, `${id}: o aviso precisa falar de janela anônima`)
  }
})

test('as lojas sem código de acesso não ganham o aviso (não faz sentido lá)', () => {
  for (const id of ['shopee', 'magazineluiza']) {
    assert.equal(loja(id).sessionCareNote, undefined, `${id} não pede código de acesso`)
  }
})

test('o aviso é renderizado na tela, fora do bloco "Saiba mais"', () => {
  // A tela virou acordeão em 09/2026 e o texto longo de cada loja foi recolhido
  // num "Saiba mais" (PlatformDetails). Este aviso é a ÚNICA exceção: ele fica
  // sempre visível, numa linha, porque lido tarde não tem conserto senão
  // recadastrar. Antes esta guarda apontava para `CookiePrivacyDetails`, função
  // que deixou de existir — e passava à toa, medindo um trecho vazio.
  assert.match(pageSource, /platform\.sessionCareNote/, 'a tela precisa renderizar o aviso')
  assert.match(pageSource, /function PlatformDetails/, 'o bloco recolhível mudou de nome — revise esta guarda')

  const inicioDetails = pageSource.indexOf('function PlatformDetails')
  const fimDetails = pageSource.indexOf('function SessionCareLine')
  assert.ok(inicioDetails > 0 && fimDetails > inicioDetails, 'não achei o bloco recolhível')
  const trechoDetails = pageSource.slice(inicioDetails, fimDetails)
  assert.doesNotMatch(trechoDetails, /sessionCareNote/, 'o aviso não pode ficar escondido dentro do "Saiba mais"')
})

test('o cuidado ao recadastrar aparece em TODA loja que pede código, não só quando vence', () => {
  // Antes o texto "não clique em Sair na Amazon" estava copiado dentro do aviso
  // de código vencido, no JSX. Isso cobria só quem JÁ tinha perdido o código —
  // e é justamente antes de copiar que a frase precisa ser lida.
  //
  // Agora `SessionCareLine` renderiza o aviso da própria loja em todo cartão que
  // pede código de acesso, vencido ou não, e o aviso de vencimento não precisa
  // repetir a frase (o que o manteria com três linhas de texto).
  assert.match(pageSource, /function SessionCareLine/)
  assert.match(pageSource, /<SessionCareLine platform=\{platform\} \/>/, 'o aviso não está sendo renderizado no cartão')

  for (const id of ['mercadolivre', 'amazon']) {
    assert.match(loja(id).sessionCareNote, /n[ãa]o clique em "Sair"/i, `${id}: o aviso perdeu o "não clique em Sair"`)
  }

  // O aviso de vencimento continua dizendo o que fazer (colar um código novo).
  assert.match(pageSource, /colar um c[óo]digo novo aqui embaixo/i)
})

test('o aviso continua em linguagem de gente (sem jargão)', () => {
  for (const id of ['mercadolivre', 'amazon']) {
    assert.doesNotMatch(loja(id).sessionCareNote, /cookie de sess[ãa]o|ssid|token|sess[ãa]o expirada/i)
  }
})
