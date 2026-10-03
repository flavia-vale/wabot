import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Pedido da dona do produto (2026-10-03): Premium fora do /painel/plano e tela
// Aplicativos fora da produção. Só esconde a tela; o backend segue igual.
const read = (p) => readFileSync(new URL(`../dashboard/${p}`, import.meta.url), 'utf8')

test('Premium escondido do /painel/plano', () => {
  assert.match(read('lib/featureVisibility.js'), /export const SHOW_PREMIUM_PLAN = false/)
  assert.match(read('app/painel/plano/page.js'), /\.concat\(SHOW_PREMIUM_PLAN \? \[PREMIUM_PLAN_CARD\] : \[\]\)/)
})

test('Aplicativos some do menu e da rota só quando o build é de produção', () => {
  const vis = read('lib/featureVisibility.js')
  assert.match(vis, /process\.env\.NEXT_PUBLIC_APP_ENV === 'production'/)
  assert.match(vis, /SHOW_APPS_SCREEN = !IS_PRODUCTION_BUILD/)
  assert.match(read('next.config.mjs'), /NEXT_PUBLIC_APP_ENV: process\.env\.APP_ENV/)
  assert.match(read('app/painel/nav.js'), /href: '\/painel\/aplicativos',\n\s+hidden: !SHOW_APPS_SCREEN/)
  assert.match(read('app/painel/nav.js'), /items: group\.items\.filter\(\(item\) => !item\.hidden\)/)
  assert.match(read('app/painel/aplicativos/page.js'), /if \(!SHOW_APPS_SCREEN\) redirect\('\/painel'\)/)
})
