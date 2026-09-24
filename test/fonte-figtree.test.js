// Fonte única do site (2026-09-23): Figtree em todas as páginas, com os pesos
// do card de Plano — 900 em títulos, preços e números; 400 no texto. Antes não
// havia fonte carregada (cada aparelho usava a sua) e Plano, Envios e o site
// público misturavam um serif itálico.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (p) => readFileSync(join(root, p), 'utf8')

test('Figtree hospedada no próprio dashboard e declarada no @font-face', () => {
  const size = statSync(join(root, 'dashboard/public/fonts/figtree-latin.woff2')).size
  assert.ok(size > 10_000 && size < 60_000, `woff2 com tamanho inesperado: ${size}`)
  const css = read('dashboard/app/globals.css')
  assert.match(css, /@font-face\s*{[^}]*font-family:\s*'Figtree'[^}]*font-weight:\s*300 900[^}]*url\('\/fonts\/figtree-latin\.woff2'\)/)
  assert.match(read('dashboard/app/layout.js'), /'--font-inter':\s*'Figtree,/)
  assert.doesNotMatch(read('dashboard/app/layout.js'), /from ['"]next\/font/)
  // font-mono do Tailwind e code/pre/kbd do navegador também caem na Figtree.
  assert.match(css, /--font-mono:\s*var\(--font-sans\)/)
  assert.match(css, /code, kbd, samp, pre\s*{\s*font-family:\s*inherit;/)
})

test('uma fonte só: nenhum serif nem fonte de código no site, painel e admin', () => {
  const files = []
  const walk = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (['node_modules', '.next', 'public'].includes(entry.name)) continue
      const rel = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(rel)
      else if (/\.(js|jsx|mjs|css)$/.test(entry.name)) files.push(rel)
    }
  }
  walk('dashboard/app'); walk('dashboard/components')
  for (const file of files) {
    const src = read(file)
    assert.doesNotMatch(src, /instrument-serif|Instrument Serif|Georgia/, file)
    if (file !== 'dashboard/app/globals.css') assert.doesNotMatch(src, /jetbrains|monospace|\bfont-mono\b/, file)
  }
})

test('títulos e números em 900', () => {
  const painel = read('dashboard/app/painel/painel.css')
  for (const sel of ['.pnl-header h1', '.pnl-kpi-num', '.pnl-price-now', '.pnl-pro-stat-n']) {
    const rule = painel.match(new RegExp(`${sel.replace(/\./g, '\\.')}\\s*{([^}]*)}`))
    assert.ok(rule, sel)
    assert.match(rule[1], /font-weight:\s*900/, sel)
  }
  assert.match(painel, /\.pnl-serif\s*{[^}]*font-family:\s*inherit;[^}]*font-weight:\s*900/)
  assert.match(read('dashboard/app/landing.css'), /\.landing-root \.serif\s*{[^}]*font-weight:\s*900/)
})
