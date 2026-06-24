import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layoutSource = readFileSync(new URL('../dashboard/app/layout.js', import.meta.url), 'utf8')

test('dashboard layout não depende de next/font/google no build', () => {
  assert.equal(/^import .*next\/font\/google/m.test(layoutSource), false, 'build do dashboard não pode depender de download do Google Fonts')
  assert.match(layoutSource, /const fontVariables = \{/, 'layout deve expor as mesmas CSS vars de fonte sem fetch externo')
  assert.match(layoutSource, /--font-inter/, 'variável --font-inter deve continuar disponível')
  assert.match(layoutSource, /--font-instrument-serif/, 'variável --font-instrument-serif deve continuar disponível')
  assert.match(layoutSource, /--font-jetbrains-mono/, 'variável --font-jetbrains-mono deve continuar disponível')
})
