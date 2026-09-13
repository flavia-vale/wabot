import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Bug relatado por cliente (2026-08-29): ela desmarcava um destino ("Essência
// do Lar"), salvava, e o grupo continuava recebendo — ao reabrir, marcado de
// novo.
//
// Causa: a lista de destinos ficava clicável enquanto o GET /groups/:id/targets
// ainda estava em vôo. No celular em 4G isso são segundos. Quem desmarcasse
// nessa janela tinha a escolha atropelada pela resposta, e o salvar gravava a
// lista da resposta em vez da escolha da cliente.
//
// A escolha também saiu do modal e passou a viver na própria tela do grupo,
// com o salvar ao lado da lista. As travas abaixo são o que impede a volta do
// bug e da usabilidade antiga.

const page = readFileSync(new URL('../dashboard/app/painel/grupos/page.js', import.meta.url), 'utf8')
const css = readFileSync(new URL('../dashboard/app/painel/painel.css', import.meta.url), 'utf8')

test('a escolha de destinos acontece na própria tela, sem janelinha', () => {
  assert.match(page, /<DestinationPicker/)
  assert.doesNotMatch(page, /Editor de alvos \(modal\)/)
  // Nenhum overlay de tela cheia sobrou para os destinos.
  assert.doesNotMatch(page, /targetEditorId/)
})

test('o salvar fica junto da lista, e só age quando há mudança de verdade', () => {
  const picker = page.slice(page.indexOf('function DestinationPicker'), page.indexOf('/* ── Monitor group config panel'))
  assert.match(picker, /className="cfg-dest-actions"/)
  assert.match(picker, /onClick=\{\(\) => onSave\(groupId\)\}/)
  assert.match(picker, /disabled=\{saving \|\| !dirty\}/)
  // "Desfazer" só aparece com alteração pendente — e a pessoa precisa ver que
  // existe alteração pendente.
  assert.match(picker, /Alterações ainda não salvas/)
  assert.match(picker, /dirty && \(/)
})

test('nada é clicável antes de a lista chegar', () => {
  const picker = page.slice(page.indexOf('function DestinationPicker'), page.indexOf('/* ── Monitor group config panel'))
  assert.match(picker, /const ready = Array\.isArray\(state\?\.savedIds\)/)
  assert.match(picker, /if \(!ready\) \{/)
  assert.match(picker, /Carregando os destinos deste grupo…/)
  // Defesa em profundidade: mesmo que a lista escape, o toggle recusa marcar
  // enquanto não há resposta do servidor.
  assert.match(page, /if \(!current \|\| !Array\.isArray\(current\.savedIds\)\) return prev/)
})

test('resposta de um carregamento antigo não sobrescreve a escolha em andamento', () => {
  assert.match(page, /const targetRequestRef = useRef\(\{\}\)/)
  assert.match(page, /targetRequestRef\.current\[groupId\] = requestId/)
  assert.match(page, /if \(targetRequestRef\.current\[groupId\] !== requestId\) return/)
  // Reabrir o painel não pode refazer o GET por cima de uma escolha ainda não
  // salva.
  assert.match(page, /if \(!force && current && \(current\.loading \|\| Array\.isArray\(current\.savedIds\)\)\) skip = true/)
})

test('salvar manda só destinos que ainda existem e mostra a falha ao lado do botão', () => {
  const save = page.slice(page.indexOf('const saveTargets = useCallback'), page.indexOf('const targetsHandlers'))
  assert.match(save, /post\.some\(\(p\) => p\.id === id\)/)
  assert.match(save, /api\.updateGroupTargets\(groupId, idsToSave\)/)
  assert.match(save, /patchTargets\(groupId, \{ saving: false, error: err\.message \}\)/)
  // Toque duplo no celular não pode disparar dois PUTs.
  assert.match(save, /if \(!current \|\| current\.loading \|\| current\.saving/)
})

test('a tela diz a verdade sobre lista vazia (vazio = não envia para ninguém)', () => {
  const picker = page.slice(page.indexOf('function DestinationPicker'), page.indexOf('/* ── Monitor group config panel'))
  assert.match(picker, /draft\.length === 0 && \(/)
  // Salvar sem nenhum marcado guarda a escolha vazia: a origem para de enviar.
  // Dizer que ela "envia para todos" era o texto do comportamento antigo, que
  // fazia a tela remarcar tudo ao reabrir.
  assert.match(picker, /não envia para lugar nenhum/)
  assert.doesNotMatch(picker, /envia para <strong>todos<\/strong> os seus destinos/)
})

test('salvar destinos guarda a escolha como explícita, inclusive vazia', () => {
  const save = page.slice(page.indexOf('const saveTargets = useCallback'), page.indexOf('const targetsHandlers'))
  assert.match(save, /mode: 'explicit'/)
  assert.doesNotMatch(save, /idsToSave\.length \? 'explicit' : 'all'/)
})

test('a linha inteira do destino é clicável, com alvo de toque grande', () => {
  assert.match(css, /\.cfg-dest-option \{[^}]*min-height: 46px/s)
  assert.match(css, /\.cfg-dest-option input \{[^}]*width: 19px/s)
  assert.match(css, /\.cfg-dest-option\.is-on \{/)
})

test('fechar o painel com destino mexido e não salvo não é silencioso', () => {
  assert.match(page, /const targetsDirty = Boolean\(targetState && Array\.isArray\(targetState\.savedIds\)/)
  assert.match(page, /destinos não salvos/)
})

test('post/monitor são declarados antes dos callbacks que os usam como dependência', () => {
  // O build passa e a página quebra em runtime: `post` entra na lista de
  // dependências de useCallback, e lista de dependência é avaliada na hora.
  // Declarado mais abaixo, vira "Cannot access 'post' before initialization" e
  // a tela inteira mostra "This page couldn't load".
  const decl = page.indexOf("const post = groups.filter")
  const useInDeps = page.indexOf("}, [post])")
  assert.ok(decl > 0 && useInDeps > 0)
  assert.ok(decl < useInDeps, 'declare post/monitor antes dos useCallback que dependem deles')
})
