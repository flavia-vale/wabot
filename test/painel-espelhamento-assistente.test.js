/* Guarda do que o antigo assistente "Criar novo espelhamento" protegia.
 *
 * O assistente existiu por um dia (2026-09-19) e saiu no mesmo dia, quando a
 * tela de Grupos foi absorvida pelo Espelhamento: a escolha de destinos virou
 * a PRIMEIRA ABA do painel lateral da origem, e dois caminhos para a mesma
 * coisa confundiriam mais do que ajudariam. O que ele protegia, porém, não
 * mudou de natureza — só de lugar, e é aqui que continua verificado.
 *
 * As duas formas de estragar o espelhamento de alguém por este caminho:
 *
 * 1. mandar ao `PUT /api/groups/:id/targets` a lista crua do que está na tela
 *    sem passar pela regra — o endpoint SUBSTITUI a lista da origem;
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

test('criar SOMA aos destinos que a origem já tinha, nunca substitui', () => {
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

test('a origem destacada é DERIVADA no render, nunca gravada por efeito', () => {
  // Gravá-la num `useEffect` dispara renderização em cascata (a regra
  // `react-hooks/set-state-in-effect` reprovou exatamente isso no gate da PR) e
  // ainda deixa um quadro com nada destacado antes do efeito rodar.
  assert.match(page, /const origemDestacada = /, 'a origem destacada precisa ser derivada no render')
  const efeitos = page.split('useEffect(').slice(1)
  for (const corpo of efeitos) {
    assert.ok(
      !corpo.slice(0, corpo.indexOf('}, [')).includes('setSelectedOriginId'),
      'setSelectedOriginId voltou para dentro de um useEffect',
    )
  }
})

test('a tela usa a regra pura, não decide a lista sozinha', () => {
  assert.ok(page.includes('planMirrorCreation'), 'a tela precisa usar planMirrorCreation')
  assert.ok(page.includes('resolveInitialOrigin'), 'a origem inicial precisa vir da regra')
  // O que vai para o endpoint sai do plano, nunca do rascunho cru da tela.
  const save = page.slice(page.indexOf('const saveTargets = useCallback'), page.indexOf('const targetsHandlers'))
  assert.match(save, /const idsToSave = planMirrorCreation\(/, 'a lista salva precisa vir do plano')
  assert.match(save, /modo: 'editar'/, 'o painel EDITA: desmarcar é remoção deliberada, não união')
  assert.match(save, /api\.updateGroupTargets\(groupId, idsToSave\)/)
  assert.doesNotMatch(save, /updateGroupTargets\([^)]*draftIds\s*\)/, 'gravou a escolha crua, sem passar pela regra')
})

test('o painel da origem abre pela pergunta que a cliente faz primeiro', () => {
  // "Para onde esse grupo envia" é a primeira aba; captura e publicação vêm
  // depois. Invertida, a tela abre num ajuste fino antes de responder o
  // essencial — que é o que o assistente perguntava no passo 1.
  const abas = page.slice(page.indexOf('const ORIGIN_TABS'), page.indexOf('const DEST_TABS'))
  const ordem = [...abas.matchAll(/key: '([a-z]+)'/g)].map((m) => m[1])
  assert.deepEqual(ordem, ['destinos', 'captura', 'publicacao'])
  assert.match(page, /Para onde esse grupo envia/)
})

test('cadastrar grupo e editar as regras acontecem NA PRÓPRIA tela', () => {
  // O assistente precisava apontar para /painel/grupos porque não fazia
  // nenhuma das duas coisas. Agora as duas moram aqui, e mandar a cliente para
  // fora seria mandá-la para uma rota que só redireciona de volta.
  assert.match(page, /AddGroupModal/, 'faltou o modal de adicionar grupo/canal')
  assert.match(page, /api\.addGroup\(/, 'a tela precisa cadastrar o grupo escolhido')
  assert.match(page, /<MonitorGroupConfig/, 'as regras do grupo precisam abrir aqui')
  assert.doesNotMatch(page, /href="\/painel\/grupos"/, 'link para a tela que deixou de existir')
})

test('os avisos do assistente sobreviveram à mudança de lugar', () => {
  // Cada um destes existia para a cliente VER antes de salvar, nunca descobrir
  // depois com um destino que parou de receber.
  assert.match(page, /plano\?\.perdeOEnvioParaTodos\?\.length > 0/, 'sumiu o aviso de quem deixa de receber ao sair do padrão')
  assert.match(page, /plano\?\.ficaSemDestino/, 'sumiu o aviso de origem que fica sem destino')
  assert.match(page, /plano\?\.removidos\?\.length > 0/, 'sumiu o aviso de destino removido')
  assert.match(page, /Ao salvar esta escolha, ela passa a enviar/)
  assert.match(page, /para de publicar em qualquer lugar/)
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

test('as conexões continuam existindo abaixo dos grupos, sem alternador de página', () => {
  // Pedido explícito: a parte de conexões não pode ser apagada, mas agora deve
  // ficar visível na mesma página, depois das duas colunas de grupos.
  assert.match(page, /ConnectionsDiagram/)
  assert.doesNotMatch(page, /setTab\('grupos'\)/)
  assert.doesNotMatch(page, /setTab\('conexoes'\)/)
  assert.ok(
    page.indexOf('className="pnl-card pnl-esp-connections"') > page.indexOf('className="pnl-grid pnl-esp-cols"'),
    'as conexões precisam vir depois das listas de grupos',
  )
})

test('o mapa leva para a edição dos destinos daquela origem', () => {
  // Sem isto, o mapa de conexões só mostra o problema e não deixa consertar — era
  // o buraco que o botão "Editar" do assistente tapava.
  assert.match(page, /Editar para onde/)
  assert.match(page, /openDrawerFor\(origemDestacada, 'monitor', 'destinos'\)/)
})

test('linguagem leiga no painel do grupo', () => {
  // Só o JSX: comentário e nome de variável podem (e devem) ser técnicos.
  const bloco = page.slice(page.indexOf('function MonitorGroupConfig('), page.indexOf('/* ── Nível 1'))
  const textoVisivel = (bloco.match(/>[^<>{}]{4,}</g) || []).join(' ')
  for (const jargao of ['payload', 'endpoint', 'targetsMode', 'postIds', 'jid', 'imageMode']) {
    assert.ok(!textoVisivel.includes(jargao), `jargão "${jargao}" no texto da tela`)
  }
})
