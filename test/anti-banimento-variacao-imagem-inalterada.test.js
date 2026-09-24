// User Story 4, decisão A (fora de escopo de mudança de comportamento): a
// variação de imagem continua exatamente como está — mesmo campo
// (imageMutationEnabled), mesmo padrão (false), mesmo gate. Só o rótulo muda
// para linguagem leiga, sem "mutação".

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const toggle = readFileSync(new URL('../dashboard/components/preservacao/ImageMutationToggle.js', import.meta.url), 'utf8')

test('o campo continua sendo imageMutationEnabled (nenhum nome novo/alias)', () => {
  assert.match(toggle, /imageMutationEnabled/)
})

test('o rótulo não contém "mutação" nem "hash"', () => {
  assert.doesNotMatch(toggle, /muta[çc][ãa]o/i)
  assert.doesNotMatch(toggle, /\bhash\b/i)
})

test('o rótulo diz "Mudar levemente a foto em cada envio para os canais"', () => {
  assert.match(toggle, /Mudar levemente a foto em cada envio para os canais/)
})

test('nenhuma rota/componente desta feature grava valor diferente do que a cliente escolheu (o padrão histórico é false, sem override forçado)', () => {
  // O componente só repassa o boolean do checkbox — não força true/false por
  // conta própria em nenhum caminho.
  assert.doesNotMatch(toggle, /imageMutationEnabled:\s*(true|false)\s*\}\)(?!\s*$)/)
  assert.match(toggle, /onChange\(\{ imageMutationEnabled: checked \}\)/)
})
