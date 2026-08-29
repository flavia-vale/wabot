import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Bug relatado por cliente (2026-08-29): ela desmarcava um destino ("Essência
// do Lar"), salvava, e o grupo continuava recebendo — ao reabrir o editor ele
// estava marcado de novo.
//
// Causa: o modal "Configurar destinos" abria com a lista JÁ clicável enquanto o
// GET /groups/:id/targets ainda estava em vôo. No celular em 4G isso são
// segundos. Quem desmarcasse nessa janela tinha a escolha atropelada pela
// resposta (`setTargetPostIds(ids)` remarcava tudo), e "Salvar destinos"
// gravava a lista da resposta em vez da escolha da cliente.
//
// As travas abaixo são o que impede o bug de voltar.

const page = readFileSync(new URL('../dashboard/app/painel/grupos/page.js', import.meta.url), 'utf8')

test('a lista de destinos só fica clicável depois que a resposta chega', () => {
  assert.match(page, /targetLoading \? \(\s*<p className="pnl-hint"[^>]*>Carregando os destinos deste grupo…<\/p>/)
  // O aviso de "todos os destinos" também não pode aparecer antes da resposta:
  // ele descreve um estado que ainda não foi carregado.
  assert.match(page, /!targetLoading && targetMode === 'all'/)
})

test('resposta de uma abertura antiga não sobrescreve a escolha em andamento', () => {
  assert.match(page, /const targetRequestRef = useRef\(0\)/)
  assert.match(page, /const requestId = \+\+targetRequestRef\.current/)
  assert.match(page, /if \(targetRequestRef\.current !== requestId\) return/)
})

test('abrir o editor de outro monitor não herda a seleção do anterior', () => {
  const openBody = page.slice(page.indexOf('async function openTargetEditor'), page.indexOf('function toggleTargetPost'))
  assert.match(openBody, /setTargetPostIds\(\[\]\)/)
  assert.ok(
    openBody.indexOf('setTargetPostIds([])') < openBody.indexOf('await api.groupTargets'),
    'a limpeza precisa vir ANTES do fetch, senão o modal mostra a escolha do monitor anterior',
  )
})

test('salvar manda só destinos que ainda existem e mostra a falha dentro do modal', () => {
  const saveBody = page.slice(page.indexOf('async function saveTargetPosts'), page.indexOf('async function handleLoadWA'))
  assert.match(saveBody, /post\.some\(\(p\) => p\.id === id\)/)
  assert.match(saveBody, /api\.updateGroupTargets\(targetEditorId, idsToSave\)/)
  assert.match(saveBody, /setTargetError\(err\.message\)/)
  // Salvar duas vezes (toque duplo no celular) não pode disparar dois PUTs, e
  // salvar não pode acontecer antes de a lista ter chegado.
  assert.match(saveBody, /if \(!targetEditorId \|\| targetLoading \|\| targetSaving\) return/)
  assert.match(page, /targetError && \(/)
})
