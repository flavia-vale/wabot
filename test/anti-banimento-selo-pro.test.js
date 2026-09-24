// FR-020: o selo "PRO" precisa ser TEXTO visível (não só cor), nos três
// lugares: item de menu, título da tela, atalho do painel de destino em
// Espelhamento.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('menu: item "Anti-banimento" tem pro:true e o componente de menu renderiza texto "PRO"', () => {
  const nav = readFileSync(new URL('../dashboard/app/painel/nav.js', import.meta.url), 'utf8')
  const trecho = nav.slice(nav.indexOf("label: 'Anti-banimento'") - 20, nav.indexOf("label: 'Anti-banimento'") + 200)
  assert.match(trecho, /pro:\s*true/)

  const shell = readFileSync(new URL('../dashboard/app/painel/PainelShell.js', import.meta.url), 'utf8')
  assert.match(shell, /item\.pro[\s\S]{0,40}>PRO</, 'o menu precisa renderizar o TEXTO "PRO", não só uma cor')
})

test('título da tela Anti-banimento mostra o texto "PRO"', () => {
  const tabs = readFileSync(new URL('../dashboard/app/painel/anti-banimento/AntiBanimentoTabs.js', import.meta.url), 'utf8')
  assert.match(tabs, />PRO</)
})

test('atalho do painel de destino em Espelhamento mostra o texto "PRO"', () => {
  const source = readFileSync(new URL('../dashboard/app/painel/espelhamento/page.js', import.meta.url), 'utf8')
  assert.match(source, /Ajustar no Anti-banimento PRO/)
})
