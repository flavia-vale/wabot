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

test('o aviso é renderizado na tela, fora do bloco recolhível', () => {
  assert.match(pageSource, /platform\.sessionCareNote/, 'a tela precisa renderizar o aviso')
  const trechoDetails = pageSource.slice(pageSource.indexOf('function CookiePrivacyDetails'), pageSource.indexOf('function PlatformCard'))
  assert.doesNotMatch(trechoDetails, /sessionCareNote/, 'o aviso não pode ficar escondido dentro do "details"')
})

test('o aviso de código vencido repete o cuidado ao recadastrar', () => {
  assert.match(pageSource, /n[ãa]o clique em &quot;Sair&quot; no Mercado Livre/i)
  assert.match(pageSource, /n[ãa]o clique em &quot;Sair&quot; na Amazon/i)
})

test('o aviso continua em linguagem de gente (sem jargão)', () => {
  for (const id of ['mercadolivre', 'amazon']) {
    assert.doesNotMatch(loja(id).sessionCareNote, /cookie de sess[ãa]o|ssid|token|sess[ãa]o expirada/i)
  }
})
