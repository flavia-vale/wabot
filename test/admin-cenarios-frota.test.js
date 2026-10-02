// Guarda estrutural da Fase 1B do plano de recepção (RCA 2026-08-26): a visão
// de quantas clientes estão em cada cenário tem que estar na PRIMEIRA tela do
// admin, não escondida numa aba — e cada card leva para a lista já filtrada.
// Os números vêm do banco; aqui travamos a fiação, que é o que some num
// refactor distraído.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const adminRoute = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
const adminPage = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')
const onlinePage = readFileSync(new URL('../dashboard/app/admin/online/page.js', import.meta.url), 'utf8')

test('a rota expõe os cinco cenários da frota', () => {
  assert.match(adminRoute, /async function buildFleetScenarios/)
  for (const campo of ['semReceber', 'caindoDemais', 'clienteAgiu', 'fonteQuebrada', 'offlineMs24h']) {
    assert.match(adminRoute, new RegExp(campo), `cenário ${campo} sumiu da rota`)
  }
})

test('o cenário "sem receber" vem do sinal durável de recepção cega', () => {
  assert.match(adminRoute, /ops_wa_reception_blind/)
})

test('a aba online aceita filtro por cenário', () => {
  assert.match(adminRoute, /scenarioUserIds/)
  assert.match(adminRoute, /if \(scenarioUserIds && !scenarioUserIds\.has\(row\.id\)\) return false/)
})

test('os conjuntos de usuários por cenário NÃO vazam na resposta', () => {
  // byScenario é Set (não serializa) e é dado interno de filtro.
  assert.match(adminRoute, /const \{ byScenario: _byScenario, \.\.\.scenarioCounts \}/)
})

test('os cards de cenário estão na primeira tela e são clicáveis', () => {
  assert.match(adminPage, /Sem receber/)
  assert.match(adminPage, /Caindo demais/)
  assert.match(adminPage, /Cliente teve que agir/)
  assert.match(adminPage, /Fonte dessincronizada/)
  assert.doesNotMatch(adminPage, /Offline acumulado 24h/)
  assert.match(adminPage, /function openScenario/)
})

test('o drill-down mostra a linha do tempo e separa quem voltou sozinho', () => {
  assert.match(onlinePage, /Linha do tempo das quedas/)
  assert.match(onlinePage, /voltou sozinho/)
  assert.match(onlinePage, /o cliente teve que agir/)
  assert.match(onlinePage, /Parado até o cliente agir/)
})
