/* Guarda do assistente "Criar novo espelhamento" (2026-09-19).
 *
 * O assistente grava pelo MESMO endpoint da tela de grupos
 * (`PUT /api/groups/:id/targets`), que SUBSTITUI a lista de destinos da
 * origem. As duas formas de estragar o espelhamento de alguém por aqui:
 *
 * 1. mandar só o que ela acabou de marcar — apaga em silêncio os
 *    espelhamentos que a origem já tinha;
 * 2. tirar uma origem do modo 'all' sem avisar — ela envia hoje para TODOS os
 *    destinos, e a escolha explícita corta os não marcados (RCA 2026-08-26).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { planMirrorCreation, resolveInitialOrigin } from '../src/domain/painel/mirrorWizard.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const page = read('../dashboard/app/painel/espelhamento/page.js')
const nav = read('../dashboard/app/painel/nav.js')
const painel = read('../dashboard/app/painel/page.js')

test('o assistente SOMA aos destinos que a origem já tinha, nunca substitui', () => {
  const r = planMirrorCreation({
    currentPostIds: ['d1', 'd2'],
    currentMode: 'explicit',
    chosenPostIds: ['d3'],
  })
  assert.deepEqual(r.postIds.sort(), ['d1', 'd2', 'd3'])
  assert.deepEqual(r.adicionados, ['d3'])
})

test('marcar um destino que já recebia não duplica nem perde os outros', () => {
  const r = planMirrorCreation({
    currentPostIds: ['d1', 'd2'],
    currentMode: 'explicit',
    chosenPostIds: ['d1', 'd3'],
  })
  assert.deepEqual(r.postIds.sort(), ['d1', 'd2', 'd3'])
  assert.deepEqual(r.jaVinculados, ['d1'])
  assert.deepEqual(r.adicionados, ['d3'])
})

test("origem em modo 'all': a lista devolvida é fallback, não escolha da cliente", () => {
  // Tratá-la como escolha faria o assistente confirmar um vínculo que ela
  // nunca fez — e gravá-lo como explícito.
  const r = planMirrorCreation({
    currentPostIds: ['d1', 'd2', 'd3'],
    currentMode: 'all',
    chosenPostIds: ['d1'],
    allPostIds: ['d1', 'd2', 'd3'],
  })
  assert.deepEqual(r.postIds, ['d1'])
  assert.deepEqual(r.jaVinculados, [])
})

test("sair do modo 'all' diz QUEM deixa de receber", () => {
  const r = planMirrorCreation({
    currentPostIds: ['d1', 'd2', 'd3'],
    currentMode: 'all',
    chosenPostIds: ['d1'],
    allPostIds: ['d1', 'd2', 'd3'],
  })
  assert.deepEqual(r.perdeOEnvioParaTodos.sort(), ['d2', 'd3'])
})

test("modo 'explicit' não inventa perda de envio", () => {
  const r = planMirrorCreation({
    currentPostIds: ['d1'],
    currentMode: 'explicit',
    chosenPostIds: ['d2'],
    allPostIds: ['d1', 'd2', 'd3'],
  })
  assert.deepEqual(r.perdeOEnvioParaTodos, [])
})

test('sem destino marcado não há o que salvar', () => {
  assert.equal(planMirrorCreation({ chosenPostIds: [] }).podeSalvar, false)
  assert.equal(planMirrorCreation({ chosenPostIds: ['d1'] }).podeSalvar, true)
})

test('a aba Conexões nasce com uma origem destacada', () => {
  // Sem destaque, o desenho sai com todas as linhas ao mesmo tempo e não se lê.
  const origens = [{ id: 'o1' }, { id: 'o2' }]
  assert.equal(resolveInitialOrigin({ origens }), 'o1')
  // A escolha da cliente é preservada.
  assert.equal(resolveInitialOrigin({ origens, selecionada: 'o2' }), 'o2')
  // Seleção que não existe mais cai na primeira; sem origem, não inventa.
  assert.equal(resolveInitialOrigin({ origens, selecionada: 'sumiu' }), 'o1')
  assert.equal(resolveInitialOrigin({ origens: [] }), null)
})

test('a tela usa a regra pura, não decide a união sozinha', () => {
  assert.ok(page.includes('planMirrorCreation'), 'a tela precisa usar planMirrorCreation')
  assert.ok(page.includes('resolveInitialOrigin'), 'a origem inicial precisa vir da regra')
  // O que vai para o endpoint é o plano, nunca a lista crua do que ela marcou.
  assert.match(page, /updateGroupTargets\(\s*wizardOrigem\.id\s*,\s*wizardPlano\.postIds\s*\)/)
  assert.doesNotMatch(page, /updateGroupTargets\([^)]*wizardDestinos\s*\)/, 'gravou a escolha crua — apaga os vínculos existentes')
})

test('o assistente tem os dois passos, nessa ordem', () => {
  const jsx = page.slice(page.indexOf('return ('))
  assert.match(jsx, /Qual grupo ou canal você quer monitorar\?/)
  assert.match(jsx, /Para qual grupo ou canal você quer que seja enviado\?/)
  assert.ok(
    jsx.indexOf('quer monitorar?') < jsx.indexOf('quer que seja enviado?'),
    'a origem precisa ser perguntada antes do destino',
  )
})

test('o assistente aponta para onde cadastrar e onde editar as regras', () => {
  // Ele não faz nenhuma das duas coisas — sem os links, a cliente fica presa.
  assert.match(page, /cadastre ele em Grupos e Canais/i)
  assert.match(page, /edite os filtros do grupo/i)
  const ajuda = page.slice(page.indexOf('esp-wizard-ajuda'))
  assert.ok((ajuda.match(/href="\/painel\/grupos"/g) || []).length >= 2, 'faltam os links para /painel/grupos')
})

test('a tela NÃO tem aviso de recurso PRO', () => {
  // Espelhamento não é recurso Pro neste produto — o aviso do mockup fica só
  // em Ofertas automáticas, que de fato exige o plano.
  assert.doesNotMatch(page, /Recurso PRO|ProFeaturePaywall/, 'aviso de PRO entrou no espelhamento')
  const item = nav.slice(nav.indexOf("label: 'Espelhamento'"), nav.indexOf("label: 'Ofertas automáticas'"))
  assert.doesNotMatch(item, /pro: true/, 'Espelhamento marcado como Pro na sidebar')
})

test('Ofertas automáticas continua sendo a tela com o bloqueio de plano', () => {
  const ofertas = read('../dashboard/app/painel/ofertas-automaticas/page.js')
  assert.match(ofertas, /ProFeaturePaywall/)
  assert.match(ofertas, /hasProLikeAccess/)
  const item = nav.slice(nav.indexOf("label: 'Ofertas automáticas'"))
  assert.match(item.slice(0, 200), /pro: true/)
})

test('o item se chama "Espelhamento" na sidebar e no painel', () => {
  assert.ok(nav.includes("label: 'Espelhamento'"), 'sidebar não foi renomeada')
  assert.ok(!nav.includes("label: 'Espelhar grupos'"), 'nome antigo continua na sidebar')
  assert.ok(painel.includes("label: 'Espelhamento'"), 'atalho do painel não foi renomeado')
  assert.ok(!painel.includes("label: 'Espelhar grupos'"), 'nome antigo continua no painel')
})

test('a aba Conexões continua existindo, com o alternador Grupos/Conexões', () => {
  // Pedido explícito: a parte de conexões não pode ser apagada.
  assert.match(page, /ConnectionsDiagram/)
  assert.match(page, /setTab\('grupos'\)/)
  assert.match(page, /setTab\('conexoes'\)/)
})

test('linguagem leiga no assistente', () => {
  const bloco = page.slice(page.indexOf('esp-wizard'), page.indexOf('Controle mestre'))
  for (const jargao of ['payload', 'endpoint', 'targetsMode', 'postIds', 'jid', 'API']) {
    assert.ok(!bloco.includes(jargao), `jargão "${jargao}" no texto do assistente`)
  }
})
