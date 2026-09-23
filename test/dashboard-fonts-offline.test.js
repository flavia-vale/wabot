import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layoutSource = readFileSync(new URL('../dashboard/app/layout.js', import.meta.url), 'utf8')

test('dashboard layout não depende de next/font/google no build', () => {
  assert.equal(/^import .*next\/font\/google/m.test(layoutSource), false, 'build do dashboard não pode depender de download do Google Fonts')
  assert.match(layoutSource, /const fontVariables = \{/, 'layout deve expor as mesmas CSS vars de fonte sem fetch externo')
  assert.match(layoutSource, /--font-inter/, 'variável --font-inter deve continuar disponível')
  // 2026-09-23: o serif saiu — títulos e números usam a Figtree em 900 (test/fonte-figtree.test.js).
  assert.doesNotMatch(layoutSource, /--font-instrument-serif/, 'o serif foi aposentado; destaque é Figtree 900')
  // 2026-09-23: fonte de código também saiu — o site inteiro usa só a Figtree.
  assert.doesNotMatch(layoutSource, /--font-jetbrains-mono/, 'fonte única: sem fonte de código')
})
