/* Primeiro espelhamento sem beco sem saída (2026-09-24).
 *
 * Quem cadastrava a PRIMEIRA origem caía na aba Destinos com o aviso "cadastre
 * ao menos um destino" e nenhum botão: precisava fechar o painel, achar o
 * "+ Adicionar" da outra coluna e voltar. Agora o destino é adicionado ali
 * mesmo, pelo atalho "Adicionar novo grupo de destino".
 *
 * Guardas estruturais (a página não é renderizada nos testes):
 *  - o aviso sem saída não volta;
 *  - o atalho nasce aberto quando não há destino;
 *  - origem em modo 'all' não é congelada em 'explicit' por causa do atalho;
 *  - alteração pendente na lista não é salva junto com o novo destino;
 *  - grupo que já é origem não é oferecido como destino.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../dashboard/app/painel/espelhamento/page.js', import.meta.url), 'utf8')

const handler = (() => {
  const start = page.indexOf('async function handleQuickAddDestination(')
  assert.ok(start > 0, 'handleQuickAddDestination precisa existir')
  const end = page.indexOf('async function handleAddFromWA(', start)
  return page.slice(start, end)
})()

test('o aviso sem botão da aba Destinos não volta', () => {
  assert.doesNotMatch(page, /Cadastre ao menos um grupo de destino para escolher/)
})

test('o atalho de destino aparece na aba Destinos e nasce aberto sem destino', () => {
  assert.match(page, /function QuickAddDestination\(/)
  assert.match(page, /<QuickAddDestination[\s\S]{0,300}startOpen=\{post\.length === 0\}/)
  assert.match(page, /Adicionar novo grupo de destino/)
})

test('o atalho cadastra como DESTINO', () => {
  assert.match(handler, /api\.addGroup\(g\.waJid, g\.name, 'post'\)/)
})

test("origem em modo 'all' não é gravada: só recarrega os vínculos", () => {
  const allBranch = handler.slice(handler.indexOf("current.mode === 'all'"))
  const beforeReturn = allBranch.slice(0, allBranch.indexOf('return'))
  assert.match(beforeReturn, /loadTargets\(originId, \{ force: true \}\)/)
  assert.doesNotMatch(beforeReturn, /updateGroupTargets/)
})

test('com alterações não salvas, o novo destino só entra no rascunho', () => {
  const dirtyBranch = handler.slice(handler.indexOf('if (dirty)'))
  const beforeReturn = dirtyBranch.slice(0, dirtyBranch.indexOf('return'))
  assert.match(beforeReturn, /draftIds:/)
  assert.doesNotMatch(beforeReturn, /updateGroupTargets/)
})

test('a gravação passa pela regra pura, nunca pela lista crua', () => {
  const save = handler.indexOf('updateGroupTargets')
  const rule = handler.indexOf("planMirrorCreation(")
  assert.ok(rule > 0 && rule < save, 'planMirrorCreation precisa vir antes do PUT')
  assert.match(handler, /modo: 'editar'/)
})

test('grupo que já é origem não é oferecido como destino', () => {
  assert.match(page, /monitorJids\.has\(g\.waJid\)[\s\S]{0,800}é uma origem/)
})

test('linguagem leiga no atalho', () => {
  const start = page.indexOf('function QuickAddDestination(')
  const comp = page.slice(start, page.indexOf('/* ── Texto da marca', start))
  const visible = comp.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  for (const jargao of [/\bmonitor\b/i, /\bjid\b/i, />[^<]*\bpost\b/i, /role/]) {
    assert.doesNotMatch(visible.replace(/role="\w+"/g, ''), jargao)
  }
})
