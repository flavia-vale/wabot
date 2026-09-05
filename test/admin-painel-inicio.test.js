import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { CARD_HELP } from '../dashboard/lib/admin/cardHelp.js'

const painel = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')

test('a fila proativa não volta para a aba Início', () => {
  // Pedido de 2026-09-05: a aba Início é "o que precisa de decisão agora"; a
  // fila é trabalho de atendimento e tem aba própria.
  assert.doesNotMatch(painel, /tab === 'inicio' \|\| tab === 'sucesso'\) && success/)
  assert.match(painel, /tab === 'sucesso' && success/)
})

test('todo card do semáforo tem drill-down de pessoas', () => {
  const cenarios = ['parado', 'blind', 'quedas', 'manual', 'desync']
  for (const cenario of cenarios) {
    assert.match(painel, new RegExp(`openScenario\\('${cenario}'\\)`), `cenário sem drill-down: ${cenario}`)
  }
  // Os dois cards de gente do comando também abrem a lista de quem são.
  assert.match(painel, /openWaStatus\('connected'\)/)
  assert.match(painel, /openErrorsDrilldown\(\)/)
})

test('os cards técnicos abrem o detalhe do que está pendente', () => {
  assert.match(painel, /setTechDrilldown\('infra'\)/)
  assert.match(painel, /setTechDrilldown\('filas'\)/)
  assert.match(painel, /function TechDrilldownModal/)
})

test('todo card do painel tem explicação atrás do "?"', () => {
  const usados = [...painel.matchAll(/CARD_HELP\.(\w+)/g)].map(match => match[1])
  const esperados = Object.keys(CARD_HELP)
  for (const chave of esperados) {
    assert.ok(usados.includes(chave), `card sem ajuda ligada na tela: ${chave}`)
  }
})

test('a explicação responde às três perguntas, em linguagem leiga', () => {
  const proibido = /\bDLQ\b|worker|socket|Baileys|endpoint|payload/i
  for (const [chave, ajuda] of Object.entries(CARD_HELP)) {
    assert.ok(ajuda.title, `${chave} sem título`)
    assert.ok(ajuda.oQueE, `${chave} não diz o que é`)
    assert.ok(ajuda.impacto, `${chave} não diz qual o impacto`)
    assert.ok(ajuda.comoResolver, `${chave} não diz como resolver`)
    for (const campo of ['title', 'oQueE', 'impacto', 'comoResolver']) {
      assert.doesNotMatch(ajuda[campo], proibido, `${chave}.${campo} com jargão`)
    }
  }
})

test('a tabela de desconectados mostra POR QUE caiu, não só o código', () => {
  assert.match(painel, /Por que caiu/)
  assert.match(painel, /disconnectReason\?\.label/)
})

test('a tag de pagante aparece nas tabelas de cliente do painel', () => {
  const ocorrencias = painel.match(/<PayingTag/g) ?? []
  assert.ok(ocorrencias.length >= 5, `esperava a tag em todas as listas de cliente, achei ${ocorrencias.length}`)
})
